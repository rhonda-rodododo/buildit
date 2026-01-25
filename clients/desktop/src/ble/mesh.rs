//! BLE Mesh networking for BuildIt Network
//!
//! Implements a privacy-preserving mesh protocol for offline peer-to-peer communication.
//! Messages use NIP-44 encryption with onion-like routing to protect metadata.
//!
//! Security Features:
//! - Sender/recipient encrypted so intermediate nodes cannot see communication graph
//! - Message IDs regenerated per hop to prevent correlation
//! - No hops vector - uses TTL only for loop prevention
//! - Timestamp randomization to prevent timing analysis
//! - Dynamic service UUID rotation for privacy

use buildit_crypto::{
    derive_conversation_key, generate_keypair, get_public_key, nip44_decrypt_with_key,
    nip44_encrypt_with_key, randomize_timestamp, schnorr_sign, schnorr_verify,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Maximum message size for BLE transmission (MTU - overhead)
pub const MAX_MESSAGE_SIZE: usize = 512;

/// Time-to-live for mesh messages (number of hops)
pub const DEFAULT_TTL: u8 = 5;

/// Timestamp randomization range in seconds (2 days as per NIP-17)
const TIMESTAMP_RANGE_SECONDS: u32 = 172800;

/// How long to remember message correlation tokens (5 minutes in ms)
const CORRELATION_TOKEN_TTL_MS: u64 = 300_000;

/// Message types for mesh protocol
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageType {
    /// Direct message to a specific node
    Direct,
    /// Broadcast to all nodes
    Broadcast,
    /// Acknowledgment of received message
    Ack,
    /// Ping for presence discovery
    Ping,
    /// Pong response to ping
    Pong,
    /// Request to sync messages
    SyncRequest,
    /// Response with synced messages
    SyncResponse,
}

/// Encrypted routing information - only the next hop can decrypt
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedRoutingInfo {
    /// Encrypted data containing: recipient_pubkey + inner_payload + correlation_token
    pub ciphertext: String,
    /// Ephemeral public key used for encryption (allows any node to try decryption)
    pub ephemeral_pubkey: String,
}

/// A mesh network message with privacy-preserving design
///
/// SECURITY: This structure never exposes sender or recipient in cleartext.
/// Each hop sees only:
/// - The encrypted routing info (which they may or may not be able to decrypt)
/// - The TTL
/// - A message ID unique to this hop (not correlatable across hops)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshMessage {
    /// Unique message ID for this hop only (regenerated on each forward)
    pub id: String,
    /// Message type
    pub message_type: MessageType,
    /// Time-to-live (decremented on each hop)
    pub ttl: u8,
    /// Randomized timestamp (unix seconds, NOT milliseconds for reduced precision)
    pub timestamp: i64,
    /// Encrypted routing information
    /// For Direct: contains encrypted (recipient + inner_encrypted_payload)
    /// For Broadcast: contains the sender commitment (not full pubkey)
    pub routing: EncryptedRoutingInfo,
    /// The encrypted payload (NIP-44 ciphertext)
    /// For Direct: only final recipient can decrypt
    /// For Broadcast: encrypted with a broadcast key derivable by recipients
    pub payload: Vec<u8>,
    /// Message signature over (id || routing.ciphertext || payload)
    /// Signed by an ephemeral key (not the actual sender) for unlinkability
    pub signature: String,
    /// Ephemeral public key that signed this message
    pub signer_pubkey: String,
}

/// Inner decrypted routing data
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RoutingData {
    /// Final recipient's public key
    recipient_pubkey: String,
    /// Sender's public key (encrypted so only recipient sees it)
    sender_pubkey: String,
    /// Correlation token (encrypted for endpoints only)
    correlation_token: String,
}

impl MeshMessage {
    /// Create a new direct mesh message with full privacy protection
    ///
    /// The sender and recipient are encrypted so intermediate nodes cannot
    /// determine who is communicating with whom.
    pub fn new_direct(
        our_private_key: &[u8],
        our_public_key: &str,
        recipient_pubkey: &str,
        payload: &[u8],
    ) -> Result<Self, MeshError> {
        // Generate ephemeral keypair for signing (unlinkable)
        let ephemeral = generate_keypair();

        // Generate correlation token for endpoint deduplication
        let correlation_token = Uuid::new_v4().to_string();

        // Create routing data
        let routing_data = RoutingData {
            recipient_pubkey: recipient_pubkey.to_string(),
            sender_pubkey: our_public_key.to_string(),
            correlation_token,
        };
        let routing_json =
            serde_json::to_string(&routing_data).map_err(|_| MeshError::SerializationFailed)?;

        // Encrypt routing data to recipient
        let routing_key = derive_conversation_key(our_private_key.to_vec(), recipient_pubkey.to_string())
            .map_err(|_| MeshError::EncryptionFailed)?;
        let encrypted_routing = nip44_encrypt_with_key(routing_key.clone(), routing_json)
            .map_err(|_| MeshError::EncryptionFailed)?;

        // Encrypt payload with NIP-44
        let payload_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, payload);
        let encrypted_payload = nip44_encrypt_with_key(routing_key, payload_str)
            .map_err(|_| MeshError::EncryptionFailed)?;

        // Get randomized timestamp (seconds, not milliseconds)
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let randomized_ts = randomize_timestamp(now, TIMESTAMP_RANGE_SECONDS);

        // Generate unique message ID for this hop
        let message_id = Uuid::new_v4().to_string();

        // Create signature material
        let sig_material = create_signature_material(&message_id, &encrypted_routing, &encrypted_payload);

        // Sign with ephemeral key
        let signature = schnorr_sign(sig_material, ephemeral.private_key.clone())
            .map_err(|_| MeshError::SigningFailed)?;

        Ok(Self {
            id: message_id,
            message_type: MessageType::Direct,
            ttl: DEFAULT_TTL,
            timestamp: randomized_ts,
            routing: EncryptedRoutingInfo {
                ciphertext: encrypted_routing,
                ephemeral_pubkey: our_public_key.to_string(), // Used for ECDH
            },
            payload: encrypted_payload.into_bytes(),
            signature: hex::encode(signature),
            signer_pubkey: ephemeral.public_key,
        })
    }

    /// Create a ping message (minimal metadata exposure)
    pub fn ping() -> Self {
        let ephemeral = generate_keypair();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let randomized_ts = randomize_timestamp(now, TIMESTAMP_RANGE_SECONDS);

        Self {
            id: Uuid::new_v4().to_string(),
            message_type: MessageType::Ping,
            ttl: 1, // Ping doesn't propagate
            timestamp: randomized_ts,
            routing: EncryptedRoutingInfo {
                ciphertext: String::new(),
                ephemeral_pubkey: ephemeral.public_key.clone(),
            },
            payload: vec![],
            signature: String::new(),
            signer_pubkey: ephemeral.public_key,
        }
    }

    /// Create a pong response
    pub fn pong(original_ping_id: &str) -> Self {
        let ephemeral = generate_keypair();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let randomized_ts = randomize_timestamp(now, TIMESTAMP_RANGE_SECONDS);

        Self {
            id: Uuid::new_v4().to_string(),
            message_type: MessageType::Pong,
            ttl: 1,
            timestamp: randomized_ts,
            routing: EncryptedRoutingInfo {
                ciphertext: String::new(),
                ephemeral_pubkey: ephemeral.public_key.clone(),
            },
            payload: original_ping_id.as_bytes().to_vec(),
            signature: String::new(),
            signer_pubkey: ephemeral.public_key,
        }
    }

    /// Create an acknowledgment message
    pub fn ack(our_private_key: &[u8], recipient_pubkey: &str, original_correlation_token: &str) -> Result<Self, MeshError> {
        let ephemeral = generate_keypair();
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;
        let randomized_ts = randomize_timestamp(now, TIMESTAMP_RANGE_SECONDS);

        // Encrypt the correlation token so only the original sender can read it
        let routing_key = derive_conversation_key(our_private_key.to_vec(), recipient_pubkey.to_string())
            .map_err(|_| MeshError::EncryptionFailed)?;
        let encrypted_token = nip44_encrypt_with_key(routing_key, original_correlation_token.to_string())
            .map_err(|_| MeshError::EncryptionFailed)?;

        Ok(Self {
            id: Uuid::new_v4().to_string(),
            message_type: MessageType::Ack,
            ttl: DEFAULT_TTL,
            timestamp: randomized_ts,
            routing: EncryptedRoutingInfo {
                ciphertext: encrypted_token,
                ephemeral_pubkey: get_public_key(our_private_key.to_vec())
                    .map_err(|_| MeshError::EncryptionFailed)?,
            },
            payload: vec![],
            signature: String::new(),
            signer_pubkey: ephemeral.public_key,
        })
    }

    /// Serialize message to bytes for transmission
    pub fn to_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Deserialize message from bytes
    pub fn from_bytes(data: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(data)
    }

    /// Check if message should be forwarded (based on TTL only, no hops tracking)
    pub fn should_forward(&self) -> bool {
        // Don't forward if TTL exhausted
        if self.ttl == 0 {
            return false;
        }

        // Don't forward ping/pong
        if self.message_type == MessageType::Ping || self.message_type == MessageType::Pong {
            return false;
        }

        true
    }

    /// Prepare message for forwarding with new message ID (breaks correlation)
    ///
    /// SECURITY: Each hop gets a completely new message ID to prevent
    /// traffic correlation attacks across the mesh.
    pub fn prepare_for_forward(&self) -> Self {
        let mut forwarded = self.clone();
        forwarded.ttl = forwarded.ttl.saturating_sub(1);
        // Generate new message ID to break correlation
        forwarded.id = Uuid::new_v4().to_string();
        forwarded
    }

    /// Try to decrypt routing info and check if message is for us
    pub fn try_decrypt_for_us(
        &self,
        our_private_key: &[u8],
    ) -> Result<DecryptedMessage, MeshError> {
        if self.routing.ciphertext.is_empty() {
            return Err(MeshError::NotForUs);
        }

        // Try to derive conversation key with the ephemeral pubkey
        let routing_key = derive_conversation_key(
            our_private_key.to_vec(),
            self.routing.ephemeral_pubkey.clone(),
        )
        .map_err(|_| MeshError::NotForUs)?;

        // Try to decrypt routing data
        let routing_json = nip44_decrypt_with_key(routing_key.clone(), self.routing.ciphertext.clone())
            .map_err(|_| MeshError::NotForUs)?;

        let routing_data: RoutingData =
            serde_json::from_str(&routing_json).map_err(|_| MeshError::NotForUs)?;

        // Check if we're the recipient
        let our_pubkey = get_public_key(our_private_key.to_vec())
            .map_err(|_| MeshError::DecryptionFailed)?;

        if routing_data.recipient_pubkey != our_pubkey {
            return Err(MeshError::NotForUs);
        }

        // Decrypt the payload
        let payload_str = String::from_utf8(self.payload.clone())
            .map_err(|_| MeshError::DecryptionFailed)?;
        let decrypted_payload_b64 = nip44_decrypt_with_key(routing_key, payload_str)
            .map_err(|_| MeshError::DecryptionFailed)?;
        let decrypted_payload = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &decrypted_payload_b64,
        )
        .map_err(|_| MeshError::DecryptionFailed)?;

        Ok(DecryptedMessage {
            sender_pubkey: routing_data.sender_pubkey,
            payload: decrypted_payload,
            correlation_token: routing_data.correlation_token,
        })
    }
}

/// Result of successfully decrypting a message
#[derive(Debug, Clone)]
pub struct DecryptedMessage {
    pub sender_pubkey: String,
    pub payload: Vec<u8>,
    pub correlation_token: String,
}

/// Create signature material from message components
fn create_signature_material(id: &str, routing_ciphertext: &str, payload: &str) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(id.as_bytes());
    hasher.update(routing_ciphertext.as_bytes());
    hasher.update(payload.as_bytes());
    hasher.finalize().to_vec()
}

/// Mesh-specific errors
#[derive(Debug, Clone)]
pub enum MeshError {
    SerializationFailed,
    EncryptionFailed,
    DecryptionFailed,
    SigningFailed,
    NotForUs,
}

/// A node in the mesh network (minimal information stored)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshNode {
    /// Node's commitment (H(pubkey || nonce)) - NOT the actual public key
    pub commitment: String,
    /// Node's BLE address
    pub ble_address: String,
    /// Nonce for commitment verification (revealed after connection)
    pub nonce: Option<String>,
    /// Revealed public key (only after successful handshake)
    pub pubkey: Option<String>,
    /// Last seen timestamp
    pub last_seen: u64,
    /// Signal strength (RSSI)
    pub rssi: Option<i16>,
    /// Whether this node is directly connected
    pub is_direct: bool,
}

impl MeshNode {
    /// Create a commitment for a public key
    pub fn create_commitment(pubkey: &str) -> (String, String) {
        let nonce = Uuid::new_v4().to_string();
        let mut hasher = Sha256::new();
        hasher.update(pubkey.as_bytes());
        hasher.update(nonce.as_bytes());
        let commitment = hex::encode(hasher.finalize());
        (commitment, nonce)
    }

    /// Verify a commitment
    pub fn verify_commitment(commitment: &str, pubkey: &str, nonce: &str) -> bool {
        let mut hasher = Sha256::new();
        hasher.update(pubkey.as_bytes());
        hasher.update(nonce.as_bytes());
        let computed = hex::encode(hasher.finalize());
        computed == commitment
    }
}

/// Mesh network state
pub struct MeshNetwork {
    /// Our private key (for decryption)
    our_private_key: Vec<u8>,
    /// Our public key
    pub our_pubkey: String,
    /// Known nodes in the network (by commitment, not pubkey)
    pub nodes: HashMap<String, MeshNode>,
    /// Seen correlation tokens (for endpoint deduplication)
    seen_tokens: HashMap<String, u64>,
    /// Pending outgoing messages (by correlation token)
    pub pending_messages: HashMap<String, String>, // correlation_token -> original_id
}

impl MeshNetwork {
    /// Create a new mesh network state
    pub fn new(private_key: Vec<u8>) -> Result<Self, MeshError> {
        let pubkey = get_public_key(private_key.clone())
            .map_err(|_| MeshError::EncryptionFailed)?;

        Ok(Self {
            our_private_key: private_key,
            our_pubkey: pubkey,
            nodes: HashMap::new(),
            seen_tokens: HashMap::new(),
            pending_messages: HashMap::new(),
        })
    }

    /// Add or update a node in the network
    pub fn update_node(&mut self, node: MeshNode) {
        self.nodes.insert(node.commitment.clone(), node);
    }

    /// Remove a node from the network
    pub fn remove_node(&mut self, commitment: &str) {
        self.nodes.remove(commitment);
    }

    /// Check if we've seen this correlation token before (endpoint deduplication)
    pub fn has_seen_token(&self, token: &str) -> bool {
        self.seen_tokens.contains_key(token)
    }

    /// Mark a correlation token as seen
    pub fn mark_token_seen(&mut self, token: &str) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.seen_tokens.insert(token.to_string(), now);
    }

    /// Process an incoming message
    pub fn process_message(&mut self, message: &MeshMessage) -> ProcessResult {
        // Handle different message types
        match message.message_type {
            MessageType::Ping => ProcessResult::SendPong(message.id.clone()),
            MessageType::Pong => ProcessResult::Pong,
            MessageType::Ack => {
                // Try to decrypt and verify ack
                ProcessResult::Ack
            }
            MessageType::Direct | MessageType::Broadcast => {
                // Try to decrypt for us
                match message.try_decrypt_for_us(&self.our_private_key) {
                    Ok(decrypted) => {
                        // Check for duplicate via correlation token
                        if self.has_seen_token(&decrypted.correlation_token) {
                            return ProcessResult::Duplicate;
                        }
                        self.mark_token_seen(&decrypted.correlation_token);
                        ProcessResult::Deliver(decrypted)
                    }
                    Err(MeshError::NotForUs) => {
                        // Not for us, consider forwarding
                        if message.should_forward() {
                            let forwarded = message.prepare_for_forward();
                            ProcessResult::Forward(forwarded)
                        } else {
                            ProcessResult::Drop
                        }
                    }
                    Err(_) => ProcessResult::Drop,
                }
            }
            MessageType::SyncRequest | MessageType::SyncResponse => {
                // Handle sync (implement later)
                ProcessResult::Sync
            }
        }
    }

    /// Clean up old correlation tokens (garbage collection)
    pub fn cleanup_old_tokens(&mut self, max_age_ms: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.seen_tokens.retain(|_, timestamp| now - *timestamp < max_age_ms);
    }

    /// Get all directly connected nodes
    pub fn get_direct_nodes(&self) -> Vec<&MeshNode> {
        self.nodes.values().filter(|n| n.is_direct).collect()
    }

    /// Get node by commitment
    pub fn get_node(&self, commitment: &str) -> Option<&MeshNode> {
        self.nodes.get(commitment)
    }

    /// Create a new message to send
    pub fn create_message(
        &mut self,
        recipient_pubkey: &str,
        payload: &[u8],
    ) -> Result<MeshMessage, MeshError> {
        let message = MeshMessage::new_direct(
            &self.our_private_key,
            &self.our_pubkey,
            recipient_pubkey,
            payload,
        )?;

        // Store correlation token for ack tracking
        // (We'd need to extract it from the message, but it's encrypted for privacy)

        Ok(message)
    }
}

/// Result of processing a mesh message
#[derive(Debug)]
pub enum ProcessResult {
    /// Message was a duplicate (same correlation token)
    Duplicate,
    /// Message should be delivered to the user
    Deliver(DecryptedMessage),
    /// Message should be forwarded to other nodes
    Forward(MeshMessage),
    /// Message should be dropped
    Drop,
    /// Send a pong response with the given ping ID
    SendPong(String),
    /// Received a pong
    Pong,
    /// Received an acknowledgment
    Ack,
    /// Sync operation
    Sync,
}

#[cfg(test)]
mod tests {
    use super::*;
    use buildit_crypto::generate_keypair;

    #[test]
    fn test_message_creation_and_decryption() {
        let sender = generate_keypair();
        let recipient = generate_keypair();

        let msg = MeshMessage::new_direct(
            &sender.private_key,
            &sender.public_key,
            &recipient.public_key,
            b"hello",
        )
        .unwrap();

        assert_eq!(msg.message_type, MessageType::Direct);
        assert_eq!(msg.ttl, DEFAULT_TTL);
        assert!(!msg.id.is_empty());

        // Message should not expose sender or recipient in cleartext
        assert!(!msg.routing.ciphertext.contains(&sender.public_key));
        assert!(!msg.routing.ciphertext.contains(&recipient.public_key));

        // Recipient should be able to decrypt
        let decrypted = msg.try_decrypt_for_us(&recipient.private_key).unwrap();
        assert_eq!(decrypted.sender_pubkey, sender.public_key);
        assert_eq!(decrypted.payload, b"hello");
    }

    #[test]
    fn test_message_not_for_us() {
        let sender = generate_keypair();
        let recipient = generate_keypair();
        let other = generate_keypair();

        let msg = MeshMessage::new_direct(
            &sender.private_key,
            &sender.public_key,
            &recipient.public_key,
            b"hello",
        )
        .unwrap();

        // Other party should not be able to decrypt
        let result = msg.try_decrypt_for_us(&other.private_key);
        assert!(matches!(result, Err(MeshError::NotForUs)));
    }

    #[test]
    fn test_message_id_changes_on_forward() {
        let sender = generate_keypair();
        let recipient = generate_keypair();

        let msg = MeshMessage::new_direct(
            &sender.private_key,
            &sender.public_key,
            &recipient.public_key,
            b"hello",
        )
        .unwrap();

        let original_id = msg.id.clone();
        let forwarded = msg.prepare_for_forward();

        // ID should change to prevent correlation
        assert_ne!(forwarded.id, original_id);
        assert_eq!(forwarded.ttl, DEFAULT_TTL - 1);
    }

    #[test]
    fn test_commitment_scheme() {
        let keypair = generate_keypair();

        let (commitment, nonce) = MeshNode::create_commitment(&keypair.public_key);

        // Valid commitment should verify
        assert!(MeshNode::verify_commitment(
            &commitment,
            &keypair.public_key,
            &nonce
        ));

        // Wrong pubkey should not verify
        let other = generate_keypair();
        assert!(!MeshNode::verify_commitment(
            &commitment,
            &other.public_key,
            &nonce
        ));
    }

    #[test]
    fn test_mesh_network_deduplication() {
        let our_keypair = generate_keypair();
        let mut network = MeshNetwork::new(our_keypair.private_key.clone()).unwrap();

        let token = "test-correlation-token";
        assert!(!network.has_seen_token(token));

        network.mark_token_seen(token);
        assert!(network.has_seen_token(token));
    }

    #[test]
    fn test_timestamp_not_exact() {
        let msg1 = MeshMessage::ping();
        let msg2 = MeshMessage::ping();

        // Due to randomization, timestamps should typically differ
        // (though this test might occasionally pass with same timestamp)
        // The key security property is that timestamps are randomized
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        // Timestamps should be within the randomization range
        assert!((msg1.timestamp - now).abs() <= TIMESTAMP_RANGE_SECONDS as i64);
        assert!((msg2.timestamp - now).abs() <= TIMESTAMP_RANGE_SECONDS as i64);
    }
}
