# Nostr Protocol Security Audit - State-Actor Threat Model

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent (Claude Opus 4.5)
**Scope**: Nostr protocol implementation, NIP-17/44/51 encryption, relay communication, event handling
**Threat Model**: State-actor level adversaries with mass surveillance capabilities

---

## Executive Summary

This security audit examined the Nostr protocol implementation in BuildIt Network against a state-actor threat model. The audit covered event signing and verification, relay communication, NIP-17/44/51 encryption implementations, subscription filter handling, and public key management.

**Overall Assessment**: The implementation demonstrates strong cryptographic foundations with proper use of `crypto.getRandomValues()` for randomness, correct NIP-44 ChaCha20-Poly1305 encryption, and robust NIP-17 gift wrapping with timestamp randomization. Several medium and low severity issues were identified that should be addressed to strengthen defenses against sophisticated adversaries.

### Finding Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | - |
| HIGH | 2 | Open |
| MEDIUM | 5 | Open |
| LOW | 4 | Open |
| INFORMATIONAL | 6 | Open |

---

## Scope

### Files Reviewed

**Core Nostr Implementation**:
- `/workspace/buildit/src/core/nostr/client.ts`
- `/workspace/buildit/src/core/nostr/nip01.ts`

**Encryption Layer**:
- `/workspace/buildit/src/core/crypto/nip17.ts`
- `/workspace/buildit/src/core/crypto/nip44.ts`
- `/workspace/buildit/src/core/crypto/nip51.ts`
- `/workspace/buildit/src/core/crypto/keyManager.ts`
- `/workspace/buildit/src/core/crypto/SecureKeyManager.ts`

**Transport Layer**:
- `/workspace/buildit/src/core/transport/NostrRelayAdapter.ts`

**Message Handling**:
- `/workspace/buildit/src/core/messaging/dm.ts`
- `/workspace/buildit/src/core/messaging/messageReceiver.ts`

**Storage and Auth**:
- `/workspace/buildit/src/core/storage/EncryptedDB.ts`
- `/workspace/buildit/src/core/storage/encryption.ts`
- `/workspace/buildit/src/stores/authStore.ts`

**Supporting Files**:
- `/workspace/buildit/src/lib/utils.ts`
- `/workspace/buildit/src/types/nostr.ts`

---

## Findings

### HIGH-001: Missing Event Signature Verification on Received Messages

**Severity**: HIGH
**Component**: `/workspace/buildit/src/core/messaging/messageReceiver.ts`
**Lines**: 86-134

**Description**:
The `handleGiftWrap` function in the message receiver does not explicitly verify the event signature before processing. While `nostr-tools` may perform some verification internally, there is no explicit call to `verifyEvent()` before unwrapping and trusting the gift wrap content.

**Code Sample**:
```typescript
private async handleGiftWrap(event: NostrEvent): Promise<void> {
  // Skip if already processed
  if (processedEvents.has(event.id)) {
    return;
  }
  // ... directly processes without signature verification
  const giftWrap = event as unknown as GiftWrap;
  // ... proceeds to unwrap
}
```

**Impact**:
An attacker could potentially inject malformed or forged events that appear valid but have invalid signatures. In a state-actor scenario, a compromised relay could inject crafted events to:
- Perform denial of service by causing decryption failures
- Inject misleading metadata about message origins
- Potentially trigger parsing vulnerabilities

**Remediation**:
```typescript
import { verifyEventSignature } from '@/core/nostr/nip01';

private async handleGiftWrap(event: NostrEvent): Promise<void> {
  // Skip if already processed
  if (processedEvents.has(event.id)) {
    return;
  }

  // SECURITY: Verify event signature before processing
  if (!verifyEventSignature(event)) {
    console.warn('Invalid event signature, rejecting gift wrap:', event.id);
    return;
  }
  // ... continue processing
}
```

**Status**: Open

---

### HIGH-002: Sender Identity Not Properly Extracted from Seal

**Severity**: HIGH
**Component**: `/workspace/buildit/src/core/messaging/dm.ts`
**Lines**: 44-78

**Description**:
The `receiveDirectMessage` function extracts the sender pubkey from the gift wrap's ephemeral key rather than from the seal's actual sender signature. The code contains a comment acknowledging this issue but does not properly fix it.

**Code Sample**:
```typescript
// Get sender pubkey from the seal (stored in gift wrap tags during unwrapping)
// For now, we'll extract it from the rumor after decryption
const senderPubkey = giftWrap.pubkey // This is the ephemeral key
// We need to track the actual sender from the seal - fix this properly
```

**Impact**:
- Messages are attributed to the ephemeral key rather than the actual sender
- Breaks NIP-17's sender authentication model
- Could enable message impersonation attacks
- Social graph analysis becomes impossible (which could be seen as a privacy feature, but breaks functionality)

**Remediation**:
Modify `unwrapGiftWrap` to return both the rumor and the seal's pubkey (actual sender):

```typescript
export function unwrapGiftWrap(
  giftWrap: GiftWrap,
  recipientPrivateKey: Uint8Array
): { rumor: Rumor; senderPubkey: string } {
  const conversationKey = deriveConversationKey(recipientPrivateKey, giftWrap.pubkey)
  const sealJson = decryptNIP44(giftWrap.content, conversationKey)
  const seal: Seal = JSON.parse(sealJson)

  // Extract actual sender from seal signature
  const senderPubkey = seal.pubkey; // This is the real sender

  const rumorConversationKey = deriveConversationKey(recipientPrivateKey, seal.pubkey)
  const rumorJson = decryptNIP44(seal.content, rumorConversationKey)
  const rumor: Rumor = JSON.parse(rumorJson)

  return { rumor, senderPubkey };
}
```

**Status**: Open

---

### MEDIUM-001: Subscription Filters May Leak User Interest Patterns

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/core/nostr/client.ts`
**Lines**: 75-120

**Description**:
Subscription filters are sent to relays in plaintext, revealing user interests and activity patterns. For state-actor threat models, this metadata can be correlated to identify users, track activity patterns, and build social graphs.

**Code Sample**:
```typescript
subscribe(
  filters: Filter[],
  onEvent: (event: NostrEvent) => void,
  onEose?: () => void
): string {
  // Filters sent directly to relays without obfuscation
  const mergedFilter = filters.length === 1 ? filters[0] : mergeFilters(...filters)
  this.pool.subscribeMany(relayUrls, mergedFilter, {...})
}
```

**Impact**:
- Relay operators (or state actors controlling relays) can observe:
  - Which pubkeys a user follows/queries
  - Message retrieval patterns (timing, frequency)
  - Group memberships via filter patterns
  - Activity windows and timezone inference

**Remediation**:
Consider implementing:
1. Filter padding with dummy requests
2. Periodic full sync instead of targeted queries
3. Private relay protocol extensions
4. Onion routing for subscription requests (beyond Tor - application layer)

**Status**: Open

---

### MEDIUM-002: JSON.parse Without Schema Validation on Decrypted Content

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/core/crypto/nip17.ts`
**Lines**: 130-135

**Description**:
The `unwrapGiftWrap` function parses decrypted JSON content without schema validation. While the content is encrypted and authenticated, a malicious message from a legitimate sender could contain crafted JSON that causes issues.

**Code Sample**:
```typescript
const seal: Seal = JSON.parse(sealJson)
// ...
const rumor: Rumor = JSON.parse(rumorJson)
```

**Impact**:
- Potential prototype pollution via `__proto__` in JSON
- Type confusion attacks if parsed object doesn't match expected schema
- Application state corruption from malformed data

**Remediation**:
Use schema validation library (e.g., Zod, Valibot) to validate parsed objects:

```typescript
import { z } from 'zod';

const SealSchema = z.object({
  kind: z.literal(13),
  content: z.string(),
  created_at: z.number(),
  tags: z.array(z.array(z.string())),
  id: z.string().length(64),
  pubkey: z.string().length(64),
  sig: z.string().length(128),
});

const seal = SealSchema.parse(JSON.parse(sealJson));
```

**Status**: Open

---

### MEDIUM-003: Math.random() Used in Non-Security Code Paths

**Severity**: MEDIUM
**Component**: Multiple test files and one production file
**Files**:
- `/workspace/buildit/src/modules/newsletters/newslettersStore.ts:854-857`
- `/workspace/buildit/src/modules/documents/components/TipTapEditor.tsx:78`

**Description**:
While security-critical code correctly uses `crypto.getRandomValues()`, some production code still uses `Math.random()`. Although these specific uses may not be security-critical, using weak randomness anywhere creates precedent and potential for copy-paste errors.

**Code Samples**:
```typescript
// newslettersStore.ts:857 - Simulated failure for testing
if (Math.random() < 0.05) {

// TipTapEditor.tsx:78 - Random color selection
return colors[Math.floor(Math.random() * colors.length)]
```

**Impact**:
- Predictable behavior in testing scenarios
- Inconsistent security posture
- Risk of accidental use in security contexts

**Remediation**:
Replace all `Math.random()` with `secureRandomInt()` from utils:

```typescript
import { secureRandomInt } from '@/lib/utils';

// For color selection:
return colors[secureRandomInt(colors.length)]

// For probabilistic testing:
if (secureRandomInt(100) < 5) {
```

**Status**: Open

---

### MEDIUM-004: Console Logging of Pubkeys May Aid Correlation Attacks

**Severity**: MEDIUM
**Component**: Multiple files throughout `src/core/`
**Example**: `/workspace/buildit/src/core/messaging/messageReceiver.ts:49`

**Description**:
Console logs include truncated pubkeys which, while seemingly innocuous, can be captured by malicious browser extensions or diagnostic tools and used for correlation attacks.

**Code Sample**:
```typescript
console.info(`Starting message receiver for ${userPubkey.slice(0, 8)}...`);
```

**Impact**:
- Browser extensions with console access can capture these logs
- DevTools-based attacks can harvest identity information
- Log aggregation services (if any) could build correlation databases

**Remediation**:
1. Remove pubkey logging in production builds
2. Use build-time log stripping for sensitive data
3. Implement structured logging that can be filtered

```typescript
if (process.env.NODE_ENV === 'development') {
  console.info(`Starting message receiver for ${userPubkey.slice(0, 8)}...`);
}
```

**Status**: Open

---

### MEDIUM-005: Dependency Vulnerabilities in Critical Libraries

**Severity**: MEDIUM
**Component**: Package dependencies
**Source**: `bun audit` output

**Description**:
The dependency audit revealed 18 vulnerabilities including 8 high severity issues. Notable concerns for security-critical applications:

- `valibot >=0.31.0 <1.2.0`: ReDoS vulnerability in EMOJI_REGEX (used in schema validation)
- `react-router >=7.0.0 <=7.11.0`: XSS and CSRF vulnerabilities
- `@modelcontextprotocol/sdk <1.24.0`: DNS rebinding and ReDoS

**Impact**:
- ReDoS could cause denial of service
- XSS could lead to key exfiltration
- DNS rebinding could redirect traffic to malicious servers

**Remediation**:
Run `bun update` to update compatible packages and evaluate breaking changes for major version updates:
```bash
bun update
# Or for all updates including breaking:
bun update --latest
```

**Status**: Open

---

### LOW-001: Relay URLs Hardcoded Without Certificate Pinning

**Severity**: LOW
**Component**: `/workspace/buildit/src/core/nostr/client.ts`
**Lines**: 244-247

**Description**:
Default relay URLs are hardcoded and connect via standard WebSocket TLS without certificate pinning. A state actor with access to Certificate Authorities could perform MitM attacks.

**Code Sample**:
```typescript
const defaultRelays: RelayConfig[] = relays || [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://relay.nostr.band', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
]
```

**Impact**:
- State actors with CA access could intercept relay traffic
- Traffic patterns visible even if content is encrypted
- Relay impersonation possible with compromised certificates

**Remediation**:
1. Recommend Tor usage for high-risk users (already supported)
2. Document relay selection best practices
3. Consider implementing relay signature verification

**Status**: Open

---

### LOW-002: No Event ID Verification Against Content Hash

**Severity**: LOW
**Component**: `/workspace/buildit/src/core/messaging/messageReceiver.ts`

**Description**:
Incoming events are processed without verifying that the event ID matches the SHA-256 hash of the serialized event content (as per NIP-01). While nostr-tools handles this internally, explicit verification provides defense in depth.

**Impact**:
- Reliance on library implementation details
- No defense against library bugs or version changes
- Missing audit trail for verification

**Remediation**:
Add explicit event ID verification:

```typescript
import { getEventHash } from 'nostr-tools';

function verifyEventId(event: NostrEvent): boolean {
  const computedId = getEventHash(event);
  return computedId === event.id;
}
```

**Status**: Open

---

### LOW-003: testModeEnabled Bypass in EncryptedDB

**Severity**: LOW
**Component**: `/workspace/buildit/src/core/storage/EncryptedDB.ts`
**Lines**: 92-98

**Description**:
The test mode check can be bypassed if `process.env.NODE_ENV` is manipulated or in certain build configurations.

**Code Sample**:
```typescript
export function enableTestMode(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    testModeEnabled = true;
    console.info('Test mode enabled - encryption bypassed');
  } else {
    console.warn('Test mode requested but not in test environment');
  }
}
```

**Impact**:
- Build misconfiguration could disable encryption
- Supply chain attack could inject test mode enablement

**Remediation**:
Add additional safeguards:
```typescript
export function enableTestMode(): void {
  // Never allow in production builds
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Test mode cannot be enabled in production');
  }
  // Additional check for browser environment
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    throw new Error('Test mode blocked in HTTPS context');
  }
  // ...
}
```

**Status**: Open

---

### LOW-004: Timing Information in Error Messages

**Severity**: LOW
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts`

**Description**:
Error messages and timing of operations may leak information about key existence or validation status.

**Impact**:
- Timing side-channel for password validation
- Error messages may differ for valid vs invalid accounts

**Remediation**:
Use constant-time operations and uniform error messages:
```typescript
// Use timingSafeEqual from utils for any comparisons
// Ensure all error paths take similar time
```

**Status**: Open

---

### INFO-001: Strong Cryptographic Randomness Implementation

**Severity**: INFORMATIONAL (Positive Finding)
**Component**: `/workspace/buildit/src/core/crypto/nip17.ts`

**Description**:
The `secureRandomInt` function correctly implements rejection sampling to avoid modulo bias when generating random numbers, using `crypto.getRandomValues()` as the entropy source.

**Code Sample**:
```typescript
export function secureRandomInt(max: number): number {
  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  // Use rejection sampling to avoid modulo bias
  const maxValid = Math.floor(0xFFFFFFFF / max) * max
  if (randomBuffer[0] >= maxValid) {
    return secureRandomInt(max)
  }
  return randomBuffer[0] % max
}
```

**Assessment**: Correctly implemented. This provides cryptographically secure random integers suitable for security-critical operations.

---

### INFO-002: Proper Timestamp Randomization for Metadata Protection

**Severity**: INFORMATIONAL (Positive Finding)
**Component**: `/workspace/buildit/src/core/crypto/nip17.ts`

**Description**:
Timestamp randomization uses a 2-day window as specified by NIP-17, with cryptographically secure randomness. This provides strong protection against timing correlation attacks.

**Code Sample**:
```typescript
export function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = secureRandomInt(twoDaysInSeconds) - Math.floor(twoDaysInSeconds / 2)
  return Math.floor(baseTime / 1000) + randomOffset
}
```

**Assessment**: Correctly implemented per NIP-17 specification.

---

### INFO-003: Application-Layer Message Padding

**Severity**: INFORMATIONAL (Positive Finding)
**Component**: `/workspace/buildit/src/core/crypto/nip44.ts`

**Description**:
The application adds an additional random padding layer (16-64 bytes) on top of NIP-44's standard padding. This provides defense-in-depth against traffic analysis.

**Assessment**: Excellent additional protection beyond NIP-44 requirements.

---

### INFO-004: Timing-Safe Comparison Function Available

**Severity**: INFORMATIONAL (Positive Finding)
**Component**: `/workspace/buildit/src/lib/utils.ts`

**Description**:
A properly implemented timing-safe string comparison function is available for use throughout the codebase.

**Code Sample**:
```typescript
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  let result = bufA.length ^ bufB.length
  const minLen = Math.min(bufA.length, bufB.length)
  for (let i = 0; i < minLen; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}
```

**Assessment**: Correctly implemented to prevent timing side-channel attacks.

---

### INFO-005: PBKDF2 with Strong Parameters

**Severity**: INFORMATIONAL (Positive Finding)
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts`

**Description**:
Key derivation uses PBKDF2 with 600,000 iterations (OWASP 2023 recommendation) and SHA-256.

**Code Sample**:
```typescript
const PBKDF2_ITERATIONS = 600_000;
```

**Assessment**: Follows current OWASP recommendations for password-based key derivation.

---

### INFO-006: Key Zeroing on Lock

**Severity**: INFORMATIONAL (Positive Finding)
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts`

**Description**:
When the app locks, decrypted keys are zero-filled before being cleared from memory.

**Code Sample**:
```typescript
public lock(): void {
  // Zero-fill all decrypted keys in memory
  for (const [_key, privateKey] of this.decryptedKeys) {
    privateKey.fill(0)
  }
  this.decryptedKeys.clear()
}
```

**Assessment**: Good security practice for memory protection.

---

## Compliance Summary

### NIP-17 (Private Direct Messages) Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Gift wrapping (kind 1059) | PASS | Correctly implemented |
| Seal (kind 13) | PASS | Correctly implemented |
| Rumor (kind 14) | PASS | Correctly implemented |
| Ephemeral key for gift wrap | PASS | New key per message |
| Timestamp randomization | PASS | +/- 2 days as specified |
| Recipient in p tag | PASS | Correctly placed |
| Sender hidden | PARTIAL | See HIGH-002 |

### NIP-44 (Encryption) Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| ChaCha20-Poly1305 | PASS | Via nostr-tools |
| Conversation key derivation | PASS | ECDH + HKDF |
| Padding | PASS | Powers of 2 + additional |
| No nonce reuse | PASS | Random nonce per message |

### NIP-51 (Lists) Compliance

| Requirement | Status | Notes |
|-------------|--------|-------|
| Encrypted content | PASS | Self-encryption |
| Custom kinds | PASS | 39500-39503 |
| d tag for replacement | PASS | Correctly implemented |

---

## Recommendations

### Priority Actions (Address Immediately)

1. **Implement event signature verification** in `messageReceiver.ts` (HIGH-001)
2. **Fix sender identity extraction** from seal in NIP-17 unwrapping (HIGH-002)
3. **Update vulnerable dependencies** via `bun update` (MEDIUM-005)

### Short-Term Improvements (Next Sprint)

4. Add JSON schema validation for parsed content (MEDIUM-002)
5. Replace remaining `Math.random()` usage (MEDIUM-003)
6. Strip debug logging in production builds (MEDIUM-004)

### Long-Term Enhancements (Roadmap)

7. Implement subscription filter obfuscation (MEDIUM-001)
8. Add certificate pinning or relay signatures (LOW-001)
9. Explicit event ID verification (LOW-002)
10. Strengthen test mode protections (LOW-003)

---

## Testing Recommendations

Add the following test cases:

```typescript
describe('Nostr Security Tests', () => {
  it('should reject events with invalid signatures', () => {
    // Create event, tamper with content, verify rejection
  });

  it('should verify event ID matches content hash', () => {
    // Create event, verify ID computation
  });

  it('should extract correct sender from seal', () => {
    // Create gift wrap, verify sender != ephemeral key
  });

  it('should handle malformed JSON gracefully', () => {
    // Attempt to unwrap gift wrap with invalid JSON
  });
});
```

---

## Conclusion

The BuildIt Network Nostr implementation demonstrates strong security fundamentals with proper cryptographic implementations. The two HIGH severity findings (signature verification and sender identity extraction) should be addressed before production deployment for high-risk users. The MEDIUM severity issues represent defense-in-depth improvements that would strengthen the overall security posture against state-actor adversaries.

The positive findings (INFO-001 through INFO-006) indicate that the development team has prioritized security in key areas including randomness generation, timestamp obfuscation, key derivation, and memory handling.

**Recommendation**: Address HIGH and MEDIUM findings before deploying for high-risk activist organizing use cases.

---

**Document Status**: Complete
**Next Review**: After remediation of HIGH/MEDIUM findings
**Related Documents**:
- `PRIVACY.md` - Threat model
- `ENCRYPTION_STRATEGY.md` - Encryption architecture
- `cryptographic-security-audit-2026-01-18.md` - Crypto audit
- `key-storage-security-audit-2026-01-18.md` - Key storage audit
