//! NIP-17 Gift Wrap Implementation
//!
//! Provides metadata protection for private messages through:
//! 1. Rumor (kind 14): Unsigned inner message
//! 2. Seal (kind 13): Encrypted rumor, signed by sender
//! 3. Gift Wrap (kind 1059): Encrypted seal, signed by ephemeral key

use crate::error::CryptoError;
use crate::keys::{generate_keypair, get_public_key};
use crate::nip44::{nip44_decrypt, nip44_encrypt};
use crate::nostr::{compute_event_id, sign_event, verify_event, NostrEvent, UnsignedEvent};
use crate::randomize_timestamp;

/// Result of unwrapping a gift-wrapped message
#[derive(Debug, Clone)]
pub struct UnwrapResult {
    pub rumor: NostrEvent,
    pub sender_pubkey: String,
    pub seal_verified: bool,
}

/// Event kinds for NIP-17
const KIND_SEAL: i32 = 13;
const KIND_RUMOR: i32 = 14;
const KIND_GIFT_WRAP: i32 = 1059;

/// Time randomization range (2 days in seconds)
const TIMESTAMP_RANGE: u32 = 172800;

/// Create a rumor event (unsigned kind 14)
pub fn create_rumor(
    sender_pubkey: String,
    recipient_pubkey: String,
    content: String,
    created_at: i64,
) -> Result<NostrEvent, CryptoError> {
    // Randomize timestamp within ±2 days
    let randomized_time = randomize_timestamp(created_at, TIMESTAMP_RANGE);

    // Create unsigned event
    let unsigned = UnsignedEvent {
        pubkey: sender_pubkey,
        created_at: randomized_time,
        kind: KIND_RUMOR,
        tags: vec![vec!["p".to_string(), recipient_pubkey]],
        content,
    };

    // Compute ID but leave signature empty
    let id = compute_event_id(unsigned.clone())?;

    Ok(NostrEvent {
        id,
        pubkey: unsigned.pubkey,
        created_at: unsigned.created_at,
        kind: unsigned.kind,
        tags: unsigned.tags,
        content: unsigned.content,
        sig: String::new(), // Rumor has no signature
    })
}

/// Create a seal event (kind 13) containing encrypted rumor
pub fn create_seal(
    sender_private_key: Vec<u8>,
    recipient_pubkey: String,
    rumor: NostrEvent,
    created_at: i64,
) -> Result<NostrEvent, CryptoError> {
    // Serialize rumor to JSON
    let rumor_json = serialize_event(&rumor)?;

    // Encrypt rumor with NIP-44
    let encrypted_rumor = nip44_encrypt(
        sender_private_key.clone(),
        recipient_pubkey.clone(),
        rumor_json,
    )?;

    // Randomize timestamp
    let randomized_time = randomize_timestamp(created_at, TIMESTAMP_RANGE);

    // Get sender pubkey
    let sender_pubkey = get_public_key(sender_private_key.clone())?;

    // Create and sign seal
    let unsigned = UnsignedEvent {
        pubkey: sender_pubkey,
        created_at: randomized_time,
        kind: KIND_SEAL,
        tags: vec![], // No tags on seal
        content: encrypted_rumor,
    };

    sign_event(sender_private_key, unsigned)
}

/// Create a gift wrap event (kind 1059) containing encrypted seal
pub fn create_gift_wrap(
    recipient_pubkey: String,
    seal: NostrEvent,
    created_at: i64,
) -> Result<NostrEvent, CryptoError> {
    // Generate ephemeral keypair
    let ephemeral = generate_keypair();

    // Serialize seal to JSON
    let seal_json = serialize_event(&seal)?;

    // Encrypt seal with ephemeral key
    let encrypted_seal = nip44_encrypt(
        ephemeral.private_key.clone(),
        recipient_pubkey.clone(),
        seal_json,
    )?;

    // Randomize timestamp
    let randomized_time = randomize_timestamp(created_at, TIMESTAMP_RANGE);

    // Create and sign gift wrap with ephemeral key
    let unsigned = UnsignedEvent {
        pubkey: ephemeral.public_key,
        created_at: randomized_time,
        kind: KIND_GIFT_WRAP,
        tags: vec![vec!["p".to_string(), recipient_pubkey]],
        content: encrypted_seal,
    };

    sign_event(ephemeral.private_key, unsigned)
}

/// Unwrap a gift-wrapped message
pub fn unwrap_gift_wrap(
    recipient_private_key: Vec<u8>,
    gift_wrap: NostrEvent,
) -> Result<UnwrapResult, CryptoError> {
    // Verify gift wrap kind
    if gift_wrap.kind != KIND_GIFT_WRAP {
        return Err(CryptoError::InvalidCiphertext);
    }

    // Decrypt gift wrap to get seal
    let seal_json = nip44_decrypt(
        recipient_private_key.clone(),
        gift_wrap.pubkey.clone(), // ephemeral pubkey
        gift_wrap.content,
    )?;

    // Parse seal
    let seal = deserialize_event(&seal_json)?;

    // Verify seal kind
    if seal.kind != KIND_SEAL {
        return Err(CryptoError::InvalidCiphertext);
    }

    // Verify seal signature
    let seal_verified = verify_event(seal.clone());

    // Extract sender pubkey from seal
    let sender_pubkey = seal.pubkey.clone();

    // Decrypt seal to get rumor
    let rumor_json = nip44_decrypt(
        recipient_private_key,
        sender_pubkey.clone(),
        seal.content,
    )?;

    // Parse rumor
    let rumor = deserialize_event(&rumor_json)?;

    // Verify rumor kind
    if rumor.kind != KIND_RUMOR {
        return Err(CryptoError::InvalidCiphertext);
    }

    Ok(UnwrapResult {
        rumor,
        sender_pubkey,
        seal_verified,
    })
}

/// Serialize a NostrEvent to JSON
fn serialize_event(event: &NostrEvent) -> Result<String, CryptoError> {
    serde_json::to_string(&EventJsonOut {
        id: &event.id,
        pubkey: &event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: &event.tags,
        content: &event.content,
        sig: &event.sig,
    })
    .map_err(|_| CryptoError::InvalidJson)
}

/// Deserialize JSON to NostrEvent
fn deserialize_event(json: &str) -> Result<NostrEvent, CryptoError> {
    // Safe parsing - check for prototype pollution
    if json.contains("__proto__") || json.contains("constructor") || json.contains("prototype") {
        return Err(CryptoError::InvalidJson);
    }

    let parsed: EventJsonIn = serde_json::from_str(json).map_err(|_| CryptoError::InvalidJson)?;

    Ok(NostrEvent {
        id: parsed.id,
        pubkey: parsed.pubkey,
        created_at: parsed.created_at,
        kind: parsed.kind,
        tags: parsed.tags,
        content: parsed.content,
        sig: parsed.sig,
    })
}

/// JSON representation for serialization
#[derive(serde::Serialize)]
struct EventJsonOut<'a> {
    id: &'a str,
    pubkey: &'a str,
    created_at: i64,
    kind: i32,
    tags: &'a Vec<Vec<String>>,
    content: &'a str,
    sig: &'a str,
}

/// JSON representation for deserialization
#[derive(serde::Deserialize)]
struct EventJsonIn {
    id: String,
    pubkey: String,
    created_at: i64,
    kind: i32,
    tags: Vec<Vec<String>>,
    content: String,
    sig: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_full_gift_wrap_flow() {
        let sender = generate_keypair();
        let recipient = generate_keypair();

        let message = "Hello, this is a private message!";
        let now = 1700000000i64;

        // Step 1: Create rumor
        let rumor = create_rumor(
            sender.public_key.clone(),
            recipient.public_key.clone(),
            message.to_string(),
            now,
        )
        .unwrap();

        assert_eq!(rumor.kind, KIND_RUMOR);
        assert!(rumor.sig.is_empty()); // Rumor is unsigned

        // Step 2: Create seal
        let seal = create_seal(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            rumor.clone(),
            now,
        )
        .unwrap();

        assert_eq!(seal.kind, KIND_SEAL);
        assert!(!seal.sig.is_empty()); // Seal is signed

        // Step 3: Create gift wrap
        let gift_wrap = create_gift_wrap(
            recipient.public_key.clone(),
            seal.clone(),
            now,
        )
        .unwrap();

        assert_eq!(gift_wrap.kind, KIND_GIFT_WRAP);
        assert!(!gift_wrap.sig.is_empty()); // Gift wrap is signed

        // Verify gift wrap has p tag
        assert_eq!(gift_wrap.tags.len(), 1);
        assert_eq!(gift_wrap.tags[0][0], "p");
        assert_eq!(gift_wrap.tags[0][1], recipient.public_key);

        // Step 4: Unwrap on recipient side
        let result = unwrap_gift_wrap(recipient.private_key.clone(), gift_wrap).unwrap();

        assert!(result.seal_verified);
        assert_eq!(result.sender_pubkey, sender.public_key);
        assert_eq!(result.rumor.content, message);
    }

    #[test]
    fn test_wrong_recipient_fails() {
        let sender = generate_keypair();
        let recipient = generate_keypair();
        let wrong = generate_keypair();

        let message = "Secret message";
        let now = 1700000000i64;

        let rumor = create_rumor(
            sender.public_key.clone(),
            recipient.public_key.clone(),
            message.to_string(),
            now,
        )
        .unwrap();

        let seal = create_seal(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            rumor,
            now,
        )
        .unwrap();

        let gift_wrap = create_gift_wrap(recipient.public_key.clone(), seal, now).unwrap();

        // Try to unwrap with wrong key
        let result = unwrap_gift_wrap(wrong.private_key.clone(), gift_wrap);
        assert!(result.is_err());
    }

    #[test]
    fn test_timestamp_randomization() {
        let sender = generate_keypair();
        let recipient = generate_keypair();

        let now = 1700000000i64;
        let mut timestamps = Vec::new();

        for _ in 0..10 {
            let rumor = create_rumor(
                sender.public_key.clone(),
                recipient.public_key.clone(),
                "Test".to_string(),
                now,
            )
            .unwrap();

            timestamps.push(rumor.created_at);
        }

        // All timestamps should be within ±2 days
        for ts in &timestamps {
            assert!(*ts >= now - TIMESTAMP_RANGE as i64);
            assert!(*ts <= now + TIMESTAMP_RANGE as i64);
        }

        // Not all timestamps should be the same (randomization working)
        let unique: std::collections::HashSet<_> = timestamps.iter().collect();
        assert!(unique.len() > 1);
    }

    #[test]
    fn test_prototype_pollution_prevention() {
        let malicious = r#"{"__proto__": {"isAdmin": true}, "id": "", "pubkey": "", "created_at": 0, "kind": 0, "tags": [], "content": "", "sig": ""}"#;

        let result = deserialize_event(malicious);
        assert!(result.is_err());
    }
}
