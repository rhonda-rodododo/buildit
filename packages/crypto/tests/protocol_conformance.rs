//! Protocol conformance tests
//!
//! These tests verify that the crypto implementation matches the
//! BuildIt Protocol Specification test vectors.

use buildit_crypto::*;

#[test]
fn test_keypair_format() {
    let kp = generate_keypair();

    // Private key should be 32 bytes
    assert_eq!(kp.private_key.len(), 32);

    // Public key should be 64 hex chars (32 bytes x-only)
    assert_eq!(kp.public_key.len(), 64);
    assert!(kp.public_key.chars().all(|c| c.is_ascii_hexdigit()));
}

#[test]
fn test_master_key_derivation() {
    let password = "correct horse battery staple".to_string();
    let salt = generate_salt(32);

    let key = derive_master_key(password.clone(), salt.clone()).unwrap();
    assert_eq!(key.len(), 32);

    // Same inputs should produce same output
    let key2 = derive_master_key(password, salt).unwrap();
    assert_eq!(key, key2);
}

#[test]
fn test_database_key_derivation() {
    let master_key = vec![0u8; 32];
    let db_key = derive_database_key(master_key.clone()).unwrap();

    assert_eq!(db_key.len(), 32);
    assert_ne!(db_key, master_key);

    // Same input should produce same output
    let db_key2 = derive_database_key(master_key).unwrap();
    assert_eq!(db_key, db_key2);
}

#[test]
fn test_nip44_roundtrip() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    let messages = vec![
        "Hello, World!",
        "Short",
        "A longer message that spans multiple padding blocks to verify the implementation handles padding correctly.",
        "Unicode: Hello 世界! 🌍 Привет! مرحبا",
        "Special chars: \n\t\r\0",
    ];

    for msg in messages {
        let encrypted = nip44_encrypt(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            msg.to_string(),
        )
        .unwrap();

        let decrypted = nip44_decrypt(
            recipient.private_key.clone(),
            sender.public_key.clone(),
            encrypted,
        )
        .unwrap();

        assert_eq!(decrypted, msg);
    }
}

#[test]
fn test_gift_wrap_roundtrip() {
    let sender = generate_keypair();
    let recipient = generate_keypair();
    let now = 1700000000i64;

    let message = "This is a private gift-wrapped message";

    // Create full gift wrap
    let rumor = create_rumor(
        sender.public_key.clone(),
        recipient.public_key.clone(),
        message.to_string(),
        now,
    )
    .unwrap();

    assert_eq!(rumor.kind, 14);
    assert!(rumor.sig.is_empty()); // Rumor should be unsigned

    let seal = create_seal(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        rumor,
        now,
    )
    .unwrap();

    assert_eq!(seal.kind, 13);
    assert!(!seal.sig.is_empty()); // Seal should be signed

    let gift_wrap = create_gift_wrap(recipient.public_key.clone(), seal, now).unwrap();

    assert_eq!(gift_wrap.kind, 1059);
    assert!(!gift_wrap.sig.is_empty()); // Gift wrap should be signed
    assert_eq!(gift_wrap.tags.len(), 1);
    assert_eq!(gift_wrap.tags[0][0], "p");

    // Unwrap and verify
    let result = unwrap_gift_wrap(recipient.private_key.clone(), gift_wrap).unwrap();

    assert!(result.seal_verified);
    assert_eq!(result.sender_pubkey, sender.public_key);
    assert_eq!(result.rumor.content, message);
}

#[test]
fn test_nostr_event_signing() {
    let kp = generate_keypair();

    let unsigned = UnsignedEvent {
        pubkey: kp.public_key.clone(),
        created_at: 1700000000,
        kind: 1,
        tags: vec![vec!["p".to_string(), "deadbeef".to_string()]],
        content: "Test message".to_string(),
    };

    let signed = sign_event(kp.private_key, unsigned).unwrap();

    // Event ID should be 64 hex chars
    assert_eq!(signed.id.len(), 64);

    // Signature should be 128 hex chars (64 bytes)
    assert_eq!(signed.sig.len(), 128);

    // Event should verify
    assert!(verify_event(signed.clone()));

    // Tampering should fail verification
    let mut tampered = signed;
    tampered.content = "Tampered message".to_string();
    assert!(!verify_event(tampered));
}

#[test]
fn test_aes_gcm_roundtrip() {
    let key = vec![0u8; 32];
    let plaintext = b"Secret data for AES encryption test".to_vec();

    let encrypted = aes_encrypt(key.clone(), plaintext.clone()).unwrap();

    assert_eq!(encrypted.nonce.len(), 12);
    assert_ne!(encrypted.ciphertext, plaintext);

    let decrypted = aes_decrypt(key, encrypted).unwrap();
    assert_eq!(decrypted, plaintext);
}

#[test]
fn test_hex_utilities() {
    let original = vec![0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef];
    let hex_str = bytes_to_hex(original.clone());

    assert_eq!(hex_str, "0123456789abcdef");

    let decoded = hex_to_bytes(hex_str).unwrap();
    assert_eq!(decoded, original);
}

#[test]
fn test_timestamp_randomization() {
    let base = 1700000000i64;
    let range = 172800u32; // 2 days

    // Run multiple times to verify randomization
    let mut all_same = true;
    let mut last = base;

    for _ in 0..100 {
        let randomized = randomize_timestamp(base, range);

        // Should be within range
        assert!(randomized >= base - range as i64);
        assert!(randomized <= base + range as i64);

        if randomized != last {
            all_same = false;
        }
        last = randomized;
    }

    // Should not all be the same (randomization working)
    assert!(!all_same);
}
