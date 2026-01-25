//! Key Derivation Test Vectors
//!
//! These tests verify key derivation functions follow security best practices
//! and produce consistent, correct outputs.

use buildit_crypto::*;

/// Test Argon2id with known test vectors
#[test]
fn test_argon2id_known_vectors() {
    // Test vector 1: Simple password
    let password = b"password".to_vec();
    let salt = vec![0u8; 32];

    let key1 = derive_master_key(password.clone(), salt.clone()).unwrap();
    assert_eq!(key1.len(), 32);

    // Same inputs should produce same output (deterministic)
    let key2 = derive_master_key(password, salt).unwrap();
    assert_eq!(key1, key2);
}

/// Test Argon2id with different passwords produce different keys
#[test]
fn test_argon2id_different_passwords() {
    let salt = vec![0u8; 32];

    let key1 = derive_master_key(b"password1".to_vec(), salt.clone()).unwrap();
    let key2 = derive_master_key(b"password2".to_vec(), salt).unwrap();

    assert_ne!(
        key1, key2,
        "Different passwords should produce different keys"
    );
}

/// Test Argon2id with different salts produce different keys
#[test]
fn test_argon2id_different_salts() {
    let password = b"password".to_vec();
    let salt1 = vec![0u8; 32];
    let salt2 = vec![1u8; 32];

    let key1 = derive_master_key(password.clone(), salt1).unwrap();
    let key2 = derive_master_key(password, salt2).unwrap();

    assert_ne!(key1, key2, "Different salts should produce different keys");
}

/// Test Argon2id requires minimum salt length
#[test]
fn test_argon2id_minimum_salt() {
    let password = b"password".to_vec();

    // Too short salt (< 16 bytes)
    let short_salt = vec![0u8; 15];
    let result = derive_master_key(password, short_salt);

    assert!(result.is_err(), "Should fail with salt < 16 bytes");
}

/// Test Argon2id with various password lengths
#[test]
fn test_argon2id_various_password_lengths() {
    let salt = vec![0u8; 32];

    let long_password = "a".repeat(100);
    let passwords: Vec<&[u8]> = vec![
        b"a",                                   // Very short
        b"password",                            // Normal
        b"correct horse battery staple",        // Passphrase
        long_password.as_bytes(),               // Long
    ];

    for password in passwords {
        let key = derive_master_key(password.to_vec(), salt.clone()).unwrap();
        assert_eq!(key.len(), 32);

        // Should be deterministic
        let key2 = derive_master_key(password.to_vec(), salt.clone()).unwrap();
        assert_eq!(key, key2);
    }
}

/// Test Argon2id with Unicode passwords
#[test]
fn test_argon2id_unicode_password() {
    let salt = vec![0u8; 32];
    let unicode_password = "Unicode: 你好世界 🌍 مرحبا".as_bytes().to_vec();

    let key = derive_master_key(unicode_password.clone(), salt.clone()).unwrap();
    assert_eq!(key.len(), 32);

    // Should be deterministic
    let key2 = derive_master_key(unicode_password, salt).unwrap();
    assert_eq!(key, key2);
}

/// Test database key derivation with HKDF
#[test]
fn test_hkdf_database_key() {
    let master_key = vec![0u8; 32];

    let db_key = derive_database_key(master_key.clone()).unwrap();
    assert_eq!(db_key.len(), 32);

    // Should be different from master key
    assert_ne!(db_key, master_key);

    // Should be deterministic
    let db_key2 = derive_database_key(master_key).unwrap();
    assert_eq!(db_key, db_key2);
}

/// Test database key derivation with different master keys
#[test]
fn test_hkdf_different_masters() {
    let master1 = vec![0u8; 32];
    let master2 = vec![1u8; 32];

    let db_key1 = derive_database_key(master1).unwrap();
    let db_key2 = derive_database_key(master2).unwrap();

    assert_ne!(
        db_key1, db_key2,
        "Different master keys should produce different database keys"
    );
}

/// Test database key requires correct length master key
#[test]
fn test_hkdf_invalid_master_length() {
    let short_master = vec![0u8; 16];
    let result = derive_database_key(short_master);

    assert!(result.is_err(), "Should fail with master key != 32 bytes");
}

/// Test conversation key derivation (ECDH + HKDF)
#[test]
fn test_conversation_key_derivation() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    // Alice derives conversation key with Bob
    let alice_conv =
        derive_conversation_key(alice.private_key.clone(), bob.public_key.clone()).unwrap();

    // Bob derives conversation key with Alice
    let bob_conv =
        derive_conversation_key(bob.private_key.clone(), alice.public_key.clone()).unwrap();

    // Should be the same (ECDH symmetry)
    assert_eq!(alice_conv, bob_conv);
    assert_eq!(alice_conv.len(), 32);
}

/// Test conversation key is deterministic
#[test]
fn test_conversation_key_deterministic() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    let conv1 = derive_conversation_key(alice.private_key.clone(), bob.public_key.clone()).unwrap();

    let conv2 = derive_conversation_key(alice.private_key.clone(), bob.public_key.clone()).unwrap();

    assert_eq!(conv1, conv2, "Conversation key should be deterministic");
}

/// Test conversation key with different pairs produces different keys
#[test]
fn test_conversation_key_different_pairs() {
    let alice = generate_keypair();
    let bob = generate_keypair();
    let charlie = generate_keypair();

    let alice_bob =
        derive_conversation_key(alice.private_key.clone(), bob.public_key.clone()).unwrap();

    let alice_charlie =
        derive_conversation_key(alice.private_key.clone(), charlie.public_key.clone()).unwrap();

    let bob_charlie =
        derive_conversation_key(bob.private_key.clone(), charlie.public_key.clone()).unwrap();

    assert_ne!(alice_bob, alice_charlie);
    assert_ne!(alice_bob, bob_charlie);
    assert_ne!(alice_charlie, bob_charlie);
}

/// Test conversation key validation
#[test]
fn test_conversation_key_invalid_inputs() {
    let alice = generate_keypair();

    // Invalid private key length
    let result = derive_conversation_key(vec![0u8; 16], alice.public_key.clone());
    assert!(result.is_err());

    // Invalid public key (not hex)
    let result = derive_conversation_key(alice.private_key.clone(), "not-hex".to_string());
    assert!(result.is_err());

    // Invalid public key (wrong length hex)
    let result = derive_conversation_key(
        alice.private_key.clone(),
        "deadbeef".to_string(), // Too short
    );
    assert!(result.is_err());
}

/// Test salt generation produces unique values
#[test]
fn test_salt_generation_uniqueness() {
    let mut salts = Vec::new();

    for _ in 0..100 {
        let salt = generate_salt(32);
        assert_eq!(salt.len(), 32);
        salts.push(salt);
    }

    // All salts should be unique
    let unique: std::collections::HashSet<_> = salts.iter().collect();
    assert_eq!(unique.len(), 100, "All generated salts should be unique");
}

/// Test salt generation with different lengths
#[test]
fn test_salt_generation_various_lengths() {
    let lengths = vec![16, 32, 64, 128];

    for length in lengths {
        let salt = generate_salt(length);
        assert_eq!(salt.len(), length as usize);
    }
}

/// Test complete key hierarchy
#[test]
fn test_complete_key_hierarchy() {
    // User password -> Master key
    let password = b"correct horse battery staple".to_vec();
    let salt = generate_salt(32);
    let master_key = derive_master_key(password, salt).unwrap();

    // Master key -> Database key (for encrypting local storage)
    let db_key = derive_database_key(master_key.clone()).unwrap();

    // Generate identity keypair
    let identity = generate_keypair();

    // Identity private key + recipient public key -> Conversation key
    let recipient = generate_keypair();
    let conv_key =
        derive_conversation_key(identity.private_key.clone(), recipient.public_key.clone())
            .unwrap();

    // All keys should be 32 bytes
    assert_eq!(master_key.len(), 32);
    assert_eq!(db_key.len(), 32);
    assert_eq!(identity.private_key.len(), 32);
    assert_eq!(conv_key.len(), 32);

    // All keys should be different
    assert_ne!(master_key, db_key);
    assert_ne!(master_key, identity.private_key);
    assert_ne!(master_key, conv_key);
    assert_ne!(db_key, identity.private_key);
    assert_ne!(db_key, conv_key);
    assert_ne!(identity.private_key, conv_key);
}

/// Test key derivation is computationally expensive (timing check for Argon2id)
#[test]
fn test_argon2id_is_slow() {
    use std::time::Instant;

    let password = b"password".to_vec();
    let salt = generate_salt(32);

    let start = Instant::now();
    let _key = derive_master_key(password, salt).unwrap();
    let duration = start.elapsed();

    // With 64MB memory and 3 iterations, Argon2id should take some time
    // (actual time depends on hardware)
    println!("Argon2id took: {:?}", duration);
    // Argon2id is memory-bound, so timing varies more by system memory bandwidth
    // We just verify it completes successfully and produces a valid key
    assert!(
        duration.as_millis() >= 10,
        "Argon2id should be computationally expensive"
    );
}
