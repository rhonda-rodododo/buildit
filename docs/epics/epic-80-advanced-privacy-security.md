# Epic 80: Advanced Privacy & Security Features

**Status**: Not Started
**Priority**: P2 - Security Hardening
**Effort**: 35-50 hours
**Platforms**: All (crypto library + all clients)
**Dependencies**: Epic 73 (Schema Versioning) recommended first

---

## Context

The security audit (completed 2026-02-05) addressed ~76 findings across all platforms. However, several advanced privacy features described in `docs/PRIVACY.md` remain as future work: WebAuthn-protected keys, message batching/padding, dummy traffic generation, ephemeral messages, multi-sig group keys, and QR code signing. These features represent the next tier of privacy hardening against state-level adversaries.

**Sources**:
- `docs/PRIVACY.md` (lines 64-66, 136, 138, 176, 241, 265, 305)
- `clients/web/docs/TECH_DEBT.md` - Cryptographic Features section

---

## Tasks

### QR Code Security (4-6h)

#### QR Data Signing
- [ ] Sign QR code data with user's private key before encoding
- [ ] Include signature in QR payload
- [ ] Prevents QR spoofing attacks (e.g., MITM friend-add)
- **File**: `clients/web/src/modules/friends/AddFriendDialog.tsx`

#### QR Signature Verification
- [ ] Verify QR signature on scan using sender's public key
- [ ] Reject QR codes with invalid/missing signatures
- [ ] Show verification status in UI
- **File**: `clients/web/src/modules/friends/AddFriendDialog.tsx`

### Key Protection (8-10h)

#### WebAuthn-Protected Keys
- [ ] Integrate WebAuthn API for biometric/hardware key protection
- [ ] Support platform authenticators (Touch ID, Face ID, Windows Hello)
- [ ] Support roaming authenticators (YubiKey, etc.)
- [ ] Encrypt private key with WebAuthn-derived secret
- [ ] Handle authenticator enrollment and management
- **File**: Referenced in `docs/PRIVACY.md`

### Traffic Analysis Resistance (10-14h)

#### Message Batching and Padding
- [ ] Batch outgoing messages to fixed intervals (configurable)
- [ ] Pad messages to uniform size (prevent size-based analysis)
- [ ] Implement padding scheme compatible with NIP-44
- [ ] Handle batch timing across multiple conversations
- **File**: Referenced in `docs/PRIVACY.md`

#### Dummy Traffic Generation
- [ ] Generate dummy Nostr events at configurable intervals
- [ ] Dummy events indistinguishable from real traffic to relay
- [ ] Configurable traffic volume (low/medium/high/off)
- [ ] Dummy events discarded by recipients via protocol flag
- [ ] Battery-aware scheduling (reduce on low battery)
- **File**: Referenced in `docs/PRIVACY.md`

### Message Lifecycle (6-8h)

#### Ephemeral Messages
- [ ] Implement self-destructing messages with configurable TTL
- [ ] Timer starts on read (not send)
- [ ] Secure deletion from local storage on expiry
- [ ] Handle edge cases: offline recipient, multi-device
- [ ] UI indicators for ephemeral messages (timer countdown)
- [ ] Protocol extension in `protocol/schemas/`
- **File**: Referenced in `docs/PRIVACY.md`

### Group Key Management (8-12h)

#### Multi-Sig Group Keys
- [ ] Implement threshold signatures for group key management
- [ ] M-of-N required to rotate group keys
- [ ] Distribute key shares via NIP-17
- [ ] Handle member addition/removal key rotation
- [ ] Audit log for key management actions
- [ ] Protocol extension in `protocol/schemas/`
- **File**: Referenced in `docs/PRIVACY.md`

---

## Acceptance Criteria

- [ ] QR codes include cryptographic signatures, verified on scan
- [ ] WebAuthn protects private keys on supported devices
- [ ] Messages are batched and padded to resist traffic analysis
- [ ] Dummy traffic generated at configurable levels
- [ ] Ephemeral messages auto-delete after read + TTL
- [ ] Group keys require M-of-N signatures to rotate
- [ ] All features documented in PRIVACY.md
- [ ] Test vectors added for new protocol extensions

---

## Privacy & Threat Model

These features address specific threats from `docs/THREAT_MODEL.md`:
- **QR signing**: Prevents MITM during key exchange
- **WebAuthn**: Protects against device theft (keys locked to biometric)
- **Message batching/padding**: Defeats traffic analysis by ISP/state actors
- **Dummy traffic**: Defeats activity correlation ("when do they message")
- **Ephemeral messages**: Reduces exposure window for seized devices
- **Multi-sig keys**: Prevents single-point-of-compromise for groups

---

## Technical Notes

- WebAuthn requires HTTPS context (works in Tauri via localhost)
- Dummy traffic must be relay-aware (don't flood relays, use appropriate event kinds)
- Ephemeral message deletion must use secure overwrite, not just DB delete
- Multi-sig likely requires Musig2 or FROST scheme for Schnorr compatibility

---

**Git Commit Format**: `feat(security): implement advanced privacy features (Epic 80)`
**Git Tag**: `v0.80.0-advanced-privacy`
