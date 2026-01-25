//! BLE Mesh networking for BuildIt Network
//!
//! Implements a simple mesh protocol for offline peer-to-peer communication.
//! Messages are encrypted using NIP-44 before transmission.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Maximum message size for BLE transmission (MTU - overhead)
pub const MAX_MESSAGE_SIZE: usize = 512;

/// Time-to-live for mesh messages (number of hops)
pub const DEFAULT_TTL: u8 = 5;

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

/// A mesh network message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshMessage {
    /// Unique message ID
    pub id: String,
    /// Message type
    pub message_type: MessageType,
    /// Sender's public key (hex)
    pub sender_pubkey: String,
    /// Recipient's public key (hex) - None for broadcast
    pub recipient_pubkey: Option<String>,
    /// Time-to-live (decremented on each hop)
    pub ttl: u8,
    /// Timestamp (unix milliseconds)
    pub timestamp: u64,
    /// Encrypted payload (NIP-44 ciphertext for direct, plaintext for broadcast)
    pub payload: Vec<u8>,
    /// Message signature (Schnorr)
    pub signature: String,
    /// Previous hops (to prevent loops)
    pub hops: Vec<String>,
}

impl MeshMessage {
    /// Create a new mesh message
    pub fn new(
        message_type: MessageType,
        sender_pubkey: String,
        recipient_pubkey: Option<String>,
        payload: Vec<u8>,
        signature: String,
    ) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            id: Uuid::new_v4().to_string(),
            message_type,
            sender_pubkey: sender_pubkey.clone(),
            recipient_pubkey,
            ttl: DEFAULT_TTL,
            timestamp,
            payload,
            signature,
            hops: vec![sender_pubkey],
        }
    }

    /// Create a ping message
    pub fn ping(sender_pubkey: String) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            id: Uuid::new_v4().to_string(),
            message_type: MessageType::Ping,
            sender_pubkey: sender_pubkey.clone(),
            recipient_pubkey: None,
            ttl: 1, // Ping doesn't propagate
            timestamp,
            payload: vec![],
            signature: String::new(),
            hops: vec![sender_pubkey],
        }
    }

    /// Create a pong response
    pub fn pong(sender_pubkey: String, original_ping_id: &str) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            id: Uuid::new_v4().to_string(),
            message_type: MessageType::Pong,
            sender_pubkey: sender_pubkey.clone(),
            recipient_pubkey: None,
            ttl: 1,
            timestamp,
            payload: original_ping_id.as_bytes().to_vec(),
            signature: String::new(),
            hops: vec![sender_pubkey],
        }
    }

    /// Create an acknowledgment message
    pub fn ack(sender_pubkey: String, original_message_id: &str) -> Self {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        Self {
            id: Uuid::new_v4().to_string(),
            message_type: MessageType::Ack,
            sender_pubkey: sender_pubkey.clone(),
            recipient_pubkey: None,
            ttl: DEFAULT_TTL,
            timestamp,
            payload: original_message_id.as_bytes().to_vec(),
            signature: String::new(),
            hops: vec![sender_pubkey],
        }
    }

    /// Serialize message to bytes for transmission
    pub fn to_bytes(&self) -> Result<Vec<u8>, serde_json::Error> {
        serde_json::to_vec(self)
    }

    /// Deserialize message from bytes
    pub fn from_bytes(data: &[u8]) -> Result<Self, serde_json::Error> {
        serde_json::from_slice(data)
    }

    /// Check if message should be forwarded
    pub fn should_forward(&self, our_pubkey: &str) -> bool {
        // Don't forward if TTL exhausted
        if self.ttl == 0 {
            return false;
        }

        // Don't forward if we already processed this message
        if self.hops.contains(&our_pubkey.to_string()) {
            return false;
        }

        // Don't forward ping/pong
        if self.message_type == MessageType::Ping || self.message_type == MessageType::Pong {
            return false;
        }

        true
    }

    /// Prepare message for forwarding (decrement TTL, add hop)
    pub fn forward(&mut self, our_pubkey: &str) {
        self.ttl = self.ttl.saturating_sub(1);
        self.hops.push(our_pubkey.to_string());
    }

    /// Check if this message is for us
    pub fn is_for_us(&self, our_pubkey: &str) -> bool {
        match &self.recipient_pubkey {
            Some(recipient) => recipient == our_pubkey,
            None => true, // Broadcast messages are for everyone
        }
    }
}

/// A node in the mesh network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshNode {
    /// Node's public key
    pub pubkey: String,
    /// Node's BLE address
    pub ble_address: String,
    /// Node's display name (if known)
    pub name: Option<String>,
    /// Last seen timestamp
    pub last_seen: u64,
    /// Signal strength (RSSI)
    pub rssi: Option<i16>,
    /// Whether this node is directly connected
    pub is_direct: bool,
    /// Number of hops to reach this node
    pub hop_count: u8,
}

/// Mesh network state
pub struct MeshNetwork {
    /// Our public key
    pub our_pubkey: String,
    /// Known nodes in the network
    pub nodes: HashMap<String, MeshNode>,
    /// Seen message IDs (to prevent duplicates)
    pub seen_messages: HashMap<String, u64>,
    /// Pending outgoing messages (waiting for ack)
    pub pending_messages: HashMap<String, MeshMessage>,
}

impl MeshNetwork {
    /// Create a new mesh network state
    pub fn new(our_pubkey: String) -> Self {
        Self {
            our_pubkey,
            nodes: HashMap::new(),
            seen_messages: HashMap::new(),
            pending_messages: HashMap::new(),
        }
    }

    /// Add or update a node in the network
    pub fn update_node(&mut self, node: MeshNode) {
        self.nodes.insert(node.pubkey.clone(), node);
    }

    /// Remove a node from the network
    pub fn remove_node(&mut self, pubkey: &str) {
        self.nodes.remove(pubkey);
    }

    /// Check if we've seen this message before
    pub fn has_seen_message(&self, message_id: &str) -> bool {
        self.seen_messages.contains_key(message_id)
    }

    /// Mark a message as seen
    pub fn mark_seen(&mut self, message_id: &str) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        self.seen_messages.insert(message_id.to_string(), now);
    }

    /// Process an incoming message
    pub fn process_message(&mut self, message: &MeshMessage) -> ProcessResult {
        // Check for duplicates
        if self.has_seen_message(&message.id) {
            return ProcessResult::Duplicate;
        }

        // Mark as seen
        self.mark_seen(&message.id);

        // Update sender node info
        if !message.hops.is_empty() {
            let sender_pubkey = &message.hops[0];
            if let Some(node) = self.nodes.get_mut(sender_pubkey) {
                node.last_seen = message.timestamp;
            }
        }

        // Handle different message types
        match message.message_type {
            MessageType::Ping => ProcessResult::SendPong(message.id.clone()),
            MessageType::Pong => {
                // Handle pong response
                ProcessResult::Pong
            }
            MessageType::Ack => {
                // Remove from pending
                if let Ok(original_id) = String::from_utf8(message.payload.clone()) {
                    self.pending_messages.remove(&original_id);
                }
                ProcessResult::Ack
            }
            MessageType::Direct | MessageType::Broadcast => {
                if message.is_for_us(&self.our_pubkey) {
                    ProcessResult::Deliver(message.clone())
                } else if message.should_forward(&self.our_pubkey) {
                    let mut forwarded = message.clone();
                    forwarded.forward(&self.our_pubkey);
                    ProcessResult::Forward(forwarded)
                } else {
                    ProcessResult::Drop
                }
            }
            MessageType::SyncRequest | MessageType::SyncResponse => {
                // Handle sync (implement later)
                ProcessResult::Sync
            }
        }
    }

    /// Clean up old seen messages (garbage collection)
    pub fn cleanup_old_messages(&mut self, max_age_ms: u64) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        self.seen_messages.retain(|_, timestamp| now - *timestamp < max_age_ms);
    }

    /// Get all directly connected nodes
    pub fn get_direct_nodes(&self) -> Vec<&MeshNode> {
        self.nodes.values().filter(|n| n.is_direct).collect()
    }

    /// Get node by public key
    pub fn get_node(&self, pubkey: &str) -> Option<&MeshNode> {
        self.nodes.get(pubkey)
    }
}

/// Result of processing a mesh message
#[derive(Debug)]
pub enum ProcessResult {
    /// Message was a duplicate
    Duplicate,
    /// Message should be delivered to the user
    Deliver(MeshMessage),
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

    #[test]
    fn test_message_creation() {
        let msg = MeshMessage::new(
            MessageType::Direct,
            "sender_pubkey".to_string(),
            Some("recipient_pubkey".to_string()),
            b"hello".to_vec(),
            "signature".to_string(),
        );

        assert_eq!(msg.message_type, MessageType::Direct);
        assert_eq!(msg.sender_pubkey, "sender_pubkey");
        assert_eq!(msg.ttl, DEFAULT_TTL);
        assert!(!msg.id.is_empty());
    }

    #[test]
    fn test_message_serialization() {
        let msg = MeshMessage::ping("test_pubkey".to_string());
        let bytes = msg.to_bytes().unwrap();
        let deserialized = MeshMessage::from_bytes(&bytes).unwrap();

        assert_eq!(msg.id, deserialized.id);
        assert_eq!(msg.message_type, deserialized.message_type);
    }

    #[test]
    fn test_forward_logic() {
        let mut msg = MeshMessage::new(
            MessageType::Broadcast,
            "sender".to_string(),
            None,
            vec![],
            String::new(),
        );

        assert!(msg.should_forward("other"));
        assert!(!msg.should_forward("sender"));

        msg.forward("other");
        assert_eq!(msg.ttl, DEFAULT_TTL - 1);
        assert!(msg.hops.contains(&"other".to_string()));
    }

    #[test]
    fn test_mesh_network() {
        let mut network = MeshNetwork::new("our_pubkey".to_string());

        let msg = MeshMessage::new(
            MessageType::Direct,
            "sender".to_string(),
            Some("our_pubkey".to_string()),
            b"hello".to_vec(),
            String::new(),
        );

        let result = network.process_message(&msg);
        assert!(matches!(result, ProcessResult::Deliver(_)));

        // Duplicate should be detected
        let result2 = network.process_message(&msg);
        assert!(matches!(result2, ProcessResult::Duplicate));
    }
}
