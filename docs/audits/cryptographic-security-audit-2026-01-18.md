# Cryptographic Security Audit - 2026-01-18

## Executive Summary

This audit examines the cryptographic implementation of BuildIt Network, a privacy-first organizing platform designed to protect activists from sophisticated state actors (including Iranian IRGC and Chinese MSS). The audit focuses on NIP-17, NIP-44, NIP-59 implementations, key management, and cryptographic primitives.

**Overall Assessment**: The implementation shows strong cryptographic foundations with some critical and high-severity issues that must be addressed before deployment in high-risk contexts.

### Key Findings Summary
- **Critical**: 2 issues
- **High**: 4 issues
- **Medium**: 5 issues
- **Low**: 3 issues
- **Informational**: 4 issues

---

## Scope

### Components Audited
1. `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts` - NIP-17 gift wrap implementation
2. `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip44.ts` - NIP-44 encryption wrapper
3. `/home/rikki/claude-workspace/buildit-network/src/core/crypto/keyManager.ts` - Key generation and management
4. `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts` - Secure key storage
5. `/home/rikki/claude-workspace/buildit-network/src/core/storage/encryption.ts` - Database encryption layer
6. `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts` - Local encryption
7. `/home/rikki/claude-workspace/buildit-network/src/lib/media/mediaEncryption.ts` - Media file encryption
8. `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts` - WebAuthn key protection
9. `/home/rikki/claude-workspace/buildit-network/src/lib/rateLimit.ts` - Rate limiting

### Methodology
- Static code analysis
- Protocol compliance verification (NIP-17, NIP-44, NIP-59)
- Threat modeling against state actors
- Dependency vulnerability scanning
- Cryptographic primitive review

---

## Findings

### CRITICAL-001: Weak Randomness in Timestamp Obfuscation

**Severity**: Critical
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts:11`

```typescript
const randomOffset = Math.floor(Math.random() * twoDaysInSeconds) - twoDaysInSeconds / 2
```

**Description**: The timestamp randomization for NIP-17 metadata protection uses `Math.random()` which is NOT cryptographically secure. `Math.random()` is a PRNG seeded from predictable sources and can be reversed or predicted by an attacker who observes multiple outputs.

**Impact**:
- State actors can correlate messages by predicting/reverse-engineering the "random" offsets
- NIP-17's metadata protection (designed to prevent timing correlation) is severely weakened
- Traffic analysis attacks become feasible

**State-Actor Relevance**: Both Chinese MSS and Iranian IRGC have sophisticated traffic analysis capabilities. With predictable timestamps, they could correlate message patterns and identify communication networks.

**Remediation**:
```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomBytes = crypto.getRandomValues(new Uint32Array(1))
  const randomOffset = (randomBytes[0] % twoDaysInSeconds) - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + randomOffset
}
```

**Status**: Open

---

### CRITICAL-002: Weak Passphrase Generation Uses Math.random()

**Severity**: Critical
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/keyManager.ts:139-153`

```typescript
export function generatePassphrase(wordCount: number = 12): string {
  const words = []
  const charset = 'abcdefghijklmnopqrstuvwxyz'

  for (let i = 0; i < wordCount; i++) {
    let word = ''
    for (let j = 0; j < 6; j++) {
      word += charset[Math.floor(Math.random() * charset.length)]
    }
    words.push(word)
  }

  return words.join(' ')
}
```

**Description**: Passphrase generation uses `Math.random()` which provides only ~52 bits of entropy instead of the expected cryptographic strength. Additionally, the "passphrase" is not using a standard wordlist (like BIP-39), making it less secure and harder to transcribe.

**Impact**:
- Passphrases are predictable and can be brute-forced
- Users may rely on these "passphrases" for key backup recovery
- Entropy is severely limited (Math.random is deterministic)

**State-Actor Relevance**: With access to seized devices and knowledge of the algorithm, state actors could enumerate possible passphrases in a reasonable timeframe.

**Remediation**:
1. Use `crypto.getRandomValues()` for word selection
2. Implement proper BIP-39 wordlist for human-readable passphrases
3. Ensure minimum 128-bit entropy

```typescript
import { wordlist } from 'bip39/wordlists/english'

export function generatePassphrase(wordCount: number = 12): string {
  const words: string[] = []
  const randomBytes = crypto.getRandomValues(new Uint16Array(wordCount))

  for (let i = 0; i < wordCount; i++) {
    const index = randomBytes[i] % wordlist.length
    words.push(wordlist[index])
  }

  return words.join(' ')
}
```

**Status**: Open

---

### HIGH-001: Static Salt in ProtectedKeyStorage PBKDF2

**Severity**: High
**Location**: `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts:193`

```typescript
salt: encoder.encode('BuildItNetwork'), // In production, use unique salt per user
```

**Description**: The PBKDF2 key derivation uses a static, hardcoded salt `'BuildItNetwork'` instead of a unique per-key salt. This completely defeats the purpose of salting.

**Impact**:
- Rainbow table attacks become feasible against all users
- If one password is cracked, the derived key can be reused
- Multi-target attacks are significantly easier

**State-Actor Relevance**: State actors can pre-compute rainbow tables for the static salt and crack multiple users' passwords in parallel.

**Remediation**:
```typescript
private async deriveEncryptionKey(password: string, salt?: Uint8Array): Promise<{key: CryptoKey, salt: Uint8Array}> {
  const actualSalt = salt || crypto.getRandomValues(new Uint8Array(32))
  // ... use actualSalt
  return { key, salt: actualSalt }
}
```

**Status**: Open

---

### HIGH-002: Insufficient PBKDF2 Iterations in ProtectedKeyStorage

**Severity**: High
**Location**: `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts:195`

```typescript
iterations: 100000,
```

**Description**: While SecureKeyManager correctly uses 600,000 iterations (OWASP 2023 recommendation), ProtectedKeyStorage uses only 100,000 iterations. This inconsistency creates a weak link.

**Impact**:
- Keys protected via ProtectedKeyStorage are 6x faster to brute-force
- Inconsistent security posture creates confusion

**State-Actor Relevance**: With GPU clusters, 100k iterations can be attacked at approximately 6x the speed of 600k iterations, making brute-force attacks more feasible.

**Remediation**: Increase to 600,000 iterations to match SecureKeyManager.

**Status**: Open

---

### HIGH-003: Weak Hash Function for Local Encryption Key Derivation

**Severity**: High
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts:137-156`

```typescript
function hashToFakePublicKey(input: string): string {
  // Simple hash to create a 64-char hex string (32 bytes)
  let hash = 0
  const result = new Uint8Array(32)

  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash = hash & hash
    result[i % 32] ^= (hash >>> (i % 24)) & 0xff
  }
  // ...
}
```

**Description**: This custom "hash" function is cryptographically weak. It's a simple multiplicative hash that can be easily reversed or collided. It's used to derive a "fake public key" for the NIP-44 conversation key derivation.

**Impact**:
- The local encryption key derivation is based on a weak, reversible hash
- Collisions could allow key prediction
- Does not provide the expected security properties

**State-Actor Relevance**: A cryptanalyst could potentially reverse-engineer or find collisions in this weak hash, compromising the local encryption key derivation.

**Remediation**: Use SHA-256 from Web Crypto API:

```typescript
async function hashToFakePublicKey(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
```

**Status**: Open

---

### HIGH-004: No Forward Secrecy Implementation

**Severity**: High
**Location**: Multiple files - architectural issue

**Description**: As documented in ENCRYPTION_STRATEGY.md, NIP-17/NIP-44 does not provide forward secrecy. A single key compromise reveals all past AND future messages. The planned Noise Protocol implementation for forward secrecy is not implemented.

**Impact**:
- Device seizure leads to complete message history exposure
- Past communications cannot be protected retrospectively
- No protection against future key compromise

**State-Actor Relevance**: This is explicitly called out in the threat model. State actors who seize devices gain access to entire communication history. This is particularly dangerous for activists in custody.

**Remediation**:
1. Implement Noise Protocol for large groups (as planned in Phase 2)
2. Add key rotation for small groups
3. Implement message expiration/deletion
4. Consider Signal Protocol port for high-risk scenarios

**Status**: Open (documented as Phase 2)

---

### MEDIUM-001: No Nonce Reuse Prevention Verification

**Severity**: Medium
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip44.ts`

**Description**: The NIP-44 implementation relies on nostr-tools for nonce generation. While nostr-tools likely generates random nonces correctly, there's no explicit verification or documentation that nonce reuse is prevented.

**Impact**:
- ChaCha20-Poly1305 with nonce reuse completely breaks security
- Two messages with the same nonce leak plaintext via XOR

**State-Actor Relevance**: If any implementation bug allows nonce reuse, sophisticated attackers could detect and exploit this.

**Remediation**:
1. Add test cases verifying unique nonces across multiple encryptions (test exists but should be expanded)
2. Consider adding nonce tracking for paranoid mode
3. Document that nonce security relies on nostr-tools

**Status**: Open

---

### MEDIUM-002: Test Mode Bypasses Encryption

**Severity**: Medium
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts:83-89`

```typescript
export function enableTestMode(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    testModeEnabled = true
    console.info('Warning: Test mode enabled - encryption bypassed')
  }
```

**Description**: A test mode exists that bypasses all encryption. While it checks for NODE_ENV=test, the function is exported and could potentially be called in production if the check fails.

**Impact**:
- If test mode is accidentally enabled in production, all encryption is bypassed
- Data would be stored in plaintext

**State-Actor Relevance**: If a supply chain attack or code injection could call enableTestMode(), all security would be defeated.

**Remediation**:
1. Use compile-time dead code elimination (remove function entirely in production builds)
2. Add runtime checks beyond just NODE_ENV
3. Consider removing the function entirely and using dependency injection for tests

**Status**: Open

---

### MEDIUM-003: Weak ID Generation Throughout Codebase

**Severity**: Medium
**Location**: Multiple files using `Math.random()` for IDs

Examples:
- `/home/rikki/claude-workspace/buildit-network/src/lib/utils.ts:15`
- `/home/rikki/claude-workspace/buildit-network/src/modules/friends/friendsStore.ts:88`
- `/home/rikki/claude-workspace/buildit-network/src/core/nostr/client.ts:79`
- `/home/rikki/claude-workspace/buildit-network/src/stores/groupsStore.ts:308`

**Description**: Many IDs are generated using `Math.random().toString(36).substring()` patterns. While these are not cryptographic keys, predictable IDs can enable enumeration attacks.

**Impact**:
- IDs may be predictable, enabling enumeration
- Race conditions could lead to ID collisions
- Less severe than crypto issues but still a concern

**State-Actor Relevance**: Low direct impact, but predictable IDs could assist in traffic analysis or message correlation.

**Remediation**: Use `crypto.randomUUID()` for ID generation throughout.

**Status**: Open

---

### MEDIUM-004: Console Logging of Sensitive Operations

**Severity**: Medium
**Location**: Multiple files

Examples:
- `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts:332` - logs key rotation failures
- `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts:86` - logs test mode status
- `/home/rikki/claude-workspace/buildit-network/src/core/storage/encryption.ts:299` - logs encryption hook setup

**Description**: While no private keys are logged, various console.log/console.info statements exist for encryption operations that could leak metadata about security operations.

**Impact**:
- Browser console or logging could reveal security operations
- Debugging information could assist attackers

**State-Actor Relevance**: If logs are captured (e.g., via malware), they could reveal encryption state and operations.

**Remediation**:
1. Implement production log levels that suppress security-related logging
2. Use a logging framework with configurable levels
3. Remove or obfuscate security-related logs in production builds

**Status**: Open

---

### MEDIUM-005: LocalStorage Usage for Non-Sensitive Data

**Severity**: Medium
**Location**:
- `/home/rikki/claude-workspace/buildit-network/src/i18n/config.ts:52`
- `/home/rikki/claude-workspace/buildit-network/src/components/theme-provider.tsx:92,100`

**Description**: localStorage is used for language and theme preferences. While not sensitive, this usage pattern could normalize localStorage usage and lead to future mistakes.

**Impact**:
- Low direct impact (only stores language/theme)
- Could lead to future security mistakes if pattern is copied

**State-Actor Relevance**: Minimal - these are not sensitive values.

**Remediation**: Consider documenting that localStorage is only for non-sensitive preferences, or migrate to IndexedDB for consistency.

**Status**: Open (Low Priority)

---

### LOW-001: Dependency Vulnerabilities

**Severity**: Low-High (varies by dependency)
**Location**: `package.json` dependencies

**Description**: `bun audit` reveals 21 vulnerabilities including:
- **Critical**: happy-dom (2 RCE vulnerabilities), jspdf (path traversal)
- **High**: react-router (XSS), glob (command injection), valibot (ReDoS), tar (file overwrite)
- **Medium/Low**: Various DoS and information disclosure issues

**Impact**: Supply chain attacks could compromise the application.

**State-Actor Relevance**: State actors frequently exploit supply chain vulnerabilities. The happy-dom critical vulnerabilities are particularly concerning as they allow RCE.

**Remediation**:
1. Update dependencies immediately: `bun update --latest`
2. Replace or remove happy-dom (critical RCE)
3. Monitor for security updates
4. Consider using Snyk or similar for automated monitoring

**Status**: Open

---

### LOW-002: No Signature Verification on Decryption

**Severity**: Low
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts:106-121`

**Description**: The `unwrapGiftWrap` function decrypts messages but doesn't explicitly verify the signature chain. While nostr-tools may handle this, explicit verification should be documented.

**Impact**:
- Tampered messages could potentially be accepted
- Origin verification may be incomplete

**State-Actor Relevance**: Man-in-the-middle attacks could inject or modify messages.

**Remediation**: Add explicit signature verification for seal and gift wrap events.

**Status**: Open

---

### LOW-003: No Post-Quantum Cryptography

**Severity**: Low (Future Risk)
**Location**: Architectural

**Description**: As noted in PRIVACY.md, there is no post-quantum encryption. Current encryption uses secp256k1 (ECDH) and ChaCha20-Poly1305, both vulnerable to quantum computers.

**Impact**:
- Stored ciphertext could be decrypted by future quantum computers
- "Harvest now, decrypt later" attacks

**State-Actor Relevance**: Both China and other state actors are investing heavily in quantum computing. Messages stored today could be decrypted in 10-20 years.

**Remediation**:
1. Monitor NIST post-quantum standardization
2. Plan migration path to hybrid cryptography
3. Consider implementing message expiration to limit exposure window

**Status**: Open (Future Risk)

---

### INFO-001: Strong PBKDF2 Implementation in SecureKeyManager

**Severity**: Informational (Positive Finding)
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts:21`

```typescript
const PBKDF2_ITERATIONS = 600_000;
```

**Description**: SecureKeyManager correctly uses 600,000 PBKDF2 iterations per OWASP 2023 recommendations.

**Status**: Good Practice

---

### INFO-002: Proper Key Zeroing on Lock

**Severity**: Informational (Positive Finding)
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts:386-390`

```typescript
// Zero-fill all decrypted keys in memory
for (const [_key, privateKey] of this.decryptedKeys) {
  privateKey.fill(0)
}
```

**Description**: Keys are zero-filled before being cleared from memory, reducing exposure to memory dump attacks.

**Status**: Good Practice

---

### INFO-003: Proper Ephemeral Key Usage in NIP-17

**Severity**: Informational (Positive Finding)
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts:64`

**Description**: Gift wraps correctly use ephemeral keys (via `generateSecretKey()`) for sender anonymity.

**Status**: Good Practice

---

### INFO-004: HKDF Key Separation for Database Encryption

**Severity**: Informational (Positive Finding)
**Location**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts:207-238`

**Description**: Database encryption key is properly derived from master key using HKDF with distinct salt and info parameters.

**Status**: Good Practice

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 2 | Open |
| High | 4 | Open |
| Medium | 5 | Open |
| Low | 3 | Open |
| Informational | 4 | N/A (Positive) |
| **Total** | **18** | |

## Priority Actions

1. **IMMEDIATE**: Replace `Math.random()` with `crypto.getRandomValues()` in all cryptographic contexts (CRITICAL-001, CRITICAL-002)
2. **IMMEDIATE**: Fix static salt in ProtectedKeyStorage (HIGH-001)
3. **HIGH**: Increase PBKDF2 iterations in ProtectedKeyStorage to 600k (HIGH-002)
4. **HIGH**: Replace weak hash function in EncryptedDB (HIGH-003)
5. **HIGH**: Update vulnerable dependencies, especially happy-dom (LOW-001)
6. **MEDIUM**: Implement forward secrecy via Noise Protocol (HIGH-004)
7. **MEDIUM**: Add nonce reuse prevention verification (MEDIUM-001)
8. **MEDIUM**: Remove test mode bypass or add stronger guards (MEDIUM-002)

## Compliance

**PRIVACY.md Threat Model Compliance**:
- **Content Confidentiality**: PASS (NIP-44 implemented correctly via nostr-tools)
- **Sender Anonymity**: PASS (ephemeral keys used correctly)
- **Timestamp Obfuscation**: FAIL (weak randomness - CRITICAL-001)
- **Key Protection at Rest**: PARTIAL (good structure, but weak salt in ProtectedKeyStorage)
- **Forward Secrecy**: FAIL (not implemented - documented limitation)
- **Post-Quantum**: FAIL (not implemented - documented limitation)

## Recommendations for High-Risk Deployment

For activists facing state-level adversaries (Iran, China, etc.):

1. **Do not deploy** until CRITICAL and HIGH issues are resolved
2. Implement hardware wallet support (NIP-46) for key storage
3. Mandate Tor usage for relay communication
4. Implement message expiration to limit "harvest now, decrypt later" exposure
5. Add forward secrecy via Noise Protocol before sensitive organizing
6. Consider separate identities per high-risk group
7. Conduct regular key rotation

---

**Audit Performed By**: Claude Code Security Auditor Agent
**Date**: 2026-01-18
**Next Review**: After remediation of Critical/High findings
