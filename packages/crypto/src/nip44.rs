//! NIP-44 Encryption (ChaCha20-Poly1305)
//!
//! Implements NIP-44 version 2 encryption with:
//! - ChaCha20-Poly1305 AEAD
//! - HKDF-SHA256 key derivation
//! - Power-of-2 padding

use crate::error::CryptoError;
use crate::keys::derive_conversation_key;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::Sha256;
use zeroize::Zeroize;

/// NIP-44 version byte
const NIP44_VERSION: u8 = 2;

/// Calculate padded length using power-of-2 scheme
fn calc_padded_len(unpadded_len: usize) -> usize {
    if unpadded_len <= 32 {
        return 32;
    }

    let next_power = (unpadded_len as u32).next_power_of_two() as usize;
    let chunk = if next_power <= 256 { 32 } else { next_power / 8 };
    chunk * ((unpadded_len + chunk - 1) / chunk)
}

/// Pad plaintext according to NIP-44
fn pad(plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let unpadded_len = plaintext.len();

    if unpadded_len < 1 || unpadded_len > 65535 {
        return Err(CryptoError::InvalidPlaintextLength);
    }

    let padded_len = calc_padded_len(unpadded_len);
    let mut padded = vec![0u8; 2 + padded_len];

    // Write length as big-endian u16
    padded[0] = ((unpadded_len >> 8) & 0xff) as u8;
    padded[1] = (unpadded_len & 0xff) as u8;

    // Copy plaintext
    padded[2..2 + unpadded_len].copy_from_slice(plaintext);

    // Remaining bytes are already zero

    Ok(padded)
}

/// Unpad decrypted data according to NIP-44
fn unpad(padded: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if padded.len() < 2 {
        return Err(CryptoError::InvalidPadding);
    }

    let unpadded_len = ((padded[0] as usize) << 8) | (padded[1] as usize);

    if unpadded_len < 1 || unpadded_len > 65535 {
        return Err(CryptoError::InvalidPadding);
    }

    if 2 + unpadded_len > padded.len() {
        return Err(CryptoError::InvalidPadding);
    }

    // Verify padding is all zeros
    for &b in &padded[2 + unpadded_len..] {
        if b != 0 {
            return Err(CryptoError::InvalidPadding);
        }
    }

    Ok(padded[2..2 + unpadded_len].to_vec())
}

/// Encrypt a message using NIP-44
pub fn nip44_encrypt(
    private_key: Vec<u8>,
    recipient_pubkey: String,
    plaintext: String,
) -> Result<String, CryptoError> {
    // Derive conversation key
    let conversation_key = derive_conversation_key(private_key, recipient_pubkey)?;

    // Generate random nonce (32 bytes for HKDF, we'll use 12 for ChaCha)
    let mut nonce_material = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce_material);

    // Derive message keys using HKDF
    let hk = Hkdf::<Sha256>::new(Some(&nonce_material), &conversation_key);
    let mut key_material = [0u8; 76]; // 32 chacha + 12 nonce + 32 hmac
    hk.expand(b"nip44-v2", &mut key_material)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    let chacha_key = &key_material[0..32];
    let chacha_nonce = &key_material[32..44];
    let hmac_key = &key_material[44..76];

    // Pad plaintext
    let padded = pad(plaintext.as_bytes())?;

    // Encrypt with ChaCha20-Poly1305
    let cipher = ChaCha20Poly1305::new_from_slice(chacha_key)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    let nonce = Nonce::from_slice(chacha_nonce);
    let ciphertext = cipher
        .encrypt(nonce, padded.as_slice())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Compute HMAC
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(hmac_key)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    mac.update(&nonce_material);
    mac.update(&ciphertext);
    let mac_bytes = mac.finalize().into_bytes();

    // Construct payload: version + nonce + ciphertext + mac
    let mut payload = Vec::with_capacity(1 + 32 + ciphertext.len() + 32);
    payload.push(NIP44_VERSION);
    payload.extend_from_slice(&nonce_material);
    payload.extend_from_slice(&ciphertext);
    payload.extend_from_slice(&mac_bytes);

    // Zeroize sensitive data
    let mut key_material = key_material;
    key_material.zeroize();

    Ok(BASE64.encode(&payload))
}

/// Encrypt a message using NIP-44 with a pre-derived conversation key
///
/// Use this when you already have the conversation key derived (e.g., from caching).
/// For single-use encryption, use `nip44_encrypt` which derives the key internally.
pub fn nip44_encrypt_with_key(
    conversation_key: Vec<u8>,
    plaintext: String,
) -> Result<String, CryptoError> {
    if conversation_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    // Generate random nonce (32 bytes for HKDF, we'll use 12 for ChaCha)
    let mut nonce_material = [0u8; 32];
    rand::thread_rng().fill_bytes(&mut nonce_material);

    // Derive message keys using HKDF
    let hk = Hkdf::<Sha256>::new(Some(&nonce_material), &conversation_key);
    let mut key_material = [0u8; 76]; // 32 chacha + 12 nonce + 32 hmac
    hk.expand(b"nip44-v2", &mut key_material)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    let chacha_key = &key_material[0..32];
    let chacha_nonce = &key_material[32..44];
    let hmac_key = &key_material[44..76];

    // Pad plaintext
    let padded = pad(plaintext.as_bytes())?;

    // Encrypt with ChaCha20-Poly1305
    let cipher = ChaCha20Poly1305::new_from_slice(chacha_key)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    let nonce = Nonce::from_slice(chacha_nonce);
    let ciphertext = cipher
        .encrypt(nonce, padded.as_slice())
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Compute HMAC
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(hmac_key)
        .map_err(|_| CryptoError::EncryptionFailed)?;
    mac.update(&nonce_material);
    mac.update(&ciphertext);
    let mac_bytes = mac.finalize().into_bytes();

    // Construct payload: version + nonce + ciphertext + mac
    let mut payload = Vec::with_capacity(1 + 32 + ciphertext.len() + 32);
    payload.push(NIP44_VERSION);
    payload.extend_from_slice(&nonce_material);
    payload.extend_from_slice(&ciphertext);
    payload.extend_from_slice(&mac_bytes);

    // Zeroize sensitive data
    let mut key_material = key_material;
    key_material.zeroize();

    Ok(BASE64.encode(&payload))
}

/// Decrypt a message using NIP-44 with a pre-derived conversation key
///
/// Use this when you already have the conversation key derived (e.g., from caching).
/// For single-use decryption, use `nip44_decrypt` which derives the key internally.
pub fn nip44_decrypt_with_key(
    conversation_key: Vec<u8>,
    ciphertext: String,
) -> Result<String, CryptoError> {
    if conversation_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    // Decode base64
    let payload = BASE64
        .decode(&ciphertext)
        .map_err(|_| CryptoError::InvalidCiphertext)?;

    // Check minimum length: version(1) + nonce(32) + min_ciphertext(34) + mac(32)
    if payload.len() < 99 {
        return Err(CryptoError::InvalidCiphertext);
    }

    // Check version
    if payload[0] != NIP44_VERSION {
        return Err(CryptoError::InvalidCiphertext);
    }

    let nonce_material = &payload[1..33];
    let encrypted = &payload[33..payload.len() - 32];
    let received_mac = &payload[payload.len() - 32..];

    // Derive message keys
    let hk = Hkdf::<Sha256>::new(Some(nonce_material), &conversation_key);
    let mut key_material = [0u8; 76];
    hk.expand(b"nip44-v2", &mut key_material)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let chacha_key = &key_material[0..32];
    let chacha_nonce = &key_material[32..44];
    let hmac_key = &key_material[44..76];

    // Verify HMAC first (constant-time comparison)
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(hmac_key)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    mac.update(nonce_material);
    mac.update(encrypted);

    mac.verify_slice(received_mac)
        .map_err(|_| CryptoError::InvalidMac)?;

    // Decrypt
    let cipher = ChaCha20Poly1305::new_from_slice(chacha_key)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    let nonce = Nonce::from_slice(chacha_nonce);
    let padded = cipher
        .decrypt(nonce, encrypted)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    // Unpad
    let plaintext_bytes = unpad(&padded)?;

    // Zeroize sensitive data
    let mut key_material = key_material;
    key_material.zeroize();

    String::from_utf8(plaintext_bytes).map_err(|_| CryptoError::DecryptionFailed)
}

/// Decrypt a message using NIP-44
pub fn nip44_decrypt(
    private_key: Vec<u8>,
    sender_pubkey: String,
    ciphertext: String,
) -> Result<String, CryptoError> {
    // Decode base64
    let payload = BASE64
        .decode(&ciphertext)
        .map_err(|_| CryptoError::InvalidCiphertext)?;

    // Check minimum length: version(1) + nonce(32) + min_ciphertext(34) + mac(32)
    if payload.len() < 99 {
        return Err(CryptoError::InvalidCiphertext);
    }

    // Check version
    if payload[0] != NIP44_VERSION {
        return Err(CryptoError::InvalidCiphertext);
    }

    let nonce_material = &payload[1..33];
    let encrypted = &payload[33..payload.len() - 32];
    let received_mac = &payload[payload.len() - 32..];

    // Derive conversation key
    let conversation_key = derive_conversation_key(private_key, sender_pubkey)?;

    // Derive message keys
    let hk = Hkdf::<Sha256>::new(Some(nonce_material), &conversation_key);
    let mut key_material = [0u8; 76];
    hk.expand(b"nip44-v2", &mut key_material)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    let chacha_key = &key_material[0..32];
    let chacha_nonce = &key_material[32..44];
    let hmac_key = &key_material[44..76];

    // Verify HMAC first (constant-time comparison)
    let mut mac = <Hmac<Sha256> as Mac>::new_from_slice(hmac_key)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    mac.update(nonce_material);
    mac.update(encrypted);

    mac.verify_slice(received_mac)
        .map_err(|_| CryptoError::InvalidMac)?;

    // Decrypt
    let cipher = ChaCha20Poly1305::new_from_slice(chacha_key)
        .map_err(|_| CryptoError::DecryptionFailed)?;
    let nonce = Nonce::from_slice(chacha_nonce);
    let padded = cipher
        .decrypt(nonce, encrypted)
        .map_err(|_| CryptoError::DecryptionFailed)?;

    // Unpad
    let plaintext_bytes = unpad(&padded)?;

    // Zeroize sensitive data
    let mut key_material = key_material;
    key_material.zeroize();

    String::from_utf8(plaintext_bytes).map_err(|_| CryptoError::DecryptionFailed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::generate_keypair;

    #[test]
    fn test_padding() {
        // 1 byte -> 32 bytes padded
        assert_eq!(calc_padded_len(1), 32);
        // 32 bytes -> 32 bytes padded
        assert_eq!(calc_padded_len(32), 32);
        // 33 bytes -> 64 bytes padded
        assert_eq!(calc_padded_len(33), 64);
        // 256 bytes -> 256 bytes padded
        assert_eq!(calc_padded_len(256), 256);
        // 257 bytes -> 320 bytes padded
        assert_eq!(calc_padded_len(257), 320);
    }

    #[test]
    fn test_pad_unpad_roundtrip() {
        let original = b"Hello, World!";
        let padded = pad(original).unwrap();
        let unpadded = unpad(&padded).unwrap();
        assert_eq!(unpadded, original);
    }

    #[test]
    fn test_nip44_encrypt_decrypt() {
        let sender = generate_keypair();
        let recipient = generate_keypair();

        let plaintext = "Hello, this is a secret message!";

        let encrypted = nip44_encrypt(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            plaintext.to_string(),
        )
        .unwrap();

        let decrypted = nip44_decrypt(
            recipient.private_key.clone(),
            sender.public_key.clone(),
            encrypted,
        )
        .unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_nip44_unicode() {
        let sender = generate_keypair();
        let recipient = generate_keypair();

        let plaintext = "Hello 世界! 🌍 Привет!";

        let encrypted = nip44_encrypt(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            plaintext.to_string(),
        )
        .unwrap();

        let decrypted = nip44_decrypt(
            recipient.private_key.clone(),
            sender.public_key.clone(),
            encrypted,
        )
        .unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_nip44_wrong_key() {
        let sender = generate_keypair();
        let recipient = generate_keypair();
        let wrong = generate_keypair();

        let plaintext = "Secret message";

        let encrypted = nip44_encrypt(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            plaintext.to_string(),
        )
        .unwrap();

        // Try to decrypt with wrong key
        let result = nip44_decrypt(
            wrong.private_key.clone(),
            sender.public_key.clone(),
            encrypted,
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_nip44_with_key_roundtrip() {
        use crate::keys::derive_conversation_key;

        let sender = generate_keypair();
        let recipient = generate_keypair();

        // Derive conversation key (same for both parties)
        let conv_key = derive_conversation_key(
            sender.private_key.clone(),
            recipient.public_key.clone(),
        )
        .unwrap();

        let plaintext = "Hello with pre-derived key!";

        // Encrypt with conversation key
        let encrypted = nip44_encrypt_with_key(
            conv_key.clone(),
            plaintext.to_string(),
        )
        .unwrap();

        // Decrypt with same conversation key
        let decrypted = nip44_decrypt_with_key(
            conv_key,
            encrypted,
        )
        .unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_nip44_with_key_cross_party() {
        use crate::keys::derive_conversation_key;

        let alice = generate_keypair();
        let bob = generate_keypair();

        // Alice derives conversation key
        let alice_conv_key = derive_conversation_key(
            alice.private_key.clone(),
            bob.public_key.clone(),
        )
        .unwrap();

        // Bob derives conversation key
        let bob_conv_key = derive_conversation_key(
            bob.private_key.clone(),
            alice.public_key.clone(),
        )
        .unwrap();

        // Keys should be equal (ECDH symmetry)
        assert_eq!(alice_conv_key, bob_conv_key);

        // Alice encrypts
        let plaintext = "Secret from Alice to Bob!";
        let encrypted = nip44_encrypt_with_key(
            alice_conv_key,
            plaintext.to_string(),
        )
        .unwrap();

        // Bob decrypts
        let decrypted = nip44_decrypt_with_key(
            bob_conv_key,
            encrypted,
        )
        .unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_nip44_with_key_invalid_key() {
        // Test with wrong key length
        let result = nip44_encrypt_with_key(
            vec![0u8; 16], // Wrong length
            "test".to_string(),
        );
        assert!(result.is_err());

        let result = nip44_decrypt_with_key(
            vec![0u8; 16], // Wrong length
            "test".to_string(),
        );
        assert!(result.is_err());
    }
}
