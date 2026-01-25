//! Integration tests for buildit-crypto integration in the Tauri app
//!
//! These tests verify that the crypto library is correctly integrated
//! and all needed functions work as expected for the desktop app.

use buildit_crypto::{
    derive_conversation_key, generate_keypair, get_public_key,
    nip44_decrypt_with_key, nip44_encrypt_with_key, KeyPair,
};

/// Test that generate_keypair returns valid keys
#[test]
fn test_generate_keypair_returns_valid_keys() {
    let keypair = generate_keypair();

    // Private key should be 32 bytes
    assert_eq!(keypair.private_key.len(), 32);

    // Public key should be 64 hex characters (32 bytes)
    assert_eq!(keypair.public_key.len(), 64);

    // Public key should be valid hex
    assert!(keypair.public_key.chars().all(|c| c.is_ascii_hexdigit()));
}

/// Test that get_public_key derives the correct public key from private key
#[test]
fn test_get_public_key_consistency() {
    let keypair = generate_keypair();

    // Deriving public key from private should match the original
    let derived_pubkey = get_public_key(keypair.private_key.clone()).unwrap();
    assert_eq!(derived_pubkey, keypair.public_key);
}

/// Test NIP-44 encrypt/decrypt roundtrip with pre-derived conversation key
#[test]
fn test_nip44_encrypt_decrypt_roundtrip() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Derive conversation key (as Tauri app does)
    let conversation_key =
        derive_conversation_key(sender.private_key.clone(), recipient.public_key.clone())
            .expect("Failed to derive conversation key");

    // Verify key is 32 bytes
    assert_eq!(conversation_key.len(), 32);

    let plaintext = "Hello from Tauri! This is a test message.";

    // Encrypt
    let ciphertext = nip44_encrypt_with_key(conversation_key.clone(), plaintext.to_string())
        .expect("Encryption failed");

    // Ciphertext should be base64 encoded
    assert!(!ciphertext.is_empty());

    // Decrypt
    let decrypted = nip44_decrypt_with_key(conversation_key, ciphertext)
        .expect("Decryption failed");

    assert_eq!(decrypted, plaintext);
}

/// Test that derive_conversation_key produces consistent results (ECDH symmetry)
#[test]
fn test_derive_conversation_key_consistency() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    // Alice derives key with Bob's public key
    let alice_key =
        derive_conversation_key(alice.private_key.clone(), bob.public_key.clone())
            .expect("Alice failed to derive key");

    // Bob derives key with Alice's public key
    let bob_key =
        derive_conversation_key(bob.private_key.clone(), alice.public_key.clone())
            .expect("Bob failed to derive key");

    // Both should get the same conversation key (ECDH property)
    assert_eq!(alice_key, bob_key);
    assert_eq!(alice_key.len(), 32);
}

/// Test encryption between two keypairs (A encrypts, B decrypts)
#[test]
fn test_encryption_between_two_keypairs() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    // Alice encrypts a message for Bob
    let alice_conv_key =
        derive_conversation_key(alice.private_key.clone(), bob.public_key.clone())
            .expect("Alice failed to derive key");

    let plaintext = "Secret message from Alice to Bob!";
    let ciphertext = nip44_encrypt_with_key(alice_conv_key, plaintext.to_string())
        .expect("Alice encryption failed");

    // Bob decrypts the message from Alice
    let bob_conv_key =
        derive_conversation_key(bob.private_key.clone(), alice.public_key.clone())
            .expect("Bob failed to derive key");

    let decrypted = nip44_decrypt_with_key(bob_conv_key, ciphertext)
        .expect("Bob decryption failed");

    assert_eq!(decrypted, plaintext);
}

/// Test that wrong key fails to decrypt
#[test]
fn test_wrong_key_fails_decryption() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let eve = generate_keypair();

    // Alice encrypts for Bob
    let alice_conv_key =
        derive_conversation_key(alice.private_key.clone(), bob.public_key.clone())
            .expect("Alice failed to derive key");

    let plaintext = "Secret message";
    let ciphertext = nip44_encrypt_with_key(alice_conv_key, plaintext.to_string())
        .expect("Encryption failed");

    // Eve tries to decrypt with wrong key
    let eve_conv_key =
        derive_conversation_key(eve.private_key.clone(), alice.public_key.clone())
            .expect("Eve failed to derive key");

    let result = nip44_decrypt_with_key(eve_conv_key, ciphertext);

    // Should fail
    assert!(result.is_err());
}

/// Test multiple messages with same conversation key
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
    ];

    for msg in messages {
        let encrypted = nip44_encrypt_with_key(conversation_key.clone(), msg.to_string())
            .expect("Encryption failed");

        let decrypted = nip44_decrypt_with_key(conversation_key.clone(), encrypted)
            .expect("Decryption failed");

        assert_eq!(decrypted, msg);
    }
}

/// Test that each encryption produces different ciphertext (nonce randomization)
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
    let decrypted1 = nip44_decrypt_with_key(conversation_key.clone(), ciphertext1)
        .expect("Decryption 1 failed");
    let decrypted2 = nip44_decrypt_with_key(conversation_key, ciphertext2)
        .expect("Decryption 2 failed");

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

/// Test hex key workflow (as used in Tauri commands)
#[test]
fn test_hex_key_workflow() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Convert private key to hex (as stored in keyring)
    let private_key_hex = hex::encode(&sender.private_key);

    // Convert back to bytes (as done in Tauri command)
    let private_key_bytes = hex::decode(&private_key_hex).expect("Failed to decode hex");

    // Derive conversation key
    let conversation_key =
        derive_conversation_key(private_key_bytes, recipient.public_key.clone())
            .expect("Failed to derive key");

    // Convert conversation key to hex (for caching/storage)
    let conv_key_hex = hex::encode(&conversation_key);

    // Convert back (when using cached key)
    let conv_key_bytes = hex::decode(&conv_key_hex).expect("Failed to decode conv key hex");

    // Encrypt/decrypt
    let plaintext = "Test message";
    let encrypted = nip44_encrypt_with_key(conv_key_bytes.clone(), plaintext.to_string())
        .expect("Encryption failed");

    let decrypted = nip44_decrypt_with_key(conv_key_bytes, encrypted)
        .expect("Decryption failed");

    assert_eq!(decrypted, plaintext);
}
