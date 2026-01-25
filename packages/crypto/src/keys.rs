//! Key generation and derivation for BuildIt Network

use crate::error::CryptoError;
use argon2::{Algorithm, Argon2, Params, Version};
use hkdf::Hkdf;
use rand::rngs::OsRng;
use secp256k1::{PublicKey, Secp256k1, SecretKey};
use sha2::{Digest, Sha256};
use std::fmt;
use zeroize::Zeroize;

/// Key pair containing private and public keys
///
/// SECURITY NOTES:
/// - Debug is manually implemented to redact the private key in logs/debug output
/// - Clone is derived for UniFFI compatibility, but cloning should be minimized
/// - Callers MUST call `zeroize_key(keypair.private_key)` when done with the key
///   to ensure secure erasure from memory
///
/// UniFFI requires Clone + no Drop for Record types, so automatic zeroization
/// via Drop is not possible here. Use the `zeroize_key()` function explicitly.
#[derive(Clone)]
pub struct KeyPair {
    pub private_key: Vec<u8>,
    pub public_key: String,
}

impl fmt::Debug for KeyPair {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("KeyPair")
            .field("private_key", &"[REDACTED]")
            .field("public_key", &self.public_key)
            .finish()
    }
}

/// Argon2id configuration (OWASP 2023 recommended)
/// Memory-hard KDF resistant to GPU/ASIC attacks
const ARGON2_MEMORY_KB: u32 = 65536; // 64 MB
const ARGON2_TIME_COST: u32 = 3; // 3 iterations
const ARGON2_PARALLELISM: u32 = 4; // 4 lanes
const ARGON2_OUTPUT_LEN: usize = 32; // 256-bit key

/// HKDF salt for database key derivation
const DATABASE_KEY_SALT: &[u8] = b"BuildItNetwork-DEK-v1";
const DATABASE_KEY_INFO: &[u8] = b"database-encryption";

/// Generate a new secp256k1 keypair
pub fn generate_keypair() -> KeyPair {
    let secp = Secp256k1::new();
    let (secret_key, public_key) = secp.generate_keypair(&mut OsRng);

    KeyPair {
        private_key: secret_key.secret_bytes().to_vec(),
        public_key: hex::encode(&public_key.serialize()[1..]), // x-only pubkey
    }
}

/// Get the public key from a private key
pub fn get_public_key(private_key: Vec<u8>) -> Result<String, CryptoError> {
    if private_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key).map_err(|_| CryptoError::InvalidKey)?;
    let public_key = PublicKey::from_secret_key(&secp, &secret_key);

    // Return x-only public key (32 bytes hex)
    Ok(hex::encode(&public_key.serialize()[1..]))
}

/// Derive master encryption key from password using Argon2id
///
/// Argon2id is a memory-hard KDF that is resistant to GPU/ASIC attacks.
/// It combines Argon2i (side-channel resistant) and Argon2d (GPU resistant).
///
/// Parameters (OWASP 2023 recommended):
/// - Memory: 64 MB (65536 KB)
/// - Time cost: 3 iterations
/// - Parallelism: 4 lanes
/// - Output: 32 bytes (256-bit key)
///
/// SECURITY: The password bytes are zeroized after use.
/// Callers should ensure they zeroize any copies of the password they hold.
pub fn derive_master_key(mut password: Vec<u8>, salt: Vec<u8>) -> Result<Vec<u8>, CryptoError> {
    if salt.len() < 16 {
        return Err(CryptoError::KeyDerivationFailed);
    }

    let params = Params::new(
        ARGON2_MEMORY_KB,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(ARGON2_OUTPUT_LEN),
    )
    .map_err(|_| CryptoError::KeyDerivationFailed)?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key = vec![0u8; ARGON2_OUTPUT_LEN];

    let result = argon2.hash_password_into(&password, &salt, &mut key);

    // Zeroize password after use
    password.zeroize();

    result.map_err(|_| CryptoError::KeyDerivationFailed)?;
    Ok(key)
}

/// Derive database encryption key from master key using HKDF
pub fn derive_database_key(master_key: Vec<u8>) -> Result<Vec<u8>, CryptoError> {
    if master_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    let hk = Hkdf::<Sha256>::new(Some(DATABASE_KEY_SALT), &master_key);
    let mut database_key = vec![0u8; 32];

    hk.expand(DATABASE_KEY_INFO, &mut database_key)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;

    Ok(database_key)
}

/// Derive NIP-44 conversation key from ECDH shared secret
///
/// SECURITY: This function properly handles both even (0x02) and odd (0x03) y-coordinates
/// by trying both prefixes when constructing the public key. The shared secret is
/// zeroized after the conversation key is derived.
pub fn derive_conversation_key(
    private_key: Vec<u8>,
    recipient_pubkey: String,
) -> Result<Vec<u8>, CryptoError> {
    if private_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    let pubkey_bytes = hex::decode(&recipient_pubkey).map_err(|_| CryptoError::InvalidPublicKey)?;
    if pubkey_bytes.len() != 32 {
        return Err(CryptoError::InvalidPublicKey);
    }

    let _secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key).map_err(|_| CryptoError::InvalidKey)?;

    // Try both possible y-coordinate parities (0x02 for even, 0x03 for odd)
    // NIP-44 specifies x-only public keys, so we need to try both
    let public_key = {
        // First try 0x02 (even y-coordinate)
        let mut compressed_even = vec![0x02u8];
        compressed_even.extend_from_slice(&pubkey_bytes);

        match PublicKey::from_slice(&compressed_even) {
            Ok(pk) => pk,
            Err(_) => {
                // Try 0x03 (odd y-coordinate)
                let mut compressed_odd = vec![0x03u8];
                compressed_odd.extend_from_slice(&pubkey_bytes);
                PublicKey::from_slice(&compressed_odd).map_err(|_| CryptoError::InvalidPublicKey)?
            }
        }
    };

    // ECDH shared secret
    let mut shared_point = secp256k1::ecdh::shared_secret_point(&public_key, &secret_key);
    let shared_x = &shared_point[0..32]; // x-coordinate only (shared_point is [x, y])

    // HKDF to derive conversation key
    let hk = Hkdf::<Sha256>::new(Some(b"nip44-v2"), shared_x);
    let mut conversation_key = vec![0u8; 32];

    let result = hk
        .expand(&[], &mut conversation_key)
        .map_err(|_| CryptoError::KeyDerivationFailed);

    // Zeroize shared secret after use
    shared_point.zeroize();

    result?;
    Ok(conversation_key)
}

/// Sign arbitrary message with Schnorr signature (BIP-340)
pub fn schnorr_sign(message: &[u8], private_key: Vec<u8>) -> Result<Vec<u8>, CryptoError> {
    if private_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key).map_err(|_| CryptoError::InvalidKey)?;

    // Create message hash
    let mut hasher = sha2::Sha256::new();
    hasher.update(message);
    let message_hash = hasher.finalize();

    let msg = secp256k1::Message::from_digest_slice(&message_hash)
        .map_err(|_| CryptoError::SigningFailed)?;

    // Sign with Schnorr
    let keypair = secp256k1::Keypair::from_secret_key(&secp, &secret_key);
    let signature = secp.sign_schnorr_with_rng(&msg, &keypair, &mut rand::rngs::OsRng);

    Ok(signature.serialize().to_vec())
}

/// Verify Schnorr signature (BIP-340)
pub fn schnorr_verify(
    message: &[u8],
    signature: Vec<u8>,
    public_key: Vec<u8>,
) -> Result<bool, CryptoError> {
    if signature.len() != 64 {
        return Err(CryptoError::InvalidSignature);
    }
    if public_key.len() != 32 {
        return Err(CryptoError::InvalidPublicKey);
    }

    let secp = Secp256k1::new();

    // Parse x-only public key
    let xonly_pubkey = secp256k1::XOnlyPublicKey::from_slice(&public_key)
        .map_err(|_| CryptoError::InvalidPublicKey)?;

    // Parse signature
    let sig = secp256k1::schnorr::Signature::from_slice(&signature)
        .map_err(|_| CryptoError::InvalidSignature)?;

    // Create message hash
    let mut hasher = sha2::Sha256::new();
    hasher.update(message);
    let message_hash = hasher.finalize();

    let msg = secp256k1::Message::from_digest_slice(&message_hash)
        .map_err(|_| CryptoError::SigningFailed)?;

    // Verify
    Ok(secp.verify_schnorr(&sig, &msg, &xonly_pubkey).is_ok())
}

/// Securely zeroize a key
pub fn zeroize_key(mut key: Vec<u8>) {
    key.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let kp = generate_keypair();
        assert_eq!(kp.private_key.len(), 32);
        assert_eq!(kp.public_key.len(), 64); // 32 bytes as hex
    }

    #[test]
    fn test_get_public_key() {
        let kp = generate_keypair();
        let pubkey = get_public_key(kp.private_key.clone()).unwrap();
        assert_eq!(pubkey, kp.public_key);
    }

    #[test]
    fn test_derive_master_key() {
        let password = b"correct horse battery staple".to_vec();
        let salt = vec![0u8; 32];

        let key = derive_master_key(password.clone(), salt.clone()).unwrap();
        assert_eq!(key.len(), 32);

        // Same inputs should produce same output
        let key2 = derive_master_key(password, salt).unwrap();
        assert_eq!(key, key2);
    }

    #[test]
    fn test_derive_database_key() {
        let master_key = vec![0u8; 32];
        let db_key = derive_database_key(master_key.clone()).unwrap();
        assert_eq!(db_key.len(), 32);

        // Different from master key
        assert_ne!(db_key, master_key);
    }

    #[test]
    fn test_derive_conversation_key() {
        let kp1 = generate_keypair();
        let kp2 = generate_keypair();

        // Both parties should derive the same conversation key
        let key1 =
            derive_conversation_key(kp1.private_key.clone(), kp2.public_key.clone()).unwrap();
        let key2 =
            derive_conversation_key(kp2.private_key.clone(), kp1.public_key.clone()).unwrap();

        assert_eq!(key1, key2);
        assert_eq!(key1.len(), 32);
    }

    #[test]
    fn test_schnorr_sign_verify() {
        let kp = generate_keypair();
        let message = b"Hello, World!";

        // Sign message
        let signature = schnorr_sign(message, kp.private_key.clone()).unwrap();
        assert_eq!(signature.len(), 64);

        // Parse public key hex to bytes
        let pubkey_bytes = hex::decode(&kp.public_key).unwrap();

        // Verify signature
        let valid = schnorr_verify(message, signature.clone(), pubkey_bytes.clone()).unwrap();
        assert!(valid);

        // Wrong message should fail
        let wrong_message = b"Wrong message";
        let invalid =
            schnorr_verify(wrong_message, signature.clone(), pubkey_bytes.clone()).unwrap();
        assert!(!invalid);

        // Wrong public key should fail
        let wrong_kp = generate_keypair();
        let wrong_pubkey_bytes = hex::decode(&wrong_kp.public_key).unwrap();
        let invalid = schnorr_verify(message, signature, wrong_pubkey_bytes).unwrap();
        assert!(!invalid);
    }

    #[test]
    fn test_schnorr_invalid_signature_length() {
        let kp = generate_keypair();
        let message = b"Test";
        let pubkey_bytes = hex::decode(&kp.public_key).unwrap();

        // Too short signature
        let result = schnorr_verify(message, vec![0u8; 32], pubkey_bytes);
        assert!(result.is_err());
    }

    #[test]
    fn test_schnorr_invalid_pubkey_length() {
        let message = b"Test";
        let signature = vec![0u8; 64];

        // Too short public key
        let result = schnorr_verify(message, signature, vec![0u8; 16]);
        assert!(result.is_err());
    }
}
