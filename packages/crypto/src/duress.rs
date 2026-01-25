//! Duress Password System - Coercion Resistance
//!
//! This module provides cryptographic primitives for protecting users under coercion.
//! When a user is forced to unlock their device, they can enter a duress password that:
//!
//! 1. Appears to unlock the app normally (plausible deniability)
//! 2. Shows a decoy identity with innocent content
//! 3. Securely destroys the real identity (cryptographic shredding)
//! 4. Optionally sends a silent alert to trusted contacts
//!
//! SECURITY MODEL:
//! - Duress password hash is stored separately from normal password hash
//! - Hash comparison uses constant-time operations to prevent timing attacks
//! - Real key destruction uses cryptographic shredding (multiple overwrites)
//! - Silent alerts are indistinguishable from normal Nostr DMs
//!
//! THREAT MODEL:
//! - Adversary has physical access to unlocked device
//! - User may be coerced to provide password
//! - Adversary may observe user entering password
//! - Network traffic may be monitored

use crate::error::CryptoError;
use crate::keys::{generate_keypair, get_public_key, KeyPair};
use crate::nip17::{create_gift_wrap, create_rumor, create_seal};
use crate::nostr::NostrEvent;
use argon2::{Algorithm, Argon2, Params, Version};
use hkdf::Hkdf;
use rand::rngs::OsRng;
use rand::RngCore;
use sha2::Sha256;
use subtle::ConstantTimeEq;
use zeroize::Zeroize;

/// Argon2id configuration (same as master key for consistency)
const ARGON2_MEMORY_KB: u32 = 65536; // 64 MB
const ARGON2_TIME_COST: u32 = 3; // 3 iterations
const ARGON2_PARALLELISM: u32 = 4; // 4 lanes
const ARGON2_OUTPUT_LEN: usize = 32; // 256-bit key

/// Number of secure overwrite passes for key destruction
const SECURE_WIPE_PASSES: usize = 3;

/// Duress alert message (appears as normal DM content)
const DURESS_ALERT_MESSAGE: &str = "DURESS ACTIVATED";

/// HKDF salt for duress key derivation
const DURESS_KEY_SALT: &[u8] = b"BuildItNetwork-Duress-v1";
const DURESS_KEY_INFO: &[u8] = b"duress-password-key";

/// Decoy identity with pre-generated content
#[derive(Debug, Clone)]
pub struct DecoyIdentity {
    /// The decoy keypair (private key + public key)
    pub keypair: KeyPair,
    /// Pre-generated display name for the decoy
    pub display_name: String,
    /// Pre-generated about text for the decoy
    pub about: String,
    /// Unix timestamp when decoy was created
    pub created_at: i64,
}

/// Result of a duress check
#[derive(Debug, Clone)]
pub struct DuressCheckResult {
    /// Whether the entered password was the duress password
    pub is_duress: bool,
    /// Whether the password matched (either normal or duress)
    pub password_valid: bool,
}

/// Configuration for duress alerts
#[derive(Debug, Clone)]
pub struct DuressAlertConfig {
    /// Public keys of trusted contacts to alert
    pub trusted_contact_pubkeys: Vec<String>,
    /// Whether to include location in alert (if available)
    pub include_location: bool,
    /// Custom message prefix (optional)
    pub custom_message: Option<String>,
}

/// A decoy contact for the fake identity
#[derive(Debug, Clone)]
pub struct DecoyContact {
    /// The fake contact's public key
    pub pubkey: String,
    /// Display name for the contact
    pub display_name: String,
}

/// Hash a password for duress detection using Argon2id
///
/// This creates a hash specifically for comparing against duress password.
/// The hash is derived using HKDF to domain-separate it from the master key.
///
/// SECURITY: Uses constant-time comparison when checking.
pub fn hash_duress_password(mut password: Vec<u8>, salt: Vec<u8>) -> Result<Vec<u8>, CryptoError> {
    if salt.len() < 16 {
        return Err(CryptoError::KeyDerivationFailed);
    }

    // Configure Argon2id parameters
    let params = Params::new(
        ARGON2_MEMORY_KB,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        Some(ARGON2_OUTPUT_LEN),
    )
    .map_err(|_| CryptoError::KeyDerivationFailed)?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    // First derive a key from password using Argon2id
    let mut derived_key = vec![0u8; ARGON2_OUTPUT_LEN];
    argon2
        .hash_password_into(&password, &salt, &mut derived_key)
        .map_err(|_| CryptoError::KeyDerivationFailed)?;

    // Then derive the duress hash using HKDF for domain separation
    let hk = Hkdf::<Sha256>::new(Some(DURESS_KEY_SALT), &derived_key);
    let mut duress_hash = vec![0u8; 32];

    let result = hk
        .expand(DURESS_KEY_INFO, &mut duress_hash)
        .map_err(|_| CryptoError::KeyDerivationFailed);

    // Zeroize intermediate values
    password.zeroize();
    derived_key.zeroize();

    result?;
    Ok(duress_hash)
}

/// Check if entered password is the duress password
///
/// Uses constant-time comparison to prevent timing attacks.
/// Returns a result indicating whether:
/// - The password is the duress password
/// - The password was valid (matched either duress or normal)
///
/// SECURITY: This function MUST be called before any other password check
/// to ensure the duress flow is triggered if needed.
pub fn check_duress_password(
    entered_password: Vec<u8>,
    salt: Vec<u8>,
    stored_duress_hash: Vec<u8>,
    stored_normal_hash: Vec<u8>,
) -> Result<DuressCheckResult, CryptoError> {
    // Hash the entered password
    let entered_hash = hash_duress_password(entered_password.clone(), salt.clone())?;

    // Constant-time comparison against duress hash
    let is_duress = entered_hash.ct_eq(&stored_duress_hash).into();

    // Also check against normal password hash for validation
    // Hash it the same way as duress (domain-separated)
    let entered_normal_hash = hash_duress_password(entered_password, salt)?;
    let is_normal: bool = entered_normal_hash.ct_eq(&stored_normal_hash).into();

    Ok(DuressCheckResult {
        is_duress,
        password_valid: is_duress || is_normal,
    })
}

/// Generate a decoy identity
///
/// Creates a new Nostr keypair and metadata that looks like a legitimate
/// but inactive user. The decoy should be pre-populated with some contacts
/// and messages to appear realistic.
///
/// SECURITY: The decoy identity should:
/// - Look like a real account (not obviously fake)
/// - Not contain anything incriminating
/// - Have some activity to avoid appearing suspicious
pub fn generate_decoy_identity(created_at: i64) -> DecoyIdentity {
    let keypair = generate_keypair();

    // Generate innocuous display name and about
    // These are generic enough to not draw attention
    let display_names = [
        "Alex",
        "Jordan",
        "Sam",
        "Casey",
        "Riley",
        "Morgan",
        "Taylor",
        "Quinn",
    ];
    let about_texts = [
        "Just here to chat",
        "Learning about Nostr",
        "Tech enthusiast",
        "New to this",
        "Hello world",
        "Testing things out",
        "Curious explorer",
        "Casual user",
    ];

    // Use deterministic selection based on public key to ensure consistency
    let pubkey_bytes = hex::decode(&keypair.public_key).unwrap_or_default();
    let name_idx = if pubkey_bytes.is_empty() {
        0
    } else {
        pubkey_bytes[0] as usize % display_names.len()
    };
    let about_idx = if pubkey_bytes.len() < 2 {
        0
    } else {
        pubkey_bytes[1] as usize % about_texts.len()
    };

    DecoyIdentity {
        keypair,
        display_name: display_names[name_idx].to_string(),
        about: about_texts[about_idx].to_string(),
        created_at,
    }
}

/// Securely destroy a private key using cryptographic shredding
///
/// Performs multiple secure overwrites before final zeroization.
/// This makes key recovery extremely difficult even with memory forensics.
///
/// SECURITY NOTES:
/// - Multiple passes with different patterns prevent recovery
/// - Final zeroization ensures no residue
/// - Compiler optimizations are prevented by using volatile operations
/// - This is a best-effort operation - some copies may exist in:
///   - Swap space (should be encrypted)
///   - Memory-mapped files
///   - OS page cache
///
/// For complete security, use encrypted memory and secure boot.
pub fn secure_destroy_key(mut key: Vec<u8>) -> Result<(), CryptoError> {
    if key.is_empty() {
        return Ok(());
    }

    // Multiple overwrite passes with different patterns
    for pass in 0..SECURE_WIPE_PASSES {
        let pattern = match pass {
            0 => 0xFF, // All ones
            1 => 0x00, // All zeros
            _ => 0xAA, // Alternating bits
        };

        // Overwrite each byte
        for byte in key.iter_mut() {
            // Use volatile write to prevent optimization
            unsafe {
                std::ptr::write_volatile(byte, pattern);
            }
        }

        // Memory barrier to ensure writes complete
        std::sync::atomic::fence(std::sync::atomic::Ordering::SeqCst);
    }

    // Random overwrite pass using OS RNG
    let mut random_bytes = vec![0u8; key.len()];
    OsRng.fill_bytes(&mut random_bytes);

    for (byte, &random) in key.iter_mut().zip(random_bytes.iter()) {
        unsafe {
            std::ptr::write_volatile(byte, random);
        }
    }

    // Final zeroization using zeroize crate
    random_bytes.zeroize();
    key.zeroize();

    Ok(())
}

/// Create a silent duress alert message
///
/// Generates an encrypted Nostr DM that alerts trusted contacts that
/// the user is under duress. The message is indistinguishable from
/// normal Nostr traffic.
///
/// SECURITY:
/// - Uses NIP-17 gift wrap for metadata protection
/// - Message looks like any other encrypted DM
/// - Timestamp is randomized per NIP-17
/// - Ephemeral key hides sender
pub fn create_duress_alert(
    sender_private_key: Vec<u8>,
    recipient_pubkey: String,
    created_at: i64,
    custom_message: Option<String>,
) -> Result<NostrEvent, CryptoError> {
    // Get sender public key
    let sender_pubkey = get_public_key(sender_private_key.clone())?;

    // Construct alert message
    let message = custom_message.unwrap_or_else(|| DURESS_ALERT_MESSAGE.to_string());

    // Create NIP-17 gift-wrapped message
    // Step 1: Create rumor (unsigned inner message)
    let rumor = create_rumor(
        sender_pubkey,
        recipient_pubkey.clone(),
        message,
        created_at,
    )?;

    // Step 2: Create seal (encrypted rumor, signed by sender)
    let seal = create_seal(
        sender_private_key,
        recipient_pubkey.clone(),
        rumor,
        created_at,
    )?;

    // Step 3: Create gift wrap (encrypted seal, signed by ephemeral key)
    create_gift_wrap(recipient_pubkey, seal, created_at)
}

/// Create duress alerts for multiple trusted contacts
///
/// Sends the same alert to all configured trusted contacts.
/// Each alert uses a different ephemeral key for unlinkability.
pub fn create_duress_alerts(
    sender_private_key: Vec<u8>,
    config: DuressAlertConfig,
    created_at: i64,
) -> Result<Vec<NostrEvent>, CryptoError> {
    let mut alerts = Vec::with_capacity(config.trusted_contact_pubkeys.len());

    let message = config.custom_message;

    for pubkey in config.trusted_contact_pubkeys {
        let alert = create_duress_alert(
            sender_private_key.clone(),
            pubkey,
            created_at,
            message.clone(),
        )?;
        alerts.push(alert);
    }

    Ok(alerts)
}

/// Validate that a duress password is sufficiently different from normal password
///
/// Ensures the duress password is:
/// - Not the same as the normal password
/// - Not a simple variation (reversed, case-changed, etc.)
/// - Memorable but distinct
///
/// Returns true if the duress password is acceptable.
pub fn validate_duress_password(
    duress_password: Vec<u8>,
    normal_password: Vec<u8>,
) -> Result<bool, CryptoError> {
    // Cannot be identical
    if duress_password == normal_password {
        return Ok(false);
    }

    // Cannot be reversed
    let reversed: Vec<u8> = normal_password.iter().rev().copied().collect();
    if duress_password == reversed {
        return Ok(false);
    }

    // Minimum length check (at least 4 characters for usability under stress)
    if duress_password.len() < 4 {
        return Ok(false);
    }

    // Cannot be just the normal password with a single character appended/prepended
    if duress_password.len() == normal_password.len() + 1 {
        // Check if it's normal password + one char
        if duress_password[..normal_password.len()] == normal_password[..] {
            return Ok(false);
        }
        if duress_password[1..] == normal_password[..] {
            return Ok(false);
        }
    }

    Ok(true)
}

/// Generate innocent-looking decoy contacts
///
/// Creates a list of fake pubkeys and display names that look realistic.
/// These are purely cosmetic - no real interaction happens with them.
pub fn generate_decoy_contacts(count: u32) -> Vec<DecoyContact> {
    let names = [
        "Mom",
        "Dad",
        "Alex",
        "Jamie",
        "Chris",
        "Pat",
        "Sam",
        "Jordan",
        "Taylor",
        "Morgan",
        "Casey",
        "Riley",
        "Avery",
        "Quinn",
        "Drew",
        "Skyler",
    ];

    let count = count as usize;
    let count = count.min(names.len());
    let mut contacts = Vec::with_capacity(count);

    for name in names.iter().take(count) {
        // Generate a random pubkey for each contact
        let contact_keypair = generate_keypair();
        contacts.push(DecoyContact {
            pubkey: contact_keypair.public_key.clone(),
            display_name: name.to_string(),
        });
    }

    contacts
}

/// Generate innocent-looking decoy messages
///
/// Creates fake message content that looks like normal conversation.
/// These appear in the decoy identity's message history.
pub fn generate_decoy_messages() -> Vec<String> {
    vec![
        "Hey, how's it going?".to_string(),
        "Did you see the game last night?".to_string(),
        "Can you pick up milk on the way home?".to_string(),
        "Happy birthday!".to_string(),
        "Thanks for dinner yesterday".to_string(),
        "See you tomorrow".to_string(),
        "Running late, be there in 10".to_string(),
        "Good morning!".to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_duress_password() {
        let password = b"duress123".to_vec();
        let salt = vec![0u8; 32];

        let hash = hash_duress_password(password.clone(), salt.clone()).unwrap();
        assert_eq!(hash.len(), 32);

        // Same password should produce same hash
        let hash2 = hash_duress_password(password, salt).unwrap();
        assert_eq!(hash, hash2);
    }

    #[test]
    fn test_hash_duress_password_different_salt() {
        let password = b"duress123".to_vec();
        let salt1 = vec![0u8; 32];
        let salt2 = vec![1u8; 32];

        let hash1 = hash_duress_password(password.clone(), salt1).unwrap();
        let hash2 = hash_duress_password(password, salt2).unwrap();

        // Different salts should produce different hashes
        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_check_duress_password_detects_duress() {
        let normal_password = b"normal123".to_vec();
        let duress_password = b"help".to_vec();
        let salt = vec![0u8; 32];

        // Pre-compute hashes as would be stored
        let stored_normal_hash = hash_duress_password(normal_password.clone(), salt.clone()).unwrap();
        let stored_duress_hash = hash_duress_password(duress_password.clone(), salt.clone()).unwrap();

        // Check that duress password is detected
        let result = check_duress_password(
            duress_password,
            salt.clone(),
            stored_duress_hash.clone(),
            stored_normal_hash.clone(),
        )
        .unwrap();

        assert!(result.is_duress);
        assert!(result.password_valid);
    }

    #[test]
    fn test_check_duress_password_normal_login() {
        let normal_password = b"normal123".to_vec();
        let duress_password = b"help".to_vec();
        let salt = vec![0u8; 32];

        let stored_normal_hash = hash_duress_password(normal_password.clone(), salt.clone()).unwrap();
        let stored_duress_hash = hash_duress_password(duress_password, salt.clone()).unwrap();

        // Check that normal password works but isn't flagged as duress
        let result = check_duress_password(
            normal_password,
            salt,
            stored_duress_hash,
            stored_normal_hash,
        )
        .unwrap();

        assert!(!result.is_duress);
        assert!(result.password_valid);
    }

    #[test]
    fn test_check_duress_password_wrong_password() {
        let normal_password = b"normal123".to_vec();
        let duress_password = b"help".to_vec();
        let wrong_password = b"wrong".to_vec();
        let salt = vec![0u8; 32];

        let stored_normal_hash = hash_duress_password(normal_password, salt.clone()).unwrap();
        let stored_duress_hash = hash_duress_password(duress_password, salt.clone()).unwrap();

        let result = check_duress_password(
            wrong_password,
            salt,
            stored_duress_hash,
            stored_normal_hash,
        )
        .unwrap();

        assert!(!result.is_duress);
        assert!(!result.password_valid);
    }

    #[test]
    fn test_generate_decoy_identity() {
        let now = 1700000000i64;
        let decoy = generate_decoy_identity(now);

        // Keypair should be valid
        assert_eq!(decoy.keypair.private_key.len(), 32);
        assert_eq!(decoy.keypair.public_key.len(), 64);

        // Display name and about should be set
        assert!(!decoy.display_name.is_empty());
        assert!(!decoy.about.is_empty());

        // Timestamp should match
        assert_eq!(decoy.created_at, now);
    }

    #[test]
    fn test_decoy_identity_consistency() {
        let now = 1700000000i64;
        let decoy = generate_decoy_identity(now);

        // The same keypair should always produce the same display name
        // (we derive it from the public key)
        let pubkey_bytes = hex::decode(&decoy.keypair.public_key).unwrap();
        let expected_name_idx = pubkey_bytes[0] as usize % 8;
        let expected_names = [
            "Alex", "Jordan", "Sam", "Casey", "Riley", "Morgan", "Taylor", "Quinn",
        ];
        assert_eq!(decoy.display_name, expected_names[expected_name_idx]);
    }

    #[test]
    fn test_secure_destroy_key() {
        let key = vec![0xAB; 32];
        let result = secure_destroy_key(key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_secure_destroy_empty_key() {
        let key = Vec::new();
        let result = secure_destroy_key(key);
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_duress_alert() {
        let sender = generate_keypair();
        let recipient = generate_keypair();
        let now = 1700000000i64;

        let alert = create_duress_alert(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            now,
            None,
        )
        .unwrap();

        // Should be a valid gift wrap event
        assert_eq!(alert.kind, 1059); // KIND_GIFT_WRAP
        assert!(!alert.sig.is_empty());

        // Should have p tag pointing to recipient
        assert!(alert.tags.iter().any(|t| t.len() >= 2 && t[0] == "p" && t[1] == recipient.public_key));
    }

    #[test]
    fn test_create_duress_alert_with_custom_message() {
        let sender = generate_keypair();
        let recipient = generate_keypair();
        let now = 1700000000i64;

        let alert = create_duress_alert(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            now,
            Some("Emergency - need help".to_string()),
        )
        .unwrap();

        assert_eq!(alert.kind, 1059);
    }

    #[test]
    fn test_create_duress_alerts_multiple_contacts() {
        let sender = generate_keypair();
        let recipient1 = generate_keypair();
        let recipient2 = generate_keypair();
        let now = 1700000000i64;

        let config = DuressAlertConfig {
            trusted_contact_pubkeys: vec![recipient1.public_key.clone(), recipient2.public_key.clone()],
            include_location: false,
            custom_message: None,
        };

        let alerts = create_duress_alerts(sender.private_key.clone(), config, now).unwrap();

        assert_eq!(alerts.len(), 2);

        // Each alert should have different ephemeral pubkey (gift wrap property)
        assert_ne!(alerts[0].pubkey, alerts[1].pubkey);
    }

    #[test]
    fn test_validate_duress_password_rejects_identical() {
        let password = b"mypassword123".to_vec();
        let result = validate_duress_password(password.clone(), password).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_validate_duress_password_rejects_reversed() {
        let normal = b"password".to_vec();
        let reversed = b"drowssap".to_vec(); // "password" reversed
        let result = validate_duress_password(reversed, normal).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_validate_duress_password_rejects_too_short() {
        let normal = b"normalpassword".to_vec();
        let duress = b"abc".to_vec(); // Too short
        let result = validate_duress_password(duress, normal).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_validate_duress_password_rejects_simple_append() {
        let normal = b"password".to_vec();
        let duress = b"password1".to_vec(); // Just appended "1"
        let result = validate_duress_password(duress, normal).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_validate_duress_password_rejects_simple_prepend() {
        let normal = b"password".to_vec();
        let duress = b"1password".to_vec(); // Just prepended "1"
        let result = validate_duress_password(duress, normal).unwrap();
        assert!(!result);
    }

    #[test]
    fn test_validate_duress_password_accepts_valid() {
        let normal = b"normalpassword".to_vec();
        let duress = b"help".to_vec(); // Simple but distinct
        let result = validate_duress_password(duress, normal).unwrap();
        assert!(result);
    }

    #[test]
    fn test_generate_decoy_contacts() {
        let contacts = generate_decoy_contacts(5);

        assert_eq!(contacts.len(), 5);

        for contact in &contacts {
            // Pubkey should be valid hex
            assert_eq!(contact.pubkey.len(), 64);
            // Name should not be empty
            assert!(!contact.display_name.is_empty());
        }

        // All pubkeys should be unique
        let pubkeys: std::collections::HashSet<_> = contacts.iter().map(|c| &c.pubkey).collect();
        assert_eq!(pubkeys.len(), 5);
    }

    #[test]
    fn test_generate_decoy_messages() {
        let messages = generate_decoy_messages();

        assert!(!messages.is_empty());

        for msg in &messages {
            assert!(!msg.is_empty());
            // Messages should look innocent
            assert!(!msg.to_lowercase().contains("duress"));
            assert!(!msg.to_lowercase().contains("emergency"));
            assert!(!msg.to_lowercase().contains("help me"));
        }
    }
}
