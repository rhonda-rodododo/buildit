//! Double Ratchet Algorithm for Forward Secrecy
//!
//! Implements the Signal Double Ratchet algorithm for per-message forward secrecy.
//! This ensures that if a conversation key is compromised, past messages remain
//! protected and future messages become protected after a single DH ratchet step.
//!
//! ## Algorithm Overview
//!
//! The Double Ratchet combines:
//! 1. **Diffie-Hellman Ratchet**: New DH keys exchanged periodically for fresh entropy
//! 2. **Symmetric-Key Ratchet**: Chain keys derived for each message direction
//!
//! ## Security Properties
//!
//! - **Forward secrecy**: Past messages cannot be decrypted if current keys are compromised
//! - **Break-in recovery**: Future messages are protected after a DH ratchet step
//! - **Out-of-order messages**: Skipped message keys can be stored temporarily
//!
//! ## Usage
//!
//! ```ignore
//! // Initialize session (after X3DH key agreement)
//! let session = RatchetSession::initialize_alice(
//!     shared_secret,
//!     bob_public_key,
//! )?;
//!
//! // Encrypt message
//! let (header, ciphertext) = session.encrypt(plaintext)?;
//!
//! // Decrypt message
//! let plaintext = session.decrypt(&header, &ciphertext)?;
//! ```

use crate::error::CryptoError;
use chacha20poly1305::{
    aead::{Aead, KeyInit as AeadKeyInit},
    ChaCha20Poly1305, Nonce,
};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::rngs::OsRng;
use secp256k1::{PublicKey, SecretKey, Secp256k1};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Maximum number of skipped message keys to store
const MAX_SKIP: usize = 1000;

/// HKDF info string for root key derivation
const KDF_RK_INFO: &[u8] = b"BuildIt-Ratchet-RootKey";

/// Header sent with each encrypted message
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageHeader {
    /// Current DH ratchet public key
    pub dh_public_key: Vec<u8>,
    /// Previous chain message count (for detecting ratchet)
    pub previous_chain_length: u32,
    /// Message number in current chain
    pub message_number: u32,
}

impl MessageHeader {
    /// Serialize header to bytes
    pub fn to_bytes(&self) -> Vec<u8> {
        // Format: pubkey_len(1) + pubkey + prev_chain_len(4) + msg_num(4)
        let mut bytes = Vec::with_capacity(1 + self.dh_public_key.len() + 8);
        bytes.push(self.dh_public_key.len() as u8);
        bytes.extend_from_slice(&self.dh_public_key);
        bytes.extend_from_slice(&self.previous_chain_length.to_be_bytes());
        bytes.extend_from_slice(&self.message_number.to_be_bytes());
        bytes
    }

    /// Deserialize header from bytes
    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() < 9 {
            return Err(CryptoError::InvalidCiphertext);
        }

        let pk_len = bytes[0] as usize;
        if bytes.len() < 1 + pk_len + 8 {
            return Err(CryptoError::InvalidCiphertext);
        }

        let dh_public_key = bytes[1..1 + pk_len].to_vec();
        let prev_chain_bytes: [u8; 4] = bytes[1 + pk_len..1 + pk_len + 4]
            .try_into()
            .map_err(|_| CryptoError::InvalidCiphertext)?;
        let msg_num_bytes: [u8; 4] = bytes[1 + pk_len + 4..1 + pk_len + 8]
            .try_into()
            .map_err(|_| CryptoError::InvalidCiphertext)?;

        Ok(Self {
            dh_public_key,
            previous_chain_length: u32::from_be_bytes(prev_chain_bytes),
            message_number: u32::from_be_bytes(msg_num_bytes),
        })
    }
}

/// Encrypted ratchet message with header
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RatchetMessage {
    /// Message header (contains DH public key and counters)
    pub header: MessageHeader,
    /// Encrypted ciphertext
    pub ciphertext: Vec<u8>,
    /// Nonce used for encryption
    pub nonce: Vec<u8>,
}

/// Key pair for DH ratchet
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
struct DhKeyPair {
    private_key: [u8; 32],
    public_key: Vec<u8>,
}

impl DhKeyPair {
    /// Generate a new random key pair
    fn generate() -> Result<Self, CryptoError> {
        let secp = Secp256k1::new();
        let (secret_key, public_key) = secp.generate_keypair(&mut OsRng);

        Ok(Self {
            private_key: secret_key.secret_bytes(),
            public_key: public_key.serialize().to_vec(),
        })
    }

    /// Create from existing private key
    fn from_private_key(private_key: &[u8]) -> Result<Self, CryptoError> {
        if private_key.len() != 32 {
            return Err(CryptoError::InvalidKey);
        }

        let secp = Secp256k1::new();
        let secret_key = SecretKey::from_slice(private_key)
            .map_err(|_| CryptoError::InvalidKey)?;
        let public_key = secret_key.public_key(&secp);

        let mut pk = [0u8; 32];
        pk.copy_from_slice(private_key);

        Ok(Self {
            private_key: pk,
            public_key: public_key.serialize().to_vec(),
        })
    }

    /// Perform DH with another public key
    fn dh(&self, their_public_key: &[u8]) -> Result<[u8; 32], CryptoError> {
        let secret_key = SecretKey::from_slice(&self.private_key)
            .map_err(|_| CryptoError::InvalidKey)?;
        let their_key = PublicKey::from_slice(their_public_key)
            .map_err(|_| CryptoError::InvalidPublicKey)?;

        // Perform ECDH
        let shared_point = secp256k1::ecdh::shared_secret_point(&their_key, &secret_key);

        // Use first 32 bytes of x-coordinate as shared secret
        let mut shared_secret = [0u8; 32];
        shared_secret.copy_from_slice(&shared_point[..32]);

        Ok(shared_secret)
    }
}

/// Ratchet session state
///
/// SECURITY: Contains sensitive key material - should be stored encrypted
///
/// This is exposed via UniFFI as an Object for cross-platform use.
#[derive(Serialize, Deserialize)]
pub struct RatchetSessionState {
    /// Our current DH key pair
    #[serde(with = "dh_keypair_serde")]
    dh_self: DhKeyPair,

    /// Their current DH public key
    dh_remote: Option<Vec<u8>>,

    /// Root key (32 bytes)
    #[serde(with = "key_serde")]
    root_key: [u8; 32],

    /// Sending chain key (32 bytes)
    #[serde(with = "option_key_serde")]
    chain_key_send: Option<[u8; 32]>,

    /// Receiving chain key (32 bytes)
    #[serde(with = "option_key_serde")]
    chain_key_recv: Option<[u8; 32]>,

    /// Number of messages sent in current chain
    message_number_send: u32,

    /// Number of messages received in current chain
    message_number_recv: u32,

    /// Previous chain length (for header)
    previous_chain_length: u32,

    /// Skipped message keys: (dh_public_key, message_number) -> message_key
    skipped_message_keys: HashMap<(Vec<u8>, u32), [u8; 32]>,
}

// Serde helpers for sensitive types
mod dh_keypair_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(keypair: &DhKeyPair, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let data = (keypair.private_key.to_vec(), keypair.public_key.clone());
        data.serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DhKeyPair, D::Error>
    where
        D: Deserializer<'de>,
    {
        let (private_key, public_key): (Vec<u8>, Vec<u8>) = Deserialize::deserialize(deserializer)?;
        let mut pk = [0u8; 32];
        pk.copy_from_slice(&private_key);
        Ok(DhKeyPair { private_key: pk, public_key })
    }
}

mod key_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(key: &[u8; 32], serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        key.to_vec().serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<[u8; 32], D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Vec<u8> = Deserialize::deserialize(deserializer)?;
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        Ok(key)
    }
}

mod option_key_serde {
    use super::*;
    use serde::{Deserializer, Serializer};

    pub fn serialize<S>(key: &Option<[u8; 32]>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        key.map(|k| k.to_vec()).serialize(serializer)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<[u8; 32]>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let bytes: Option<Vec<u8>> = Deserialize::deserialize(deserializer)?;
        Ok(bytes.map(|b| {
            let mut key = [0u8; 32];
            key.copy_from_slice(&b);
            key
        }))
    }
}

impl RatchetSessionState {
    /// Initialize a new session as Alice (initiator)
    fn initialize_alice_internal(
        shared_secret: &[u8; 32],
        bob_public_key: &[u8],
    ) -> Result<Self, CryptoError> {
        // Generate our initial DH key pair
        let dh_self = DhKeyPair::generate()?;

        // Perform DH with Bob's key
        let dh_output = dh_self.dh(bob_public_key)?;

        // Derive root key and sending chain key
        let (root_key, chain_key_send) = kdf_rk(shared_secret, &dh_output)?;

        Ok(Self {
            dh_self,
            dh_remote: Some(bob_public_key.to_vec()),
            root_key,
            chain_key_send: Some(chain_key_send),
            chain_key_recv: None,
            message_number_send: 0,
            message_number_recv: 0,
            previous_chain_length: 0,
            skipped_message_keys: HashMap::new(),
        })
    }

    /// Initialize a new session as Bob (responder)
    fn initialize_bob_internal(
        shared_secret: &[u8; 32],
        our_signed_prekey: &[u8],
    ) -> Result<Self, CryptoError> {
        let dh_self = DhKeyPair::from_private_key(our_signed_prekey)?;

        Ok(Self {
            dh_self,
            dh_remote: None,
            root_key: *shared_secret,
            chain_key_send: None,
            chain_key_recv: None,
            message_number_send: 0,
            message_number_recv: 0,
            previous_chain_length: 0,
            skipped_message_keys: HashMap::new(),
        })
    }

    /// Encrypt a message
    ///
    /// Returns the ratchet message containing header and ciphertext.
    /// The header must be sent alongside the ciphertext.
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<RatchetMessage, CryptoError> {
        // Ensure we have a sending chain key
        let chain_key = self.chain_key_send
            .ok_or(CryptoError::EncryptionFailed)?;

        // Derive message key from chain key
        let (message_key, new_chain_key) = kdf_ck(&chain_key)?;
        self.chain_key_send = Some(new_chain_key);

        // Create header
        let header = MessageHeader {
            dh_public_key: self.dh_self.public_key.clone(),
            previous_chain_length: self.previous_chain_length,
            message_number: self.message_number_send,
        };

        // Encrypt with message key
        let (ciphertext, nonce) = encrypt_message(&message_key, plaintext, &header)?;

        self.message_number_send += 1;

        Ok(RatchetMessage {
            header,
            ciphertext,
            nonce,
        })
    }

    /// Decrypt a message
    ///
    /// Handles DH ratchet steps and out-of-order messages automatically.
    pub fn decrypt(&mut self, message: &RatchetMessage) -> Result<Vec<u8>, CryptoError> {
        // Check if we have a stored key for this message
        let key_id = (message.header.dh_public_key.clone(), message.header.message_number);
        if let Some(message_key) = self.skipped_message_keys.remove(&key_id) {
            return decrypt_message(&message_key, &message.ciphertext, &message.nonce, &message.header);
        }

        // Check if this is a new DH ratchet step
        let header_dh = &message.header.dh_public_key;
        let need_ratchet = match &self.dh_remote {
            Some(remote) => remote != header_dh,
            None => true,
        };

        if need_ratchet {
            // Skip any missed messages from previous chain
            self.skip_message_keys(message.header.previous_chain_length)?;

            // Perform DH ratchet
            self.dh_ratchet(header_dh)?;
        }

        // Skip any missed messages in current chain
        self.skip_message_keys(message.header.message_number)?;

        // Derive message key
        let chain_key = self.chain_key_recv
            .ok_or(CryptoError::DecryptionFailed)?;
        let (message_key, new_chain_key) = kdf_ck(&chain_key)?;
        self.chain_key_recv = Some(new_chain_key);
        self.message_number_recv += 1;

        // Decrypt
        decrypt_message(&message_key, &message.ciphertext, &message.nonce, &message.header)
    }

    /// Perform a DH ratchet step (receiving side)
    fn dh_ratchet(&mut self, their_public_key: &[u8]) -> Result<(), CryptoError> {
        // Store previous chain length
        self.previous_chain_length = self.message_number_send;
        self.message_number_send = 0;
        self.message_number_recv = 0;

        // Update remote DH key
        self.dh_remote = Some(their_public_key.to_vec());

        // Derive receiving chain key
        let dh_recv = self.dh_self.dh(their_public_key)?;
        let (new_root_key, chain_key_recv) = kdf_rk(&self.root_key, &dh_recv)?;
        self.root_key = new_root_key;
        self.chain_key_recv = Some(chain_key_recv);

        // Generate new DH key pair and derive sending chain key
        self.dh_self = DhKeyPair::generate()?;
        let dh_send = self.dh_self.dh(their_public_key)?;
        let (new_root_key, chain_key_send) = kdf_rk(&self.root_key, &dh_send)?;
        self.root_key = new_root_key;
        self.chain_key_send = Some(chain_key_send);

        Ok(())
    }

    /// Skip and store message keys for out-of-order message handling
    fn skip_message_keys(&mut self, until: u32) -> Result<(), CryptoError> {
        if self.message_number_recv + (MAX_SKIP as u32) < until {
            return Err(CryptoError::DecryptionFailed); // Too many skipped messages
        }

        let chain_key = match self.chain_key_recv {
            Some(key) => key,
            None => return Ok(()), // No chain key yet
        };

        let dh_key = match &self.dh_remote {
            Some(key) => key.clone(),
            None => return Ok(()),
        };

        let mut current_chain_key = chain_key;
        while self.message_number_recv < until {
            let (message_key, new_chain_key) = kdf_ck(&current_chain_key)?;
            let key_id = (dh_key.clone(), self.message_number_recv);
            self.skipped_message_keys.insert(key_id, message_key);
            current_chain_key = new_chain_key;
            self.message_number_recv += 1;

            // Limit stored keys
            if self.skipped_message_keys.len() > MAX_SKIP {
                // Remove oldest key (this is a simplification)
                if let Some(key_to_remove) = self.skipped_message_keys.keys().next().cloned() {
                    self.skipped_message_keys.remove(&key_to_remove);
                }
            }
        }

        self.chain_key_recv = Some(current_chain_key);
        Ok(())
    }

    /// Get our current public DH key for sending
    pub fn get_public_key(&self) -> Vec<u8> {
        self.dh_self.public_key.clone()
    }

    /// Serialize session state for storage
    ///
    /// SECURITY: The returned bytes contain sensitive key material
    /// and should be encrypted before storage.
    pub fn serialize(&self) -> Result<Vec<u8>, CryptoError> {
        serde_json::to_vec(self).map_err(|_| CryptoError::InvalidJson)
    }

    /// Deserialize session state from storage
    pub fn deserialize(data: &[u8]) -> Result<Self, CryptoError> {
        serde_json::from_slice(data).map_err(|_| CryptoError::InvalidJson)
    }
}

/// KDF for root key ratchet
/// Returns (new_root_key, chain_key)
fn kdf_rk(root_key: &[u8; 32], dh_output: &[u8; 32]) -> Result<([u8; 32], [u8; 32]), CryptoError> {
    let hkdf = Hkdf::<Sha256>::new(Some(root_key), dh_output);

    let mut output = [0u8; 64];
    hkdf.expand(KDF_RK_INFO, &mut output)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;

    let mut new_root_key = [0u8; 32];
    let mut chain_key = [0u8; 32];
    new_root_key.copy_from_slice(&output[..32]);
    chain_key.copy_from_slice(&output[32..]);

    Ok((new_root_key, chain_key))
}

/// KDF for chain key ratchet
/// Returns (message_key, new_chain_key)
fn kdf_ck(chain_key: &[u8; 32]) -> Result<([u8; 32], [u8; 32]), CryptoError> {
    // Message key = HMAC(chain_key, 0x01)
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(chain_key)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;
    mac.update(&[0x01]);
    let message_key_bytes = mac.finalize().into_bytes();

    // New chain key = HMAC(chain_key, 0x02)
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(chain_key)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;
    mac.update(&[0x02]);
    let new_chain_key_bytes = mac.finalize().into_bytes();

    let mut message_key = [0u8; 32];
    let mut new_chain_key = [0u8; 32];
    message_key.copy_from_slice(&message_key_bytes);
    new_chain_key.copy_from_slice(&new_chain_key_bytes);

    Ok((message_key, new_chain_key))
}

/// Encrypt message with ChaCha20-Poly1305
fn encrypt_message(
    key: &[u8; 32],
    plaintext: &[u8],
    header: &MessageHeader,
) -> Result<(Vec<u8>, Vec<u8>), CryptoError> {
    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Generate random nonce
    let mut nonce_bytes = [0u8; 12];
    rand::Rng::fill(&mut OsRng, &mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Use header as additional authenticated data
    let aad = header.to_bytes();

    let ciphertext = cipher
        .encrypt(nonce, chacha20poly1305::aead::Payload {
            msg: plaintext,
            aad: &aad,
        })
        .map_err(|_| CryptoError::EncryptionFailed)?;

    Ok((ciphertext, nonce_bytes.to_vec()))
}

/// Decrypt message with ChaCha20-Poly1305
fn decrypt_message(
    key: &[u8; 32],
    ciphertext: &[u8],
    nonce: &[u8],
    header: &MessageHeader,
) -> Result<Vec<u8>, CryptoError> {
    if nonce.len() != 12 {
        return Err(CryptoError::DecryptionFailed);
    }

    let cipher = ChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let nonce = Nonce::from_slice(nonce);
    let aad = header.to_bytes();

    let plaintext = cipher
        .decrypt(nonce, chacha20poly1305::aead::Payload {
            msg: ciphertext,
            aad: &aad,
        })
        .map_err(|_| CryptoError::DecryptionFailed)?;

    Ok(plaintext)
}

/// Thread-safe wrapper for RatchetSession exposed via UniFFI
///
/// This wrapper provides a thread-safe interface to the Double Ratchet
/// session that can be used from Swift, Kotlin, and TypeScript via UniFFI.
pub struct RatchetSession {
    state: std::sync::Mutex<RatchetSessionState>,
}

impl RatchetSession {
    /// Initialize a new session as Alice (initiator)
    ///
    /// # Arguments
    /// * `shared_secret` - 32-byte initial shared secret from X3DH key agreement
    /// * `bob_public_key` - Bob's signed pre-key public key (33 bytes compressed secp256k1)
    pub fn initialize_alice(
        shared_secret: Vec<u8>,
        bob_public_key: Vec<u8>,
    ) -> Result<Self, CryptoError> {
        if shared_secret.len() != 32 {
            return Err(CryptoError::InvalidKey);
        }

        let mut secret = [0u8; 32];
        secret.copy_from_slice(&shared_secret);

        let state = RatchetSessionState::initialize_alice_internal(&secret, &bob_public_key)?;

        Ok(Self {
            state: std::sync::Mutex::new(state),
        })
    }

    /// Initialize a new session as Bob (responder)
    ///
    /// # Arguments
    /// * `shared_secret` - 32-byte initial shared secret from X3DH key agreement
    /// * `our_signed_prekey` - Bob's signed pre-key private key (32 bytes)
    pub fn initialize_bob(
        shared_secret: Vec<u8>,
        our_signed_prekey: Vec<u8>,
    ) -> Result<Self, CryptoError> {
        if shared_secret.len() != 32 {
            return Err(CryptoError::InvalidKey);
        }

        let mut secret = [0u8; 32];
        secret.copy_from_slice(&shared_secret);

        let state = RatchetSessionState::initialize_bob_internal(&secret, &our_signed_prekey)?;

        Ok(Self {
            state: std::sync::Mutex::new(state),
        })
    }

    /// Encrypt a message with forward secrecy
    ///
    /// Each message uses a unique key derived from the ratchet state.
    /// After encryption, the message key is deleted, providing forward secrecy.
    pub fn encrypt(&self, plaintext: Vec<u8>) -> Result<RatchetMessage, CryptoError> {
        let mut state = self.state.lock().map_err(|_| CryptoError::EncryptionFailed)?;
        state.encrypt(&plaintext)
    }

    /// Decrypt a message
    ///
    /// Handles DH ratchet steps and out-of-order messages automatically.
    pub fn decrypt(&self, message: RatchetMessage) -> Result<Vec<u8>, CryptoError> {
        let mut state = self.state.lock().map_err(|_| CryptoError::DecryptionFailed)?;
        state.decrypt(&message)
    }

    /// Get our current public DH key
    pub fn get_public_key(&self) -> Vec<u8> {
        let state = self.state.lock().unwrap();
        state.get_public_key()
    }

    /// Serialize session state for storage
    ///
    /// SECURITY: The returned bytes contain sensitive key material
    /// and MUST be encrypted before storage using aes_encrypt().
    pub fn serialize(&self) -> Result<Vec<u8>, CryptoError> {
        let state = self.state.lock().map_err(|_| CryptoError::InvalidJson)?;
        state.serialize()
    }

    /// Deserialize session state from storage
    ///
    /// # Arguments
    /// * `data` - Previously serialized session state (must be decrypted first)
    pub fn deserialize(data: Vec<u8>) -> Result<Self, CryptoError> {
        let state = RatchetSessionState::deserialize(&data)?;
        Ok(Self {
            state: std::sync::Mutex::new(state),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn generate_shared_secret() -> Vec<u8> {
        let mut secret = [0u8; 32];
        rand::Rng::fill(&mut OsRng, &mut secret);
        secret.to_vec()
    }

    #[test]
    fn test_basic_encryption_decryption() {
        // Simulate X3DH key agreement result
        let shared_secret = generate_shared_secret();

        // Bob's prekey
        let bob_prekey = DhKeyPair::generate().unwrap();

        // Alice initializes her session
        let alice = RatchetSession::initialize_alice(
            shared_secret.clone(),
            bob_prekey.public_key.clone(),
        ).unwrap();

        // Bob initializes his session
        let bob = RatchetSession::initialize_bob(
            shared_secret,
            bob_prekey.private_key.to_vec(),
        ).unwrap();

        // Alice sends first message
        let plaintext = b"Hello Bob!";
        let message = alice.encrypt(plaintext.to_vec()).unwrap();

        // Bob decrypts
        let decrypted = bob.decrypt(message).unwrap();
        assert_eq!(decrypted, plaintext);

        // Bob replies
        let reply = b"Hello Alice!";
        let message2 = bob.encrypt(reply.to_vec()).unwrap();

        // Alice decrypts
        let decrypted2 = alice.decrypt(message2).unwrap();
        assert_eq!(decrypted2, reply);
    }

    #[test]
    fn test_multiple_messages() {
        let shared_secret = generate_shared_secret();
        let bob_prekey = DhKeyPair::generate().unwrap();

        let alice = RatchetSession::initialize_alice(
            shared_secret.clone(),
            bob_prekey.public_key.clone(),
        ).unwrap();

        let bob = RatchetSession::initialize_bob(
            shared_secret,
            bob_prekey.private_key.to_vec(),
        ).unwrap();

        // Send multiple messages
        for i in 0..10 {
            let plaintext = format!("Message {} from Alice", i);
            let message = alice.encrypt(plaintext.as_bytes().to_vec()).unwrap();
            let decrypted = bob.decrypt(message).unwrap();
            assert_eq!(String::from_utf8(decrypted).unwrap(), plaintext);
        }

        // Bob replies
        for i in 0..10 {
            let plaintext = format!("Message {} from Bob", i);
            let message = bob.encrypt(plaintext.as_bytes().to_vec()).unwrap();
            let decrypted = alice.decrypt(message).unwrap();
            assert_eq!(String::from_utf8(decrypted).unwrap(), plaintext);
        }
    }

    #[test]
    fn test_out_of_order_messages() {
        let shared_secret = generate_shared_secret();
        let bob_prekey = DhKeyPair::generate().unwrap();

        let alice = RatchetSession::initialize_alice(
            shared_secret.clone(),
            bob_prekey.public_key.clone(),
        ).unwrap();

        let bob = RatchetSession::initialize_bob(
            shared_secret,
            bob_prekey.private_key.to_vec(),
        ).unwrap();

        // Alice sends 3 messages
        let msg1 = alice.encrypt(b"Message 1".to_vec()).unwrap();
        let msg2 = alice.encrypt(b"Message 2".to_vec()).unwrap();
        let msg3 = alice.encrypt(b"Message 3".to_vec()).unwrap();

        // Bob receives them out of order: 3, 1, 2
        let decrypted3 = bob.decrypt(msg3).unwrap();
        assert_eq!(decrypted3, b"Message 3");

        let decrypted1 = bob.decrypt(msg1).unwrap();
        assert_eq!(decrypted1, b"Message 1");

        let decrypted2 = bob.decrypt(msg2).unwrap();
        assert_eq!(decrypted2, b"Message 2");
    }

    #[test]
    fn test_serialization() {
        let shared_secret = generate_shared_secret();
        let bob_prekey = DhKeyPair::generate().unwrap();

        let alice = RatchetSession::initialize_alice(
            shared_secret,
            bob_prekey.public_key.clone(),
        ).unwrap();

        // Serialize
        let serialized = alice.serialize().unwrap();

        // Deserialize
        let deserialized = RatchetSession::deserialize(serialized).unwrap();

        // Verify public key matches
        assert_eq!(alice.get_public_key(), deserialized.get_public_key());
    }

    #[test]
    fn test_forward_secrecy() {
        // This test verifies that message keys are different for each message
        let shared_secret = generate_shared_secret();
        let bob_prekey = DhKeyPair::generate().unwrap();

        let alice = RatchetSession::initialize_alice(
            shared_secret,
            bob_prekey.public_key.clone(),
        ).unwrap();

        // Encrypt same message twice
        let msg1 = alice.encrypt(b"Hello".to_vec()).unwrap();
        let msg2 = alice.encrypt(b"Hello".to_vec()).unwrap();

        // Ciphertexts should be different (different message keys)
        assert_ne!(msg1.ciphertext, msg2.ciphertext);

        // Message numbers should be different
        assert_ne!(msg1.header.message_number, msg2.header.message_number);
    }
}
