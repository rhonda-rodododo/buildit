# 01. Protocol Overview

## Design Principles

### 1. Offline-First
BLE mesh is the primary transport. Internet connectivity via Nostr relays is a fallback, not a requirement.

### 2. Privacy by Design
- End-to-end encryption for all messages
- Metadata protection via NIP-17 gift wrapping
- No centralized servers or user tracking

### 3. Interoperability
All implementations (iOS, Android, Desktop) must be fully interoperable:
- Same BLE service UUIDs and characteristics
- Byte-compatible message framing
- Identical crypto parameters

### 4. Security
- Hardware-backed key storage (Secure Enclave, StrongBox, TPM)
- Biometric authentication
- Forward secrecy via ephemeral keys

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  Chat, Groups, Modules, Settings, Device Sync                  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                      TRANSPORT ROUTER                          │
│  Priority-based routing, failover, store-and-forward          │
└─────────────────────────────┬─────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│   BLE Mesh    │    │ Nostr Relays  │    │  Future       │
│   (Primary)   │    │  (Fallback)   │    │  (LoRa, etc)  │
└───────────────┘    └───────────────┘    └───────────────┘
        │                     │
        │                     │
┌───────▼─────────────────────▼─────────────────────────────────┐
│                      CRYPTO LAYER                              │
│  NIP-44 encryption, NIP-17 gift wrap, key derivation          │
└───────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┴─────────────────────────────────┐
│                      STORAGE LAYER                             │
│  Encrypted database, secure keystore, offline queue           │
└───────────────────────────────────────────────────────────────┘
```

## Component Overview

### BLE Mesh Layer
- Service-based communication using GATT
- Central + Peripheral mode for all devices
- Multi-hop routing with TTL
- Store-and-forward for offline peers
- Automatic peer discovery and reconnection

### Nostr Relay Layer
- WebSocket connections to relay servers
- NIP-17 gift-wrapped messages
- Subscription-based event filtering
- Multi-relay redundancy

### Transport Router
- Priority: BLE > Nostr
- Automatic failover on transport failure
- Message queue for offline operation
- Deduplication across transports

### Crypto Layer
- NIP-44: ChaCha20-Poly1305 encryption
- NIP-17: Gift wrap for metadata protection
- PBKDF2: Password-based key derivation
- HKDF: Key expansion and derivation
- secp256k1: Nostr identity keys

### Storage Layer
- Encrypted local database
- Secure keystore (platform-specific)
- Offline message queue
- Cache with LRU eviction

## Message Flow

### Sending a Message

```
1. Application creates message content
2. Crypto layer encrypts with NIP-44
3. Crypto layer wraps with NIP-17 (gift wrap)
4. Transport router selects transport:
   a. If BLE available → send via mesh
   b. Else if online → send via Nostr relay
   c. Else → queue for later
5. On success, update delivery status
6. On failure, try failover or queue
```

### Receiving a Message

```
1. Transport receives encrypted event
2. Deduplicator checks if already processed
3. Crypto layer unwraps gift wrap
4. Crypto layer decrypts content
5. Application processes message
6. Storage persists message
7. UI updates
```

## Platform Support

| Platform | BLE | Crypto | UI |
|----------|-----|--------|-----|
| iOS | Core Bluetooth | Rust via UniFFI | SwiftUI |
| Android | Android BLE API | Rust via UniFFI | Jetpack Compose |
| Desktop | btleplug | Native Rust | Tauri + Web |

## Related Specifications

### Core Protocol
- [02-ble-mesh.md](./02-ble-mesh.md) - BLE mesh networking
- [03-transport.md](./03-transport.md) - Transport layer
- [04-cryptography.md](./04-cryptography.md) - Cryptographic protocols
- [05-nostr-extensions.md](./05-nostr-extensions.md) - Nostr protocol extensions
- [06-device-sync.md](./06-device-sync.md) - Device synchronization
- [07-message-types.md](./07-message-types.md) - Message format specification

### Schema & Versioning
- [08-schema-versioning.md](./08-schema-versioning.md) - Schema versioning & cross-client compatibility
- [09-schema-codegen.md](./09-schema-codegen.md) - Code generation from JSON Schema
- [10-version-negotiation.md](./10-version-negotiation.md) - Cross-version negotiation protocol
- [11-client-implementation-guide.md](./11-client-implementation-guide.md) - Platform implementation guide
- [12-migration-guide.md](./12-migration-guide.md) - Schema migration procedures

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-25 | Initial specification |
| 1.1.0 | 2026-01-25 | Added schema versioning spec (08) |
| 1.2.0 | 2026-01-25 | Added codegen, negotiation, implementation, migration specs (09-12) |
