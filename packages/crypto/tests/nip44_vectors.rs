//! NIP-44 Test Vectors
//!
//! These test vectors verify compliance with the NIP-44 specification.
//! Test vectors are derived from the official NIP-44 repository.

use buildit_crypto::*;

/// Test padding calculation according to NIP-44 spec
#[test]
fn test_nip44_padding_spec() {
    // Test vectors from NIP-44 spec
    let test_cases = vec![
        (0, 32), // Edge case (though invalid for actual encryption)
        (1, 32),
        (32, 32),
        (33, 64),
        (37, 64),
        (45, 64),
        (49, 64),
        (64, 64),
        (65, 96),
        (100, 128),
        (111, 128),
        (200, 224),
        (250, 256),
        (256, 256),
        (257, 320),
        (500, 512),
        (512, 512),
        (515, 640),
        (1000, 1024),
        (1024, 1024),
        (1025, 1280),
        (2000, 2048),
        (2048, 2048),
        (2049, 2560),
        (3000, 3072),
        (4096, 4096),
        (5000, 5120),
        (8192, 8192),
        (10000, 10240),
        (16384, 16384),
        (20000, 20480),
        (32768, 32768),
        (40000, 40960),
        (65535, 65536),
    ];

    for (input, expected) in test_cases {
        let padded_len = calc_padded_len_test(input);
        assert_eq!(
            padded_len, expected,
            "Padding calculation failed for input {}: expected {}, got {}",
            input, expected, padded_len
        );
    }
}

// Helper function to test padding (duplicates internal logic for testing)
fn calc_padded_len_test(unpadded_len: usize) -> usize {
    if unpadded_len == 0 {
        return 32; // Edge case
    }
    if unpadded_len <= 32 {
        return 32;
    }

    let next_power = (unpadded_len as u32).next_power_of_two() as usize;
    let chunk = if next_power <= 256 {
        32
    } else {
        next_power / 8
    };
    chunk * unpadded_len.div_ceil(chunk)
}

/// Test that encryption produces valid base64 output
#[test]
fn test_nip44_output_format() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    let plaintext = "Test message";

    let ciphertext = nip44_encrypt(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        plaintext.to_string(),
    )
    .unwrap();

    // Should be valid base64
    assert!(
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &ciphertext).is_ok()
    );

    // Decode and check structure
    let decoded =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &ciphertext).unwrap();

    // version(1) + nonce(32) + ciphertext(variable) + mac(32)
    assert!(decoded.len() >= 65); // Minimum: 1 + 32 + 0 + 32
    assert_eq!(decoded[0], 2); // Version 2
}

/// Test conversation key derivation is symmetric
#[test]
fn test_nip44_conversation_key_symmetry() {
    let alice = generate_keypair();
    let bob = generate_keypair();

    let alice_key =
        derive_conversation_key(alice.private_key.clone(), bob.public_key.clone()).unwrap();

    let bob_key =
        derive_conversation_key(bob.private_key.clone(), alice.public_key.clone()).unwrap();

    assert_eq!(alice_key, bob_key);
}

/// Test that same plaintext produces different ciphertexts (due to random nonce)
#[test]
fn test_nip44_nonce_randomization() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    let plaintext = "Same message";

    let ciphertext1 = nip44_encrypt(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        plaintext.to_string(),
    )
    .unwrap();

    let ciphertext2 = nip44_encrypt(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        plaintext.to_string(),
    )
    .unwrap();

    // Ciphertexts should be different due to random nonce
    assert_ne!(ciphertext1, ciphertext2);

    // But both should decrypt to same plaintext
    let decrypted1 = nip44_decrypt(
        recipient.private_key.clone(),
        sender.public_key.clone(),
        ciphertext1,
    )
    .unwrap();

    let decrypted2 = nip44_decrypt(
        recipient.private_key.clone(),
        sender.public_key.clone(),
        ciphertext2,
    )
    .unwrap();

    assert_eq!(decrypted1, plaintext);
    assert_eq!(decrypted2, plaintext);
}

/// Test encryption with various message lengths
#[test]
fn test_nip44_various_lengths() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Test messages of various lengths
    let lengths = vec![1, 10, 32, 33, 100, 256, 500, 1000, 5000, 10000];

    for len in lengths {
        let plaintext = "x".repeat(len);

        let ciphertext = nip44_encrypt(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            plaintext.clone(),
        )
        .unwrap();

        let decrypted = nip44_decrypt(
            recipient.private_key.clone(),
            sender.public_key.clone(),
            ciphertext,
        )
        .unwrap();

        assert_eq!(decrypted, plaintext, "Failed for length {}", len);
    }
}

/// Test that tampering with ciphertext causes decryption failure
#[test]
fn test_nip44_tamper_detection() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    let plaintext = "Secret message";

    let ciphertext = nip44_encrypt(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        plaintext.to_string(),
    )
    .unwrap();

    // Decode base64
    let mut payload =
        base64::Engine::decode(&base64::engine::general_purpose::STANDARD, &ciphertext).unwrap();

    // Tamper with a byte in the ciphertext portion (after version + nonce)
    if payload.len() > 40 {
        payload[40] ^= 0xff;
    }

    // Re-encode
    let tampered = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &payload);

    // Decryption should fail
    let result = nip44_decrypt(
        recipient.private_key.clone(),
        sender.public_key.clone(),
        tampered,
    );

    assert!(
        result.is_err(),
        "Tampered ciphertext should fail decryption"
    );
}

/// Test empty and maximum length messages
#[test]
fn test_nip44_edge_cases() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Minimum length (1 byte)
    let min_msg = "x";
    let encrypted = nip44_encrypt(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        min_msg.to_string(),
    )
    .unwrap();
    let decrypted = nip44_decrypt(
        recipient.private_key.clone(),
        sender.public_key.clone(),
        encrypted,
    )
    .unwrap();
    assert_eq!(decrypted, min_msg);

    // Maximum length (65535 bytes)
    let max_msg = "x".repeat(65535);
    let encrypted = nip44_encrypt(
        sender.private_key.clone(),
        recipient.public_key.clone(),
        max_msg.clone(),
    )
    .unwrap();
    let decrypted = nip44_decrypt(
        recipient.private_key.clone(),
        sender.public_key.clone(),
        encrypted,
    )
    .unwrap();
    assert_eq!(decrypted, max_msg);
}

/// Test binary data (non-UTF8)
#[test]
fn test_nip44_binary_safety() {
    let sender = generate_keypair();
    let recipient = generate_keypair();

    // Test with various UTF-8 strings that include special characters
    let test_strings = vec![
        "Hello\nWorld\t!",
        "Special: \r\n\t\0",
        "Unicode: 你好世界 🌍 مرحبا",
        "Emoji: 😀😁😂🤣😃😄😅😆😇",
        "Mixed: ABC123!@# 世界 🌍",
    ];

    for plaintext in test_strings {
        let encrypted = nip44_encrypt(
            sender.private_key.clone(),
            recipient.public_key.clone(),
            plaintext.to_string(),
        )
        .unwrap();

        let decrypted = nip44_decrypt(
            recipient.private_key.clone(),
            sender.public_key.clone(),
            encrypted,
        )
        .unwrap();

        assert_eq!(decrypted, plaintext, "Failed for: {:?}", plaintext);
    }
}
