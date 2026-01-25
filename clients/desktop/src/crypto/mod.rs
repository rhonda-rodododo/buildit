//! Cryptographic operations module for BuildIt Network Desktop
//!
//! This module provides:
//! - System keyring integration for secure credential storage
//! - Integration with buildit-crypto crate for NIP-44/NIP-17 encryption

pub mod keyring;

pub use keyring::KeyringManager;
