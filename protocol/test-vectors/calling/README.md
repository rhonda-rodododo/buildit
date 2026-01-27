# Calling Protocol Test Vectors

This directory contains test vectors for validating calling protocol implementations across all BuildIt clients.

## Files

| File | Description |
|------|-------------|
| `call-offer.json` | Call offer message validation |
| `call-hangup.json` | Hangup reason codes and handling |
| `ice-candidate.json` | ICE candidate format validation |
| `group-call.json` | Group call and sender key distribution |

## Usage

Each test vector file contains a JSON array of test cases with:

- `name`: Unique identifier for the test
- `description`: Human-readable description
- `input`: The message to validate
- `expected`: Expected validation result

### Example (Rust)

```rust
#[test]
fn test_call_offer_validation() {
    let vectors: TestVectors = serde_json::from_str(include_str!("call-offer.json")).unwrap();

    for vector in vectors.vectors {
        let result = validate_call_offer(&vector.input);
        assert_eq!(result.is_ok(), vector.expected.valid, "{}", vector.name);
    }
}
```

### Example (TypeScript)

```typescript
import callOfferVectors from './call-offer.json';

describe('CallOffer validation', () => {
  callOfferVectors.vectors.forEach((vector) => {
    it(vector.name, () => {
      const result = CallOfferSchema.safeParse(vector.input);
      expect(result.success).toBe(vector.expected.valid);
    });
  });
});
```

### Example (Swift)

```swift
func testCallOfferValidation() throws {
    let vectors = try loadTestVectors("call-offer.json")

    for vector in vectors {
        let result = validateCallOffer(vector.input)
        XCTAssertEqual(result.isValid, vector.expected.valid, vector.name)
    }
}
```

### Example (Kotlin)

```kotlin
@Test
fun testCallOfferValidation() {
    val vectors = loadTestVectors("call-offer.json")

    vectors.forEach { vector ->
        val result = validateCallOffer(vector.input)
        assertEquals(vector.expected.valid, result.isValid, vector.name)
    }
}
```

## Adding New Vectors

When adding new test vectors:

1. Follow the existing JSON structure
2. Include both valid and invalid cases
3. Document the expected behavior in `expected`
4. Add a clear `description` explaining what's being tested
5. Update this README if adding new files

## Cross-Client Validation

All clients (Web, iOS, Android, Desktop) must pass these test vectors to ensure protocol compatibility. Run validation as part of CI/CD:

```bash
# From repo root
bun run validate:calling
```
