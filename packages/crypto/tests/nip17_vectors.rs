//! NIP-17 Gift Wrap Test Vectors
//!
//! These tests verify compliance with the NIP-17 specification for
//! private direct messages with metadata protection.

use buildit_crypto::*;

/// Test that rumor events are properly formatted
#[test]
fn test_nip17_rumor_format() {
    let sender = generate_keypair();
    let recipient = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let rumor = create_rumor(
        sender.public_key.clone(),
        recipient.public_key.clone(),
        "Test message".to_string(),
        now,
    )
    .unwrap();

    // Kind should be 14
    assert_eq!(rumor.kind, 14);

    // Should have no signature
    assert!(rumor.sig.is_empty());

    // Should have ID
    assert_eq!(rumor.id.len(), 64);

    // Should have p tag with recipient
    assert_eq!(rumor.tags.len(), 1);
    assert_eq!(rumor.tags[0][0], "p");
    assert_eq!(rumor.tags[0][1], recipient.public_key);

    // Timestamp should be randomized (within ±2 days)
    let diff = (rumor.created_at - now).abs();
    assert!(diff <= 172800, "Timestamp not within expected range");
}

/// Test that seal events are properly formatted
#[test]
fn test_nip17_seal_format() {
    let sender = generate_keypair();
    let recipient = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let rumor = create_rumor(
        sender.public_key.clone(),
        recipient.public_key.clone(),
        "Test message".to_string(),
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

    // Kind should be 13
    assert_eq!(seal.kind, 13);

    // Should be signed
    assert!(!seal.sig.is_empty());
    assert_eq!(seal.sig.len(), 128);

    // Should have ID
    assert_eq!(seal.id.len(), 64);

    // Should have no tags
    assert!(seal.tags.is_empty());

    // Content should be encrypted (base64)
    assert!(
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &seal.content).is_ok()
    );

    // Pubkey should match sender
    assert_eq!(seal.pubkey, sender.public_key);

    // Should verify
    assert!(verify_event(seal));
}

/// Test that gift wrap events are properly formatted
#[test]
fn test_nip17_gift_wrap_format() {
    let sender = generate_keypair();
    let recipient = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let rumor = create_rumor(
        sender.public_key.clone(),
        recipient.public_key.clone(),
        "Test message".to_string(),
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

    // Kind should be 1059
    assert_eq!(gift_wrap.kind, 1059);

    // Should be signed (by ephemeral key)
    assert!(!gift_wrap.sig.is_empty());
    assert_eq!(gift_wrap.sig.len(), 128);

    // Should have ID
    assert_eq!(gift_wrap.id.len(), 64);

    // Should have p tag with recipient
    assert_eq!(gift_wrap.tags.len(), 1);
    assert_eq!(gift_wrap.tags[0][0], "p");
    assert_eq!(gift_wrap.tags[0][1], recipient.public_key);

    // Pubkey should be ephemeral (not sender)
    assert_ne!(gift_wrap.pubkey, sender.public_key);
    assert_eq!(gift_wrap.pubkey.len(), 64);

    // Content should be encrypted (base64)
    assert!(base64::Engine::decode(
        &base64::engine::general_purpose::STANDARD,
        &gift_wrap.content
    )
    .is_ok());

    // Should verify (signed by ephemeral key)
    assert!(verify_event(gift_wrap));
}

/// Test complete gift wrap flow with multiple messages
#[test]
fn test_nip17_multiple_messages() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let messages = vec![
        "First message",
        "Second message",
        "Third message with unicode: 你好 🌍",
    ];

    for msg in messages {
        // Alice sends to Bob
        let rumor = create_rumor(
            alice.public_key.clone(),
            bob.public_key.clone(),
            msg.to_string(),
            now,
        )
        .unwrap();

        let seal = create_seal(
            alice.private_key.clone(),
            bob.public_key.clone(),
            rumor,
            now,
        )
        .unwrap();

        let gift_wrap = create_gift_wrap(bob.public_key.clone(), seal, now).unwrap();

        // Bob unwraps
        let result = unwrap_gift_wrap(bob.private_key.clone(), gift_wrap).unwrap();

        assert!(result.seal_verified);
        assert_eq!(result.sender_pubkey, alice.public_key);
        assert_eq!(result.rumor.content, msg);
        assert_eq!(result.rumor.kind, 14);
    }
}

/// Test that wrong recipient cannot unwrap
#[test]
fn test_nip17_wrong_recipient() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let eve = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let rumor = create_rumor(
        alice.public_key.clone(),
        bob.public_key.clone(),
        "Secret for Bob".to_string(),
        now,
    )
    .unwrap();

    let seal = create_seal(
        alice.private_key.clone(),
        bob.public_key.clone(),
        rumor,
        now,
    )
    .unwrap();

    let gift_wrap = create_gift_wrap(bob.public_key.clone(), seal, now).unwrap();

    // Eve tries to unwrap
    let result = unwrap_gift_wrap(eve.private_key.clone(), gift_wrap);

    assert!(result.is_err());
}

/// Test timestamp randomization for metadata protection
#[test]
fn test_nip17_timestamp_randomization() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let mut rumor_timestamps = Vec::new();
    let mut seal_timestamps = Vec::new();
    let mut wrap_timestamps = Vec::new();

    // Create multiple gift wraps with same base timestamp
    for _ in 0..20 {
        let rumor = create_rumor(
            alice.public_key.clone(),
            bob.public_key.clone(),
            "Test".to_string(),
            now,
        )
        .unwrap();
        rumor_timestamps.push(rumor.created_at);

        let seal = create_seal(
            alice.private_key.clone(),
            bob.public_key.clone(),
            rumor,
            now,
        )
        .unwrap();
        seal_timestamps.push(seal.created_at);

        let gift_wrap = create_gift_wrap(bob.public_key.clone(), seal, now).unwrap();
        wrap_timestamps.push(gift_wrap.created_at);
    }

    // All timestamps should be within ±2 days
    for ts in &rumor_timestamps {
        assert!((*ts - now).abs() <= 172800);
    }
    for ts in &seal_timestamps {
        assert!((*ts - now).abs() <= 172800);
    }
    for ts in &wrap_timestamps {
        assert!((*ts - now).abs() <= 172800);
    }

    // Should have multiple unique timestamps (randomization working)
    let unique_rumor: std::collections::HashSet<_> = rumor_timestamps.iter().collect();
    let unique_seal: std::collections::HashSet<_> = seal_timestamps.iter().collect();
    let unique_wrap: std::collections::HashSet<_> = wrap_timestamps.iter().collect();

    assert!(unique_rumor.len() > 1, "Rumor timestamps not randomized");
    assert!(unique_seal.len() > 1, "Seal timestamps not randomized");
    assert!(unique_wrap.len() > 1, "Gift wrap timestamps not randomized");
}

/// Test that each gift wrap uses a different ephemeral key
#[test]
fn test_nip17_ephemeral_key_uniqueness() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let mut ephemeral_keys = Vec::new();

    // Create multiple gift wraps
    for _ in 0..10 {
        let rumor = create_rumor(
            alice.public_key.clone(),
            bob.public_key.clone(),
            "Test".to_string(),
            now,
        )
        .unwrap();

        let seal = create_seal(
            alice.private_key.clone(),
            bob.public_key.clone(),
            rumor,
            now,
        )
        .unwrap();

        let gift_wrap = create_gift_wrap(bob.public_key.clone(), seal, now).unwrap();

        ephemeral_keys.push(gift_wrap.pubkey);
    }

    // All ephemeral keys should be unique
    let unique: std::collections::HashSet<_> = ephemeral_keys.iter().collect();
    assert_eq!(unique.len(), 10, "Ephemeral keys should be unique");
}

/// Test seal verification result
#[test]
fn test_nip17_seal_verification() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    let rumor = create_rumor(
        alice.public_key.clone(),
        bob.public_key.clone(),
        "Test message".to_string(),
        now,
    )
    .unwrap();

    let seal = create_seal(
        alice.private_key.clone(),
        bob.public_key.clone(),
        rumor,
        now,
    )
    .unwrap();

    // Verify seal is valid
    assert!(verify_event(seal.clone()));

    let gift_wrap = create_gift_wrap(bob.public_key.clone(), seal, now).unwrap();

    let result = unwrap_gift_wrap(bob.private_key.clone(), gift_wrap).unwrap();

    // Seal should be verified in result
    assert!(result.seal_verified);
    assert_eq!(result.sender_pubkey, alice.public_key);
}

/// Test large message content
#[test]
fn test_nip17_large_message() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    // Create a large message (10KB)
    let large_message = "x".repeat(10000);

    let rumor = create_rumor(
        alice.public_key.clone(),
        bob.public_key.clone(),
        large_message.clone(),
        now,
    )
    .unwrap();

    let seal = create_seal(
        alice.private_key.clone(),
        bob.public_key.clone(),
        rumor,
        now,
    )
    .unwrap();

    let gift_wrap = create_gift_wrap(bob.public_key.clone(), seal, now).unwrap();

    let result = unwrap_gift_wrap(bob.private_key.clone(), gift_wrap).unwrap();

    assert_eq!(result.rumor.content, large_message);
}

/// Test bidirectional communication
#[test]
fn test_nip17_bidirectional() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64;

    // Alice sends to Bob
    let alice_msg = "Hello Bob!";
    let rumor1 = create_rumor(
        alice.public_key.clone(),
        bob.public_key.clone(),
        alice_msg.to_string(),
        now,
    )
    .unwrap();

    let seal1 = create_seal(
        alice.private_key.clone(),
        bob.public_key.clone(),
        rumor1,
        now,
    )
    .unwrap();

    let gift1 = create_gift_wrap(bob.public_key.clone(), seal1, now).unwrap();

    let result1 = unwrap_gift_wrap(bob.private_key.clone(), gift1).unwrap();
    assert_eq!(result1.rumor.content, alice_msg);
    assert_eq!(result1.sender_pubkey, alice.public_key);

    // Bob replies to Alice
    let bob_msg = "Hi Alice!";
    let rumor2 = create_rumor(
        bob.public_key.clone(),
        alice.public_key.clone(),
        bob_msg.to_string(),
        now,
    )
    .unwrap();

    let seal2 = create_seal(
        bob.private_key.clone(),
        alice.public_key.clone(),
        rumor2,
        now,
    )
    .unwrap();

    let gift2 = create_gift_wrap(alice.public_key.clone(), seal2, now).unwrap();

    let result2 = unwrap_gift_wrap(alice.private_key.clone(), gift2).unwrap();
    assert_eq!(result2.rumor.content, bob_msg);
    assert_eq!(result2.sender_pubkey, bob.public_key);
}
