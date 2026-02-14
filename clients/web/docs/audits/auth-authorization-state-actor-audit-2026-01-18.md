# Authentication & Authorization Security Audit - State-Actor Threat Model

**Date**: 2026-01-18
**Auditor**: Claude Opus 4.5 (Security Auditor Agent)
**Scope**: Authentication, Authorization, Session Management, Key Management, WebAuthn
**Threat Model**: Nation-State Adversary

---

## Executive Summary

This audit examines the authentication and authorization system of BuildIt Network against a state-actor threat model. The application demonstrates solid cryptographic foundations with proper use of PBKDF2 (600K iterations), AES-GCM encryption, and secure randomness via `crypto.getRandomValues()` in most critical paths.

**Overall Assessment**: **B+ (Good with Notable Gaps)**

### Critical Statistics

| Category | Findings | Status |
|----------|----------|--------|
| Critical | 2 | Needs Immediate Fix |
| High | 4 | Priority Fix Required |
| Medium | 6 | Planned Remediation |
| Low | 4 | Accept or Fix |
| Informational | 3 | Documentation |

### Key Strengths
- PBKDF2 with 600,000 iterations (OWASP 2023 compliant)
- AES-256-GCM encryption with random IVs
- Proper key derivation hierarchy (MEK -> DEK)
- Memory zeroing on lock
- `timingSafeEqual()` for checksum comparison
- WebAuthn support for biometric authentication

### Critical Gaps
- Rate limiting not enforced on unlock/password verification
- Authorization checks missing on sensitive group operations
- No brute-force protection on local password attempts
- Test mode bypass could be exploited in production

---

## Detailed Findings

### CRITICAL-001: No Rate Limiting on Password Verification

**Severity**: CRITICAL
**Component**: `/workspace/buildit/src/stores/authStore.ts:449-465`
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:612-627`

**Description**: The `verifyPassword()` and `unlock()` functions do not enforce rate limiting. While `src/lib/rateLimit.ts` defines a 'login' rate limit configuration, it is **never actually applied** to the authentication functions.

**Code Analysis**:
```typescript
// authStore.ts:449-465
verifyPassword: async (password: string): Promise<boolean> => {
  const current = get().currentIdentity;
  if (!current) {
    return false;
  }

  try {
    const dbIdentity = await db.identities.get(current.publicKey);
    if (!dbIdentity || !dbIdentity.salt) {
      return false;
    }

    const encryptedData = dbIdentityToEncryptedData(dbIdentity);
    return await secureKeyManager.verifyPassword(encryptedData, password);
    // NO RATE LIMITING HERE
  } catch {
    return false;
  }
}
```

**State-Actor Attack Scenario**:
1. Adversary gains physical access to device (border seizure, arrest)
2. Extracts IndexedDB data containing encrypted keys
3. Runs unlimited offline brute-force attacks
4. With 600K PBKDF2 iterations: ~1000 attempts/second on modern GPU
5. Weak passwords (8 chars alphanumeric) cracked in hours

**Impact**:
- Offline brute-force attack feasible for weak passwords
- No alert mechanism for repeated failures
- No progressive delay or lockout

**Remediation**:
```typescript
// Apply rate limiting to unlock and verifyPassword
import { rateLimiter } from '@/lib/rateLimit';

unlock: async (password: string) => {
  const current = get().currentIdentity;
  if (!current) throw new Error('No identity selected');

  // Check rate limit BEFORE attempting verification
  const { allowed, retryAfter } = rateLimiter.checkLimit('login', current.publicKey);
  if (!allowed) {
    throw new Error(`Too many attempts. Try again in ${retryAfter} seconds.`);
  }

  // Record attempt
  rateLimiter.recordAttempt('login', current.publicKey);

  // ... existing unlock logic ...

  // On success, reset rate limit
  rateLimiter.reset('login', current.publicKey);
}
```

**Priority**: P0 - Immediate

---

### CRITICAL-002: Test Mode Bypass in Production

**Severity**: CRITICAL
**Component**: `/workspace/buildit/src/core/storage/EncryptedDB.ts:86-113`

**Description**: The `enableTestMode()` function can bypass all encryption if `process.env.NODE_ENV` is manipulated or if code injection occurs.

**Code Analysis**:
```typescript
// EncryptedDB.ts:86-99
let testModeEnabled = false;

export function enableTestMode(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    testModeEnabled = true;
    console.info('Test mode enabled - encryption bypassed');
  } else {
    console.warn('Test mode requested but not in test environment');
  }
}

// EncryptedDB.ts:370
if (testModeEnabled) {
  return obj;  // ENCRYPTION COMPLETELY BYPASSED
}
```

**State-Actor Attack Scenario**:
1. Supply chain attack injects code that sets `process.env.NODE_ENV = 'test'`
2. Malicious browser extension calls `enableTestMode()`
3. All subsequent writes are stored in plaintext
4. All sensitive data readable without decryption

**Impact**:
- Complete encryption bypass possible
- All security guarantees voided
- Past encrypted data remains protected, but new data exposed

**Remediation**:
1. Remove `enableTestMode()` from production builds entirely via tree-shaking
2. Use compile-time constant instead of runtime check
3. Add integrity verification that test mode cannot be enabled in production

```typescript
// Use compile-time check that can be stripped
const IS_TEST_BUILD = import.meta.env.MODE === 'test';

export function encryptObject<T>(obj: T, tableName: string): T {
  // Compile-time constant - dead code eliminated in production
  if (IS_TEST_BUILD && __ENABLE_TEST_MODE__) {
    return obj;
  }
  // ... encryption logic
}
```

**Priority**: P0 - Immediate

---

### HIGH-001: Missing Authorization Checks on Group Operations

**Severity**: HIGH
**Component**: `/workspace/buildit/src/stores/groupsStore.ts:169-193, 272-297, 416-463`

**Description**: Several critical group operations lack authorization verification. The store trusts that the caller has appropriate permissions without checking.

**Affected Functions**:
- `updateGroup()` - No admin check
- `deleteGroup()` - No admin check
- `toggleModule()` - No admin check
- `updateMemberRole()` - No admin check
- `removeMember()` - No admin check

**Code Analysis**:
```typescript
// groupsStore.ts:169-193
updateGroup: async (groupId, updates) => {
  set({ isLoading: true, error: null })

  try {
    await db.groups.update(groupId, updates)  // NO PERMISSION CHECK
    // ... rest of function
  }
}

// groupsStore.ts:416-440
updateMemberRole: async (groupId, memberPubkey, newRole) => {
  const members = get().groupMembers.get(groupId) || []
  const member = members.find(m => m.pubkey === memberPubkey)
  if (!member || !member.id) throw new Error('Member not found')

  await db.groupMembers.update(member.id, { role: newRole })  // NO ADMIN CHECK
  // ...
}
```

**State-Actor Attack Scenario**:
1. Infiltrator joins group as regular member
2. Modifies local database to set their role to 'admin'
3. Calls `updateMemberRole()` to demote actual admins
4. Takes over group completely
5. Accesses all historical messages

**Impact**:
- Privilege escalation via local database manipulation
- Group takeover possible by any member
- Admin demotion without authorization

**Remediation**:
```typescript
updateMemberRole: async (groupId, memberPubkey, newRole, requestingUserPubkey) => {
  // VERIFY AUTHORIZATION FIRST
  const isAdmin = await canManageModules(requestingUserPubkey, groupId);
  if (!isAdmin) {
    throw new Error('Unauthorized: Admin privileges required');
  }

  // Prevent self-demotion of last admin
  if (memberPubkey === requestingUserPubkey && newRole !== 'admin') {
    const group = get().groups.find(g => g.id === groupId);
    if (group && group.adminPubkeys.length === 1) {
      throw new Error('Cannot remove your own admin role as the only admin');
    }
  }

  // ... existing logic
}
```

**Priority**: P0 - Immediate

---

### HIGH-002: Session Fixation via Identity Switching

**Severity**: HIGH
**Component**: `/workspace/buildit/src/stores/authStore.ts:320-338`

**Description**: When switching identities via `setCurrentIdentity()`, the session state may not be fully cleared, potentially allowing session fixation attacks.

**Code Analysis**:
```typescript
// authStore.ts:320-338
setCurrentIdentity: async (publicKey: string | null) => {
  if (!publicKey) {
    secureKeyManager.lock()
    set({ currentIdentity: null, lockState: 'locked' })
    return
  }

  const identity = get().identities.find((id) => id.publicKey === publicKey)
  if (!identity) {
    throw new Error('Identity not found')
  }

  secureKeyManager.lock()  // Good: locks before switching
  set({ currentIdentity: identity, lockState: 'locked' })
  // BUT: groupMembers, activeGroup, pendingInvitations not cleared
}
```

**State-Actor Attack Scenario**:
1. User A is logged in with admin access to sensitive group
2. Malicious code switches to identity B (compromised)
3. Group membership cache from identity A may persist
4. Identity B gains unauthorized view of A's group memberships

**Impact**:
- Cross-identity data leakage
- Cached group memberships persist across identity switches
- Social graph information exposed

**Remediation**:
```typescript
setCurrentIdentity: async (publicKey: string | null) => {
  // ALWAYS clear session-specific data first
  secureKeyManager.lock();

  // Clear all session-specific caches
  useGroupsStore.getState().clearSessionData();
  useConversationsStore.getState().clearSessionData();

  if (!publicKey) {
    set({ currentIdentity: null, lockState: 'locked' });
    return;
  }
  // ... rest
}
```

**Priority**: P1 - High

---

### HIGH-003: Weak Password Policy Enforcement

**Severity**: HIGH
**Component**: `/workspace/buildit/src/components/auth/LoginForm.tsx:22-27`

**Description**: Password validation only requires 8 characters minimum with no complexity requirements.

**Code Analysis**:
```typescript
// LoginForm.tsx:22-27
const validatePassword = (pass: string): string | null => {
  if (pass.length < 8) {
    return 'Password must be at least 8 characters'
  }
  return null  // NO COMPLEXITY REQUIREMENTS
}
```

**State-Actor Attack Scenario**:
With 600K PBKDF2 iterations and a modern GPU cluster:
- 8-char lowercase: ~1 hour to crack
- 8-char alphanumeric: ~10 hours to crack
- 8-char with special chars: ~2 days to crack
- 12-char passphrase: ~decades to crack

**Impact**:
- Users likely to choose weak passwords
- Offline brute-force attacks feasible
- State actors have significant GPU resources

**Remediation**:
```typescript
const validatePassword = (pass: string): string | null => {
  if (pass.length < 12) {
    return 'Password must be at least 12 characters';
  }

  // Check for common patterns
  if (commonPasswords.includes(pass.toLowerCase())) {
    return 'Password is too common';
  }

  // Recommend passphrase
  const hasSpaces = /\s/.test(pass);
  const hasMultipleWords = pass.split(/\s+/).length >= 3;

  if (!hasSpaces && pass.length < 16) {
    return 'Use a passphrase (3+ words) or at least 16 characters';
  }

  return null;
};
```

**Priority**: P1 - High

---

### HIGH-004: No Memory Protection for Decrypted Keys

**Severity**: HIGH
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:383-405`

**Description**: While the code attempts to zero-fill keys on lock, JavaScript's garbage collector and potential heap snapshots expose keys.

**Code Analysis**:
```typescript
// SecureKeyManager.ts:383-405
public lock(): void {
  this._lockState = 'locking';

  // Zero-fill all decrypted keys in memory
  for (const [_key, privateKey] of this.decryptedKeys) {
    privateKey.fill(0);  // Good: attempts to zero
  }
  this.decryptedKeys.clear();

  // Clear master key reference (will be garbage collected)
  this.masterKey = null;  // BAD: GC timing unpredictable
  this.databaseKey = null;
  // ...
}
```

**State-Actor Attack Scenario**:
1. Adversary has physical access to running device
2. Takes memory dump or uses cold boot attack
3. Searches for key material in heap
4. Keys may persist in memory after "zeroing" due to:
   - JavaScript engine optimizations
   - GC not running immediately
   - Copy-on-write semantics

**Impact**:
- Keys potentially recoverable from memory dumps
- Cold boot attacks feasible
- JavaScript cannot guarantee secure memory erasure

**Remediation**:
1. Document limitation in threat model
2. Recommend WebAuthn/hardware keys for high-security users
3. Implement periodic key re-derivation to limit exposure window
4. Consider WebCrypto non-extractable keys where possible

```typescript
// Use non-extractable keys where possible
const masterKey = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', ... },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,  // NON-EXTRACTABLE - better protection
  ['encrypt', 'decrypt']
);
```

**Priority**: P1 - High (Requires architectural consideration)

---

### MEDIUM-001: WebAuthn Challenge Not Verified Server-Side

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/lib/webauthn/WebAuthnService.ts:197-228`

**Description**: WebAuthn challenges are generated client-side only. Without server-side verification, a sophisticated attacker could potentially replay or forge authentication.

**Code Analysis**:
```typescript
// WebAuthnService.ts:254-258
private generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return this.bufferToBase64url(array);  // Client-generated, no server verification
}
```

**State-Actor Relevance**: A state actor with access to the local device could:
1. Extract stored credentials from IndexedDB
2. Generate their own challenge
3. Bypass the authentication entirely

**Impact**:
- WebAuthn provides device binding but not true authentication
- Replay attacks possible within same device context
- Does not protect against device compromise

**Remediation**:
For a local-first application, document this limitation and:
1. Combine WebAuthn with password verification for sensitive operations
2. Use WebAuthn as convenience factor, not sole authentication
3. Document that WebAuthn is for "quick unlock" not security boundary

**Priority**: P2 - Medium

---

### MEDIUM-002: No Anomaly Detection on Authentication Patterns

**Severity**: MEDIUM
**Component**: Multiple authentication files

**Description**: No detection of suspicious authentication patterns that could indicate compromise or brute-force attempts.

**Missing Capabilities**:
- No tracking of failed authentication attempts over time
- No alerting on unusual login times or locations
- No detection of rapid identity switching
- No audit logging of authentication events

**State-Actor Relevance**: Sophisticated adversaries conduct reconnaissance:
1. Probe password repeatedly to test rate limits
2. Attempt authentication from multiple contexts
3. Try different identities systematically

**Remediation**:
```typescript
interface AuthAuditEvent {
  timestamp: number;
  eventType: 'login_attempt' | 'login_success' | 'login_failure' | 'unlock' | 'lock';
  identityPubkey: string;
  metadata: {
    userAgent: string;
    screenResolution: string;
    timezone: string;
    failureReason?: string;
  };
}

class AuthAuditLogger {
  async logEvent(event: AuthAuditEvent): Promise<void> {
    // Store locally (encrypted)
    await db.authAudit.add(event);

    // Check for anomalies
    await this.checkAnomalies(event);
  }

  private async checkAnomalies(event: AuthAuditEvent): Promise<void> {
    const recentFailures = await this.getRecentFailures(event.identityPubkey, 24 * 60);
    if (recentFailures > 10) {
      this.emitWarning('Excessive login failures detected');
    }
  }
}
```

**Priority**: P2 - Medium

---

### MEDIUM-003: Identity Confusion in Multi-Identity Scenarios

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/stores/authStore.ts`

**Description**: With multiple identities, there's potential for "confused deputy" attacks where operations are performed with the wrong identity context.

**Code Analysis**:
```typescript
// Multiple places use getCurrentPrivateKey() which returns whatever is unlocked
export function getCurrentPrivateKey(): Uint8Array | null {
  const { currentIdentity, lockState } = useAuthStore.getState();
  if (!currentIdentity || lockState !== 'unlocked') {
    return null;
  }
  return secureKeyManager.getCurrentPrivateKey();
}
```

**Attack Scenario**:
1. User has identity A (personal) and B (activist)
2. User intends to post with identity B
3. Race condition during identity switch
4. Post is signed with identity A, exposing real identity

**Impact**:
- Unintended identity disclosure
- Posts signed with wrong identity
- Potential deanonymization

**Remediation**:
```typescript
// Explicit identity binding for sensitive operations
async function signEventWithIdentity(
  event: UnsignedEvent,
  explicitIdentityPubkey: string
): Promise<SignedEvent> {
  const { currentIdentity, lockState } = useAuthStore.getState();

  // STRICT CHECK: Verify the intended identity is active
  if (!currentIdentity || currentIdentity.publicKey !== explicitIdentityPubkey) {
    throw new Error(`Identity mismatch: expected ${explicitIdentityPubkey}, current is ${currentIdentity?.publicKey}`);
  }

  if (lockState !== 'unlocked') {
    throw new Error('App is locked');
  }

  const privateKey = secureKeyManager.getCurrentPrivateKey();
  if (!privateKey) {
    throw new Error('Private key not available');
  }

  return finalizeEvent(event, privateKey);
}
```

**Priority**: P2 - Medium

---

### MEDIUM-004: Invitation Code Entropy May Be Insufficient

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/stores/groupsStore.ts:300-306`

**Description**: Invitation codes use only 16 hex characters from a secret key slice.

**Code Analysis**:
```typescript
// groupsStore.ts:304-306
const code = !inviteePubkey
  ? bytesToHex(generateSecretKey()).slice(0, 16)
  : undefined
```

**Analysis**:
- 16 hex chars = 64 bits of entropy
- Sufficient for most cases
- But: if codes are enumerable, brute-force is faster

**Impact**:
- 64 bits is ~2^64 combinations - generally safe
- However, if invite links follow predictable patterns, enumeration possible

**Remediation**:
- Increase to 32 hex characters (128 bits)
- Add expiration enforcement (already present)
- Consider one-time-use codes for high-security groups

**Priority**: P2 - Medium

---

### MEDIUM-005: Session Timeout Can Be Disabled

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:553-562`

**Description**: Users can set `inactivityTimeout: 0` to disable auto-lock entirely.

**Code Analysis**:
```typescript
// SecureKeyManager.ts:561-562
if (timeoutMinutes === 0) {
  return;  // No timer set - never auto-locks
}
```

**State-Actor Relevance**:
- User forgets device unlocked
- Device seized while unlocked
- All keys accessible without authentication

**Remediation**:
- Enforce minimum timeout (e.g., 1 hour)
- Or require re-authentication for sensitive operations regardless of lock state
- Add "high security mode" that enforces strict timeout

**Priority**: P2 - Medium

---

### MEDIUM-006: No Secure Key Export Audit Trail

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/stores/authStore.ts:599-617`

**Description**: Key exports are not logged or audited, making it difficult to detect compromise.

**Code Analysis**:
```typescript
// authStore.ts:599-617
exportPrivateKey: async (password: string): Promise<string> => {
  // ... validation ...
  const privateKey = await secureKeyManager.exportPrivateKey(encryptedData, password);
  return nip19.nsecEncode(privateKey);
  // NO AUDIT LOG
}
```

**Remediation**:
```typescript
exportPrivateKey: async (password: string): Promise<string> => {
  // ... existing validation ...

  // Audit log the export (this is security-sensitive)
  await auditLogger.log({
    type: 'KEY_EXPORT',
    timestamp: Date.now(),
    identityPubkey: current.publicKey,
    metadata: {
      userAgent: navigator.userAgent,
      // Note: Do NOT log the actual key
    }
  });

  const privateKey = await secureKeyManager.exportPrivateKey(encryptedData, password);
  return nip19.nsecEncode(privateKey);
}
```

**Priority**: P2 - Medium

---

### LOW-001: Password Visible in Memory During Input

**Severity**: LOW
**Component**: `/workspace/buildit/src/components/auth/LoginForm.tsx`

**Description**: Password is stored in React state as a plain string, visible in React DevTools and memory.

**Code Analysis**:
```typescript
// LoginForm.tsx:17
const [password, setPassword] = useState('')
```

**Impact**:
- Password visible in React DevTools
- Persists in memory until component unmounts
- Cannot be securely erased

**Remediation**:
- Document as inherent web limitation
- Clear password from state immediately after use
- Consider using secure password input patterns

**Priority**: P3 - Low

---

### LOW-002: Error Messages May Leak Information

**Severity**: LOW
**Component**: Multiple files

**Description**: Some error messages reveal internal state that could aid attackers.

**Examples**:
- "Identity not found in database" (reveals identity enumeration)
- "This identity needs to be migrated" (reveals migration state)
- "Invalid password or corrupted key data" (good - doesn't distinguish)

**Remediation**:
Use generic error messages for authentication failures:
```typescript
throw new Error('Authentication failed');  // Don't specify why
```

**Priority**: P3 - Low

---

### LOW-003: No CSRF Protection for State-Changing Operations

**Severity**: LOW
**Component**: General architecture

**Description**: As a local-first application, CSRF is less relevant, but browser-based attacks could potentially trigger state changes.

**Impact**: Limited in local-first architecture, but defense-in-depth recommends mitigation.

**Priority**: P3 - Low

---

### LOW-004: Timing Side-Channel in Password Comparison

**Severity**: LOW
**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:612-627`

**Description**: While `timingSafeEqual` is used for checksum comparison, password verification timing could leak information about password correctness.

**Code Analysis**:
```typescript
// SecureKeyManager.ts:612-627
public async verifyPassword(
  encryptedData: EncryptedKeyData,
  password: string
): Promise<boolean> {
  try {
    const salt = this.base64ToBuffer(encryptedData.salt);
    const masterKey = await this.deriveKeyFromPassword(password, salt);
    await this.decryptPrivateKey(  // Timing varies based on correctness
      encryptedData.encryptedPrivateKey,
      encryptedData.iv,
      masterKey
    );
    return true;
  } catch {
    return false;  // Timing: fail fast vs. success
  }
}
```

**Impact**:
- PBKDF2 takes ~600ms regardless of password
- AES-GCM decryption failure is fast
- Timing difference: success ~600ms, failure ~600ms + small delta
- Extremely difficult to exploit in practice

**Remediation**:
Add artificial delay on failure to normalize timing:
```typescript
} catch {
  // Add random delay 0-50ms to obscure timing
  await new Promise(r => setTimeout(r, Math.random() * 50));
  return false;
}
```

**Priority**: P3 - Low (Difficult to exploit)

---

### INFORMATIONAL-001: Rate Limiter Uses In-Memory Storage

**Component**: `/workspace/buildit/src/lib/rateLimit.ts`

**Description**: Rate limiting is stored in-memory only, reset on page refresh.

**Impact**: Attacker can bypass rate limits by refreshing the page.

**Note**: For local-first app, this is partially by design. Document limitation.

---

### INFORMATIONAL-002: WebAuthn Implementation Incomplete

**Component**: `/workspace/buildit/src/core/crypto/SecureKeyManager.ts:358-378`

**Description**: `unlockWithWebAuthn()` throws "requires password storage implementation".

**Code Analysis**:
```typescript
// SecureKeyManager.ts:377
throw new Error('WebAuthn unlock requires password storage implementation');
```

**Impact**: WebAuthn is currently only for registration, not standalone unlock.

---

### INFORMATIONAL-003: Good Practices Observed

**Positive Findings**:

1. **PBKDF2 Configuration** (SecureKeyManager.ts:21): 600,000 iterations per OWASP 2023
2. **Secure Randomness** (nip17.ts:9-18): Uses `crypto.getRandomValues()` with rejection sampling
3. **Memory Zeroing** (SecureKeyManager.ts:386-390): Attempts to zero keys on lock
4. **Timing-Safe Comparison** (utils.ts:86-105): `timingSafeEqual()` for sensitive comparisons
5. **Proper IV Handling** (ProtectedKeyStorage.ts:244-245): Random 12-byte IV per encryption
6. **Salt Per Identity** (SecureKeyManager.ts:286-288): Unique 32-byte salt per identity
7. **Key Derivation Hierarchy** (SecureKeyManager.ts:207-238): MEK -> DEK separation

---

## Summary Table

| ID | Severity | Title | File | Remediation |
|----|----------|-------|------|-------------|
| CRITICAL-001 | CRITICAL | No Rate Limiting on Password Verification | authStore.ts:449 | Apply rateLimiter to unlock/verify |
| CRITICAL-002 | CRITICAL | Test Mode Bypass in Production | EncryptedDB.ts:86 | Compile-time elimination |
| HIGH-001 | HIGH | Missing Authorization on Group Operations | groupsStore.ts | Add permission checks |
| HIGH-002 | HIGH | Session Fixation via Identity Switching | authStore.ts:320 | Clear session data on switch |
| HIGH-003 | HIGH | Weak Password Policy | LoginForm.tsx:22 | Require 12+ chars or passphrase |
| HIGH-004 | HIGH | No Memory Protection for Keys | SecureKeyManager.ts:383 | Document limitation, use non-extractable |
| MEDIUM-001 | MEDIUM | WebAuthn Challenge Not Server-Verified | WebAuthnService.ts:254 | Document as quick-unlock only |
| MEDIUM-002 | MEDIUM | No Anomaly Detection | Multiple | Implement auth audit logging |
| MEDIUM-003 | MEDIUM | Identity Confusion Risk | authStore.ts | Explicit identity binding |
| MEDIUM-004 | MEDIUM | Invitation Code Entropy | groupsStore.ts:304 | Increase to 128 bits |
| MEDIUM-005 | MEDIUM | Session Timeout Disablable | SecureKeyManager.ts:561 | Enforce minimum timeout |
| MEDIUM-006 | MEDIUM | No Key Export Audit | authStore.ts:599 | Add audit logging |
| LOW-001 | LOW | Password in React State | LoginForm.tsx:17 | Document limitation |
| LOW-002 | LOW | Error Message Information Leak | Multiple | Use generic errors |
| LOW-003 | LOW | No CSRF Protection | General | Limited relevance for local-first |
| LOW-004 | LOW | Timing Side-Channel | SecureKeyManager.ts:612 | Add artificial delay on failure |

---

## Recommendations by Priority

### P0 - Immediate (< 1 week)
1. Apply rate limiting to `unlock()` and `verifyPassword()`
2. Remove or compile-out `enableTestMode()` from production builds
3. Add authorization checks to all group management functions

### P1 - High (< 2 weeks)
4. Clear all session data on identity switch
5. Enforce stronger password policy (12+ chars or passphrase)
6. Document JavaScript memory limitations in threat model

### P2 - Medium (< 1 month)
7. Implement authentication audit logging
8. Add explicit identity binding for signing operations
9. Increase invitation code entropy
10. Enforce minimum session timeout

### P3 - Low (Backlog)
11. Clear password from React state after use
12. Use generic authentication error messages
13. Add timing normalization to password verification

---

## Compliance Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| OWASP Password Storage | PASS | 600K PBKDF2 iterations |
| NIST Key Derivation | PASS | HKDF for database key |
| AES-GCM Best Practices | PASS | Random IV, 256-bit key |
| WebAuthn Level 2 | PARTIAL | Missing server-side verification |
| Rate Limiting | FAIL | Defined but not applied |
| Authorization | FAIL | Missing permission checks |
| Audit Logging | FAIL | Not implemented |

---

## Conclusion

BuildIt Network has a solid cryptographic foundation suitable for protecting against mass surveillance and casual attackers. However, **against a state-actor with physical device access**, the lack of rate limiting and missing authorization checks create significant vulnerabilities.

The most critical issues (CRITICAL-001, CRITICAL-002, HIGH-001) should be addressed before any deployment in high-risk organizing contexts.

**Recommended Next Steps**:
1. Fix all P0 issues immediately
2. Update PRIVACY.md to accurately reflect current protections
3. Add security hardening guide for high-risk users
4. Schedule follow-up audit after remediation

---

**Auditor**: Claude Opus 4.5
**Co-Authored-By**: Claude Opus 4.5 <noreply@anthropic.com>
**Review Date**: 2026-01-18
