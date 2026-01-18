# Security Audit - Timing Attacks and Side-Channel Vulnerabilities

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent
**Scope**: State-Actor Threat Model - Timing and Side-Channel Analysis
**Version**: 0.30.0

## Executive Summary

This audit examines the BuildIt Network codebase for timing attacks, side-channel vulnerabilities, and related information leakage that could be exploited by state-level adversaries. The analysis focuses on cryptographic operations, authentication flows, key comparisons, and error handling patterns.

**Overall Assessment**: MODERATE RISK

The codebase demonstrates good security awareness with several mitigations already in place:
- Timing-safe comparison function (`timingSafeEqual`) implemented and used for checksum verification
- Cryptographically secure randomness used throughout (`crypto.getRandomValues`)
- PBKDF2 with 600,000 iterations for key derivation (OWASP 2023 compliant)
- Timestamp randomization for NIP-17 metadata protection

However, several areas require attention for state-actor resilience.

---

## Findings

### MEDIUM - M001: Password Verification Timing Oracle via PBKDF2

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts`
**Lines**: 612-628

**Description**:
The `verifyPassword` function relies on AES-GCM decryption failure to determine password validity. While AES-GCM provides authentication (MAC verification), the PBKDF2 key derivation takes a consistent time regardless of password correctness. However, the decryption operation itself may have timing variations:

```typescript
public async verifyPassword(
  encryptedData: EncryptedKeyData,
  password: string
): Promise<boolean> {
  try {
    const salt = this.base64ToBuffer(encryptedData.salt);
    const masterKey = await this.deriveKeyFromPassword(password, salt);
    await this.decryptPrivateKey(
      encryptedData.encryptedPrivateKey,
      encryptedData.iv,
      masterKey
    );
    return true;
  } catch {
    return false;
  }
}
```

**Impact**:
- State actors with network access could perform statistical timing analysis
- Multiple password verification attempts could reveal information about password length or partial matches through subtle timing differences
- The 600K PBKDF2 iterations provide significant mitigation but do not eliminate the risk entirely

**Remediation**:
1. Add constant-time padding to the verification operation
2. Ensure consistent execution time regardless of success/failure
3. Consider adding random delay jitter to mask timing patterns:

```typescript
public async verifyPassword(
  encryptedData: EncryptedKeyData,
  password: string
): Promise<boolean> {
  const startTime = performance.now();
  const minExecutionTime = 1000; // 1 second minimum

  try {
    const salt = this.base64ToBuffer(encryptedData.salt);
    const masterKey = await this.deriveKeyFromPassword(password, salt);
    await this.decryptPrivateKey(
      encryptedData.encryptedPrivateKey,
      encryptedData.iv,
      masterKey
    );

    // Ensure minimum execution time
    const elapsed = performance.now() - startTime;
    if (elapsed < minExecutionTime) {
      await new Promise(resolve => setTimeout(resolve, minExecutionTime - elapsed));
    }
    return true;
  } catch {
    // Ensure same timing on failure
    const elapsed = performance.now() - startTime;
    if (elapsed < minExecutionTime) {
      await new Promise(resolve => setTimeout(resolve, minExecutionTime - elapsed));
    }
    return false;
  }
}
```

**Status**: Open

---

### MEDIUM - M002: Device Fingerprint Hash Comparison Not Timing-Safe

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/device/DeviceFingerprintService.ts`
**Lines**: 205-227

**Description**:
The `compareFingerprints` function uses direct string comparison (`===`) for hash comparison:

```typescript
public compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
  if (fp1.hash === fp2.hash) {
    return 1.0; // Exact match
  }
  // ...component comparison
}
```

**Impact**:
- Device fingerprint hashes could be brute-forced character-by-character
- Timing differences reveal how many leading characters match
- State actors could use this to identify target devices across sessions

**Remediation**:
Use timing-safe comparison:

```typescript
import { timingSafeEqual } from '@/lib/utils';

public compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
  if (timingSafeEqual(fp1.hash, fp2.hash)) {
    return 1.0; // Exact match
  }
  // ...
}
```

**Status**: Open

---

### MEDIUM - M003: WebAuthn Credential ID Comparison Not Timing-Safe

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/WebAuthnService.ts`
**Lines**: 301-308

**Description**:
The `verifyCredential` function uses direct comparison for credential IDs:

```typescript
public async verifyCredential(credential: WebAuthnCredential): Promise<boolean> {
  try {
    const result = await this.authenticateCredential([credential]);
    return result === credential.id;  // Direct string comparison
  } catch {
    return false;
  }
}
```

**Impact**:
- Credential ID validation could leak timing information
- State actors could potentially enumerate valid credential IDs

**Remediation**:
Use timing-safe comparison for credential ID verification.

**Status**: Open

---

### LOW - L001: Error Messages Reveal Operation Type

**Severity**: Low
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts`
**Lines**: 350, 364, 371, 377, 491, 520, 647

**Description**:
Error messages distinguish between different failure modes:

```typescript
throw new Error('Invalid password or corrupted key data');  // Line 350
throw new Error('WebAuthn not enabled for this identity');  // Line 364
throw new Error('WebAuthn authentication failed');          // Line 371
throw new Error('Invalid password');                        // Line 491, 520, 647
```

**Impact**:
- Attackers can determine which authentication method is configured
- Different error messages help map the system's authentication state
- For state-actor threat model, this reveals security posture

**Remediation**:
Normalize error messages for authentication failures:

```typescript
throw new Error('Authentication failed');
```

**Status**: Open

---

### LOW - L002: Early Returns in Validation Functions

**Severity**: Low
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/keyManager.ts`
**Lines**: 109-123, 127-135

**Description**:
The `isValidNsec` and `isValidNpub` functions use early returns in try/catch blocks:

```typescript
export function isValidNsec(nsec: string): boolean {
  try {
    const decoded = nip19.decode(nsec)
    return decoded.type === 'nsec'
  } catch {
    return false
  }
}
```

**Impact**:
- Timing varies based on whether decoding succeeds before the type check
- Could reveal information about the structure of invalid inputs
- Lower severity as these are format validators, not secret comparisons

**Remediation**:
For high-security contexts, add constant-time padding. For current use case, risk is acceptable.

**Status**: Accepted Risk

---

### LOW - L003: Rate Limiter Reveals Attempt Counts

**Severity**: Low
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/rateLimit.ts`
**Lines**: 163-167

**Description**:
The `getAttempts` function exposes attempt counts:

```typescript
getAttempts(operation: string, identifier: string): number {
  const key = `${operation}:${identifier}`
  return this.attempts.get(key)?.attempts || 0
}
```

**Impact**:
- Exposes information about prior authentication attempts
- Could be used by attackers to gauge rate limit status
- Primarily a debugging feature

**Remediation**:
Consider restricting this function to development/testing environments only.

**Status**: Open

---

### INFORMATIONAL - I001: Timing-Safe Equal Implementation Quality

**Severity**: Informational
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/utils.ts`
**Lines**: 86-105

**Description**:
The existing `timingSafeEqual` implementation is well-designed:

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

**Positive Observations**:
- Uses XOR accumulation to avoid early termination
- Handles length differences correctly
- Tests exist for timing consistency (`src/lib/__tests__/utils-security.test.ts`)

**Improvement Opportunity**:
The length comparison still leaks timing information. For maximum security:

```typescript
// Pad to same length with zeros for full constant-time comparison
const maxLen = Math.max(bufA.length, bufB.length);
let result = bufA.length ^ bufB.length;
for (let i = 0; i < maxLen; i++) {
  const a = i < bufA.length ? bufA[i] : 0;
  const b = i < bufB.length ? bufB[i] : 0;
  result |= a ^ b;
}
return result === 0;
```

**Status**: Enhancement Suggested

---

### INFORMATIONAL - I002: Checksum Verification Uses Timing-Safe Comparison

**Severity**: Informational (Positive Finding)
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts`
**Lines**: 156-161

**Description**:
Backup integrity verification correctly uses timing-safe comparison:

```typescript
if (backup.metadata?.checksum) {
  const checksum = await this.createChecksum(data);
  if (!timingSafeEqual(checksum, backup.metadata.checksum)) {
    throw new Error('Backup integrity check failed');
  }
}
```

**Impact**: Positive - This prevents timing attacks on backup validation.

**Status**: No Action Required

---

### INFORMATIONAL - I003: Cryptographic Randomness Correctly Used

**Severity**: Informational (Positive Finding)
**Component**: Multiple files

**Description**:
The codebase consistently uses `crypto.getRandomValues()` for:
- Salt generation (PBKDF2)
- IV generation (AES-GCM)
- Timestamp randomization (NIP-17)
- Passphrase generation (BIP-39)
- Random string generation

Tests verify that `Math.random()` is NOT used for security-critical operations.

**Status**: No Action Required

---

### INFORMATIONAL - I004: Console Logging Does Not Leak Secrets

**Severity**: Informational (Positive Finding)
**Component**: Codebase-wide

**Description**:
Searched for patterns that would log passwords, keys, secrets, or tokens:
- No instances of `console.log(.*password)` found in production code
- No instances of `console.log(.*nsec)` found
- Error messages do not include sensitive data

**Status**: No Action Required

---

## Summary

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | - |
| High | 0 | - |
| Medium | 3 | Open |
| Low | 3 | 2 Open, 1 Accepted |
| Informational | 4 | Positive findings |

### Priority Actions

1. **M001**: Add constant-time padding to password verification
2. **M002**: Use `timingSafeEqual` for device fingerprint hash comparison
3. **M003**: Use `timingSafeEqual` for WebAuthn credential ID verification
4. **L001**: Normalize authentication error messages

### Compliance Assessment

**Against PRIVACY.md Threat Model**:
- State Surveillance: PARTIAL - Timing attacks could reveal authentication patterns
- Device Seizure: PASS - No timing vulnerabilities in local key storage
- Network Analysis: PARTIAL - Authentication timing could be observed
- Supply Chain: PASS - Proper randomness used throughout

**Recommendations for State-Actor Resilience**:
1. Implement all Medium-severity remediations
2. Consider adding network-level timing jitter
3. Add unit tests for timing consistency in authentication flows
4. Review all string comparisons involving secrets/tokens

---

**Next Review**: After remediation of Medium-severity findings
**Document Status**: Security Audit Complete
