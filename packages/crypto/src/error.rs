//! Error types for BuildIt Crypto

use thiserror::Error;

/// Cryptographic operation errors
#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CryptoError {
    #[error("Invalid private key")]
    InvalidKey,

    #[error("Invalid public key format")]
    InvalidPublicKey,

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Encryption failed")]
    EncryptionFailed,

    #[error("Decryption failed")]
    DecryptionFailed,

    #[error("Invalid plaintext length (must be 1-65535 bytes)")]
    InvalidPlaintextLength,

    #[error("Invalid ciphertext format")]
    InvalidCiphertext,

    #[error("Invalid padding")]
    InvalidPadding,

    #[error("Invalid MAC")]
    InvalidMac,

    #[error("Invalid hex string")]
    InvalidHex,

    #[error("Invalid JSON")]
    InvalidJson,

    #[error("Signing failed")]
    SigningFailed,

    #[error("Key derivation failed")]
    KeyDerivationFailed,

    #[error("Random number generation failed")]
    RandomGenerationFailed,

    #[error("Invalid duress password")]
    InvalidDuressPassword,

    #[error("Duress password too similar to normal password")]
    DuressPasswordTooSimilar,

    #[error("Key destruction failed")]
    KeyDestructionFailed,

    #[error("Duress alert failed")]
    DuressAlertFailed,

    #[error("Invalid version string (expected format: MAJOR.MINOR.PATCH)")]
    InvalidVersion,
}
