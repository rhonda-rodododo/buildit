//! BuildIt Crypto - Shared cryptographic primitives for BuildIt Network
//!
//! This crate provides:
//! - NIP-44 ChaCha20-Poly1305 encryption
//! - NIP-17 gift wrap/unwrap
//! - Key derivation (PBKDF2, HKDF)
//! - secp256k1 signing/verification
//! - UniFFI bindings for Swift/Kotlin

mod error;
mod keys;
mod nip44;
mod nip17;
mod nostr;
mod aes;

pub use error::CryptoError;
pub use keys::*;
pub use nip44::*;
pub use nip17::*;
pub use nostr::*;
pub use aes::*;

use rand::Rng;

uniffi::include_scaffolding!("buildit_crypto");

/// Generate a random salt of the specified length
pub fn generate_salt(length: u32) -> Vec<u8> {
    let mut salt = vec![0u8; length as usize];
    rand::thread_rng().fill(&mut salt[..]);
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
pub fn randomize_timestamp(timestamp: i64, range_seconds: u32) -> i64 {
    let mut rng = rand::thread_rng();
    let offset = rng.gen_range(-(range_seconds as i64)..=(range_seconds as i64));
    timestamp + offset
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
