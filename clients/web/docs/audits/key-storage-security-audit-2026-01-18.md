# Security Audit - Key Storage and Device Seizure Vulnerabilities

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent (Claude Opus 4.5)
**Scope**: Key management, device seizure, memory handling, storage security
**Threat Model Focus**: Device seized by adversary (e.g., border crossing in authoritarian regime)

## Executive Summary

BuildIt Network implements a reasonable encryption-at-rest architecture with PBKDF2 key derivation and AES-GCM encryption. However, several vulnerabilities exist that could allow an adversary with physical device access to extract sensitive data, particularly when the device is seized while powered on (unlocked state).

**Critical Findings**: 1
**High Findings**: 4
**Medium Findings**: 5
**Low Findings**: 3
**Informational**: 3

**Device Seizure Scenario**: If an activist's device is seized at an airport in Iran while the app is unlocked, authorities could potentially:
1. Extract decrypted private keys from memory (cold boot attack if device is powered)
2. Access all historical messages (no forward secrecy)
3. Extract the entire IndexedDB including encrypted data (offline brute force)
4. Identify group memberships and social graph from unencrypted metadata

---

## Findings

### CRITICAL - Math.random() Used in NIP-17 Timestamp Randomization

**Severity**: Critical
**Component**: `/workspace/buildit/src/core/crypto/nip17.ts:11`
**CWE**: CWE-330 (Use of Insufficiently Random Values)

**Description**:
The `randomizeTimestamp()` function uses `Math.random()` which is cryptographically insecure:

```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = Math.floor(Math.random() * twoDaysInSeconds) - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + randomOffset
}
```

**Impact**:
- `Math.random()` is predictable and can be reverse-engineered
- Adversary can correlate message timing by predicting the randomization
- Undermines NIP-17 metadata protection
- Pattern analysis could reveal when messages were actually sent

**Attack Scenario**:
A state adversary with network-level visibility could use timing analysis to correlate encrypted messages, even with "randomized" timestamps. The PRNG state can be extracted or predicted.

**Remediation**:
Replace with `crypto.getRandomValues()`:

```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomBytes = new Uint32Array(1)
  crypto.getRandomValues(randomBytes)
  const randomOffset = (randomBytes[0] % twoDaysInSeconds) - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + randomOffset
}
```

**Status**: Open

---

### HIGH - Passphrase Generator Uses Math.random()

**Severity**: High
**Component**: `/workspace/buildit/src/core/crypto/keyManager.ts:140-153`
**CWE**: CWE-330 (Use of Insufficiently Random Values)

**Description**:
The `generatePassphrase()` function uses `Math.random()` for generating passphrases:

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

**Impact**:
- Passphrases are predictable
- Does not use BIP-39 wordlist as mentioned in comment
- Entropy is significantly lower than expected
- Brute force attacks become feasible

**Attack Scenario**:
An adversary who knows the seed state of `Math.random()` (which can be extracted from JavaScript engine) could predict generated passphrases.

**Remediation**:
1. Use `crypto.getRandomValues()` instead of `Math.random()`
2. Implement proper BIP-39 wordlist support
3. Calculate and verify minimum entropy requirements

**Status**: Open

---

### HIGH - Decrypted Private Keys Persist in Memory Until Lock

**Severity**: High
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:87-92`
**CWE**: CWE-316 (Cleartext Storage of Sensitive Information in Memory)

**Description**:
When unlocked, private keys are stored in a Map and remain in memory until explicit lock:

```typescript
private decryptedKeys: Map<string, Uint8Array> = new Map();
private masterKey: CryptoKey | null = null;
private databaseKey: CryptoKey | null = null;
```

While the implementation does zero-fill on lock (line 388: `privateKey.fill(0)`), keys are vulnerable during the unlocked period.

**Impact**:
- Cold boot attacks can extract keys from RAM
- Memory dump tools can read keys while device is unlocked
- JavaScript heap inspection reveals keys
- Browser extensions can access page memory

**Attack Scenario**:
Device seized while unlocked at border checkpoint. Adversary:
1. Keeps device powered on (or uses cold boot technique)
2. Extracts memory dump
3. Searches for 32-byte keys in known memory locations
4. Recovers all private keys

**Remediation**:
1. Consider using Web Crypto API's non-extractable keys where possible
2. Implement automatic lock on memory pressure events
3. Consider shorter auto-lock timeouts for high-risk users
4. Document cold boot attack mitigation (device encryption + strong PIN)

**Status**: Open (partial mitigation via auto-lock exists)

---

### HIGH - No Forward Secrecy for Historical Messages

**Severity**: High
**Component**: `/workspace/buildit/ENCRYPTION_STRATEGY.md`
**CWE**: CWE-326 (Inadequate Encryption Strength)

**Description**:
The NIP-17 implementation provides no forward secrecy. A single key compromise exposes all historical and future messages:

From ENCRYPTION_STRATEGY.md:
```
**Properties**:
- ✅ End-to-end encryption
- ✅ Metadata protection
- ✅ Message unlinkability
- ⚠️ No forward secrecy (acceptable for social organizing)
```

**Impact**:
- Device seizure = all past messages decryptable
- Key compromise is catastrophic
- No protection against "harvest now, decrypt later" attacks
- Particularly dangerous for long-term organizing records

**Attack Scenario**:
Adversary seizes device, extracts private key, then decrypts:
- All historical DMs
- All group messages
- All private event details
- All voting records

**Remediation**:
1. Implement Noise Protocol for large groups (documented as Phase 2)
2. Consider Signal Protocol ratcheting for high-risk DMs
3. Implement message expiration/auto-delete features
4. Document risk clearly to users

**Status**: Open (acknowledged limitation, Phase 2 planned)

---

### HIGH - Encrypted Data in IndexedDB Vulnerable to Offline Brute Force

**Severity**: High
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:21`
**CWE**: CWE-916 (Use of Password Hash With Insufficient Computational Effort)

**Description**:
While PBKDF2 with 600,000 iterations is used (OWASP 2023 recommended), the salt and encrypted data are stored in IndexedDB. An adversary with device access can copy the entire database for offline attack.

```typescript
const PBKDF2_ITERATIONS = 600_000;
```

**Impact**:
- Weak passwords can be cracked offline
- No rate limiting for offline attacks
- No device binding (data can be exfiltrated)
- HSM/secure enclave not utilized

**Attack Scenario**:
1. Adversary copies IndexedDB data (easily accessible via browser dev tools)
2. Extracts `encryptedPrivateKey`, `salt`, `iv`
3. Runs GPU-accelerated PBKDF2 brute force
4. Weak passwords (common words, short phrases) cracked in hours/days

**Remediation**:
1. Implement minimum password requirements
2. Consider Argon2id instead of PBKDF2 (memory-hard)
3. Document password strength requirements to users
4. Consider WebAuthn-only mode for high-risk users
5. Implement device binding via WebAuthn credential

**Status**: Open

---

### MEDIUM - Browser Extensions Can Access IndexedDB

**Severity**: Medium
**Component**: IndexedDB storage model
**CWE**: CWE-200 (Exposure of Sensitive Information)

**Description**:
Browser extensions with appropriate permissions can read IndexedDB data from the BuildIt Network origin. While data is encrypted, malicious extensions could:
- Extract encrypted data for offline attack
- Monitor when keys are decrypted in memory
- Inject keyloggers to capture passwords

**Impact**:
- Supply chain attacks via browser extensions
- User-installed malware can exfiltrate data
- Corporate policies may force extension installation

**Attack Scenario**:
User installs a browser extension (e.g., "free VPN", "ad blocker") that contains hidden code to:
1. Read IndexedDB on BuildIt Network domain
2. Monitor password input events
3. Exfiltrate credentials to attacker server

**Remediation**:
1. Document security hygiene (minimal browser extensions)
2. Consider Content Security Policy to block some extension behaviors
3. Recommend dedicated browser/profile for sensitive organizing
4. Consider native app for highest security

**Status**: Open (inherent to web platform)

---

### MEDIUM - WebAuthn Implementation Incomplete for Password Protection

**Severity**: Medium
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:376-377`
**CWE**: CWE-306 (Missing Authentication for Critical Function)

**Description**:
The WebAuthn unlock flow throws an error indicating incomplete implementation:

```typescript
public async unlockWithWebAuthn(
  ...
): Promise<Uint8Array> {
  ...
  // The protected key storage contains the password encrypted with WebAuthn
  // For now, we'll require the password to be provided separately
  // In a full implementation, the password would be stored encrypted with WebAuthn credential
  throw new Error('WebAuthn unlock requires password storage implementation');
}
```

**Impact**:
- WebAuthn is advertised but not fully functional
- Users may believe they have hardware key protection when they don't
- Password remains the only real protection

**Remediation**:
1. Complete WebAuthn implementation to protect password/key material
2. Or remove WebAuthn options from UI until implemented
3. Document current WebAuthn limitations

**Status**: Open

---

### MEDIUM - Test Mode Can Bypass Encryption

**Severity**: Medium
**Component**: `/workspace/buildit/src/core/storage/EncryptedDB.ts:83-89`
**CWE**: CWE-489 (Active Debug Code)

**Description**:
A test mode exists that bypasses encryption entirely:

```typescript
export function enableTestMode(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    testModeEnabled = true;
    console.info('⚠️  Test mode enabled - encryption bypassed');
  } else {
    console.warn('⚠️  Test mode requested but not in test environment');
  }
}
```

**Impact**:
- If NODE_ENV check is bypassed, encryption can be disabled
- Development builds may accidentally have encryption disabled
- Could be exploited in certain attack scenarios

**Remediation**:
1. Ensure test mode is completely stripped in production builds
2. Add additional checks beyond NODE_ENV
3. Consider compile-time removal of test code

**Status**: Open

---

### MEDIUM - Math.random() Used Throughout Application for IDs

**Severity**: Medium
**Component**: Multiple files in `/workspace/buildit/src/`
**CWE**: CWE-330 (Use of Insufficiently Random Values)

**Description**:
`Math.random()` is used extensively for generating IDs:
- `postsStore.ts`: Post IDs, reaction IDs, comment IDs, repost IDs, bookmark IDs
- `friendsStore.ts`: Friend request IDs, invite codes
- `conversationsStore.ts`: Conversation IDs, message IDs
- `groupsStore.ts`: Invitation IDs
- Many test files

**Impact**:
- IDs are predictable
- Potential for ID collision
- Could enable enumeration attacks
- Privacy leak if IDs correlate with timing

**Remediation**:
Use `crypto.randomUUID()` for ID generation:

```typescript
const id = crypto.randomUUID(); // Returns UUID v4
```

**Status**: Open

---

### MEDIUM - Dependency Vulnerabilities

**Severity**: Medium
**Component**: Package dependencies
**CWE**: CWE-1395 (Dependency on Vulnerable Third-Party Component)

**Description**:
`bun audit` reveals 21 vulnerabilities:
- 3 Critical: happy-dom (RCE), jspdf (LFI/Path Traversal)
- 8 High: valibot (ReDoS), glob (Command Injection), react-router (XSS), @modelcontextprotocol/sdk, qs, tar
- 8 Moderate: vite, mdast-util-to-hast, js-yaml, body-parser, prismjs, undici, react-router
- 2 Low: undici, diff

**Impact**:
- Remote code execution via happy-dom
- XSS via react-router
- Path traversal via jspdf
- DoS via valibot ReDoS

**Remediation**:
1. Run `bun update --latest` to update dependencies
2. Evaluate critical dependencies (happy-dom is test-only, can be replaced)
3. Consider removing or replacing jspdf if not essential

**Status**: Open

---

### LOW - Session Timeout Default May Be Too Long

**Severity**: Low
**Component**: `/workspace/buildit/src/lib/sessionTimeout.ts:19-22`
**CWE**: CWE-613 (Insufficient Session Expiration)

**Description**:
Default inactivity timeout is 30 minutes:

```typescript
private config: SessionConfig = {
  inactivityTimeoutMs: 30 * 60 * 1000, // 30 minutes default
  ...
}
```

**Impact**:
- Device left unattended for 29 minutes is vulnerable
- May be too long for high-risk organizing

**Remediation**:
1. Consider shorter default (15 minutes)
2. Recommend shorter timeout in security documentation
3. Implement "paranoid mode" with 5-minute timeout

**Status**: Open

---

### LOW - Console Logging in Security-Critical Code

**Severity**: Low
**Component**: Various files
**CWE**: CWE-532 (Insertion of Sensitive Information into Log File)

**Description**:
While no direct key logging was found, there are console.info/warn calls in security-critical paths:
- `SecureKeyManager.ts` does not log keys (good)
- Migration code logs public keys (acceptable)
- No nsec logging found (good)

**Impact**:
- Console logs can be captured by browser extensions
- Developer tools console persists data
- Minimal impact but should be audited

**Remediation**:
1. Ensure no sensitive data is logged
2. Strip console.* calls in production builds
3. Add linting rules for security-sensitive files

**Status**: Open (minor issue)

---

### LOW - No Duress/Panic Password Feature

**Severity**: Low
**Component**: Not implemented
**CWE**: CWE-306 (Missing Authentication for Critical Function)

**Description**:
There is no "duress password" or "panic unlock" feature that would:
- Wipe data when entered
- Show fake/decoy data
- Silently alert contacts

**Impact**:
- Users forced to unlock at border have no protection
- No plausible deniability
- Physical coercion has no mitigation

**Remediation**:
Consider implementing:
1. Duress password that wipes real data
2. Hidden identities that show decoy content
3. Remote wipe capability

**Status**: Not Implemented (Feature Request)

---

### INFORMATIONAL - Key Export Always Requires Password

**Severity**: Informational
**Component**: `/workspace/buildit/src/components/security/LockSettings.tsx:351-358`

**Description**:
The key export feature always requires password verification and this setting is hardcoded:

```typescript
<Switch
  id="require-password-export"
  ...
  disabled // Always true for security
/>
```

**Impact**: Positive - this is the correct security behavior.

**Status**: Good Practice (No Action)

---

### INFORMATIONAL - Memory Clearing Implemented

**Severity**: Informational
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:383-404`

**Description**:
The `lock()` method properly zero-fills sensitive data:

```typescript
public lock(): void {
  this._lockState = 'locking';

  // Zero-fill all decrypted keys in memory
  for (const [_key, privateKey] of this.decryptedKeys) {
    privateKey.fill(0);
  }
  this.decryptedKeys.clear();

  // Clear master key reference (will be garbage collected)
  this.masterKey = null;
  this.databaseKey = null;
  ...
}
```

**Impact**: Positive - reduces memory exposure window.

**Status**: Good Practice (No Action)

---

### INFORMATIONAL - Encrypted Key Storage Format

**Severity**: Informational
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:48-59`

**Description**:
The encrypted key storage format is well-designed:

```typescript
export interface EncryptedKeyData {
  publicKey: string; // Primary key (unencrypted for lookup)
  encryptedPrivateKey: string; // AES-GCM encrypted private key (base64)
  salt: string; // Unique PBKDF2 salt for this identity (base64)
  iv: string; // AES-GCM initialization vector (base64)
  webAuthnProtected: boolean;
  credentialId?: string;
  createdAt: number;
  lastUnlockedAt?: number;
  keyVersion: number; // For key rotation tracking
}
```

**Impact**: Positive - proper cryptographic design with unique salt per identity.

**Status**: Good Practice (No Action)

---

## Summary

**Total Findings**: 16
- Critical: 1
- High: 4
- Medium: 5
- Low: 3
- Informational: 3

## Priority Actions

1. **CRITICAL**: Replace `Math.random()` with `crypto.getRandomValues()` in timestamp randomization (nip17.ts)
2. **HIGH**: Replace `Math.random()` in passphrase generator with cryptographically secure alternative
3. **HIGH**: Update vulnerable dependencies (especially happy-dom, jspdf, valibot)
4. **HIGH**: Document forward secrecy limitations clearly to users
5. **MEDIUM**: Complete WebAuthn implementation or remove from UI

## Device Seizure Threat Analysis

### Scenario: Device Seized While Unlocked (Powered On)

**Extractable Data**:
1. All private keys (from memory)
2. All decrypted message content (from memory/IndexedDB)
3. All group memberships and metadata
4. All contact lists and social graph
5. All voting records and event attendance

**Mitigations**:
- Auto-lock feature (but 30min default may be too long)
- Memory clearing on lock (but requires user action)
- No protection against cold boot attacks

### Scenario: Device Seized While Locked (Powered Off)

**Extractable Data**:
1. Encrypted IndexedDB (offline brute force possible)
2. Public keys and metadata (unencrypted for indexing)
3. Username settings and preferences
4. Browser history (if not cleared)

**Mitigations**:
- PBKDF2 with 600K iterations slows brute force
- Unique salt per identity
- AES-GCM encryption

**Recommendations for High-Risk Users**:
1. Use strong passphrases (6+ random words)
2. Enable shortest auto-lock timeout
3. Enable "lock on tab hide" feature
4. Use dedicated device/browser profile
5. Enable device full-disk encryption
6. Consider hardware wallet for key storage (NIP-46)
7. Regularly clear browser data
8. Use Tor for network protection

## Compliance Status

**PRIVACY.md Threat Model Compliance**: Partial

The implementation aligns with documented threat model limitations:
- Device seizure is acknowledged as "Low Effectiveness" defense
- Forward secrecy limitation is documented
- IndexedDB accessibility is documented

However, the use of `Math.random()` for cryptographic operations violates security best practices and undermines the metadata protection claims.

---

**Document Status**: Complete
**Next Review**: After remediation of Critical and High findings
**Related Documents**:
- `/workspace/buildit/PRIVACY.md`
- `/workspace/buildit/ENCRYPTION_STRATEGY.md`
