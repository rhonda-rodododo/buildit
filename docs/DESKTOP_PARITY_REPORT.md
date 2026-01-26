# Desktop App Parity Report

> Comprehensive analysis of the BuildIt Desktop (Tauri) application compared to mobile apps and protocol specifications.

**Date**: 2026-01-25
**Version**: 0.1.0

## Executive Summary

The BuildIt Desktop application is a mature Tauri-based app that embeds the web client UI and provides native Rust backend capabilities. This report documents:

1. **Crypto command parity** - Gap analysis between desktop and mobile crypto capabilities
2. **Module parity** - Feature comparison across platforms
3. **Protocol compliance** - Adherence to schema specifications
4. **Recommended improvements** - Action items for full parity

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS                              │
├─────────────────────┬─────────────────┬─────────────────────────┤
│   Desktop (Tauri)   │      iOS        │       Android           │
│   ┌───────────────┐ │   Swift/SwiftUI │   Kotlin/Compose        │
│   │ clients/web/  │ │   10 modules    │   11 modules            │
│   │ 21 modules    │ │                 │                         │
│   └───────────────┘ │   Core BT BLE   │   Android BLE           │
│   btleplug BLE      │   UniFFI crypto │   UniFFI crypto         │
└─────────────────────┴─────────────────┴─────────────────────────┘
```

---

## 1. Crypto Command Parity Analysis

### Commands Previously Available in Desktop

| Command | Description | Status |
|---------|-------------|--------|
| `store_secret` | Store secret in OS keyring | ✅ |
| `retrieve_secret` | Retrieve secret from keyring | ✅ |
| `delete_secret` | Delete secret from keyring | ✅ |
| `has_secret` | Check if secret exists | ✅ |
| `generate_keypair` | Generate secp256k1 keypair | ✅ |
| `encrypt_nip44` | NIP-44 ChaCha20-Poly1305 encryption | ✅ |
| `decrypt_nip44` | NIP-44 decryption | ✅ |
| `derive_conversation_key` | ECDH + HKDF conversation key | ✅ |
| `sign_nostr_event` | Sign Nostr event | ✅ |
| `verify_nostr_event` | Verify Nostr event signature | ✅ |
| `gift_wrap_message` | NIP-17 gift wrap | ✅ |
| `unwrap_gift_message` | NIP-17 unwrap | ✅ |

### Commands Added for Parity (NEW)

| Command | Description | Priority |
|---------|-------------|----------|
| `derive_master_key` | Argon2id password-based KDF | **Critical** |
| `derive_database_key` | HKDF database key derivation | **Critical** |
| `aes_encrypt` | AES-256-GCM storage encryption | **Critical** |
| `aes_decrypt` | AES-256-GCM decryption | **Critical** |
| `schnorr_sign` | BIP-340 Schnorr signature | Medium |
| `schnorr_verify` | Schnorr signature verification | Medium |
| `compute_event_id` | SHA-256 event ID computation | Medium |
| `hash_duress_password` | Duress password hashing | High |
| `check_duress_password` | Duress activation check | High |
| `validate_duress_password` | Validate duress vs normal | High |
| `generate_decoy_identity` | Generate fake identity | High |
| `generate_decoy_contacts` | Generate fake contacts | High |
| `generate_decoy_messages` | Generate fake messages | High |
| `create_duress_alert` | Send silent coercion alert | High |
| `create_duress_alerts` | Multi-recipient alerts | High |
| `secure_destroy_key` | Cryptographic key shredding | High |
| `generate_salt` | Generate random salt | Medium |
| `randomize_timestamp` | Privacy timestamp randomization | Medium |
| `get_public_key_from_private` | Derive pubkey from privkey | Medium |

### Still Missing (Future Work)

| Feature | Description | Notes |
|---------|-------------|-------|
| `RatchetSession` | Double Ratchet forward secrecy | Complex stateful interface |

---

## 2. Module Parity Analysis

### Feature Modules Comparison

| Module | Web/Desktop | iOS | Android | Notes |
|--------|-------------|-----|---------|-------|
| **Core Messaging** | ✅ | ✅ | ✅ | NIP-17 encrypted DMs, group chat |
| **Events** | ✅ | ✅ | ✅ | RSVP, campaigns, calendar |
| **Governance** | ✅ | ✅ | ✅ | Proposals, voting systems |
| **Mutual Aid** | ✅ | ✅ | ✅ | Requests, offers, rideshare |
| **Wiki** | ✅ | ✅ | ✅ | Knowledge base, version control |
| **Forms** | ✅ | ✅ | ✅ | Form builder, responses |
| **Fundraising** | ✅ | ✅ | ✅ | Campaigns, donations |
| **Publishing** | ✅ | ✅ | ✅ | Articles, long-form content |
| **Newsletters** | ✅ | ✅ | ✅ | Nostr DM-based delivery |
| **Contact Notes** | ✅ | ✅ | ✅ | Notes and tags on contacts |
| **Documents** | ✅ | ❌ | ❌ | WYSIWYG editor |
| **Files** | ✅ | ❌ | ❌ | Encrypted file storage |
| **CRM** | ✅ | ❌ | ❌ | Contact management |
| **Database** | ✅ | ❌ | ❌ | Airtable-like data |
| **Custom Fields** | ✅ | ❌ | ❌ | Dynamic field system |
| **Microblogging** | ✅ | ❌ | ❌ | Nostr kind 1 posts |
| **Social/Friends** | ✅ | ❌ | ❌ | Friend system |
| **Hotlines** | ✅ | ❌ | ❌ | Crisis support |
| **Security** | ✅ | ❌ | ❌ | Duress mode (now enabled) |

### Infrastructure Comparison

| Feature | Desktop | iOS | Android |
|---------|---------|-----|---------|
| BLE Mesh | ✅ btleplug | ✅ Core BT | ✅ Android BLE |
| Nostr Relays | ✅ WebSocket | ✅ URLSession | ✅ OkHttp |
| Secure Storage | ✅ OS Keyring | ✅ Keychain | ✅ Keystore |
| Offline Support | ✅ IndexedDB | ✅ SwiftData | ✅ Room |
| Deep Links | ✅ buildit:// | ✅ Universal | ✅ App Links |
| System Tray | ✅ | N/A | N/A |

---

## 3. Protocol Schema Compliance

### Schema Registry Status

All modules use schema version 1.0.0 with the following compliance:

| Schema | Desktop | iOS | Android | Codegen |
|--------|---------|-----|---------|---------|
| messaging/v1 | ✅ | ✅ | ✅ | quicktype |
| events/v1 | ✅ | ✅ | ✅ | quicktype |
| governance/v1 | ✅ | ✅ | ✅ | quicktype |
| mutual-aid/v1 | ✅ | ✅ | ✅ | quicktype |
| wiki/v1 | ✅ | ✅ | ✅ | quicktype |
| documents/v1 | ✅ | ❌ | ❌ | quicktype |
| files/v1 | ✅ | ❌ | ❌ | quicktype |
| forms/v1 | ✅ | ✅ | ✅ | quicktype |
| crm/v1 | ✅ | ❌ | ❌ | quicktype |
| database/v1 | ✅ | ❌ | ❌ | quicktype |
| fundraising/v1 | ✅ | ✅ | ✅ | quicktype |
| publishing/v1 | ✅ | ✅ | ✅ | quicktype |
| newsletters/v1 | ✅ | ✅ | ✅ | quicktype |
| custom-fields/v1 | ✅ | ❌ | ❌ | quicktype |

### Nostr Event Kind Allocations

| Module | Kind Range | Status |
|--------|-----------|--------|
| Events | 40001-40009 | ✅ Implemented |
| Documents | 40011-40019 | ✅ Desktop only |
| Files | 40021-40029 | ✅ Desktop only |
| Forms | 40031-40039 | ✅ All platforms |
| CRM | 40041-40049 | ✅ Desktop only |
| Database | 40051-40059 | ✅ Desktop only |
| Fundraising | 40061-40069 | ✅ All platforms |
| Publishing | 40071-40079 | ✅ All platforms |
| Newsletters | 40081-40089 | ✅ All platforms |
| Governance | 40091-40099 | ✅ All platforms |
| Mutual Aid | 40101-40109 | ✅ All platforms |
| Wiki | 40111-40119 | ✅ All platforms |

---

## 4. Security Features Status

### Cryptographic Guarantees

| Feature | Desktop | iOS | Android | Notes |
|---------|---------|-----|---------|-------|
| NIP-44 Encryption | ✅ | ✅ | ✅ | ChaCha20-Poly1305 |
| NIP-17 Gift Wrap | ✅ | ✅ | ✅ | Metadata protection |
| Argon2id KDF | ✅ NEW | ✅ | ✅ | 64MB, 3 iter, 4 par |
| AES-256-GCM | ✅ NEW | ✅ | ✅ | Local storage encryption |
| Duress Mode | ✅ NEW | ❌ | ❌ | Coercion resistance |
| Forward Secrecy | ❌ | ✅ | ✅ | Double Ratchet pending |

### Privacy Features

| Feature | Status | Description |
|---------|--------|-------------|
| Ephemeral Keys | ✅ | Per-message ephemeral keys in NIP-17 |
| Timestamp Randomization | ✅ NEW | ±2 days for metadata privacy |
| BLE UUID Rotation | ✅ | Daily UUID rotation |
| Identity Commitments | ✅ | H(pubkey \|\| nonce) in BLE |
| Tor Integration | ✅ | 11+ .onion relays |

---

## 5. Build System Status

### Desktop Build Requirements

**Linux**:
```bash
# Required packages
apt install libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \
    libappindicator3-dev librsvg2-dev patchelf libsoup-3.0-dev
```

**macOS**:
```bash
# Xcode Command Line Tools required
xcode-select --install
```

**Windows**:
```powershell
# WebView2 and Visual C++ Build Tools required
```

### Build Commands

```bash
# Development
cd clients/desktop && cargo tauri dev

# Production
cargo tauri build

# Platform-specific
cargo tauri build --target aarch64-apple-darwin   # macOS ARM
cargo tauri build --target x86_64-apple-darwin    # macOS Intel
cargo tauri build --target x86_64-pc-windows-msvc # Windows
cargo tauri build --target x86_64-unknown-linux-gnu # Linux
```

---

## 6. Recommendations

### Immediate Actions

1. **Verify build on all platforms** - The crypto commands have been added; verify compilation on macOS/Windows
2. **Add TypeScript types** - Update `clients/web/src/lib/tauri/types.ts` with new command signatures
3. **Integration tests** - Add Tauri-specific E2E tests for new crypto commands

### Future Work

1. **RatchetSession Interface** - Implement Double Ratchet for desktop (complex stateful API)
2. **Mobile Module Parity** - Consider adding Documents, Files, CRM, Database to mobile
3. **Biometric Authentication** - Add Touch ID/Face ID support via Tauri plugins

### Testing Requirements

- [ ] Argon2id key derivation correctness
- [ ] AES-256-GCM encryption/decryption roundtrip
- [ ] Duress mode activation and alert sending
- [ ] Cross-platform keyring storage
- [ ] BLE mesh message routing

---

## 7. File Changes Summary

### Modified Files

| File | Changes |
|------|---------|
| `clients/desktop/src/commands/crypto_commands.rs` | Added 19 new Tauri commands |
| `clients/desktop/src/lib.rs` | Registered new commands in invoke handler |

### New Commands Added

```rust
// Key derivation
derive_master_key        // Argon2id password KDF
derive_database_key      // HKDF database key

// AES encryption
aes_encrypt              // AES-256-GCM encrypt
aes_decrypt              // AES-256-GCM decrypt

// Signatures
schnorr_sign             // BIP-340 signature
schnorr_verify           // Signature verification
compute_event_id         // SHA-256 event ID

// Duress system
hash_duress_password     // Hash duress password
check_duress_password    // Check if duress activated
validate_duress_password // Validate password difference
generate_decoy_identity  // Generate fake identity
generate_decoy_contacts  // Generate fake contacts
generate_decoy_messages  // Generate fake messages
create_duress_alert      // Send silent alert
create_duress_alerts     // Multi-recipient alerts
secure_destroy_key       // Cryptographic key shredding

// Utilities
generate_salt            // Random salt generation
randomize_timestamp      // Privacy timestamp
get_public_key_from_private // Derive pubkey
```

---

## Appendix A: Test Vectors

All crypto operations should pass test vectors from `protocol/test-vectors/`:

- `encryption.json` - NIP-44 encryption
- `nip17/gift-wrap.json` - NIP-17 wrapping
- `events/signing.json` - Nostr event signing
- `ble/chunking.json` - BLE message chunking

## Appendix B: Related Documentation

- `clients/desktop/CLAUDE.md` - Desktop development guide
- `clients/web/CLAUDE.md` - Web client guide
- `packages/crypto/README.md` - Crypto library documentation
- `protocol/schemas/` - Schema definitions
- `docs/protocol-spec/` - Protocol specifications
