//! Key generation and derivation for BuildIt Network

use crate::error::CryptoError;
use hkdf::Hkdf;
use pbkdf2::pbkdf2_hmac;
use rand::rngs::OsRng;
use secp256k1::{PublicKey, Secp256k1, SecretKey};
use sha2::{Digest, Sha256};
use zeroize::Zeroize;

/// Key pair containing private and public keys
#[derive(Debug, Clone)]
pub struct KeyPair {
    pub private_key: Vec<u8>,
    pub public_key: String,
}

/// PBKDF2 configuration (OWASP 2023 recommended)
const PBKDF2_ITERATIONS: u32 = 600_000;

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

/// Derive master encryption key from password using PBKDF2
pub fn derive_master_key(password: String, salt: Vec<u8>) -> Result<Vec<u8>, CryptoError> {
    if salt.len() < 16 {
        return Err(CryptoError::KeyDerivationFailed);
    }

    let mut key = vec![0u8; 32];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

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

    // Construct compressed public key (02 prefix + x-coordinate)
    let mut compressed = vec![0x02u8];
    compressed.extend_from_slice(&pubkey_bytes);

    let _secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key).map_err(|_| CryptoError::InvalidKey)?;
    let public_key =
        PublicKey::from_slice(&compressed).map_err(|_| CryptoError::InvalidPublicKey)?;

    // ECDH shared secret
    let shared_point = secp256k1::ecdh::shared_secret_point(&public_key, &secret_key);
    let shared_x = &shared_point[0..32]; // x-coordinate only (shared_point is [x, y])

    // HKDF to derive conversation key
    let hk = Hkdf::<Sha256>::new(Some(b"nip44-v2"), shared_x);
    let mut conversation_key = vec![0u8; 32];

    hk.expand(&[], &mut conversation_key)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;

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
        let password = "correct horse battery staple".to_string();
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
