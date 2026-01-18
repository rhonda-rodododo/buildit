# Security Audit - Data Storage and Encryption at Rest

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent (Claude Opus 4.5)
**Scope**: IndexedDB encryption, key derivation, encryption modes, memory handling, cache/storage leakage, backup security, migration security
**Threat Model Focus**: State-actor adversary with physical device access or persistent network access

## Executive Summary

This audit focuses specifically on data storage security and encryption at rest for the BuildIt Network application, evaluated against a state-actor threat model. The application implements a reasonable defense-in-depth strategy with PBKDF2 key derivation, AES-GCM encryption, and NIP-44 (ChaCha20-Poly1305) for field-level encryption.

**Good Practices Found**:
- PBKDF2 with 600,000 iterations (OWASP 2023 recommended)
- Unique salt per identity (32 bytes)
- Random IV generation per encryption operation (12 bytes for AES-GCM)
- Zero-filling of keys on lock
- Dexie hooks for automatic encryption of sensitive fields
- Proper use of crypto.getRandomValues() for cryptographic operations
- Timing-safe comparison for checksums

**Findings Summary**:
- Critical: 0
- High: 3
- Medium: 4
- Low: 3
- Informational: 4

---

## Detailed Findings

### HIGH - Unencrypted Social Graph Indexes in IndexedDB

**Severity**: High
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/db.ts:187-192` and `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts:65`
**CWE**: CWE-312 (Cleartext Storage of Sensitive Information)

**Description**:
While sensitive fields like `displayName` and `notes` are encrypted, the IndexedDB indexes expose social graph metadata in plaintext:

```typescript
// db.ts lines 187-192
{
  name: 'friends',
  schema: 'id, [userPubkey+friendPubkey], userPubkey, friendPubkey, status, trustTier, verifiedInPerson, isFavorite, addedAt, acceptedAt, *tags',
  indexes: [
    'id', '[userPubkey+friendPubkey]', 'userPubkey', 'friendPubkey', 'status', 'trustTier', ...
  ]
}

// conversations table also exposes participants
schema: 'id, type, createdBy, createdAt, lastMessageAt, groupId, isPinned, isMuted, isArchived, *participants',
```

The code explicitly acknowledges this limitation:
```typescript
// EncryptedDB.ts line 65
// Note: friendPubkey/userPubkey are indexes and can't be encrypted at rest,
// but we use NIP-51 encrypted lists for relay-stored social graph protection
```

**Impact**:
- State actor with device access can extract complete social graph
- Friend relationships, group memberships, conversation participants visible
- Trust tiers and verification status exposed
- Timestamps reveal relationship timing
- This data alone can be used for network analysis and targeting

**Attack Scenario**:
1. Device seized at border checkpoint
2. IndexedDB extracted (accessible via Chrome DevTools or file system)
3. Social graph fully reconstructed without decrypting any fields
4. Adversary identifies all contacts, groups, and communication patterns

**Remediation**:
1. Consider client-side obfuscation of pubkeys in indexes (hash with user-specific salt)
2. Document this limitation clearly in user-facing privacy documentation
3. Implement optional "paranoid mode" that sacrifices query performance for privacy
4. For highest-risk users, recommend separate device with no persistent local storage

**Status**: Open

---

### HIGH - Master Key Extractable During Unlocked State

**Severity**: High
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts:199`
**CWE**: CWE-321 (Use of Hard-coded Cryptographic Key)

**Description**:
The master encryption key is derived with `extractable: true`, allowing it to be exported from the CryptoKey object:

```typescript
// SecureKeyManager.ts lines 189-201
return crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: salt.buffer as ArrayBuffer,
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256',
  },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  true, // Extractable (needed for deriveDatabaseKey)
  ['encrypt', 'decrypt']
);
```

The comment indicates this is needed for deriving the database key.

**Impact**:
- Malicious browser extension can call `crypto.subtle.exportKey()` on the master key
- JavaScript-based attacks can exfiltrate the MEK
- XSS vulnerabilities become more severe (key exfiltration possible)

**Attack Scenario**:
1. User installs malicious browser extension
2. Extension injects script that monitors for unlocked state
3. Extension exports MEK using Web Crypto API
4. Exfiltrated key allows offline decryption of all IndexedDB data

**Remediation**:
1. Refactor key derivation to avoid need for extractable master key
2. Derive database key using HKDF directly from password material
3. Make MEK non-extractable and derive DEK separately
4. Consider using separate PBKDF2 derivations for each key type

**Status**: Open

---

### HIGH - Incomplete Encryption Field Coverage

**Severity**: High
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts:32-80`
**CWE**: CWE-311 (Missing Encryption of Sensitive Data)

**Description**:
Several sensitive fields are not included in the ENCRYPTED_FIELDS configuration:

```typescript
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  messages: ['content'],
  conversationMessages: ['content'],
  conversations: ['name', 'lastMessagePreview'],
  events: ['title', 'description', 'location'],
  groups: ['description'],  // Missing: name?
  mutualAidRequests: ['title', 'description', 'notes'],
  proposals: ['title', 'description'],
  wikiPages: ['title', 'content'],
  databaseRecords: ['data'],
  posts: ['content'],
  friends: ['displayName', 'notes', 'username', 'tags'],
  friendRequests: ['message'],
  friendInviteLinks: [],  // Empty - no encryption
  documents: ['title', 'content'],
  files: ['name', 'description'],
};
```

**Missing/Incomplete Coverage**:
1. `groups.name` - Group names can be sensitive
2. `friendInviteLinks` - No fields encrypted
3. `groupInvitations.message` - Invitation messages may contain sensitive info
4. `nostrEvents` - Raw events stored unencrypted (contains metadata)
5. `userPresence` - Status reveals activity patterns
6. `chatWindows` - Reveals which conversations are active

**Impact**:
- Group names visible to device-level attacker
- Invitation link metadata exposed
- Activity patterns deducible from presence data
- Raw Nostr events may contain sensitive content

**Remediation**:
1. Add `name` to groups encryption
2. Review all tables and add appropriate field encryption
3. Consider encrypting groupInvitations.message
4. Implement automatic scan for new tables/fields

**Status**: Open

---

### MEDIUM - Test Mode Encryption Bypass

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts:86-98`
**CWE**: CWE-489 (Active Debug Code)

**Description**:
A test mode exists that completely bypasses encryption:

```typescript
let testModeEnabled = false;

export function enableTestMode(): void {
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
    testModeEnabled = true;
    console.info('Test mode enabled - encryption bypassed');
  } else {
    console.warn('Test mode requested but not in test environment');
  }
}
```

While the check for `NODE_ENV === 'test'` provides some protection, the `testModeEnabled` flag is a module-level variable.

**Impact**:
- If NODE_ENV check bypassed, encryption disabled
- Development builds may inadvertently have encryption disabled
- Variable could potentially be manipulated via prototype pollution

**Attack Scenario**:
1. Attacker finds way to set NODE_ENV or manipulate process object
2. Calls enableTestMode()
3. All subsequent writes store plaintext

**Remediation**:
1. Use build-time dead code elimination instead of runtime check
2. Use `import.meta.env.MODE` instead of `process.env.NODE_ENV`
3. Consider removing this functionality in production builds entirely
4. Add integrity check that test mode cannot be enabled if encryption key exists

**Status**: Open

---

### MEDIUM - Backup Export May Expose Sensitive Metadata

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts:98-135`
**CWE**: CWE-532 (Insertion of Sensitive Information into Log File)

**Description**:
The backup creation function includes metadata that could aid forensic analysis:

```typescript
const backupData = JSON.stringify({
  keys: privateKeys,  // Encrypted
  timestamp: Date.now(),  // Reveals exact backup time
  deviceId,  // Links backup to specific device
});
```

The backup also includes:
```typescript
const backup: KeyBackup = {
  id: crypto.randomUUID(),
  encryptedBackup: ...,
  backupType: 'recovery',
  createdAt: Date.now(),
  createdBy: deviceId,  // Device identification
  requiresWebAuthn: !!credential,
  credentialId: credential?.id,  // WebAuthn credential ID
  metadata: {
    version: 1,
    format: 'json',
    checksum,
  },
};
```

**Impact**:
- Backup files reveal device IDs and timing
- WebAuthn credential IDs exposed
- Metadata can correlate backups across devices
- Forensic analysis aided by timestamps

**Remediation**:
1. Consider encrypting all metadata, not just keys
2. Remove or obfuscate deviceId in encrypted payload
3. Randomize timestamps in metadata
4. Use content-addressing instead of UUIDs for backup IDs

**Status**: Open

---

### MEDIUM - Legacy Encryption Format Migration Exposes Keys Temporarily

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/migrations/secureKeys.ts:57-102`
**CWE**: CWE-311 (Missing Encryption of Sensitive Data)

**Description**:
The migration from legacy format temporarily exposes plaintext private keys:

```typescript
export async function migrateIdentity(publicKey: string, password: string): Promise<void> {
  // Extract the private key from the old format (PLAINTEXT!)
  let privateKey: Uint8Array;
  try {
    privateKey = hexToBytes(identity.encryptedPrivateKey);
  } catch (error) {
    throw new Error('Failed to decode private key from old format');
  }

  // ... encryption operations ...

  // Zero-fill the private key in memory (good!)
  privateKey.fill(0);
}
```

While the code does zero-fill after use (line 100), the key exists in plaintext memory during the migration window.

**Impact**:
- During migration, keys are temporarily unprotected in memory
- If migration interrupted, data may be in inconsistent state
- Multiple migration calls could leave copies in memory

**Remediation**:
1. Add transaction wrapper to ensure atomic migration
2. Implement rollback capability if migration fails
3. Consider background garbage collection trigger after migration
4. Add migration status tracking to prevent re-migration

**Status**: Open (partial mitigation via zero-fill exists)

---

### MEDIUM - No Integrity Verification for Encrypted Data

**Severity**: Medium
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/storage/EncryptedDB.ts`
**CWE**: CWE-354 (Improper Validation of Integrity Check Value)

**Description**:
While AES-GCM and NIP-44 (ChaCha20-Poly1305) provide authenticated encryption, there is no application-level integrity verification for the database as a whole. An attacker could:
1. Delete encrypted records
2. Replace encrypted records with other encrypted records
3. Modify unencrypted index fields

```typescript
// No database-level MAC or signature verification
export function decryptObject<T extends Record<string, unknown>>(
  obj: T,
  tableName: string,
  groupId?: string
): T {
  // Individual field decryption only
  // No verification that the record hasn't been tampered with
}
```

**Impact**:
- Records can be deleted without detection
- Records can be reordered or duplicated
- Index tampering changes query results
- No audit trail for data modifications

**Remediation**:
1. Implement Merkle tree or similar structure for database integrity
2. Add per-table MACs that cover all records
3. Sign database state on each significant change
4. Implement integrity verification on application startup

**Status**: Open

---

### LOW - Math.random() in Non-Security-Critical Code

**Severity**: Low
**Component**: Multiple files (test files and UI components)
**CWE**: CWE-330 (Use of Insufficiently Random Values)

**Description**:
`Math.random()` is used in several locations, though not for security-critical operations:

1. **Test files** - Acceptable for test ID generation:
   - `wikiStore.test.ts:19`
   - `customFieldsStore.test.ts:18`
   - `governanceStore.test.ts:20, 33`
   - `mutualAidStore.test.ts:20, 38`
   - `eventsStore.test.ts:20`

2. **Simulation code** - Acceptable for delay simulation:
   - `newslettersStore.ts:854, 857` - Network delay simulation

3. **UI code** - Acceptable for cursor color:
   - `TipTapEditor.tsx:78` - Random cursor color selection

**Impact**:
- Test IDs slightly predictable (no security impact)
- Simulation timing predictable (no security impact)
- UI cursor colors predictable (no security impact)

**Remediation**:
1. Consider replacing with `crypto.randomUUID()` for consistency
2. No immediate action required for security
3. Document that these uses are intentionally not crypto-secure

**Status**: Acceptable (No Action Required)

---

### LOW - Console Logging in Production Code

**Severity**: Low
**Component**: Various files in `/home/rikki/claude-workspace/buildit-network/src/core/`
**CWE**: CWE-532 (Insertion of Sensitive Information into Log File)

**Description**:
Multiple `console.info` calls exist in production code paths:

```typescript
// EncryptedDB.ts:95
console.info('Test mode enabled - encryption bypassed');

// EncryptedDB.ts:547
console.info(`Local encryption hooks enabled for ${tablesToEncrypt.length} tables`);

// EncryptedDB.ts:611
console.info(`Migration complete: ${migrated} records migrated, ${failed} failed`);

// secureKeys.ts:102
console.info(`Migrated identity ${publicKey.slice(0, 8)}... to secure storage`);
```

**Impact**:
- Logs can be captured by browser extensions
- Console persists in browser developer tools
- May reveal timing of security operations
- Public key prefix logged (minimal impact)

**Remediation**:
1. Strip console.* calls in production builds
2. Use conditional logging based on environment
3. Implement structured logging for security events
4. Never log key material (currently compliant)

**Status**: Open (minor issue)

---

### LOW - Session Storage Not Used (Good Practice Verification)

**Severity**: Low (Informational - Positive Finding)
**Component**: Application-wide
**CWE**: N/A

**Description**:
Verified that `sessionStorage` is not used for sensitive data:

```bash
grep -r "sessionStorage" src/
# No matches found in application code
```

**Impact**: Positive - no sensitive data in sessionStorage.

**Status**: Good Practice Verified

---

### INFORMATIONAL - LocalStorage Usage Limited to Non-Sensitive Data

**Severity**: Informational
**Component**: `/home/rikki/claude-workspace/buildit-network/src/components/theme-provider.tsx` and `/home/rikki/claude-workspace/buildit-network/src/i18n/config.ts`

**Description**:
LocalStorage is used only for UI preferences:

```typescript
// theme-provider.tsx
localStorage.getItem(storageKey) as Theme
localStorage.setItem(storageKey, newTheme)
localStorage.setItem(colorThemeStorageKey, newColorTheme)

// config.ts
localStorage.getItem('i18n-language')
localStorage.setItem('i18n-language', lng)
```

**Impact**: None - only theme and language preferences stored.

**Status**: Good Practice Verified

---

### INFORMATIONAL - Proper Key Zeroization Implemented

**Severity**: Informational
**Component**: Multiple files

**Description**:
Key zeroization is properly implemented in critical paths:

```typescript
// SecureKeyManager.ts:388
for (const [_key, privateKey] of this.decryptedKeys) {
  privateKey.fill(0);
}

// EncryptedDB.ts:215-216
if (localEncryptionKey) {
  localEncryptionKey.fill(0);
  localEncryptionKey = null;
}

// EncryptedDB.ts:355-358
for (const key of groupKeyCache.values()) {
  key.fill(0);
}
groupKeyCache.clear();

// secureKeys.ts:100
privateKey.fill(0);
```

**Impact**: Positive - reduces memory exposure window.

**Status**: Good Practice Verified

---

### INFORMATIONAL - PBKDF2 Parameters Compliant

**Severity**: Informational
**Component**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/SecureKeyManager.ts:21` and `/home/rikki/claude-workspace/buildit-network/src/lib/webauthn/ProtectedKeyStorage.ts:217-220`

**Description**:
PBKDF2 parameters meet OWASP 2023 recommendations:

```typescript
// SecureKeyManager.ts
const PBKDF2_ITERATIONS = 600_000;

// ProtectedKeyStorage.ts
{
  name: 'PBKDF2',
  salt: salt,
  iterations: 600000,  // OWASP 2023 recommendation for SHA-256
  hash: 'SHA-256',
}
```

Salt generation uses proper random source:
```typescript
// SecureKeyManager.ts:287
public generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));  // 256-bit salt
}

// ProtectedKeyStorage.ts:201-203
const buffer = new ArrayBuffer(16);
salt = new Uint8Array(buffer);
crypto.getRandomValues(salt);  // 128-bit salt
```

**Impact**: Positive - adequate protection against offline brute force.

**Status**: Good Practice Verified (Note: Consider increasing salt to 32 bytes in ProtectedKeyStorage for consistency)

---

### INFORMATIONAL - Timing-Safe Comparison Implemented

**Severity**: Informational
**Component**: `/home/rikki/claude-workspace/buildit-network/src/lib/utils.ts:86-105`

**Description**:
Timing-safe string comparison is properly implemented:

```typescript
export function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)

  // XOR-based comparison without early exit
  let result = bufA.length ^ bufB.length
  const minLen = Math.min(bufA.length, bufB.length)
  for (let i = 0; i < minLen; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}
```

Used in backup integrity verification:
```typescript
// ProtectedKeyStorage.ts:159
if (!timingSafeEqual(checksum, backup.metadata.checksum)) {
  throw new Error('Backup integrity check failed');
}
```

**Impact**: Positive - prevents timing attacks on checksum verification.

**Status**: Good Practice Verified

---

## Dependency Vulnerabilities

**Current Status**: 18 vulnerabilities detected by `bun audit`

| Severity | Package | Vulnerability | Usage |
|----------|---------|---------------|-------|
| High | qs | DoS via memory exhaustion | Transitive (shadcn) |
| High | tar | Arbitrary file overwrite | Transitive (tailwindcss) |
| High | valibot | ReDoS | Transitive (bip32, bitcoinjs-lib) |
| High | glob | Command injection | Transitive (vitest, workbox) |
| High | @modelcontextprotocol/sdk | DNS rebinding, ReDoS | Transitive (shadcn) |
| High | react-router | XSS, CSRF | Direct dependency |
| Moderate | vite | fs.deny bypass | Direct dependency |
| Moderate | mdast-util-to-hast | Unsanitized class | Transitive |
| Moderate | js-yaml | Prototype pollution | Transitive |
| Moderate | body-parser | DoS | Transitive |
| Moderate | prismjs | DOM Clobbering | Transitive |
| Low | undici | Unbounded decompression | Transitive |
| Low | diff | DoS | Transitive |

**Remediation Priority**:
1. Update react-router (XSS risk in production)
2. Update vite (fs bypass in dev server)
3. Run `bun update --latest` and test

**Status**: Open

---

## Summary

**Total Findings**: 14
- Critical: 0
- High: 3
- Medium: 4
- Low: 3
- Informational: 4 (all positive findings)

## Priority Actions

1. **HIGH**: Address social graph exposure in IndexedDB indexes - document limitation and consider obfuscation
2. **HIGH**: Refactor key derivation to make MEK non-extractable
3. **HIGH**: Audit and expand ENCRYPTED_FIELDS coverage
4. **MEDIUM**: Remove test mode bypass or implement build-time elimination
5. **MEDIUM**: Add database-level integrity verification

## State-Actor Threat Assessment

### Scenario: Device Seized (Powered Off, Locked)

**Extractable Data Without Password**:
- All public keys and social graph relationships
- Group memberships and conversation participants
- Timestamps of all activities
- Friend trust levels and verification status
- File names and descriptions (if not encrypted)

**Protected Data (Requires Password)**:
- Private keys
- Message content
- Event descriptions
- Document content
- Friend notes

**Attack Effort**:
- Social graph: Immediate extraction, no crypto attack needed
- Encrypted content: Requires offline PBKDF2 brute force (600K iterations)

### Scenario: Device Seized (Powered On, Unlocked)

**Additional Extractable Data**:
- Master encryption key (extractable from Web Crypto)
- All decrypted content in memory
- Database encryption key

**Attack Effort**: Immediate full compromise

### Recommendations for High-Risk Users

1. Use strong passphrase (6+ random words from BIP-39)
2. Enable shortest auto-lock timeout (5 minutes)
3. Enable "lock on tab hide" feature
4. Use dedicated browser profile with minimal extensions
5. Enable device full-disk encryption
6. Consider separate "burner" device for highest-risk activities
7. Regularly clear IndexedDB and start fresh for operational security
8. Use Tor for network-level protection

## Compliance Status

**PRIVACY.md Threat Model Compliance**: Partial

The implementation aligns with documented limitations:
- Device seizure acknowledged as "Low Effectiveness" defense
- Forward secrecy limitation documented
- IndexedDB accessibility documented

**Gap**: Social graph exposure not explicitly documented as a limitation.

---

**Document Status**: Complete
**Next Review**: After remediation of High findings
**Related Documents**:
- `/home/rikki/claude-workspace/buildit-network/PRIVACY.md`
- `/home/rikki/claude-workspace/buildit-network/ENCRYPTION_STRATEGY.md`
- `/home/rikki/claude-workspace/buildit-network/docs/audits/key-storage-security-audit-2026-01-18.md`
