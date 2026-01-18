# Zero-Knowledge Architecture Audit Report

**Date**: 2026-01-18
**Auditor**: Claude Code Security Auditor
**Scope**: Relay metadata exposure, zero-knowledge compliance, Nostr protocol limitations
**Version**: 0.30.0

---

## Executive Summary

BuildIt Network claims "zero-knowledge relay architecture" in its documentation. This audit evaluates the accuracy of that claim by analyzing what metadata relays can observe, comparing to true zero-knowledge systems (Signal, CryptPad), and identifying the fundamental limitations of the Nostr protocol.

**Overall Assessment**: **PARTIALLY COMPLIANT** - The system provides strong content confidentiality through NIP-17 gift wrapping for DMs, but falls short of true zero-knowledge architecture due to inherent Nostr protocol limitations. Group operations, events, RSVPs, and other module data expose significant metadata to relays.

### Summary of Findings

| Category | Rating | Description |
|----------|--------|-------------|
| DM Content Protection | STRONG | NIP-17 gift wrap prevents content access |
| DM Sender Protection | GOOD | Ephemeral keys hide real sender identity |
| DM Recipient Exposure | MEDIUM | Recipient pubkey visible in `p` tag |
| Group Messaging | WEAK | Sender pubkey, group ID, thread ID visible |
| Group Operations | CRITICAL | Full membership, roles, invitations visible |
| Events Module | CRITICAL | Event details, locations, RSVPs fully visible |
| Metadata Correlation | HIGH RISK | Timing, patterns, activity observable |

---

## Detailed Analysis

### 1. What Relays Learn - Direct Messages (NIP-17)

**File**: `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts`

**Visible to Relays (Gift Wrap Event - Kind 1059)**:
```json
{
  "id": "unique_event_id",
  "kind": 1059,
  "pubkey": "ephemeral_random_pubkey",    // GOOD: Not real sender
  "created_at": 1234567890,                // Randomized +/- 2 days
  "tags": [["p", "RECIPIENT_PUBKEY"]],     // EXPOSED: Real recipient
  "content": "encrypted_blob",             // PROTECTED: Ciphertext only
  "sig": "signature"
}
```

**Analysis**:
- **Content**: PROTECTED - Encrypted with NIP-44 (ChaCha20-Poly1305)
- **Sender Identity**: PROTECTED - Ephemeral key generated per message
- **Recipient Identity**: EXPOSED - Plaintext pubkey in `p` tag
- **Timestamp**: PARTIALLY PROTECTED - Randomized within 2-day window
- **Message Size**: EXPOSED - Ciphertext length reveals content size

**Gap vs Signal Sealed Sender**:
Signal's sealed sender completely hides the recipient from the server. In Nostr NIP-17, the recipient pubkey is always visible in the `p` tag. This is a fundamental protocol limitation - relays need to know who to deliver messages to.

---

### 2. What Relays Learn - Group Messaging

**File**: `/home/rikki/claude-workspace/buildit-network/src/core/messaging/groupThread.ts`

**Visible to Relays (Group Message - Kind 39101)**:
```json
{
  "id": "message_id",
  "kind": 39101,
  "pubkey": "REAL_SENDER_PUBKEY",          // EXPOSED: Real sender identity
  "created_at": 1234567890,                 // EXPOSED: Exact timestamp
  "tags": [
    ["h", "GROUP_ID"],                      // EXPOSED: Group membership
    ["thread", "THREAD_ID"]                 // EXPOSED: Conversation context
  ],
  "content": "encrypted_content",           // PROTECTED: NIP-44 encrypted
  "sig": "signature"
}
```

**Critical Exposure**:
1. **Sender pubkey** - Real identity, not ephemeral
2. **Group ID** - Reveals group membership
3. **Thread ID** - Reveals conversation context
4. **Exact timestamp** - No randomization (line 39: `created_at: Math.floor(Date.now() / 1000)`)
5. **Message frequency** - Activity patterns observable

**Vulnerability**: A relay operator can build a complete social graph of who is in which groups and their communication patterns.

---

### 3. What Relays Learn - Group Operations

**File**: `/home/rikki/claude-workspace/buildit-network/src/core/groups/groupManager.ts`

**Group Creation (Kind 39000)**:
```json
{
  "kind": 39000,
  "pubkey": "CREATOR_PUBKEY",              // EXPOSED: Creator identity
  "content": "{name, description, privacy, modules}",  // PLAINTEXT!
  "tags": [
    ["d", "group_id"],
    ["name", "GROUP_NAME"],                 // EXPOSED: Group name
    ["privacy", "private"],                 // EXPOSED: Privacy level
    ["module", "events"],                   // EXPOSED: Enabled modules
    ["module", "mutual-aid"]
  ]
}
```

**Group Invitation (Kind 39006)**:
```json
{
  "kind": 39006,
  "pubkey": "INVITER_PUBKEY",              // EXPOSED
  "tags": [
    ["d", "group_id"],
    ["p", "INVITEE_PUBKEY"],               // EXPOSED: Who was invited
    ["group", "group_id"]
  ],
  "content": "You've been invited..."       // PLAINTEXT invitation message
}
```

**Join/Leave Events (Kind 39004/39005)**:
- Member pubkey fully visible
- Join/leave times visible
- Complete membership history reconstructable

**CRITICAL FINDING**: Group metadata is NOT encrypted. Relays can see:
- Group names and descriptions
- All member pubkeys
- Who invited whom
- When members joined/left
- Group privacy settings
- Which modules are enabled

---

### 4. What Relays Learn - Events Module

**File**: `/home/rikki/claude-workspace/buildit-network/src/modules/events/eventManager.ts`

**Event Creation (Kind 31922)**:
```json
{
  "kind": 31922,
  "pubkey": "CREATOR_PUBKEY",
  "content": "{title, description, location, startTime, capacity, ...}",  // PLAINTEXT!
  "tags": [
    ["d", "event_id"],
    ["title", "EVENT_TITLE"],              // EXPOSED: Event name
    ["start", "1234567890"],               // EXPOSED: Exact start time
    ["end", "1234567890"],
    ["location", "123 Main St"],           // EXPOSED: Physical location!
    ["group", "group_id"],
    ["t", "protest"],                       // EXPOSED: Event tags
    ["t", "march"]
  ]
}
```

**RSVP (Kind 31923)**:
```json
{
  "kind": 31923,
  "pubkey": "ATTENDEE_PUBKEY",             // EXPOSED: Who is attending
  "tags": [
    ["d", "event:user"],
    ["e", "event_id"],
    ["status", "going"]                     // EXPOSED: Attendance status
  ]
}
```

**CRITICAL SECURITY ISSUE**: For activists, this is catastrophic:
- Physical locations of events are plaintext
- Complete attendee lists are publicly visible
- Timing of activities is exposed
- Event tags reveal organizing topics

Even "direct-action" privacy level only delays location reveal, but the location still eventually becomes plaintext on relays.

---

### 5. Comparison to Zero-Knowledge Standards

#### Signal (Sealed Sender)

| Property | Signal | BuildIt Network |
|----------|--------|-----------------|
| Message content | Encrypted | Encrypted |
| Sender identity | Hidden (sealed sender) | Hidden for DMs (ephemeral) |
| Recipient identity | Hidden | VISIBLE in p-tag |
| Timestamp | Hidden | Partially randomized |
| Message size | Padded | Exposed |
| Group membership | Hidden | VISIBLE |
| Server sees nothing | YES | NO |

#### CryptPad (Zero-Knowledge)

| Property | CryptPad | BuildIt Network |
|----------|----------|-----------------|
| Document content | Encrypted blobs only | Varies by module |
| User identity | Anonymous keys | Linked to Nostr identity |
| Document metadata | Encrypted | VISIBLE in tags |
| Collaboration data | Encrypted | VISIBLE |
| Server storage | Encrypted blobs | Plaintext metadata + encrypted content |

#### Matrix (E2EE)

| Property | Matrix | BuildIt Network |
|----------|--------|-----------------|
| Room membership | Server sees | Relay sees |
| Message content | E2EE | E2EE for DMs |
| User identity | Server knows | Relay sees |
| Metadata | Exposed | Exposed |

**Conclusion**: BuildIt Network is comparable to Matrix in privacy properties, but falls significantly short of Signal and CryptPad's zero-knowledge standards.

---

### 6. Relay Trust Model Analysis

#### Single Malicious Relay

**Impact**: MEDIUM
- Can observe all events sent to it
- Can see recipient pubkeys for DMs
- Can see full group metadata
- Can build social graphs
- Cannot read encrypted DM content

**Mitigation**: Multi-relay publishing (implemented)

#### All Relays Collude (State Actor Scenario)

**Impact**: HIGH
- Complete communication pattern analysis
- Full social graph of all users
- All group memberships known
- All event attendees known
- Physical locations of events known
- DM content remains protected (if keys not compromised)

**Vulnerability**: The current architecture provides NO protection against this scenario for metadata. This is particularly dangerous for:
- Activists organizing in repressive countries
- Union organizers facing corporate surveillance
- Anyone where association metadata is incriminating

---

### 7. Data at Rest on Relays

**Encrypted Data**:
- DM content (NIP-44)
- Group message content (NIP-44)
- Document content (gift-wrapped)

**Plaintext Data Persisted**:
- All event kinds (0-65535) with their tags
- Group names, descriptions, settings
- Event titles, locations, times
- RSVP status and attendee lists
- Member pubkeys and roles
- Invitation messages

**Harvest Now, Decrypt Later**:
- DM content uses NIP-44 (ChaCha20-Poly1305) - quantum-vulnerable
- No post-quantum encryption implemented
- No forward secrecy for DMs (key compromise = all history)
- Metadata is ALREADY plaintext - no decryption needed

---

### 8. Nostr Protocol Inherent Limitations

The Nostr protocol has fundamental architectural decisions that prevent true zero-knowledge:

1. **Addressable Events Require `p` Tags**: To deliver a message to a recipient, the relay must know who to deliver it to. The `p` tag exposes this.

2. **Event IDs Are Content-Derived**: Event IDs are hashes of content, which means the same content produces the same ID. Relay collusion can detect duplicate events.

3. **Signatures Prove Authorship**: Every event is signed by a keypair. The pubkey is inherently linked to identity.

4. **Tags Are Plaintext**: All Nostr tags are plaintext by design. There is no encrypted tag mechanism.

5. **Relays Are Untrusted Storage**: Unlike Signal servers that see nothing, Nostr relays are designed to index and query events by metadata.

**These are protocol-level limitations, not implementation bugs.**

---

## Recommendations

### Critical (Must Fix)

1. **Encrypt Group Operations**
   - Apply NIP-17 gift wrapping to group creation, invitations, join/leave events
   - Each group member receives individual encrypted copy
   - Group metadata should be encrypted blobs, not plaintext tags

2. **Encrypt Event Metadata**
   - Event details (title, location, time) should be encrypted
   - Only group members should be able to decrypt
   - Tags should be minimal (kind, encrypted blob)

3. **Encrypt RSVPs**
   - RSVP events should be gift-wrapped to event creator
   - Attendee lists should never be plaintext on relays

### High Priority

4. **Apply Timestamp Randomization Universally**
   - Group messages currently use exact timestamps
   - Apply the same +/- 2 day randomization from NIP-17

5. **Implement Noise Protocol for Groups**
   - As documented in ENCRYPTION_STRATEGY.md Phase 2
   - Provides forward secrecy
   - Reduces metadata exposure

6. **Add Message Padding**
   - Pad all encrypted content to fixed sizes
   - Prevents length-based analysis

### Medium Priority

7. **Relay Diversity Strategy**
   - Use different relays for different identity contexts
   - Prevent single-relay correlation

8. **Post-Quantum Preparation**
   - Plan migration path to hybrid encryption
   - Consider CRYSTALS-Kyber for key encapsulation

---

## Compliance Assessment

| Claim in Documentation | Reality | Compliant? |
|------------------------|---------|------------|
| "Zero-knowledge relay architecture" | Relays see significant metadata | NO |
| "Relays cannot read encrypted content" | True for DM/group message content | YES |
| "Ephemeral keys hide sender identity" | True for DMs only | PARTIAL |
| "Metadata protection" | Only timestamp randomization for DMs | PARTIAL |
| "No server-side key storage" | True - keys are client-side only | YES |
| "Group membership encrypted" | Group operations are plaintext | NO |

---

## Conclusion

BuildIt Network provides strong **content confidentiality** for direct messages and group chat content through NIP-17/NIP-44 encryption. However, the claim of "zero-knowledge architecture" is **misleading** because:

1. **Recipient identity** is always visible to relays
2. **Group operations** (creation, invitations, membership) are plaintext
3. **Event metadata** (locations, times, attendees) is plaintext
4. **Social graphs** can be reconstructed from relay data

For activists in high-risk environments, this metadata exposure could be as dangerous as content exposure. The system is more accurately described as "content-encrypted, metadata-exposed" rather than "zero-knowledge."

**To achieve true zero-knowledge similar to CryptPad, the project would need to:**

1. Encrypt ALL event metadata, not just content
2. Use encrypted blob storage with no queryable plaintext fields
3. Implement encrypted indexes or PIR (Private Information Retrieval)
4. Move group membership to encrypted local storage only
5. Consider alternative protocols for sensitive operations (e.g., Signal Protocol sideband)

The current Nostr protocol makes this extremely difficult because relays are designed to index and query events by metadata. A true zero-knowledge Nostr implementation would require significant protocol extensions or a hybrid architecture.

---

**Audit Status**: COMPLETE
**Next Steps**: Review with security team, prioritize critical findings, update PRIVACY.md documentation to accurately reflect current limitations

---

## Appendix: Files Reviewed

| File | Purpose | Privacy Impact |
|------|---------|----------------|
| `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip17.ts` | DM encryption | Good - uses ephemeral keys |
| `/home/rikki/claude-workspace/buildit-network/src/core/crypto/nip44.ts` | NIP-44 encryption | Good - proper ChaCha20 usage |
| `/home/rikki/claude-workspace/buildit-network/src/core/nostr/client.ts` | Relay communication | Neutral - publishes as designed |
| `/home/rikki/claude-workspace/buildit-network/src/core/messaging/dm.ts` | Direct messages | Good - uses NIP-17 |
| `/home/rikki/claude-workspace/buildit-network/src/core/messaging/groupThread.ts` | Group messages | CRITICAL - exposes sender pubkey |
| `/home/rikki/claude-workspace/buildit-network/src/core/groups/groupManager.ts` | Group operations | CRITICAL - all metadata plaintext |
| `/home/rikki/claude-workspace/buildit-network/src/modules/events/eventManager.ts` | Events module | CRITICAL - locations/attendees exposed |
| `/home/rikki/claude-workspace/buildit-network/PRIVACY.md` | Threat model | Claims not fully accurate |
| `/home/rikki/claude-workspace/buildit-network/ENCRYPTION_STRATEGY.md` | Encryption design | Accurate, Phase 2 needed |
