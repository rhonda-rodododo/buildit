# BuildIt Protocol Test Vectors - Index

**Version:** 1.0.0
**Last Updated:** 2026-01-25

## Overview

This directory contains comprehensive test vectors for ensuring cross-client compatibility across all BuildIt implementations (Desktop/Rust, iOS/Swift, Android/Kotlin).

## Test Vector Categories

### 1. NIP-44 Encryption (`nip44/`)

ChaCha20-Poly1305 encryption with HKDF-SHA256 key derivation.

| File | Test Count | Description |
|------|-----------|-------------|
| `encryption.json` | 14 + padding tests | Encryption operations, padding boundaries, unicode, edge cases |
| `decryption.json` | 13 | Decryption operations, error handling, MAC verification |
| `conversation-key.json` | 8 | ECDH shared secret derivation, symmetry validation |

**Key Tests:**
- Padding algorithm (power-of-2 scheme)
- Unicode and special character handling
- Maximum plaintext size (65535 bytes)
- MAC verification and constant-time comparison
- Conversation key symmetry (Alice→Bob == Bob→Alice)

### 2. NIP-17 Gift Wrap (`nip17/`)

Private direct message protocol with metadata protection.

| File | Test Count | Description |
|------|-----------|-------------|
| `gift-wrap.json` | 12 | Gift wrap creation, rumor/seal/wrap structure |
| `unwrap.json` | 14 | Gift wrap unwrapping, validation, error cases |
| `full-flow.json` | 10 | End-to-end messaging flows, security scenarios |

**Key Tests:**
- 3-layer structure (rumor → seal → gift wrap)
- Timestamp randomization (±2 days)
- Ephemeral key uniqueness
- Sender identity extraction (from seal, not gift wrap)
- Prototype pollution prevention
- Replay attack detection
- Man-in-the-middle attack prevention

### 3. Event Signing (`events/`)

Nostr event signing and verification with Schnorr signatures.

| File | Test Count | Description |
|------|-----------|-------------|
| `signing.json` | 12 | Event signing, ID computation, signature generation |
| `id-computation.json` | 12 | SHA256 event ID calculation, serialization format |
| `verification.json` | 14 | Signature verification, tampering detection |

**Key Tests:**
- NIP-01 serialization format
- Event ID computation (SHA256 of serialized event)
- Schnorr signature generation and verification
- Tag ordering significance
- Unicode and special character handling
- Rumor special case (kind 14, unsigned)

### 4. BLE Transport (`ble/`)

Bluetooth Low Energy message chunking and compression.

| File | Test Count | Description |
|------|-----------|-------------|
| `chunking.json` | 12 | Message splitting into BLE-compatible chunks |
| `reassembly.json` | 14 | Chunk reassembly, out-of-order handling |
| `compression.json` | 15 | DEFLATE compression/decompression |

**Key Tests:**
- Binary header format (21 bytes)
- Chunk size limit (491 bytes payload)
- Message size limit (100KB)
- Compression threshold (100 bytes)
- Out-of-order chunk reassembly
- Duplicate chunk handling
- Concurrent message tracking
- UTF-8 boundary preservation

### 5. Schema Serialization (`schemas/`)

JSON serialization for application data structures.

| File | Test Count | Description |
|------|-----------|-------------|
| `events.json` | 10 | Events module data structures |
| `messaging.json` | 8 | Messaging module data structures |
| `mutual-aid.json` | 10 | Mutual Aid module (requests, offers, fulfillments, rideshares, resources) |
| `governance.json` | 12 | Governance module (proposals, votes, delegations, results) |
| `wiki.json` | 15 | Wiki module (pages, categories, revisions, comments, suggestions) |

**Key Tests:**
- Required vs optional fields
- Field type validation
- Unicode content preservation
- Deterministic serialization (field ordering)
- Maximum field lengths
- Nested objects and arrays
- Cross-client type compatibility
- Enum value serialization (hyphen-case)

### 6. Calling (`calling/`)

Voice, video, and group calling with E2EE.

| File | Test Count | Description |
|------|-----------|-------------|
| `call-offer.json` | - | 1:1 call offer/answer signaling |
| `call-hangup.json` | - | Call termination reasons |
| `ice-candidate.json` | - | ICE candidate exchange |
| `group-call.json` | - | Mesh topology group calls, sender keys |
| `hotline.json` | 15 | Hotline queue management, ACD, operator status |
| `broadcast.json` | 15 | Broadcast delivery, scheduling, messaging queue |

**Key Tests:**
- Queue priority ordering (urgent > high > medium > low)
- Operator status transitions
- ACD (Automatic Call Distribution)
- Ring timeout and queue return
- Transfer/escalate workflows
- Hold/resume functionality
- Shift statistics tracking
- Nostr signaling event kinds (24330-24335)

### 6. Legacy/Original Files

| File | Description | Status |
|------|-------------|--------|
| `encryption.json` | Original encryption tests | Superseded by `nip44/encryption.json` |
| `gift-wrap.json` | Original gift wrap tests | Superseded by `nip17/gift-wrap.json` |
| `routing.json` | BLE routing protocol tests | Active |
| `ble/chunking-original.json` | Original chunking tests | Superseded by `ble/chunking.json` |
| `schema-versioning/` | Schema version negotiation | Active |

## Statistics

- **Total Test Vectors:** ~185+
- **Test Categories:** 7
- **Schema Modules:** 5 (Events, Messaging, Mutual Aid, Governance, Wiki)
- **Protocols Covered:** NIP-01, NIP-17, NIP-44, BLE, WebRTC Calling, Custom Schemas
- **Client Targets:** 3 (Desktop/Rust, iOS/Swift, Android/Kotlin)

## Usage by Platform

### Rust (Desktop)

```bash
cd /home/rikki/claude-workspace/buildit/packages/crypto
cargo test --features test-vectors
```

Test vectors should be loaded from JSON and validated in Rust test functions.

Generated Rust types are available at:
```rust
use buildit_crypto::generated::schemas::messaging::DirectMessage;
use buildit_crypto::generated::schemas::events::Event;
use buildit_crypto::generated::schemas::governance::Proposal;
```

### Swift (iOS)

```bash
cd /home/rikki/claude-workspace/buildit/clients/ios
swift test --filter TestVectors
```

Use `JSONDecoder` to load test vectors and validate against Swift implementations.

### Kotlin (Android)

```bash
cd /home/rikki/claude-workspace/buildit/clients/android
./gradlew testDebugUnitTest --tests "*TestVectors*"
```

Use Gson or kotlinx.serialization to load test vectors.

## Compliance Requirements

All clients MUST pass ALL test vectors to be considered protocol-compliant:

1. ✅ All deterministic tests must match exactly
2. ✅ All non-deterministic tests must satisfy constraints
3. ✅ All error cases must be handled correctly
4. ✅ All edge cases must be tested
5. ✅ All security requirements must be met

## Test Vector Format

All test vectors follow a consistent JSON format:

```json
{
  "version": "1.0.0",
  "description": "What this file tests",
  "vectors": [
    {
      "id": "unique-test-id",
      "description": "What this specific test validates",
      "input": {
        // Input parameters
      },
      "expected": {
        // Expected output or constraints
      }
    }
  ]
}
```

## Adding New Test Vectors

When adding new test vectors:

1. Follow existing format conventions
2. Include both success and error cases
3. Test edge cases and boundaries
4. Document any platform-specific behavior
5. Update this INDEX.md
6. Update README.md if needed
7. Ensure all clients pass new tests

## Cross-Client Validation

To validate cross-client compatibility:

```bash
# Generate test data with Desktop (Rust)
cd packages/crypto
cargo run --bin generate-test-data

# Validate with iOS (Swift)
cd clients/ios
swift test --filter CrossClientValidation

# Validate with Android (Kotlin)
cd clients/android
./gradlew testDebugUnitTest --tests "*CrossClient*"
```

## Security Test Vectors

Critical security tests included:

- **Constant-time MAC comparison** (prevents timing attacks)
- **Prototype pollution prevention** (JSON parsing safety)
- **Replay attack detection** (event ID tracking)
- **Signature verification** (prevents forgery)
- **Ephemeral key uniqueness** (prevents correlation)
- **Timestamp randomization** (metadata privacy)

## References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [BuildIt Protocol Specification](../docs/protocol-spec/)

## Version History

- **1.2.1** (2026-01-26): Added messaging hotline and broadcast test vectors
  - Broadcast delivery (group, contact-list, SMS batching)
  - Broadcast scheduling and recurring broadcasts
  - Messaging thread status transitions
  - Template variable substitution
  - Channel escalation (voice/messaging)
  - Analytics tracking

- **1.2.0** (2026-01-26): Added calling module test vectors
  - Hotline voice calling (queue management, ACD, operator status)
  - Group call mesh topology
  - Call controls (hold, transfer, escalate)
  - Shift and break management
  - Nostr signaling events (kinds 24330-24335)

- **1.1.0** (2026-01-26): Added schema test vectors for all modules
  - Mutual Aid module (requests, offers, fulfillments, rideshares, resources)
  - Governance module (proposals, votes, delegations, results)
  - Wiki module (pages, categories, revisions, comments, suggestions)
  - Complete enum value coverage
  - Cross-client type validation

- **1.0.0** (2026-01-25): Initial comprehensive test vector release
  - NIP-44 encryption/decryption
  - NIP-17 gift wrap
  - Event signing/verification
  - BLE chunking/reassembly/compression
  - Schema serialization (events, messaging)
