# BuildIt Crypto

Shared cryptographic primitives for BuildIt Network - provides consistent crypto behavior across iOS, Android, and Desktop platforms through UniFFI bindings.

## Features

- **NIP-44 Encryption**: ChaCha20-Poly1305 with HKDF key derivation
- **NIP-17 Gift Wrap**: Metadata protection for private messages
- **Key Derivation**: PBKDF2 (600,000 iterations) and HKDF
- **secp256k1**: Nostr identity key operations (Schnorr signatures)
- **AES-256-GCM**: Key storage encryption
- **UniFFI Bindings**: Swift and Kotlin bindings for native apps

## Installation

### Rust (Direct)

```toml
[dependencies]
buildit-crypto = { git = "https://github.com/buildit-network/buildit-crypto" }
```

### iOS (Swift Package)

```swift
// Add to Package.swift
.package(url: "https://github.com/buildit-network/buildit-crypto", from: "0.1.0")
```

### Android (Gradle)

```kotlin
// Add to build.gradle.kts
implementation("network.buildit:crypto:0.1.0")
```

## Usage

### Key Generation

```rust
use buildit_crypto::{generate_keypair, derive_master_key, derive_database_key};

// Generate a new Nostr keypair
let keypair = generate_keypair();
println!("Public key: {}", keypair.public_key);

// Derive master key from password
let salt = generate_salt(32);
let master_key = derive_master_key("password".to_string(), salt)?;

// Derive database encryption key
let db_key = derive_database_key(master_key)?;
```

### NIP-44 Encryption

```rust
use buildit_crypto::{nip44_encrypt, nip44_decrypt, generate_keypair};

let sender = generate_keypair();
let recipient = generate_keypair();

// Encrypt
let ciphertext = nip44_encrypt(
    sender.private_key,
    recipient.public_key,
    "Hello, World!".to_string(),
)?;

// Decrypt
let plaintext = nip44_decrypt(
    recipient.private_key,
    sender.public_key,
    ciphertext,
)?;
```

### NIP-17 Gift Wrap

```rust
use buildit_crypto::{create_rumor, create_seal, create_gift_wrap, unwrap_gift_wrap};

let sender = generate_keypair();
let recipient = generate_keypair();
let now = chrono::Utc::now().timestamp();

// Create gift-wrapped message
let rumor = create_rumor(
    sender.public_key.clone(),
    recipient.public_key.clone(),
    "Secret message".to_string(),
    now,
)?;

let seal = create_seal(
    sender.private_key,
    recipient.public_key.clone(),
    rumor,
    now,
)?;

let gift_wrap = create_gift_wrap(
    recipient.public_key,
    seal,
    now,
)?;

// Unwrap on recipient side
let result = unwrap_gift_wrap(recipient.private_key, gift_wrap)?;
assert!(result.seal_verified);
println!("From: {}", result.sender_pubkey);
println!("Message: {}", result.rumor.content);
```

### Nostr Events

```rust
use buildit_crypto::{sign_event, verify_event, UnsignedEvent};

let keypair = generate_keypair();

let unsigned = UnsignedEvent {
    pubkey: keypair.public_key,
    created_at: 1700000000,
    kind: 1,
    tags: vec![],
    content: "Hello, Nostr!".to_string(),
};

let signed = sign_event(keypair.private_key, unsigned)?;

assert!(verify_event(signed));
```

## Building UniFFI Bindings

### Generate Swift Bindings

```bash
cargo run --bin uniffi-bindgen generate \
    src/buildit_crypto.udl \
    --language swift \
    --out-dir bindings/swift
```

### Generate Kotlin Bindings

```bash
cargo run --bin uniffi-bindgen generate \
    src/buildit_crypto.udl \
    --language kotlin \
    --out-dir bindings/kotlin
```

### Build for iOS

```bash
# Build for iOS simulator
cargo build --release --target aarch64-apple-ios-sim

# Build for iOS device
cargo build --release --target aarch64-apple-ios
```

### Build for Android

```bash
# Install Android targets
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android

# Build with cargo-ndk
cargo ndk -t armeabi-v7a -t arm64-v8a -t x86_64 build --release
```

## Security Considerations

- PBKDF2 uses 600,000 iterations (OWASP 2023 recommendation)
- All sensitive data is zeroized after use
- NIP-17 timestamps are randomized ±2 days for metadata protection
- Prototype pollution prevention in JSON parsing
- Constant-time MAC comparison

## Testing

```bash
# Run all tests
cargo test

# Run with verbose output
cargo test -- --nocapture
```

## Protocol Conformance

This library implements the [BuildIt Protocol Specification](../../docs/protocol-spec/). All implementations must pass the same test vectors in `../../protocol/test-vectors/`.

## License

MIT License - See LICENSE file for details.
