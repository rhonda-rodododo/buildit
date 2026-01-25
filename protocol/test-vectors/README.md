# BuildIt Protocol Test Vectors

Cross-client compatibility test vectors for BuildIt protocol implementations.

## Purpose

These test vectors ensure that all clients (Desktop, iOS, Android) produce byte-identical results for cryptographic operations, event handling, and data serialization. Every client MUST pass all test vectors to be considered protocol-compliant.

## Version

**Test Vectors Version:** 1.0.0
**Protocol Version:** 1.0.0
**Last Updated:** 2026-01-25

## Directory Structure

```
protocol/test-vectors/
├── README.md              # This file
├── nip44/
│   ├── encryption.json    # NIP-44 encryption test cases
│   ├── decryption.json    # NIP-44 decryption test cases
│   └── conversation-key.json  # Shared secret derivation
├── nip17/
│   ├── gift-wrap.json     # Gift wrap creation test cases
│   ├── unwrap.json        # Gift wrap unwrapping test cases
│   └── full-flow.json     # Complete DM send/receive flow
├── events/
│   ├── signing.json       # Event signing test cases
│   ├── id-computation.json # Event ID computation
│   └── verification.json  # Signature verification
├── ble/
│   ├── chunking.json      # Message chunking
│   ├── reassembly.json    # Chunk reassembly
│   └── compression.json   # DEFLATE compression
└── schemas/
    ├── events.json        # Events schema test data
    └── messaging.json     # Messaging schema test data
```

## Test Vector Format

Each test vector file is a JSON file with the following structure:

```json
{
  "version": "1.0.0",
  "description": "Brief description of what this tests",
  "vectors": [
    {
      "id": "unique-test-id",
      "description": "What this specific test validates",
      "input": {
        // Input parameters
      },
      "expected": {
        // Expected output values
      }
    }
  ]
}
```

## Using Test Vectors

### 1. Load Test Vectors

Each client should load the appropriate test vector JSON files at test time.

### 2. Run Test Cases

For each test vector:
1. Extract input parameters
2. Execute the operation being tested
3. Compare output to expected values
4. Report pass/fail

### 3. Deterministic vs Non-Deterministic Tests

**Deterministic Tests**: Output must match exactly
- Event ID computation
- Signature verification
- Padding calculations
- Conversation key derivation

**Non-Deterministic Tests**: Output varies but must satisfy constraints
- Encryption (random nonce)
- Timestamp randomization (within range)
- Ephemeral key generation (unique each time)

For non-deterministic tests, verify:
- Decryption produces original plaintext
- Timestamps fall within specified range
- Ephemeral keys are unique

## Test Categories

### NIP-44 (Encryption)

**Files:**
- `nip44/encryption.json` - Encrypt plaintext, verify decryption
- `nip44/decryption.json` - Decrypt ciphertext, verify plaintext
- `nip44/conversation-key.json` - ECDH shared secret derivation

**What's tested:**
- ChaCha20-Poly1305 encryption/decryption
- HKDF-SHA256 key derivation
- Power-of-2 padding scheme
- Conversation key derivation (ECDH)
- Unicode handling
- Edge cases (empty, max size, boundaries)

### NIP-17 (Gift Wrap)

**Files:**
- `nip17/gift-wrap.json` - Wrap message, verify structure
- `nip17/unwrap.json` - Unwrap message, verify content
- `nip17/full-flow.json` - Complete DM send/receive flow

**What's tested:**
- Rumor creation (unsigned kind 14)
- Seal creation (signed kind 13)
- Gift wrap creation (ephemeral kind 1059)
- Timestamp randomization (±2 days)
- Ephemeral key uniqueness
- Multi-layer decryption
- Signature verification

### Events (Signing)

**Files:**
- `events/signing.json` - Sign event, verify signature
- `events/id-computation.json` - Compute event ID
- `events/verification.json` - Verify event signatures

**What's tested:**
- Event ID computation (SHA256)
- Schnorr signature generation
- Signature verification
- Event serialization format
- Tags handling
- Content escaping

### BLE (Transport)

**Files:**
- `ble/chunking.json` - Split message into chunks
- `ble/reassembly.json` - Reassemble chunks
- `ble/compression.json` - DEFLATE compression

**What's tested:**
- Binary header format (21 bytes)
- Chunk size calculations
- Message ID handling (UUID)
- Out-of-order reassembly
- Duplicate chunk handling
- Compression threshold (100 bytes)
- DEFLATE compression/decompression

### Schemas (Data)

**Files:**
- `schemas/events.json` - Events module data structures
- `schemas/messaging.json` - Messaging module data structures

**What's tested:**
- JSON serialization
- Field ordering (deterministic)
- Type validation
- Required fields
- Optional fields
- Nested structures

## Running Tests

### Rust (Desktop)

```bash
cd packages/crypto
cargo test --features test-vectors
```

Expected output:
```
running 50 tests
test nip44::test_vectors::encryption ... ok
test nip44::test_vectors::decryption ... ok
...
test result: ok. 50 passed; 0 failed
```

### Swift (iOS)

```bash
cd clients/ios
swift test --filter TestVectors
```

Expected output:
```
Test Suite 'TestVectors' passed
     50 tests passed in 2.5 seconds
```

### Kotlin (Android)

```bash
cd clients/android
./gradlew testDebugUnitTest --tests "*TestVectors*"
```

Expected output:
```
TestVectors > testNip44Encryption PASSED
TestVectors > testNip44Decryption PASSED
...
BUILD SUCCESSFUL in 5s
```

## Compliance Requirements

To be considered protocol-compliant, a client implementation MUST:

1. **Pass all deterministic tests** - Exact output match
2. **Pass all non-deterministic tests** - Satisfy constraints
3. **Handle all edge cases** - Empty strings, max sizes, unicode
4. **Implement all security features** - Constant-time comparison, memory clearing
5. **Support all event kinds** - As specified in protocol

## Test Vector Generation

Test vectors are manually curated to ensure:
1. **Real cryptographic values** - No placeholder data
2. **Cross-platform compatibility** - Same results on all platforms
3. **Edge case coverage** - Boundaries, unicode, errors
4. **Security validation** - Timing attacks, memory leaks

### Generating New Vectors

When adding new protocol features:

1. Create test vectors in appropriate directory
2. Use consistent test ID format: `{category}-{number}`
3. Include both success and failure cases
4. Document any platform-specific behavior
5. Update this README with new test category

## Known Platform Differences

### Floating Point Precision

No floating point values are used in the protocol to avoid precision issues.

### String Encoding

All strings are UTF-8 encoded. Clients must handle multi-byte characters correctly.

### Timestamp Precision

Timestamps are Unix epoch seconds (i64). Milliseconds are truncated, not rounded.

### Binary Encoding

All binary data uses:
- **Hex encoding** for cryptographic keys and hashes (lowercase)
- **Base64 encoding** for ciphertexts (standard alphabet with padding)
- **Big-endian** for multi-byte integers in binary formats

## Troubleshooting

### Test Failures

If tests fail:

1. **Check versions** - Ensure test vector version matches protocol version
2. **Review implementation** - Compare to reference implementation (Rust)
3. **Validate inputs** - Ensure test inputs are parsed correctly
4. **Check encoding** - Verify hex/base64/binary encoding
5. **Platform differences** - Review "Known Platform Differences" section

### Common Issues

**Issue**: Encryption test fails
**Solution**: Check that nonce is being generated randomly (test decryption instead)

**Issue**: Signature verification fails
**Solution**: Verify event ID computation matches NIP-01 serialization format

**Issue**: Padding calculation wrong
**Solution**: Review power-of-2 padding algorithm for boundary cases

**Issue**: Gift wrap fails
**Solution**: Check that ephemeral key is generated fresh each time

## Contributing

When adding new test vectors:

1. Follow existing format conventions
2. Include descriptive test IDs and descriptions
3. Cover both success and error cases
4. Test edge cases and boundaries
5. Update this README
6. Verify all clients pass new tests

## License

Same license as BuildIt protocol (see root LICENSE file).

## References

- [NIP-01: Basic protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [BuildIt Protocol Specification](../docs/protocol-spec/)

## Support

For questions about test vectors or protocol compliance:
- Open an issue in the BuildIt repository
- Join the BuildIt development chat
- Review protocol specification documentation
