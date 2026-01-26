//! BuildIt Crypto - Shared cryptographic primitives for BuildIt Network
//!
//! This crate provides:
//! - NIP-44 ChaCha20-Poly1305 encryption
//! - NIP-17 gift wrap/unwrap
//! - Key derivation (Argon2id, HKDF)
//! - secp256k1 signing/verification
//! - Duress password system for coercion resistance
//! - UniFFI bindings for Swift/Kotlin

// Allow clippy warnings in generated code
#![allow(clippy::empty_line_after_doc_comments)]

mod aes;
mod duress;
mod error;
pub mod generated;
mod keys;
mod nip17;
mod nip44;
mod nostr;
mod ratchet;

pub use aes::*;
pub use duress::*;
pub use error::CryptoError;
pub use keys::*;
pub use nip17::*;
pub use nip44::*;
pub use nostr::*;
pub use ratchet::*;

use rand::rngs::OsRng;
use rand::Rng;

uniffi::include_scaffolding!("buildit_crypto");

/// Generate a random salt of the specified length
///
/// SECURITY: Uses OsRng (operating system's cryptographically secure RNG)
pub fn generate_salt(length: u32) -> Vec<u8> {
    let mut salt = vec![0u8; length as usize];
    OsRng.fill(&mut salt[..]);
    salt
}

/// Convert bytes to hex string
pub fn bytes_to_hex(bytes: Vec<u8>) -> String {
    hex::encode(bytes)
}

/// Convert hex string to bytes
pub fn hex_to_bytes(hex_string: String) -> Result<Vec<u8>, CryptoError> {
    hex::decode(&hex_string).map_err(|_| CryptoError::InvalidHex)
}

/// Randomize a timestamp within a range (for metadata protection)
///
/// SECURITY: Uses OsRng (operating system's cryptographically secure RNG)
pub fn randomize_timestamp(timestamp: i64, range_seconds: u32) -> i64 {
    let offset = OsRng.gen_range(-(range_seconds as i64)..=(range_seconds as i64));
    timestamp + offset
}

/// Sign arbitrary message with Schnorr signature (BIP-340)
///
/// This is a wrapper that reorders parameters for UniFFI compatibility.
/// The keys module has the main implementation.
pub fn schnorr_sign(message: Vec<u8>, private_key: Vec<u8>) -> Result<Vec<u8>, CryptoError> {
    keys::schnorr_sign(&message, private_key)
}

/// Verify Schnorr signature (BIP-340)
///
/// This is a wrapper for UniFFI compatibility.
pub fn schnorr_verify(
    message: Vec<u8>,
    signature: Vec<u8>,
    public_key: Vec<u8>,
) -> Result<bool, CryptoError> {
    keys::schnorr_verify(&message, signature, public_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_salt() {
        let salt = generate_salt(32);
        assert_eq!(salt.len(), 32);
    }

    #[test]
    fn test_hex_conversion() {
        let original = vec![0x01, 0x02, 0x03, 0xab, 0xcd, 0xef];
        let hex = bytes_to_hex(original.clone());
        assert_eq!(hex, "010203abcdef");

        let decoded = hex_to_bytes(hex).unwrap();
        assert_eq!(decoded, original);
    }

    #[test]
    fn test_randomize_timestamp() {
        let base = 1700000000i64;
        let range = 172800u32; // 2 days

        for _ in 0..100 {
            let randomized = randomize_timestamp(base, range);
            assert!(randomized >= base - range as i64);
            assert!(randomized <= base + range as i64);
        }
    }
}
