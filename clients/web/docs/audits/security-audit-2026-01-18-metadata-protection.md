# Security Audit - Metadata Protection and Traffic Analysis

**Date**: 2026-01-18
**Auditor**: Security Auditor Agent (Claude Opus 4.5)
**Focus**: Metadata Protection and Traffic Analysis Vulnerabilities
**Threat Model**: State actors with network-level surveillance capabilities (NSA, GFW-style)

---

## Executive Summary

This audit examines how BuildIt Network protects user metadata from traffic analysis by state-level adversaries monitoring Nostr relays for 6 months. While the NIP-17 gift-wrap implementation provides sender anonymity and content confidentiality, **significant metadata leakage vectors remain** that could enable social graph reconstruction and activity pattern analysis.

**Critical Finding Count**: 0
**High Finding Count**: 4
**Medium Finding Count**: 5
**Low Finding Count**: 4
**Informational**: 3

---

## Scope

### Areas Analyzed
1. NIP-17 timestamp randomization implementation
2. Ephemeral key usage and sender anonymity
3. Message size patterns and padding
4. Relay subscription filters and metadata leakage
5. Public event publication (contacts, groups, profiles)
6. Traffic correlation attack vectors
7. Tor integration status
8. Dependency vulnerabilities

### Threat Scenario
A state actor (NSA/GCHQ/MSS) monitors all WebSocket traffic to/from known Nostr relays for 6 months. They have access to:
- Connection timing and IP addresses (at ISP/backbone level)
- Encrypted message content, sizes, and timing
- Subscription filter patterns
- Public event metadata

---

## Findings

### HIGH-001: Math.random() Used for Timestamp Randomization

**Severity**: HIGH
**Location**: `/workspace/buildit/src/core/crypto/nip17.ts:11`

**Description**:
The `randomizeTimestamp()` function uses `Math.random()` for generating timestamp offsets:

```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomOffset = Math.floor(Math.random() * twoDaysInSeconds) - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + randomOffset
}
```

`Math.random()` is not cryptographically secure. Modern JavaScript engines use xorshift128+ which:
- Has only 128 bits of internal state
- Is predictable if enough outputs are observed (~1000 values)
- May exhibit statistical biases that reduce effective entropy

**Impact**:
An adversary observing many messages from a user could potentially:
1. Predict future timestamp offsets
2. Narrow the window for timing correlation attacks
3. Reduce the effective entropy of timestamp randomization

**Exploitation Scenario**:
State actor collects 1000+ gift-wrapped events from target user, analyzes timestamp distribution, potentially identifies bias patterns that allow narrowing actual send times.

**Remediation**:
Replace with `crypto.getRandomValues()`:

```typescript
function randomizeTimestamp(baseTime: number = Date.now()): number {
  const twoDaysInSeconds = 2 * 24 * 60 * 60
  const randomBytes = new Uint32Array(1)
  crypto.getRandomValues(randomBytes)
  // Map to range [-twoDaysInSeconds/2, +twoDaysInSeconds/2]
  const randomOffset = (randomBytes[0] / 0xFFFFFFFF) * twoDaysInSeconds - twoDaysInSeconds / 2
  return Math.floor(baseTime / 1000) + Math.floor(randomOffset)
}
```

**Status**: Open

---

### HIGH-002: No Message Padding Implementation

**Severity**: HIGH
**Location**: Multiple files - `/workspace/buildit/src/core/crypto/nip17.ts`

**Description**:
Messages are encrypted without padding to fixed sizes. The NIP-44 encryption used internally may add minimal padding, but there is no application-level message padding to hide content length.

**Impact**:
Message size leaks information about content:
- Short messages (~50 bytes) indicate single-word responses ("ok", "yes")
- Medium messages (100-500 bytes) indicate normal conversation
- Long messages (1KB+) indicate detailed information exchange
- Very long messages indicate file sharing or attachments

An adversary can:
1. Identify message types by size distribution
2. Track conversation "momentum" (back-and-forth patterns)
3. Identify likely commands vs. casual chat
4. Correlate sender/recipient by size echoing patterns

**Exploitation Scenario**:
State actor monitors encrypted messages between suspected activists. Despite encryption, they notice:
- User A sends 1200 byte message
- 30 seconds later, User B sends 800 byte message
- Pattern repeats, indicating conversation between A and B
- Message sizes during organizing periods spike, correlating with protest planning

**Remediation**:
Implement message padding to fixed bucket sizes:

```typescript
const MESSAGE_BUCKETS = [256, 512, 1024, 2048, 4096, 8192, 16384]

function padMessage(content: string): string {
  const encoded = new TextEncoder().encode(content)
  const targetSize = MESSAGE_BUCKETS.find(s => s >= encoded.length + 16) || MESSAGE_BUCKETS[MESSAGE_BUCKETS.length - 1]
  const paddingLength = targetSize - encoded.length
  const padding = crypto.getRandomValues(new Uint8Array(paddingLength))
  // Add length prefix and padding
  return JSON.stringify({ c: content, p: Array.from(padding) })
}
```

**Status**: Open

---

### HIGH-003: Contact List Publication Leaks Social Graph

**Severity**: HIGH
**Location**: `/workspace/buildit/src/stores/contactsStore.ts:222-258`

**Description**:
The `publishContactList()` function publishes a kind 3 event containing all followed users with their pubkeys in plaintext:

```typescript
publishContactList: async () => {
  const following = get().getFollowing();
  const tags = following.map((contact) => [
    'p',
    contact.pubkey,
    contact.relay || '',
    contact.petname || '',
  ]);

  const event = finalizeEvent({
    kind: 3,
    tags,
    content: '',
    created_at: Math.floor(Date.now() / 1000),  // NOTE: Real timestamp!
  }, privateKey);

  await nostrClient.publish(event);
}
```

**Impact**:
- **Complete social graph exposure**: Anyone (including relays, state actors) can see exactly who follows whom
- **Real timestamps**: Unlike gift-wrapped messages, contact list updates use real timestamps
- **No encryption**: Contact lists are fully public
- **Relationship inference**: Following patterns reveal organizational structures

**Exploitation Scenario**:
State actor scrapes all kind 3 events from relays. They can:
1. Build complete social graph of all BuildIt users
2. Identify central nodes (organizers) by in-degree
3. Track when follow relationships change (timing of org building)
4. Identify cells/clusters of closely connected activists

**Remediation**:
Consider implementing NIP-51 encrypted lists:
- Store contact lists as encrypted kind 30000 events
- Only decrypt locally
- Or: Do not publish contact lists at all (keep local-only)

**Status**: Open

---

### HIGH-004: Group Events Leak Membership Patterns

**Severity**: HIGH
**Location**: `/workspace/buildit/src/core/groups/groupManager.ts`

**Description**:
Group management events (kinds 39000, 39001, 39002, 39004, 39005, 39006) are published without NIP-17 gift wrapping:

```typescript
// Line 32-46: Group creation with plaintext metadata
const creationEvent = createEventFromTemplate({
  kind: 39000,
  content: JSON.stringify(groupMetadata),
  tags: [
    ['d', generateEventId()],
    ['name', params.name],
    ['privacy', params.privacyLevel],
    ...params.enabledModules.map(module => ['module', module]),
  ],
  created_at: now,  // Real timestamp!
}, creatorPrivateKey)
```

Similarly, join/leave/invitation events use real timestamps and plaintext tags.

**Impact**:
- Group names and descriptions visible to relays
- Member pubkeys visible in invitation/join events
- Timing of membership changes reveals organizational activity
- "Private" groups still have visible metadata structure

**Exploitation Scenario**:
State actor queries for all kind 39004 (join) and 39005 (leave) events. They can:
1. Track which pubkeys join which groups
2. Map organizational structure even for "private" groups
3. Identify when groups become more active (more joins)
4. Correlate group activity with real-world events

**Remediation**:
Gift-wrap all group management events using NIP-17:
- Encrypt group metadata for members only
- Use ephemeral keys for group events
- Randomize timestamps for join/leave events

**Status**: Open

---

### MEDIUM-001: Subscription Filters Leak User Interest

**Severity**: MEDIUM
**Location**: `/workspace/buildit/src/core/nostr/client.ts:74-119`

**Description**:
When subscribing to events, the client sends filter criteria to relays:

```typescript
subscribe(filters: Filter[], onEvent, onEose): string {
  const relayUrls = this.getReadRelays();
  this.pool.subscribeMany(relayUrls, mergedFilter, { ... });
}
```

Filters typically include:
- `authors: [pubkey1, pubkey2, ...]` - reveals who user is interested in
- `#p: [pubkey]` - reveals who user is communicating with
- `kinds: [...]` - reveals what event types user cares about

**Impact**:
Relays (and relay operators coerced by state actors) can see:
- Which pubkeys a user subscribes to
- Which group IDs user is interested in
- Communication patterns based on subscription changes

**Exploitation Scenario**:
State-compromised relay logs all REQ messages. When user subscribes to `{ authors: [activist_pubkey] }`, relay operator knows user is monitoring that activist.

**Remediation**:
- Implement broad subscription filters (fetch more than needed)
- Use multiple relays with different filters
- Consider dummy subscriptions to add noise
- Document this as inherent Nostr limitation

**Status**: Open

---

### MEDIUM-002: No Message Batching Implementation

**Severity**: MEDIUM
**Location**: `/workspace/buildit/src/core/messaging/conversationsStore.ts:526-584`

**Description**:
Messages are published immediately when sent:

```typescript
// Line 570-572
const publishResults = await Promise.all(
  giftWraps.map((gw) => client.publish(gw))
);
```

No batching, queuing, or timing obfuscation is applied.

**Impact**:
- Message send times directly correlate with user activity
- Rapid back-and-forth visible as correlation even through gift wrapping
- Activity patterns reveal timezone, work hours, sleep schedule

**Exploitation Scenario**:
State actor observes gift-wrapped event publication times. Even without content:
- Events at 9am-5pm EST suggest US East Coast user
- Rapid exchanges (5 events in 30 seconds) suggest active conversation
- Silent periods during local night suggest timezone

**Remediation**:
Implement message queue with jittered delays:

```typescript
class MessageQueue {
  private queue: GiftWrap[] = [];
  private minDelay = 1000;  // 1 second minimum
  private maxDelay = 30000; // 30 seconds maximum

  async enqueue(giftWrap: GiftWrap) {
    this.queue.push(giftWrap);
    await this.scheduleFlush();
  }

  private async scheduleFlush() {
    const delay = this.minDelay + crypto.getRandomValues(new Uint32Array(1))[0] % (this.maxDelay - this.minDelay);
    await new Promise(r => setTimeout(r, delay));
    // Flush random subset of queue
  }
}
```

**Status**: Open

---

### MEDIUM-003: Tor Support Not Actually Functional

**Severity**: MEDIUM
**Location**: `/workspace/buildit/src/modules/security/tor/`

**Description**:
While a Tor module exists (`torStore.ts`, `detection.ts`), it only:
1. Detects if running in Tor Browser
2. Provides `.onion` relay URLs
3. Does NOT implement actual SOCKS proxy routing

From `detection.ts:75-81`:
```typescript
export async function canAccessOnionServices(): Promise<boolean> {
  // We can't actually test .onion connectivity from JavaScript
  // because browsers don't support SOCKS5 proxies directly
  return detectTorBrowser();
}
```

**Impact**:
- Users may believe Tor is protecting them when it's not
- Only Tor Browser users get actual IP protection
- `.onion` relay feature requires manual Tor Browser setup
- No programmatic Tor proxy support

**Exploitation Scenario**:
User enables "Tor mode" thinking they're protected. Actually:
- Their real IP is still visible to relays
- Only Tor Browser provides actual IP hiding
- False sense of security

**Remediation**:
- Clearly document that only Tor Browser is supported
- Remove or grey out "Enable Tor" options for non-Tor browsers
- Consider WebSocket-over-Tor proxy integration (requires backend)
- Add prominent warning when Tor features enabled outside Tor Browser

**Status**: Open

---

### MEDIUM-004: Profile Metadata Published with Real Timestamps

**Severity**: MEDIUM
**Location**: `/workspace/buildit/src/core/nostr/nip01.ts:88-107`

**Description**:
Profile metadata events use real timestamps:

```typescript
export function createMetadataEvent(metadata, privateKey): NostrEvent {
  return createEventFromTemplate({
    kind: 0,
    content: JSON.stringify(metadata),
    tags: [],
    created_at: Math.floor(Date.now() / 1000),  // Real timestamp!
  }, privateKey)
}
```

**Impact**:
- Profile update timing reveals user activity
- First profile creation reveals account creation time
- Profile update patterns can fingerprint users

**Remediation**:
Randomize timestamps for profile updates within reasonable window.

**Status**: Open

---

### MEDIUM-005: Passphrase Generation Uses Math.random()

**Severity**: MEDIUM
**Location**: `/workspace/buildit/src/core/crypto/keyManager.ts:139-153`

**Description**:
The `generatePassphrase()` function uses `Math.random()`:

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
- Passphrases have reduced entropy
- Comment notes "in production, use BIP-39 wordlist"
- May be used for sensitive key encryption

**Remediation**:
Use `crypto.getRandomValues()` or implement proper BIP-39.

**Status**: Open

---

### LOW-001: No Dummy Traffic Generation

**Severity**: LOW
**Location**: System-wide

**Description**:
PRIVACY.md mentions "Dummy traffic generation (future)" but no implementation exists. Without dummy traffic:
- Activity patterns are visible
- Silent periods indicate user offline
- Burst periods indicate active usage

**Remediation**:
Implement optional dummy message generation during quiet periods.

**Status**: Open

---

### LOW-002: Console Logging May Leak Sensitive Information

**Severity**: LOW
**Location**: Multiple files (50+ occurrences)

**Description**:
Extensive `console.log`, `console.info`, `console.warn`, `console.error` statements throughout codebase. Some examples:

- `src/core/groups/groupManager.ts:276` - "Failed to parse group event"
- `src/stores/contactsStore.ts:254` - "Failed to publish contact list"
- `src/core/messaging/conversationsStore.ts:508` - "Failed to store message locally"

**Impact**:
- Browser dev tools capture these logs
- May reveal timing, user actions, or errors
- Malicious browser extensions could scrape console

**Remediation**:
- Remove sensitive logging in production builds
- Use build-time log stripping
- Ensure no PII or keys in log messages

**Status**: Open

---

### LOW-003: Dependency Vulnerabilities

**Severity**: LOW (but note CRITICAL happy-dom issue)
**Location**: `package.json` dependencies

**Description**:
`bun audit` reveals multiple vulnerabilities:

**Critical**:
- `happy-dom >=19.0.0 <20.0.2` - VM Context Escape (RCE) - GHSA-37j7-fg3j-429f
  - Only affects test environment (vitest)

**High**:
- `qs <6.14.1` - DoS via memory exhaustion
- `tar <=7.5.2` - Arbitrary file overwrite
- `valibot >=0.31.0 <1.2.0` - ReDoS vulnerability

**Moderate**:
- `vite >=7.1.0 <=7.1.10` - server.fs.deny bypass on Windows
- `mdast-util-to-hast` - unsanitized class attribute
- `js-yaml >=4.0.0 <4.1.1` - prototype pollution

**Remediation**:
Update dependencies to patched versions:
- `happy-dom` >= 20.0.2
- `vite` > 7.1.10
- `valibot` >= 1.2.0
- etc.

**Status**: Open

---

### LOW-004: ID Generation Uses Date.now() + Math.random()

**Severity**: LOW
**Location**: Multiple files

**Description**:
IDs are generated with predictable patterns:

```typescript
// conversationsStore.ts:157
id: `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,

// postsStore.ts:135
id: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
```

**Impact**:
- IDs reveal creation timestamps
- Math.random() adds limited entropy
- Could aid traffic analysis correlation

**Remediation**:
Use `crypto.randomUUID()` for opaque, unpredictable IDs.

**Status**: Open

---

### INFO-001: Timestamp Randomization Window Documented as +/-2 Days

**Severity**: Informational
**Location**: `/workspace/buildit/src/core/crypto/nip17.ts:7-13`

**Description**:
Timestamp randomization uses a +/-2 day window, which matches NIP-17 specification:

```typescript
const twoDaysInSeconds = 2 * 24 * 60 * 60
```

**Analysis**:
- This is the NIP-17 recommended window
- Provides reasonable protection against correlation
- Wider windows would help but break compatibility
- Window may be insufficient for high-value targets

**No action required** - this is informational.

---

### INFO-002: Ephemeral Keys Properly Implemented

**Severity**: Informational
**Location**: `/workspace/buildit/src/core/crypto/nip17.ts:59-79`

**Description**:
Gift wrapping uses ephemeral keys correctly:

```typescript
export function createGiftWrap(seal: Seal, recipientPubkey: string): GiftWrap {
  // Generate ephemeral key for anonymity
  const ephemeralPrivateKey = generateSecretKey()
  // ...
  return finalizeEvent(giftWrapTemplate, ephemeralPrivateKey) as GiftWrap
}
```

**Analysis**:
- Each gift wrap uses a unique ephemeral key
- Sender identity is hidden from relays
- Test confirms: "pubkey should not be sender"

**This is a positive finding** - correctly implemented.

---

### INFO-003: NIP-44 Encryption Delegated to nostr-tools

**Severity**: Informational
**Location**: `/workspace/buildit/src/core/crypto/nip44.ts`

**Description**:
Encryption uses `nostr-tools/nip44` which implements:
- ChaCha20-Poly1305 AEAD
- Proper nonce handling
- Conversation key derivation

```typescript
import * as nip44 from 'nostr-tools/nip44'
return nip44.v2.encrypt(plaintext, conversationKey)
```

**Analysis**:
- nostr-tools is a well-maintained library
- NIP-44 was audited by Cure53 in 2023
- Proper delegation of cryptographic primitives

**This is a positive finding** - correct use of audited library.

---

## Summary

**Total Findings**: 16
- Critical: 0
- High: 4
- Medium: 5
- Low: 4
- Informational: 3

### Priority Actions

1. **[HIGH-001]** Replace `Math.random()` with `crypto.getRandomValues()` for timestamp randomization
2. **[HIGH-002]** Implement message padding to fixed bucket sizes
3. **[HIGH-003]** Encrypt contact lists or keep local-only
4. **[HIGH-004]** Gift-wrap all group management events
5. **[MEDIUM-001]** Document subscription filter metadata leakage in PRIVACY.md
6. **[MEDIUM-003]** Clarify Tor support limitations prominently in UI
7. **[LOW-003]** Update vulnerable dependencies

### What a State Actor Can Learn in 6 Months

Even with NIP-17 gift wrapping properly implemented, a state-level adversary monitoring all relay traffic can determine:

| Information | Source | Confidence |
|-------------|--------|------------|
| User's social graph | Kind 3 contact lists | HIGH |
| Group membership | Kind 39xxx events | HIGH |
| Activity patterns | Event publication timing | MEDIUM |
| Message size patterns | Encrypted event sizes | MEDIUM |
| User timezone | Activity timing | MEDIUM |
| Conversation partners | Timing correlation | LOW-MEDIUM |
| User interests | Subscription filters | MEDIUM |
| IP address | WebSocket connections | HIGH (without Tor) |

### Positive Security Properties

The implementation does correctly provide:
- **Content confidentiality**: NIP-44 encryption is sound
- **Sender anonymity for DMs**: Ephemeral keys hide sender pubkey
- **Relay zero-knowledge**: Relays cannot read encrypted content
- **Timestamp obfuscation**: +/-2 day randomization (with noted weakness)
- **Key management**: Proper PBKDF2 derivation with 600K iterations

---

## Compliance

**PRIVACY.md Threat Model Compliance**: PARTIAL

- Content protection: PASS
- Metadata protection: PARTIAL FAIL
- Social graph protection: FAIL
- Traffic analysis resistance: PARTIAL FAIL

---

## References

1. NIP-17: https://github.com/nostr-protocol/nips/blob/master/17.md
2. NIP-44 Cure53 Audit: https://cure53.de/audit-report.pdf
3. Math.random() Predictability: https://security.stackexchange.com/questions/84906/predicting-math-random-numbers
4. Traffic Analysis in Encrypted Messaging: https://www.usenix.org/conference/usenixsecurity17/technical-sessions/presentation/coull

---

**Document Status**: Complete
**Next Steps**: Address HIGH findings before production deployment for high-risk users
