# Key Management and Storage Strategies

**Version**: 0.30.0
**Last Updated**: 2025-10-07
**Status**: Production-Ready for Security Audit

## Table of Contents

1. [Overview](#overview)
2. [Key Types and Lifecycle](#key-types-and-lifecycle)
3. [Key Generation](#key-generation)
4. [Key Storage](#key-storage)
5. [Key Import/Export](#key-importexport)
6. [Key Usage](#key-usage)
7. [Key Rotation](#key-rotation)
8. [Key Recovery](#key-recovery)
9. [Security Considerations](#security-considerations)
10. [Future Enhancements](#future-enhancements)

---

## Overview

BuildIt Network uses Nostr secp256k1 keypairs as the foundation for user identity and encryption. This document details how keys are generated, stored, used, and protected throughout their lifecycle.

### Key Management Principles

1. **User Sovereignty**: Users own and control their private keys
2. **Local-First**: Private keys never leave the user's device
3. **Defense in Depth**: Multiple layers of protection (device encryption, sandboxing, future password/WebAuthn)
4. **Transparency**: Open-source key management code, auditable
5. **Portability**: Keys can be exported and imported (nsec format)

---

## Key Types and Lifecycle

### Identity Keypair (Nostr secp256k1)

**Purpose**: Primary identity and encryption key

**Structure**:
- **Private Key**: 32 bytes (256 bits) random entropy
- **Public Key**: 33 bytes (compressed secp256k1 point)
- **Formats**:
  - Private: Hex (64 chars) or nsec (bech32)
  - Public: Hex (64 chars hex) or npub (bech32)

**Lifecycle**:
```
Generate → Store → Use → Export (backup) → Revoke/Delete
    ↓         ↓       ↓           ↓              ↓
  Secure   IndexDB  Sign/    Encrypted       Wipe from
  Random             Encrypt   Backup         Storage
```

**Lifespan**: Indefinite (until user chooses to revoke)

### Ephemeral Keys (NIP-17 Gift Wrap)

**Purpose**: Single-use keys for sender anonymity in NIP-17 messages

**Structure**: Same as identity keypair (secp256k1)

**Lifecycle**:
```
Generate → Use Once → Discard
    ↓          ↓           ↓
  Secure    Sign      Not Stored
  Random    Event     (ephemeral)
```

**Lifespan**: Single message (not persisted)

**Security Property**: Sender unlinkability (relay cannot determine who sent message)

### Conversation Keys (Derived)

**Purpose**: Shared secret for NIP-44 encryption between two parties

**Derivation**:
```typescript
conversationKey = ECDH(privateKey, recipientPubkey)
               = HKDF-SHA256(sharedPoint.x, salt="nip44-v2", info="")
```

**Lifecycle**:
```
Derive → Use → Discard
   ↓       ↓       ↓
 ECDH   Encrypt  Not Stored
       /Decrypt  (re-derived)
```

**Lifespan**: Not stored (re-derived on demand)

**Security Property**: Deterministic (same key pair + recipient always produces same conversation key)

### Group Keys (Derived)

**Purpose**: Shared encryption key for group data

**Derivation**:
```typescript
groupKey = deriveConversationKey(privateKey, groupId)
```

**Lifecycle**:
```
Derive → Use → Discard
   ↓       ↓       ↓
 HKDF  Encrypt  Re-derived
       Group    on demand
       Data
```

**Lifespan**: Not stored (re-derived on demand)

**Security Note**: Simplified group key management. Production systems should use explicit group key distribution with rotation support.

### Media Encryption Keys (Random)

**Purpose**: Per-file encryption for images/videos/documents

**Structure**: AES-256 key (32 bytes)

**Lifecycle**:
```
Generate → Encrypt File → Share Key via NIP-17 → Recipient Decrypts
    ↓           ↓                  ↓                      ↓
 Secure      AES-GCM         Encrypted in         Decrypt File
 Random                      Message Content
```

**Lifespan**: Stored with file metadata, shared via encrypted message

**Distribution**: Key + IV sent via NIP-17 encrypted message

---

## Key Generation

### Implementation Location
- **File**: `/src/core/crypto/keyManager.ts`
- **Library**: `nostr-tools` (generateSecretKey)

### Entropy Source

**WebCrypto API**:
```typescript
crypto.getRandomValues(new Uint8Array(32))
```

**Properties**:
- CSPRNG (Cryptographically Secure Pseudo-Random Number Generator)
- Browser-provided (OS-level entropy)
- 32 bytes = 256 bits of entropy
- Sufficient for secp256k1 private keys

### Key Generation Function

```typescript
import { generateSecretKey, getPublicKey } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'

export function createIdentity(name: string): Identity {
  // Generate 32 random bytes
  const privateKey = generateSecretKey()  // Uint8Array(32)

  // Derive public key (secp256k1 point multiplication)
  const publicKey = getPublicKey(privateKey)

  return {
    publicKey,  // hex string (64 chars)
    npub: nip19.npubEncode(publicKey),  // bech32 format
    privateKey,  // Uint8Array(32)
    name,
    created: Date.now(),
    lastUsed: Date.now(),
  }
}
```

### Validation

**Private Key Validation**:
- Length: Exactly 32 bytes
- Range: 1 ≤ privateKey < secp256k1 curve order (n)
- Library handles validation internally

**Public Key Validation**:
- Length: 64 hex characters (32 bytes)
- Valid secp256k1 point (on curve)
- Derived from private key via point multiplication

---

## Key Storage

### Storage Layers

#### Layer 1: In-Memory (Runtime)

**Location**: Zustand store (`/src/stores/authStore.ts`)

**Format**: Uint8Array (32 bytes)

**Scope**: Current session only

**Lifecycle**:
```
Login → Load from IndexedDB → Store in Zustand → Logout → Clear
```

**Security**:
- ✅ Cleared on logout
- ✅ Not persisted to disk
- ⚠️ Vulnerable to memory dump if device compromised
- ⚠️ Accessible to JavaScript (inherent to web apps)

#### Layer 2: IndexedDB (Persistent)

**Location**: Browser IndexedDB (`/src/core/storage/db.ts`, table: `identities`)

**Format**: Hex-encoded string (64 characters)

**Schema**:
```typescript
{
  publicKey: string,           // hex (primary key)
  encryptedPrivateKey: string, // hex (NOT actually encrypted yet - future enhancement)
  name: string,
  created: number,
  lastUsed: number,
}
```

**Security**:
- ✅ Browser-sandboxed (isolated per-origin)
- ✅ Not accessible to other websites
- ⚠️ Plaintext in IndexedDB (mitigated by browser sandboxing)
- ⚠️ Readable with device access (future: encrypt with password/WebAuthn)

**Access Control**:
- Same-origin policy (browser enforces)
- No cross-site access
- Survives page reloads

#### Layer 3: localStorage (Public Metadata Only)

**Location**: `localStorage` key `auth-storage`

**Stored Data**:
```typescript
{
  currentIdentity: {
    publicKey: string,
    npub: string,
    name: string,
    created: number,
    lastUsed: number,
    // NOTE: privateKey NOT stored here (security)
  }
}
```

**Purpose**: Remember which identity was last used (for UI state restoration)

**Security**:
- ✅ No private keys (only public metadata)
- ✅ Safe to persist
- ⚠️ Reveals identity usage patterns (acceptable)

### Storage Flow

**On Identity Creation**:
```typescript
1. Generate keypair (memory)
2. Store in IndexedDB (hex-encoded)
3. Update Zustand store (in-memory)
4. Update localStorage (public metadata only)
```

**On Login/Session Restore**:
```typescript
1. Read publicKey from localStorage (last used identity)
2. Load full identity from IndexedDB
3. Decode hex → Uint8Array
4. Store in Zustand (in-memory)
5. Use for signing/encryption
```

**On Logout**:
```typescript
1. Clear Zustand store (privateKey removed from memory)
2. Keep localStorage (public metadata for next session)
3. Keep IndexedDB (persistent identity storage)
```

**On Identity Delete**:
```typescript
1. Remove from IndexedDB
2. Clear Zustand if current identity
3. Update localStorage
```

---

## Key Import/Export

### Export Formats

#### nsec (Nostr bech32)
**Format**: `nsec1...` (63 characters)

**Encoding**: bech32 encoding of private key bytes

**Usage**: Standard Nostr private key format (portable across Nostr clients)

**Example**:
```typescript
import * as nip19 from 'nostr-tools/nip19'

const nsec = nip19.nsecEncode(privateKey)
// nsec1qpzry9x8gf2tvdw0s3jn54khce6mua7lmqqqxw4qqqqqqqqqqqqqp3r7zh
```

**Export Function**:
```typescript
export function exportToNsec(privateKey: Uint8Array): string {
  return nip19.nsecEncode(privateKey)
}
```

#### Hex (Raw)
**Format**: 64-character hex string

**Usage**: Direct byte representation (for technical users)

**Example**:
```typescript
import { bytesToHex } from '@noble/hashes/utils'

const hexKey = bytesToHex(privateKey)
// e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

### Import from nsec

**Function**:
```typescript
import * as nip19 from 'nostr-tools/nip19'

export function importFromNsec(nsec: string, name: string): Identity {
  // Decode nsec
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec format')
  }

  const privateKey = decoded.data as Uint8Array
  const publicKey = getPublicKey(privateKey)

  return {
    publicKey,
    npub: nip19.npubEncode(publicKey),
    privateKey,
    name,
    created: Date.now(),
    lastUsed: Date.now(),
  }
}
```

**Validation**:
- ✅ Verify nsec prefix
- ✅ Decode bech32
- ✅ Validate key length (32 bytes)
- ✅ Derive public key and verify on-curve

**Error Handling**:
- Invalid format → Throw error
- Wrong length → Throw error
- Invalid key → Throw error (from getPublicKey)

### Backup Recommendations

**For Users**:
1. **Export nsec** immediately after creation
2. **Store securely**:
   - Password manager (1Password, Bitwarden, KeePassXC)
   - Encrypted USB drive
   - Paper wallet (written/printed, stored in safe)
3. **Multiple backups** (geographically distributed)
4. **Test recovery** before relying on backup

**For High-Risk Users**:
1. **Paper wallet only** (no digital storage)
2. **Encrypted backup** (GPG-encrypted file)
3. **Split backup** (Shamir's Secret Sharing - future)
4. **Hardware wallet** (NIP-46 support - future)

---

## Key Usage

### Signing (Nostr Events)

**Use Case**: Authenticate Nostr events (posts, messages, etc.)

**Implementation**:
```typescript
import { finalizeEvent } from 'nostr-tools'

const event = {
  kind: 1,  // text note
  content: "Hello world",
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
}

const signedEvent = finalizeEvent(event, privateKey)
// Adds: id (SHA256), pubkey, sig (schnorr signature)
```

**Algorithm**:
- **Hash**: SHA-256 of event serialization
- **Signature**: Schnorr signature (secp256k1)
- **Verification**: Public key verifies signature

**Security**:
- ✅ Non-repudiation (only holder of private key can sign)
- ✅ Integrity (event cannot be modified without breaking signature)
- ⚠️ No forward secrecy (key compromise = all signatures verifiable)

### Encryption (NIP-44)

**Use Case**: Encrypt message content

**Implementation**:
```typescript
import * as nip44 from 'nostr-tools/nip44'

// Derive conversation key
const conversationKey = nip44.v2.utils.getConversationKey(
  senderPrivateKey,
  recipientPubkey
)

// Encrypt
const ciphertext = nip44.v2.encrypt(plaintext, conversationKey)

// Decrypt
const plaintext = nip44.v2.decrypt(ciphertext, conversationKey)
```

**Algorithm**:
- **Key Derivation**: ECDH + HKDF-SHA256
- **Cipher**: ChaCha20-Poly1305
- **Nonce**: Random (24 bytes)
- **MAC**: Poly1305 (integrated in AEAD)

**Security**:
- ✅ Confidentiality (only sender and recipient can decrypt)
- ✅ Authenticity (MAC prevents tampering)
- ⚠️ No forward secrecy (key compromise = all messages readable)

### Key Derivation (Groups)

**Use Case**: Derive group-specific encryption keys

**Implementation**:
```typescript
function deriveGroupKey(privateKey: Uint8Array, groupId: string): Uint8Array {
  // Use groupId as pseudo-pubkey for ECDH
  return nip44.v2.utils.getConversationKey(privateKey, groupId)
}
```

**Security Note**: Simplified approach. Production systems should use proper group key management with:
- Explicit group key generation by admin
- Key distribution via encrypted messages
- Key rotation on member removal
- Support for forward secrecy

---

## Key Rotation

### Current Status

**Status**: Not implemented (manual rotation only)

**Limitations**:
- No automatic rotation
- No forward secrecy
- Key compromise = all messages readable

### Manual Rotation Process

**Steps**:
1. User creates new identity keypair
2. Announces new pubkey (via old key)
3. Migrates groups and data to new key
4. Revokes old key
5. Securely deletes old private key

**Challenges**:
- All contacts must update pubkey
- Past messages still encrypted with old key
- Complex migration process

### Future: Automatic Rotation

**Planned Features** (Epic 7-8):
1. **Periodic Rotation**: Rotate keys every N days/months
2. **Event-Based Rotation**: Rotate after sensitive actions
3. **Compromise Response**: Emergency rotation if key suspected compromised
4. **Key History**: Maintain old keys for decrypting past messages (with expiration)
5. **Forward Secrecy**: Implement Noise Protocol with ratcheting

**Implementation Path**:
```
1. Implement key rotation protocol
2. Add UI for key rotation
3. Notify contacts of new pubkey (NIP-05)
4. Migrate group memberships
5. Set expiration for old keys
6. Delete old keys after grace period
```

---

## Key Recovery

### Recovery Scenarios

#### Scenario 1: Device Loss (With Backup)

**Precondition**: User has nsec backup

**Recovery Steps**:
1. Install app on new device
2. Import nsec via "Import Identity" flow
3. Restore access to all groups and messages

**Data Preserved**:
- ✅ Identity (public key remains same)
- ✅ Group memberships (re-sync from relays)
- ✅ Messages (re-fetch from relays)
- ⚠️ Local-only data lost (if not synced to relays)

#### Scenario 2: Device Loss (No Backup)

**Precondition**: User did not backup nsec

**Outcome**:
- ❌ Identity lost (cannot recover private key)
- ❌ Cannot access encrypted messages
- ❌ Cannot prove identity ownership

**Mitigation**:
- User must create new identity
- Rejoin groups (as new member)
- Past messages unrecoverable

**Prevention**:
- Prompt for backup on first use
- Require backup before accessing sensitive groups
- Periodic backup reminders

#### Scenario 3: Corrupted IndexedDB

**Precondition**: IndexedDB data corrupted (rare browser bug)

**Recovery Steps**:
1. Import nsec from backup
2. App recreates IndexedDB entry
3. Normal operation restored

**Data Preserved**:
- ✅ Identity (restored from nsec)
- ✅ Groups and messages (re-sync from relays)

### Recovery Best Practices

**For Users**:
1. **Immediate Backup**: Export nsec after creation
2. **Test Recovery**: Import backup on second device to verify
3. **Multiple Backups**: Password manager + paper wallet
4. **Secure Storage**: Never share nsec, never store in plaintext files

**For Administrators**:
1. **Backup Enforcement**: Require backup before joining high-risk groups
2. **Recovery Plan**: Document recovery procedures
3. **Key Escrow** (optional): Multi-sig recovery for critical admin keys

---

## Security Considerations

### Current Protections

✅ **Browser Sandboxing**
- IndexedDB isolated per-origin
- Cross-site access prevented
- Same-origin policy enforced

✅ **Secure Random Generation**
- WebCrypto CSPRNG
- OS-level entropy pool
- Sufficient entropy (256 bits)

✅ **Memory Isolation**
- Keys cleared from memory on logout
- No unnecessary copies
- Zustand store clears on unmount

✅ **No Server-Side Storage**
- Private keys never transmitted
- Local-first architecture
- Zero-knowledge server design

### Current Limitations

⚠️ **Plaintext in IndexedDB**
- Keys stored hex-encoded (not encrypted)
- Readable with device access
- Mitigated by browser sandboxing

⚠️ **No Password Protection**
- Keys not encrypted with user password
- Device access = key access
- Future: PBKDF2-based key encryption

⚠️ **No Hardware Security**
- Keys in software only
- No secure enclave usage
- Future: WebAuthn, NIP-46 hardware wallets

⚠️ **No Forward Secrecy**
- Key compromise = all messages readable
- No ratcheting
- Future: Noise Protocol implementation

⚠️ **JavaScript Access**
- Keys accessible to JavaScript code
- Vulnerable to XSS (mitigated by CSP)
- Inherent to web app model

### Threat Model

**Protected Against**:
- ✅ Network eavesdropping (TLS + E2E encryption)
- ✅ Relay compromise (keys never sent to relay)
- ✅ Cross-site attacks (same-origin policy)
- ✅ Man-in-the-middle (cryptographic signatures)

**NOT Protected Against**:
- ❌ Physical device access (keys in plaintext in IndexedDB)
- ❌ Malicious browser extensions (can access IndexedDB)
- ❌ XSS if CSP bypassed (can read keys from memory)
- ❌ Malware on device (keylogger, screen capture)

---

## Future Enhancements

### Short-Term (Phase 2)

#### 1. Password-Based Key Encryption

**Concept**: Encrypt private keys with user password before storing in IndexedDB

**Implementation**:
```typescript
// Derive encryption key from password
const keyMaterial = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(password),
  "PBKDF2",
  false,
  ["deriveBits", "deriveKey"]
)

const encryptionKey = await crypto.subtle.deriveKey(
  {
    name: "PBKDF2",
    salt: randomSalt,
    iterations: 600000,  // OWASP recommendation
    hash: "SHA-256",
  },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
)

// Encrypt private key
const iv = crypto.getRandomValues(new Uint8Array(12))
const encryptedKey = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  encryptionKey,
  privateKey
)

// Store: salt, iv, encryptedKey in IndexedDB
```

**Benefits**:
- Private keys encrypted at rest
- Requires password to decrypt
- Survives device seizure (if strong password)

**Trade-offs**:
- User must remember password
- Password recovery impossible (by design)
- Performance cost (PBKDF2 iterations)

#### 2. WebAuthn-Protected Keys

**Concept**: Require biometric/security key to decrypt private keys

**Implementation**:
```typescript
// Encrypt key with WebAuthn credential
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: randomChallenge,
    rp: { name: "BuildIt Network" },
    user: { id: userId, name: userName, displayName: userName },
    pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
    },
  },
})

// Use credential to encrypt/decrypt private key
// Requires biometric on each decryption
```

**Benefits**:
- Strong protection even with device access
- Biometric required to decrypt
- Hardware-backed security

**Trade-offs**:
- Requires WebAuthn support
- Not portable (tied to device)
- Backup complexity

### Medium-Term (Phase 3)

#### 3. NIP-46 Hardware Wallet Support

**Concept**: Private keys stored on hardware wallet, signing delegated

**Implementation**:
- Use NIP-46 remote signing protocol
- Private key never leaves hardware wallet
- App requests signatures via protocol

**Benefits**:
- Maximum security (keys in tamper-resistant hardware)
- Physical confirmation required
- Survives malware and device seizure

**Trade-offs**:
- Requires hardware device
- Higher friction (physical interaction)
- Cost (hardware wallet purchase)

#### 4. Multi-Device Sync

**Concept**: Encrypted key sync across multiple devices

**Implementation**:
- Encrypt private key with device-specific key
- Sync via encrypted relay storage
- Decrypt on second device with user password

**Benefits**:
- Seamless multi-device experience
- No manual import/export

**Trade-offs**:
- Complexity of secure sync
- Trust in relay for encrypted storage
- Backup still needed

### Long-Term (Phase 4)

#### 5. Social Recovery (Multi-Sig)

**Concept**: Split key among trusted contacts, recover with M-of-N

**Implementation** (Shamir's Secret Sharing):
```typescript
// Split key into 5 shares, require 3 to recover
const shares = splitSecret(privateKey, 5, 3)

// Distribute to 5 trusted contacts
// Recovery: Collect 3 shares, reconstruct key
```

**Benefits**:
- Recover from lost key with help of contacts
- No single point of failure
- Trusted by community

**Trade-offs**:
- Requires trusted contacts
- Complex recovery process
- Coordination required

#### 6. Forward Secrecy (Noise Protocol)

**Concept**: Ratcheting keys for forward secrecy

**Implementation**: See ENCRYPTION_STRATEGY.md (Phase 2)

**Benefits**:
- Key compromise doesn't reveal past messages
- Post-compromise security

**Trade-offs**:
- Complex state management
- Performance overhead
- Not yet implemented

---

## References

1. [ENCRYPTION_IMPLEMENTATION.md](./ENCRYPTION_IMPLEMENTATION.md) - Complete encryption documentation
2. [PRIVACY.md](../PRIVACY.md) - Threat model and security considerations
3. [NIP-19 Specification](https://github.com/nostr-protocol/nips/blob/master/19.md) - nsec/npub encoding
4. [NIP-46 Specification](https://github.com/nostr-protocol/nips/blob/master/46.md) - Remote signing (hardware wallets)
5. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
6. [WebAuthn Specification](https://www.w3.org/TR/webauthn/)

---

**Document Status**: Production-ready, security audit pending
**Last Audit**: None (external audit scheduled - see Epic 30)
**Next Review**: After external security audit completion
