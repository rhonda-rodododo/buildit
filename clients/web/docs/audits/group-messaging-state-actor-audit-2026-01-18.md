# Security Audit - Group Management and Messaging
## State-Actor Threat Model Analysis

**Date**: 2026-01-18
**Auditor**: Claude Opus 4.5 (Security Auditor Agent)
**Scope**: Group key management, member permissions, message integrity, metadata leakage, invite system, admin privileges, message ordering, replay attacks
**Threat Model**: State-level adversary with mass surveillance capabilities

---

## Executive Summary

This audit examines the group management and messaging subsystems of BuildIt Network against a state-actor threat model. The application implements NIP-17 gift-wrapped encryption with proper cryptographic foundations, but several security gaps exist that could be exploited by sophisticated adversaries.

**Overall Assessment**: MEDIUM-HIGH RISK for state-actor threat model

**Total Findings**: 14
- Critical: 2
- High: 4
- Medium: 5
- Low: 3

---

## Findings

### CRITICAL-001: Missing Signature Verification on Incoming Messages

**Severity**: CRITICAL
**Component**: `/workspace/buildit/src/core/messaging/messageReceiver.ts`
**Lines**: 86-135

**Description**:
The `handleGiftWrap` function decrypts incoming NIP-17 gift-wrapped messages without verifying the cryptographic signatures on the gift wrap, seal, or rumor events. A state actor with relay control could inject malformed or tampered messages.

```typescript
// Line 122-123: No signature verification before processing
const rumor = unwrapGiftWrap(giftWrap, privateKey);

// Process based on rumor kind
if (rumor.kind === 14) {
  await this.processPrivateMessage(rumor, giftWrap);
}
```

The `verifyEventSignature` function exists in `nip01.ts` but is NOT called on incoming events.

**Impact**:
- Message tampering by relay operators
- Injection of forged messages
- Impersonation attacks
- Evidence planting by state actors

**Remediation**:
```typescript
import { verifyEventSignature } from '@/core/nostr/nip01';

// In handleGiftWrap, before processing:
if (!verifyEventSignature(event)) {
  console.warn('Invalid signature on gift wrap, rejecting');
  return;
}
```

**Status**: Open

---

### CRITICAL-002: Group Key Distribution Without Cryptographic Binding

**Severity**: CRITICAL
**Component**: `/workspace/buildit/src/stores/groupsStore.ts`
**Lines**: 81-92

**Description**:
Group encryption keys are generated locally and stored in IndexedDB, but there is no cryptographic protocol to securely distribute keys to new group members. The current implementation stores a `encryptedGroupKey` field but no key exchange mechanism is implemented.

```typescript
// Line 81-83: Key generated but not distributed cryptographically
const groupKey = params.privacyLevel === 'private'
  ? bytesToHex(generateSecretKey())
  : undefined
```

Without proper key distribution:
- New members cannot decrypt historical messages
- Key rotation is not implemented
- Compromised members continue to have access
- No forward secrecy for group messages

**Impact**:
- Single key compromise exposes all group messages
- State actor with one compromised member gains all group content
- No mechanism to revoke access when members are removed

**Remediation**:
1. Implement NIP-17 multi-wrap key distribution for small groups (<100 members)
2. Implement Noise Protocol key establishment for large groups (as per ENCRYPTION_STRATEGY.md Phase 2)
3. Add key rotation mechanism with epoch tracking
4. Implement key revocation on member removal

**Status**: Open

---

### HIGH-001: Client-Side Authorization Only for Member Management

**Severity**: HIGH
**Component**: `/workspace/buildit/src/components/groups/GroupMembersTab.tsx`
**Lines**: 65, 91-103, 105-116

**Description**:
Authorization for member role changes and member removal is performed entirely client-side based on `adminPubkeys` check without cryptographic verification. A malicious client could bypass these checks.

```typescript
// Line 65: Client-side admin check only
const isAdmin = currentIdentity && adminPubkeys.includes(currentIdentity.publicKey)

// Line 91-103: Direct DB update without server-side verification
const handleRoleChange = async (member: DBGroupMember, newRole: MemberRole) => {
  if (!member.id) return;
  await db.groupMembers.update(member.id, { role: newRole });
  // No cryptographic proof of authorization
}
```

**Impact**:
- Privilege escalation by modifying local IndexedDB
- Unauthorized role changes
- Admin bypass attacks
- No audit trail of who made changes

**Remediation**:
1. Sign all administrative actions with admin's private key
2. Verify signatures before applying changes
3. Publish signed role change events to Nostr
4. Implement consensus-based admin actions for high-security groups

**Status**: Open

---

### HIGH-002: Sender Identity Not Properly Extracted from NIP-17

**Severity**: HIGH
**Component**: `/workspace/buildit/src/core/messaging/messageReceiver.ts`
**Lines**: 140-156

**Description**:
The code incorrectly uses the ephemeral gift wrap pubkey as the sender identity, not the seal's pubkey (actual sender). This breaks sender authentication.

```typescript
// Line 145-146: WRONG - ephemeral key is not the sender
const senderPubkey = giftWrap.pubkey; // Ephemeral key, not sender

// Comment acknowledges the bug but doesn't fix it:
// "For NIP-17, the actual sender is found in the seal"
```

**Impact**:
- Cannot reliably identify message sender
- Attribution attacks possible
- Message history shows wrong senders
- Reply-to functionality broken

**Remediation**:
Extract sender pubkey from the seal after unwrapping:
```typescript
// In unwrapGiftWrap, return seal.pubkey as senderPubkey
const { rumor, senderPubkey } = unwrapGiftWrap(giftWrap, privateKey);
```

**Status**: Open

---

### HIGH-003: Invite Token Predictability

**Severity**: HIGH
**Component**: `/workspace/buildit/src/components/groups/MemberInviteDialog.tsx`
**Lines**: 78-83

**Description**:
Invite codes are generated using `nanoid(12).toUpperCase()` which has only ~62 bits of entropy. More critically, the invite lookup uses only the code without rate limiting or attempt tracking.

```typescript
// Line 83: Invite code with limited entropy
const code = nanoid(12).toUpperCase()
```

Additionally, in `/workspace/buildit/src/stores/groupsStore.ts` (lines 304-306), the alternative method uses truncated hex:
```typescript
const code = !inviteePubkey
  ? bytesToHex(generateSecretKey()).slice(0, 16)
  : undefined
```

**Impact**:
- Brute force enumeration of invite codes
- Unauthorized group access
- Mass invite code scanning by state actors

**Remediation**:
1. Use full 32-byte cryptographically random invite tokens
2. Implement rate limiting on invite code lookups
3. Add exponential backoff after failed attempts
4. Log and alert on repeated failed attempts
5. Consider one-time use tokens with cryptographic commitment

**Status**: Open

---

### HIGH-004: No Replay Protection Beyond In-Memory Deduplication

**Severity**: HIGH
**Component**: `/workspace/buildit/src/core/messaging/messageReceiver.ts`
**Lines**: 22-26, 88-99

**Description**:
Replay attack protection relies solely on an in-memory `Set` of processed event IDs that:
1. Is lost on page reload
2. Has a cap of 10,000 entries
3. Evicts oldest entries without persistence

```typescript
// Lines 22-26: In-memory only deduplication
const processedEvents = new Set<string>();
const MAX_PROCESSED_EVENTS = 10000;

// Lines 93-96: Primitive eviction
if (processedEvents.size > MAX_PROCESSED_EVENTS) {
  const toRemove = Array.from(processedEvents).slice(0, MAX_PROCESSED_EVENTS / 2);
  toRemove.forEach((id) => processedEvents.delete(id));
}
```

**Impact**:
- After browser restart, previously seen messages can be replayed
- Attacker can force eviction with 10k+ events, then replay old messages
- State actor can replay compromised historical messages

**Remediation**:
1. Persist processed event IDs to IndexedDB
2. Use message timestamps combined with event IDs for deduplication
3. Implement sliding window based on timestamp, not count
4. Add signature validation to prevent forged replays

**Status**: Open

---

### MEDIUM-001: Group Thread Messages Not NIP-17 Wrapped

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/core/messaging/groupThread.ts`
**Lines**: 52-85

**Description**:
Group thread messages use simple NIP-44 encryption with a shared group key but are not gift-wrapped with NIP-17. This exposes:
- Sender pubkey (not ephemeral)
- Precise timestamps (randomizeTimestamp is used, but pubkey is exposed)
- Group ID in plaintext tags

```typescript
// Lines 73-80: Standard event, not gift wrapped
const event = createEventFromTemplate(
  {
    kind: GROUP_MESSAGE_KINDS.THREAD_MESSAGE,
    content: encryptedContent,
    tags,
    created_at: randomizeTimestamp(),
  },
  privateKey  // Sender's actual key, not ephemeral
)
```

**Impact**:
- Relay operators can see who posts to groups
- Social graph analysis possible through sender pubkeys
- Traffic analysis of group participation patterns

**Remediation**:
Apply full NIP-17 gift wrapping to group messages, sending individual wrapped copies to each member (as documented in ENCRYPTION_STRATEGY.md for small groups).

**Status**: Open

---

### MEDIUM-002: Admin Pubkeys Array Can Be Manipulated Locally

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/stores/groupsStore.ts`
**Lines**: 417-440

**Description**:
The `updateMemberRole` function updates the local `adminPubkeys` array without publishing a signed event to the Nostr network. Changes are local-only and can be manipulated.

```typescript
// Lines 425-435: Local modification without cryptographic proof
if (group) {
  let adminPubkeys = [...group.adminPubkeys]
  if (newRole === 'admin' && !adminPubkeys.includes(memberPubkey)) {
    adminPubkeys.push(memberPubkey)
  } else if (newRole !== 'admin' && adminPubkeys.includes(memberPubkey)) {
    adminPubkeys = adminPubkeys.filter(pk => pk !== memberPubkey)
  }
  // Direct DB update, no signed event
  await get().updateGroup(groupId, { adminPubkeys })
}
```

**Impact**:
- Local privilege escalation
- Inconsistent admin state across members
- No verifiable admin change history

**Remediation**:
Publish signed kind 39002 events for all role changes and verify them on receipt.

**Status**: Open

---

### MEDIUM-003: Message Ordering Relies on Randomized Timestamps

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/core/crypto/nip17.ts`
**Lines**: 26-29

**Description**:
While timestamp randomization is excellent for metadata protection, it means message ordering is unreliable. The security tests confirm this is intentional but creates a trade-off.

```typescript
// Lines 26-29: 2-day randomization window
export function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = secureRandomInt(twoDaysInSeconds) - Math.floor(twoDaysInSeconds / 2)
  return Math.floor(baseTime / 1000) + randomOffset
}
```

**Impact**:
- Messages may appear out of order
- Conversation threading may be confused
- State actor cannot infer exact timing (positive)
- Users may see confusing message sequences (negative)

**Remediation**:
This is a documented trade-off. Consider:
1. Adding a local-only sequence number for display ordering
2. Documenting this behavior to users
3. Storing original timestamp locally for display while sending randomized

**Status**: Informational (documented behavior)

---

### MEDIUM-004: Last Admin Removal Check Byppassable

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/stores/groupsStore.ts`
**Lines**: 448-450

**Description**:
The last admin protection exists but only checks local state:

```typescript
// Lines 448-450
if (group && group.adminPubkeys.includes(memberPubkey) && group.adminPubkeys.length === 1) {
  throw new Error('Cannot remove the last admin. Transfer admin role first.')
}
```

This can be bypassed by directly modifying IndexedDB or having desynchronized admin lists.

**Impact**:
- Groups can become orphaned without admins
- Denial of service by removing all admins

**Remediation**:
Implement cryptographic consensus for admin removal with multi-signature verification.

**Status**: Open

---

### MEDIUM-005: Group Metadata Visible in Event Tags

**Severity**: MEDIUM
**Component**: `/workspace/buildit/src/core/groups/groupManager.ts`
**Lines**: 33-45

**Description**:
Group creation events expose metadata in plaintext tags:

```typescript
// Lines 37-42
tags: [
  ['d', generateEventId()], // Unique group identifier
  ['name', params.name],      // GROUP NAME IN PLAINTEXT
  ['privacy', params.privacyLevel],  // PRIVACY LEVEL EXPOSED
  ...params.enabledModules.map(module => ['module', module]),  // MODULES EXPOSED
],
```

**Impact**:
- Relay operators see group names
- Privacy level reveals sensitivity
- Module list reveals group activities
- State actors can profile groups by metadata

**Remediation**:
Encrypt group metadata or use NIP-17 for group admin events.

**Status**: Open

---

### LOW-001: Math.random Used in Non-Security Test Code

**Severity**: LOW
**Component**: Multiple test files and one UI component
**Files**:
- `/workspace/buildit/src/modules/newsletters/newslettersStore.ts:854,857`
- `/workspace/buildit/src/modules/documents/components/TipTapEditor.tsx:78`

**Description**:
`Math.random()` is used in non-cryptographic contexts (UI randomization, test timeouts). The security tests correctly verify that crypto code does NOT use Math.random.

```typescript
// newslettersStore.ts:857 - Simulated failure for testing
if (Math.random() < 0.05) { // 5% simulated failure rate

// TipTapEditor.tsx:78 - Color selection for UI
return colors[Math.floor(Math.random() * colors.length)]
```

**Impact**:
- Low - not used for security-critical operations
- Test code correctly validates crypto uses crypto.getRandomValues

**Remediation**:
Consider using secureRandomInt even for UI to maintain consistent patterns, but this is not a security issue.

**Status**: Informational

---

### LOW-002: Dependency Vulnerabilities in Development Dependencies

**Severity**: LOW
**Component**: package.json dependencies
**Details**: `bun audit` reports 18 vulnerabilities (8 high, 8 moderate, 2 low)

Notable:
- `valibot >=0.31.0 <1.2.0` - ReDoS in EMOJI_REGEX (transitive via bip32/bitcoinjs-lib)
- `react-router >=7.0.0 <=7.11.0` - XSS via open redirects
- `@modelcontextprotocol/sdk <1.24.0` - DNS rebinding and ReDoS
- `tar <=7.5.2` - Path traversal

**Impact**:
- Development tool vulnerabilities (shadcn CLI) don't affect runtime
- Valibot ReDoS could affect BIP-32 key derivation with malicious input
- React Router XSS requires SSR which is not in use

**Remediation**:
```bash
bun update --latest
```

Pin secure versions of critical dependencies. Most vulnerabilities are in development tools not shipped to users.

**Status**: Open

---

### LOW-003: Console Logging in Crypto Code

**Severity**: LOW
**Component**: `/workspace/buildit/src/core/crypto/nip44.ts`
**Line**: 57

**Description**:
Warning logged for invalid padding:

```typescript
console.warn('Invalid padding length in message');
```

This could leak information about decryption attempts to browser console.

**Impact**:
- Information disclosure in console
- Could aid in cryptanalysis if combined with other attacks

**Remediation**:
Remove or replace with structured error handling that doesn't expose details.

**Status**: Open

---

## Summary

### Critical Issues (Must Fix Before Production)
1. **CRITICAL-001**: Add signature verification to incoming messages
2. **CRITICAL-002**: Implement proper group key distribution protocol

### High Priority (Fix Soon)
3. **HIGH-001**: Implement cryptographic authorization for admin actions
4. **HIGH-002**: Fix sender identity extraction from NIP-17 seals
5. **HIGH-003**: Strengthen invite token generation and add rate limiting
6. **HIGH-004**: Persist replay protection to IndexedDB

### Medium Priority (Planned Improvements)
7. **MEDIUM-001**: Apply NIP-17 wrapping to group thread messages
8. **MEDIUM-002**: Publish signed events for admin changes
9. **MEDIUM-003**: Document timestamp randomization trade-offs
10. **MEDIUM-004**: Add cryptographic consensus for admin removal
11. **MEDIUM-005**: Encrypt group metadata in events

### Low Priority (Best Practice)
12. **LOW-001**: Consistent randomness patterns (informational)
13. **LOW-002**: Update vulnerable dependencies
14. **LOW-003**: Remove console logging from crypto code

---

## Positive Security Findings

The audit also identified several strong security implementations:

1. **Proper PBKDF2 Key Derivation**: 600,000 iterations per OWASP 2023 guidelines
2. **NIP-44 Implementation**: Correct use of ChaCha20-Poly1305 via nostr-tools
3. **Timestamp Randomization**: 2-day window per NIP-17 specification
4. **Secure Randomness**: crypto.getRandomValues used throughout
5. **At-Rest Encryption**: Local IndexedDB encryption with proper key hierarchy
6. **Timing-Safe Comparison**: `timingSafeEqual` function implemented correctly
7. **Session Management**: Proper lock/unlock with inactivity timeout
8. **Key Zeroing**: Memory cleared on lock via SecureKeyManager
9. **Security Test Coverage**: Comprehensive tests for crypto functions
10. **No Hardcoded Secrets**: No nsec or private keys in source code

---

## Compliance Assessment

Against **PRIVACY.md** Threat Model:

| Threat | Status | Notes |
|--------|--------|-------|
| State Surveillance | PARTIAL | E2E encryption good, but metadata leakage in group events |
| Device Seizure | GOOD | Proper at-rest encryption with PBKDF2 |
| Legal Pressure | GOOD | Zero-knowledge relay architecture |
| Infiltration | PARTIAL | No technical protection (as documented) |
| Network Analysis | PARTIAL | NIP-17 helps but group messages expose pubkeys |
| Supply Chain | NEEDS ATTENTION | 18 dependency vulnerabilities |

---

## Recommendations

### Immediate Actions
1. Add `verifyEventSignature()` call before processing any incoming event
2. Extract actual sender from seal in NIP-17 unwrapping
3. Run `bun update --latest` to patch dependencies

### Short-Term (1-2 weeks)
4. Implement persistent replay protection in IndexedDB
5. Strengthen invite token entropy and add rate limiting
6. Publish signed role change events to Nostr

### Medium-Term (1-2 months)
7. Implement proper group key distribution (NIP-17 multi-wrap)
8. Add key rotation mechanism with epoch tracking
9. Apply NIP-17 wrapping to group thread messages

### Long-Term (Phase 2)
10. Implement Noise Protocol for large groups as per ENCRYPTION_STRATEGY.md
11. Add forward secrecy with key ratcheting
12. Implement multi-signature consensus for admin actions

---

**Audit Completed**: 2026-01-18
**Next Review**: After addressing CRITICAL and HIGH findings

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
