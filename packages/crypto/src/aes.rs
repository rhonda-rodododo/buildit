//! AES-256-GCM encryption for key storage

use crate::error::CryptoError;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce as AesNonce,
};
use rand::RngCore;

/// Encrypted data with nonce
#[derive(Debug, Clone)]
pub struct EncryptedData {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

/// AES-256-GCM nonce size (12 bytes)
const AES_GCM_NONCE_SIZE: usize = 12;

/// Encrypt data with AES-256-GCM
pub fn aes_encrypt(key: Vec<u8>, plaintext: Vec<u8>) -> Result<EncryptedData, CryptoError> {
    if key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    // Generate random nonce
    let mut nonce_bytes = [0u8; AES_GCM_NONCE_SIZE];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| CryptoError::InvalidKey)?;
    let nonce = AesNonce::from_slice(&nonce_bytes);

    // Encrypt
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    Ok(EncryptedData {
        ciphertext,
        nonce: nonce_bytes.to_vec(),
    })
}

/// Decrypt data with AES-256-GCM
pub fn aes_decrypt(key: Vec<u8>, encrypted: EncryptedData) -> Result<Vec<u8>, CryptoError> {
    if key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    if encrypted.nonce.len() != AES_GCM_NONCE_SIZE {
        return Err(CryptoError::InvalidCiphertext);
    }

    // Create cipher
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|_| CryptoError::InvalidKey)?;
    let nonce = AesNonce::from_slice(&encrypted.nonce);

    // Decrypt
    cipher
        .decrypt(nonce, encrypted.ciphertext.as_ref())
        .map_err(|_| CryptoError::DecryptionFailed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aes_encrypt_decrypt() {
        let key = vec![0u8; 32];
        let plaintext = b"Hello, World!".to_vec();

        let encrypted = aes_encrypt(key.clone(), plaintext.clone()).unwrap();

        // Verify ciphertext is different from plaintext
        assert_ne!(encrypted.ciphertext, plaintext);

        // Verify nonce is correct size
        assert_eq!(encrypted.nonce.len(), AES_GCM_NONCE_SIZE);

        // Decrypt
        let decrypted = aes_decrypt(key, encrypted).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_wrong_key() {
        let key = vec![0u8; 32];
        let wrong_key = vec![1u8; 32];
        let plaintext = b"Secret data".to_vec();

        let encrypted = aes_encrypt(key, plaintext).unwrap();

        // Try to decrypt with wrong key
        let result = aes_decrypt(wrong_key, encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_aes_tampered_ciphertext() {
        let key = vec![0u8; 32];
        let plaintext = b"Secret data".to_vec();

        let mut encrypted = aes_encrypt(key.clone(), plaintext).unwrap();

        // Tamper with ciphertext
        if !encrypted.ciphertext.is_empty() {
            encrypted.ciphertext[0] ^= 0xff;
        }

        // Decryption should fail
        let result = aes_decrypt(key, encrypted);
        assert!(result.is_err());
    }

    #[test]
    fn test_aes_invalid_key_length() {
        let short_key = vec![0u8; 16]; // Too short
        let plaintext = b"Test".to_vec();

        let result = aes_encrypt(short_key, plaintext);
        assert!(matches!(result, Err(CryptoError::InvalidKey)));
    }

    #[test]
    fn test_aes_unique_nonces() {
        let key = vec![0u8; 32];
        let plaintext = b"Same message".to_vec();

        // Encrypt same message multiple times
        let mut nonces = Vec::new();
        for _ in 0..100 {
            let encrypted = aes_encrypt(key.clone(), plaintext.clone()).unwrap();
            nonces.push(encrypted.nonce);
        }

        // All nonces should be unique
        let unique: std::collections::HashSet<_> = nonces.iter().collect();
        assert_eq!(unique.len(), 100);
    }
}
