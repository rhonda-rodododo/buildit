//! Tauri app integration tests
//!
//! These tests verify that buildit-crypto works correctly
//! for the Tauri desktop app's specific workflows:
//! - Hex encoding/decoding of keys (as stored/transmitted)
//! - Pre-derived conversation key encryption (for caching)
//! - Cross-party encryption between two keypairs

use buildit_crypto::*;

/// Test that generate_keypair returns valid keys for Tauri use
#[test]
fn test_generate_keypair_for_tauri() {
    let keypair = generate_keypair();

    // Private key should be 32 bytes
    assert_eq!(keypair.private_key.len(), 32);

    // Public key should be 64 hex characters (32 bytes)
    assert_eq!(keypair.public_key.len(), 64);

    // Public key should be valid hex
    assert!(keypair.public_key.chars().all(|c| c.is_ascii_hexdigit()));
}

/// Test hex key workflow as used in Tauri commands
#[test]
fn test_hex_key_workflow() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Convert private key to hex (as stored in keyring)
    let private_key_hex = hex::encode(&sender.private_key);
    assert_eq!(private_key_hex.len(), 64);

    // Convert back to bytes (as done in Tauri command)
    let private_key_bytes = hex::decode(&private_key_hex).expect("Failed to decode hex");
    assert_eq!(private_key_bytes, sender.private_key);

    // Derive conversation key
    let conversation_key = derive_conversation_key(private_key_bytes, recipient.public_key.clone())
        .expect("Failed to derive key");
    assert_eq!(conversation_key.len(), 32);

    // Convert conversation key to hex (for caching/storage)
    let conv_key_hex = hex::encode(&conversation_key);
    assert_eq!(conv_key_hex.len(), 64);

    // Convert back (when using cached key)
    let conv_key_bytes = hex::decode(&conv_key_hex).expect("Failed to decode conv key hex");
    assert_eq!(conv_key_bytes, conversation_key);
}

/// Test NIP-44 encrypt/decrypt with pre-derived conversation key
/// This is how the Tauri app uses the crypto library
#[test]
fn test_nip44_with_key_for_tauri() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Derive conversation key (as Tauri app does)
    let conversation_key =
        derive_conversation_key(sender.private_key.clone(), recipient.public_key.clone())
            .expect("Failed to derive conversation key");

    let plaintext = "Hello from Tauri! This is a test message.";

    // Encrypt with pre-derived key
    let ciphertext = nip44_encrypt_with_key(conversation_key.clone(), plaintext.to_string())
        .expect("Encryption failed");

    // Ciphertext should be base64 encoded
    assert!(!ciphertext.is_empty());

    // Decrypt with same key
    let decrypted =
        nip44_decrypt_with_key(conversation_key, ciphertext).expect("Decryption failed");

    assert_eq!(decrypted, plaintext);
}

/// Test that derive_conversation_key produces consistent results (ECDH symmetry)
/// This is critical for cross-party communication
#[test]
fn test_derive_conversation_key_symmetry() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    // Alice derives key with Bob's public key
    let alice_key = derive_conversation_key(alice.private_key.clone(), bob.public_key.clone())
        .expect("Alice failed to derive key");

    // Bob derives key with Alice's public key
    let bob_key = derive_conversation_key(bob.private_key.clone(), alice.public_key.clone())
        .expect("Bob failed to derive key");

    // Both should get the same conversation key (ECDH property)
    assert_eq!(alice_key, bob_key);
    assert_eq!(alice_key.len(), 32);
}

/// Test encryption between two keypairs (A encrypts, B decrypts)
/// This simulates actual Tauri app usage
#[test]
fn test_cross_party_encryption() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    // Alice encrypts a message for Bob using pre-derived key
    let alice_conv_key = derive_conversation_key(alice.private_key.clone(), bob.public_key.clone())
        .expect("Alice failed to derive key");

    let plaintext = "Secret message from Alice to Bob!";
    let ciphertext = nip44_encrypt_with_key(alice_conv_key, plaintext.to_string())
        .expect("Alice encryption failed");

    // Bob decrypts the message using pre-derived key
    let bob_conv_key = derive_conversation_key(bob.private_key.clone(), alice.public_key.clone())
        .expect("Bob failed to derive key");

    let decrypted =
        nip44_decrypt_with_key(bob_conv_key, ciphertext).expect("Bob decryption failed");

    assert_eq!(decrypted, plaintext);
}

/// Test that wrong key fails to decrypt
/// This ensures security properties are maintained
#[test]
fn test_wrong_key_fails_decryption() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let eve = generate_keypair();

    // Alice encrypts for Bob
    let alice_conv_key = derive_conversation_key(alice.private_key.clone(), bob.public_key.clone())
        .expect("Alice failed to derive key");

    let plaintext = "Secret message";
    let ciphertext =
        nip44_encrypt_with_key(alice_conv_key, plaintext.to_string()).expect("Encryption failed");

    // Eve tries to decrypt with wrong key
    let eve_conv_key = derive_conversation_key(eve.private_key.clone(), alice.public_key.clone())
        .expect("Eve failed to derive key");

    let result = nip44_decrypt_with_key(eve_conv_key, ciphertext);

    // Should fail
    assert!(result.is_err());
}

/// Test multiple messages with same conversation key
/// This simulates a conversation thread
#[test]
fn test_multiple_messages_same_key() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    let conversation_key =
        derive_conversation_key(sender.private_key.clone(), recipient.public_key.clone())
            .expect("Failed to derive key");

    let messages = [
        "First message",
        "Second message",
        "Third message with unicode: Hello World!",
        "Message with special chars: !@#$%^&*()",
    ];

    for msg in messages {
        let encrypted = nip44_encrypt_with_key(conversation_key.clone(), msg.to_string())
            .expect("Encryption failed");

        let decrypted =
            nip44_decrypt_with_key(conversation_key.clone(), encrypted).expect("Decryption failed");

        assert_eq!(decrypted, msg);
    }
}

/// Test that each encryption produces different ciphertext (nonce randomization)
/// This is important for security - no message patterns should leak
#[test]
fn test_encryption_produces_different_ciphertexts() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    let conversation_key =
        derive_conversation_key(sender.private_key.clone(), recipient.public_key.clone())
            .expect("Failed to derive key");

    let plaintext = "Same message";

    let ciphertext1 = nip44_encrypt_with_key(conversation_key.clone(), plaintext.to_string())
        .expect("Encryption 1 failed");

    let ciphertext2 = nip44_encrypt_with_key(conversation_key.clone(), plaintext.to_string())
        .expect("Encryption 2 failed");

    // Ciphertexts should be different due to random nonce
    assert_ne!(ciphertext1, ciphertext2);

    // But both should decrypt to the same plaintext
    let decrypted1 =
        nip44_decrypt_with_key(conversation_key.clone(), ciphertext1).expect("Decryption 1 failed");
    let decrypted2 =
        nip44_decrypt_with_key(conversation_key, ciphertext2).expect("Decryption 2 failed");

    assert_eq!(decrypted1, plaintext);
    assert_eq!(decrypted2, plaintext);
}

/// Test invalid conversation key length
#[test]
fn test_invalid_conversation_key_length() {
    // Too short
    let result = nip44_encrypt_with_key(vec![0u8; 16], "test".to_string());
    assert!(result.is_err());

    // Too long
    let result = nip44_encrypt_with_key(vec![0u8; 64], "test".to_string());
    assert!(result.is_err());
}

/// Test get_public_key consistency
#[test]
fn test_get_public_key_consistency() {
    let keypair = generate_keypair();

    // Deriving public key from private should match the original
    let derived_pubkey = get_public_key(keypair.private_key.clone()).unwrap();
    assert_eq!(derived_pubkey, keypair.public_key);
}

/// Test complete Tauri workflow simulation
/// This tests the full flow a Tauri app would use
#[test]
fn test_complete_tauri_workflow() {
    // 1. Generate keypairs for two users
    let alice = generate_keypair();
    let bob = generate_keypair();

    // 2. Convert keys to hex for storage (as Tauri stores in keyring)
    let alice_private_hex = hex::encode(&alice.private_key);
    let bob_private_hex = hex::encode(&bob.private_key);

    // 3. Simulate retrieving keys from keyring
    let alice_private = hex::decode(&alice_private_hex).expect("Failed to decode Alice's key");
    let bob_private = hex::decode(&bob_private_hex).expect("Failed to decode Bob's key");

    // 4. Alice derives conversation key for Bob and caches it
    let alice_conv_key = derive_conversation_key(alice_private, bob.public_key.clone())
        .expect("Failed to derive Alice's conversation key");
    let alice_conv_key_hex = hex::encode(&alice_conv_key);

    // 5. Bob derives conversation key for Alice and caches it
    let bob_conv_key = derive_conversation_key(bob_private, alice.public_key.clone())
        .expect("Failed to derive Bob's conversation key");
    let bob_conv_key_hex = hex::encode(&bob_conv_key);

    // 6. Keys should match
    assert_eq!(alice_conv_key_hex, bob_conv_key_hex);

    // 7. Alice sends encrypted message to Bob
    let alice_conv_key_bytes = hex::decode(&alice_conv_key_hex).expect("Failed to decode");
    let message = "Hello Bob, this is Alice!";
    let encrypted = nip44_encrypt_with_key(alice_conv_key_bytes, message.to_string())
        .expect("Alice encryption failed");

    // 8. Bob decrypts message from Alice
    let bob_conv_key_bytes = hex::decode(&bob_conv_key_hex).expect("Failed to decode");
    let decrypted =
        nip44_decrypt_with_key(bob_conv_key_bytes, encrypted).expect("Bob decryption failed");

    assert_eq!(decrypted, message);
}
