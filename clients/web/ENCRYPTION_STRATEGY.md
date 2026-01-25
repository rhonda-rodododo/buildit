# Encryption Strategy & Architecture

## Executive Summary

Based on analysis of Nostr encryption protocols (NIP-04, NIP-44, NIP-17), Noise Protocol Framework (used in WireGuard, BitChat), and Signal Protocol, this document defines the encryption architecture for BuildIt Network - a social action network.

**Strategic Decision**: Use a **layered encryption approach** that combines the best of each protocol for different use cases.

## 🏗️ Encryption Architecture

### Layer 1: Direct Messages (1-to-1)
**Protocol**: NIP-17 (Gift-Wrapped NIP-44)

**Why**:
- Strong metadata protection (hides sender, receiver, timestamp)
- Uses proven NIP-44 encryption (ChaCha20, HMAC-SHA256)
- Two-layer encryption (seal + gift wrap)
- No correlation between messages on relays

**Properties**:
- ✅ End-to-end encryption
- ✅ Metadata protection
- ✅ Message unlinkability
- ⚠️ No forward secrecy (acceptable for social organizing)
- ⚠️ No post-compromise security (mitigated by key rotation)

### Layer 2: Small Group Messaging (<100 members)
**Protocol**: NIP-17 with Multiple Gift Wraps

**Why**:
- Same strong properties as DMs
- Scales to ~100 participants
- Each member gets individual encrypted copy
- No group metadata leakage

**Properties**:
- ✅ Per-member encryption
- ✅ Metadata protection
- ✅ Group anonymity on relays
- ⚠️ Message duplication (one per member)

### Layer 3: Large Group Messaging (>100 members)
**Protocol**: Custom Group Encryption with Noise Protocol Patterns

**Why**:
- Noise Protocol provides forward secrecy
- Better scalability than NIP-17
- Supports key rotation
- Can use Noise_XX or Noise_IK patterns

**Implementation**:
- Derive group key using Noise handshake
- Encrypt messages with ChaCha20-Poly1305
- Rotate keys periodically
- Store encrypted group key list

**Properties**:
- ✅ Forward secrecy (with key rotation)
- ✅ Efficient for large groups
- ✅ Post-compromise security (with rotation)
- ✅ Scales to thousands of members

### Layer 4: Future - Bluetooth Mesh (Offline)
**Protocol**: Noise Protocol Framework

**Why**:
- Proven in BitChat for BLE mesh
- Low bandwidth efficiency
- Forward secrecy
- Perfect for offline scenarios

**Implementation** (Future Epic):
- Noise_XX pattern for peer discovery
- Multi-hop relay (up to 7 hops)
- Message queue when offline
- Sync to Nostr when online

## 📊 Encryption Decision Matrix

| Use Case | Protocol | Forward Secrecy | Metadata Protection | Scalability | Implementation Priority |
|----------|----------|-----------------|---------------------|-------------|------------------------|
| DMs | NIP-17 | ❌ | ✅✅✅ | High | **MVP** |
| Small Groups (<100) | NIP-17 Multi-Wrap | ❌ | ✅✅✅ | Medium | **MVP** |
| Large Groups (>100) | Noise + Group Key | ✅ | ✅✅ | High | **Phase 2** |
| Offline/BLE Mesh | Noise Protocol | ✅ | ✅ | Low | **Future** |
| High-Risk Organizing | Signal Protocol Port | ✅ | ✅✅✅ | Low | **Optional** |

## 🔐 Detailed Implementation

### MVP: NIP-17 Implementation

#### Message Flow (Direct Message)
```typescript
// 1. Create unsigned rumor event
const rumor = {
  kind: 14, // Private Direct Message
  content: plaintext,
  created_at: randomizeTimestamp(now),
  tags: [['p', recipientPubkey]]
}

// 2. Seal the rumor (NIP-59)
const seal = {
  kind: 13,
  content: nip44Encrypt(JSON.stringify(rumor), conversationKey),
  created_at: randomizeTimestamp(now),
  tags: []
}
signEvent(seal, senderPrivkey)

// 3. Gift wrap for recipient (NIP-59)
const giftWrap = {
  kind: 1059,
  content: nip44Encrypt(JSON.stringify(seal), recipientPubkey),
  created_at: randomizeTimestamp(now),
  tags: [['p', recipientPubkey]]
}
signEvent(giftWrap, ephemeralKey) // Use ephemeral key for anonymity
```

#### Group Message Flow (Small Groups)
```typescript
// For each group member:
members.forEach(member => {
  const giftWrap = createGiftWrap(rumor, member.pubkey)
  publishToRelays(giftWrap)
})
```

### Phase 2: Noise Protocol for Large Groups

#### Noise_XX Pattern (Group Key Establishment)
```typescript
// Admin creates group
const groupNoiseState = noise.initializeInitiator()
const groupPublicKey = groupNoiseState.getPublicKey()

// Member joins group
const memberNoiseState = noise.initializeResponder()
const handshakeMessage = memberNoiseState.receiveHandshake()

// Establish shared group key
const groupKey = noise.deriveKey(handshakeMessage)
```

#### Group Message Encryption
```typescript
// Encrypt group message
const nonce = randomBytes(24)
const ciphertext = chacha20poly1305.encrypt(
  plaintext,
  nonce,
  groupKey
)

// Publish to group relay
const event = {
  kind: 42, // Channel message
  content: base64(nonce + ciphertext),
  tags: [['e', groupId]]
}
```

#### Key Rotation (Forward Secrecy)
```typescript
// Rotate group key every N messages or T time
if (shouldRotateKey(groupState)) {
  const newGroupKey = noise.rotateKey(currentGroupKey)

  // Distribute new key to members
  members.forEach(member => {
    const keyUpdate = nip17Encrypt({
      type: 'key_rotation',
      newKey: newGroupKey,
      epoch: nextEpoch
    }, member.pubkey)
    publishToRelays(keyUpdate)
  })
}
```

## 🛡️ Security Properties Comparison

### NIP-17 (MVP Implementation)
✅ **Strengths**:
- Strong metadata protection
- Message unlinkability
- Relay cannot see participants
- No timing correlation
- Works with existing Nostr infrastructure

❌ **Limitations**:
- No forward secrecy (key compromise = all messages)
- No post-compromise security
- Message duplication for groups

**Mitigation**:
- Regular key rotation (manual)
- Separate identities per risk level
- Hardware wallet for high-security groups

### Noise Protocol (Phase 2)
✅ **Strengths**:
- Forward secrecy (with ratcheting)
- Post-compromise security (with rotation)
- Efficient for large groups
- Battle-tested (WireGuard, WhatsApp)

❌ **Limitations**:
- More complex implementation
- Requires group key distribution
- Less metadata protection than NIP-17 (if not combined)

**Best Practice**: Combine with NIP-17 for key distribution

## 📦 Libraries & Dependencies

### MVP (NIP-17)
```json
{
  "@noble/secp256k1": "^2.0.0",
  "nostr-tools": "^2.0.0"
}
```

### Phase 2 (Noise Protocol)
```json
{
  "@noiseprotocol/noise-protocol": "^latest",
  "noise-handshake": "^latest",
  "chacha20-poly1305": "^latest"
}
```

### Future (BLE Mesh)
```json
{
  "@capacitor/bluetooth-le": "^latest",
  "noise-protocol-react-native": "^latest"
}
```

## 🚀 Implementation Roadmap

### Epic 1-3: Foundation (MVP)
- [x] NIP-44 encryption functions
- [x] NIP-17 gift wrap implementation
- [x] DM encryption/decryption
- [x] Small group messaging (<100)
- [x] Key management (IndexedDB)
- [x] Metadata randomization

### Epic 7-8: Enhanced Groups
- [ ] Noise Protocol integration
- [ ] Large group support (>100)
- [ ] Key rotation mechanism
- [ ] Forward secrecy for groups
- [ ] Group key distribution via NIP-17

### Future: Offline & BLE
- [ ] Noise Protocol for BLE
- [ ] Multi-hop mesh networking
- [ ] Offline message queue
- [ ] Sync to Nostr when online
- [ ] React Native implementation

## 🔬 Threat Model Considerations

### Attack Vectors & Mitigations

#### 1. Key Compromise
**Risk**: Private key stolen → All messages decryptable

**Mitigation**:
- Hardware wallet support (NIP-46)
- Key rotation (Phase 2)
- Separate identities per context
- Short-lived conversation keys

#### 2. Metadata Analysis
**Risk**: Relay operators analyze patterns

**Mitigation**:
- NIP-17 metadata protection
- Timestamp randomization
- Tor integration
- Multiple relay usage

#### 3. Device Seizure
**Risk**: Physical access to device

**Mitigation**:
- IndexedDB encryption at rest
- Device lock/biometric
- No plaintext key storage
- Key derivation from password

#### 4. Relay Compromise
**Risk**: Malicious relay collects data

**Mitigation**:
- E2E encryption (relay sees ciphertext only)
- Multiple relay redundancy
- Community-run relays
- Relay rotation

## 📝 Best Practices for Developers

### Key Management
```typescript
// ✅ Good: Derive keys, never store plaintext
const conversationKey = hkdf(
  masterKey,
  recipientPubkey,
  'nostr-dm-key'
)

// ❌ Bad: Store plaintext keys
localStorage.setItem('key', privateKey) // NEVER!
```

### Metadata Protection
```typescript
// ✅ Good: Randomize timestamps
const created_at = now + randomInt(-2 * 24 * 60 * 60, 2 * 24 * 60 * 60)

// ❌ Bad: Precise timestamps
const created_at = Date.now() // Leaks timing!
```

### Group Key Distribution
```typescript
// ✅ Good: Individual encryption for each member
members.forEach(m => sendEncrypted(groupKey, m))

// ❌ Bad: Public group key
publishEvent({ kind: 42, content: groupKey }) // NEVER!
```

## 🔍 Audit & Compliance

### Security Audits
- NIP-44 audited by Cure53 (2023)
- Noise Protocol formally verified
- Regular security reviews required

### Compliance Notes
- Encryption may be restricted in some jurisdictions
- No backdoors or key escrow
- User responsible for key management
- Local-first, no cloud storage

## 📚 References

1. [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
2. [NIP-44: Encrypted Payloads](https://github.com/nostr-protocol/nips/blob/master/44.md)
3. [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)
4. [Noise Protocol Framework](https://noiseprotocol.org/)
5. [BitChat Architecture](https://github.com/permissionlesstech/bitchat)
6. [Signal Protocol Specification](https://signal.org/docs/)
7. [Cure53 NIP-44 Audit](https://cure53.de/audit-report.pdf)

---

**Note**: This is a living document. Update as new protocols emerge and security landscape evolves.
