//! Nostr event handling - signing and verification

use crate::error::CryptoError;
use secp256k1::{schnorr, Message, Secp256k1, SecretKey, XOnlyPublicKey};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Unsigned Nostr event (before signing)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnsignedEvent {
    pub pubkey: String,
    pub created_at: i64,
    pub kind: i32,
    pub tags: Vec<Vec<String>>,
    pub content: String,
}

/// Signed Nostr event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NostrEvent {
    pub id: String,
    pub pubkey: String,
    pub created_at: i64,
    pub kind: i32,
    pub tags: Vec<Vec<String>>,
    pub content: String,
    pub sig: String,
}

/// Compute the event ID (SHA256 hash of serialized event)
pub fn compute_event_id(event: UnsignedEvent) -> Result<String, CryptoError> {
    // Serialize according to NIP-01
    let serialized = serialize_event(&event)?;

    // SHA256 hash
    let mut hasher = Sha256::new();
    hasher.update(serialized.as_bytes());
    let hash = hasher.finalize();

    Ok(hex::encode(hash))
}

/// Serialize event for hashing (NIP-01 format)
fn serialize_event(event: &UnsignedEvent) -> Result<String, CryptoError> {
    // [0, pubkey, created_at, kind, tags, content]
    let tags_json = serde_json::to_string(&event.tags).map_err(|_| CryptoError::InvalidJson)?;

    let content_json =
        serde_json::to_string(&event.content).map_err(|_| CryptoError::InvalidJson)?;

    Ok(format!(
        "[0,\"{}\",{},{},{},{}]",
        event.pubkey, event.created_at, event.kind, tags_json, content_json
    ))
}

/// Sign an unsigned event
pub fn sign_event(private_key: Vec<u8>, event: UnsignedEvent) -> Result<NostrEvent, CryptoError> {
    if private_key.len() != 32 {
        return Err(CryptoError::InvalidKey);
    }

    let secp = Secp256k1::new();
    let secret_key = SecretKey::from_slice(&private_key).map_err(|_| CryptoError::InvalidKey)?;

    // Compute event ID
    let id = compute_event_id(event.clone())?;
    let id_bytes = hex::decode(&id).map_err(|_| CryptoError::InvalidHex)?;

    // Create message from ID
    let message = Message::from_digest_slice(&id_bytes).map_err(|_| CryptoError::SigningFailed)?;

    // Sign with Schnorr using OS RNG (cryptographically secure)
    let keypair = secp256k1::Keypair::from_secret_key(&secp, &secret_key);
    let signature = secp.sign_schnorr_with_rng(&message, &keypair, &mut rand::rngs::OsRng);

    Ok(NostrEvent {
        id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags,
        content: event.content,
        sig: hex::encode(signature.serialize()),
    })
}

/// Verify a signed event
pub fn verify_event(event: NostrEvent) -> bool {
    // Reconstruct unsigned event to compute expected ID
    let unsigned = UnsignedEvent {
        pubkey: event.pubkey.clone(),
        created_at: event.created_at,
        kind: event.kind,
        tags: event.tags.clone(),
        content: event.content.clone(),
    };

    // Verify ID
    let expected_id = match compute_event_id(unsigned) {
        Ok(id) => id,
        Err(_) => return false,
    };

    if event.id != expected_id {
        return false;
    }

    // Parse public key
    let pubkey_bytes = match hex::decode(&event.pubkey) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let xonly_pubkey = match XOnlyPublicKey::from_slice(&pubkey_bytes) {
        Ok(pk) => pk,
        Err(_) => return false,
    };

    // Parse signature
    let sig_bytes = match hex::decode(&event.sig) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let signature = match schnorr::Signature::from_slice(&sig_bytes) {
        Ok(s) => s,
        Err(_) => return false,
    };

    // Parse message (event ID)
    let id_bytes = match hex::decode(&event.id) {
        Ok(b) => b,
        Err(_) => return false,
    };

    let message = match Message::from_digest_slice(&id_bytes) {
        Ok(m) => m,
        Err(_) => return false,
    };

    // Verify signature
    let secp = Secp256k1::new();
    secp.verify_schnorr(&signature, &message, &xonly_pubkey)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::keys::generate_keypair;

    #[test]
    fn test_sign_and_verify_event() {
        let keypair = generate_keypair();

        let unsigned = UnsignedEvent {
            pubkey: keypair.public_key.clone(),
            created_at: 1700000000,
            kind: 1,
            tags: vec![],
            content: "Hello, Nostr!".to_string(),
        };

        let signed = sign_event(keypair.private_key.clone(), unsigned).unwrap();

        // Verify the signed event
        assert!(verify_event(signed.clone()));

        // Verify ID is 64 hex chars
        assert_eq!(signed.id.len(), 64);

        // Verify signature is 128 hex chars
        assert_eq!(signed.sig.len(), 128);
    }

    #[test]
    fn test_verify_event_with_tags() {
        let keypair = generate_keypair();

        let unsigned = UnsignedEvent {
            pubkey: keypair.public_key.clone(),
            created_at: 1700000000,
            kind: 1,
            tags: vec![
                vec!["p".to_string(), "deadbeef".to_string()],
                vec!["e".to_string(), "cafebabe".to_string()],
            ],
            content: "Tagged message".to_string(),
        };

        let signed = sign_event(keypair.private_key.clone(), unsigned).unwrap();
        assert!(verify_event(signed));
    }

    #[test]
    fn test_tampered_event_fails() {
        let keypair = generate_keypair();

        let unsigned = UnsignedEvent {
            pubkey: keypair.public_key.clone(),
            created_at: 1700000000,
            kind: 1,
            tags: vec![],
            content: "Original message".to_string(),
        };

        let mut signed = sign_event(keypair.private_key.clone(), unsigned).unwrap();

        // Tamper with content
        signed.content = "Tampered message".to_string();

        // Verification should fail
        assert!(!verify_event(signed));
    }

    #[test]
    fn test_wrong_pubkey_fails() {
        let keypair1 = generate_keypair();
        let keypair2 = generate_keypair();

        let unsigned = UnsignedEvent {
            pubkey: keypair1.public_key.clone(),
            created_at: 1700000000,
            kind: 1,
            tags: vec![],
            content: "Message".to_string(),
        };

        let mut signed = sign_event(keypair1.private_key.clone(), unsigned).unwrap();

        // Change pubkey to someone else's
        signed.pubkey = keypair2.public_key.clone();

        // Verification should fail (ID won't match)
        assert!(!verify_event(signed));
    }
}
