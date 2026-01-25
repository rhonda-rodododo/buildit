# BuildIt Android Architecture

## Overview

BuildIt Android follows Clean Architecture principles with MVVM pattern for the presentation layer.

## Module Structure

```
app/
├── core/                 # Core business logic
│   ├── ble/             # BLE mesh networking
│   ├── crypto/          # Cryptographic operations
│   ├── nostr/           # Nostr protocol client
│   ├── transport/       # Multi-transport routing
│   └── storage/         # Room database
├── features/            # Feature modules (screens)
│   ├── chat/            # Messaging feature
│   ├── groups/          # Group management
│   ├── devicesync/      # Device synchronization
│   └── settings/        # App settings
├── ui/                  # Shared UI components
│   ├── theme/           # Material 3 theming
│   └── components/      # Reusable composables
└── di/                  # Hilt modules
```

## Core Components

### BLE Mesh (`core/ble/`)

Handles Bluetooth Low Energy mesh networking for offline communication.

```
BLEManager
├── GattServer          # Accepts incoming connections
├── GattClient          # Connects to peers
├── AdvertisingManager  # BLE advertising
├── MeshRouter          # Multi-hop routing
└── PeerDiscovery       # Discovers nearby devices
```

**Key Files:**
- `BLEManager.kt` - Main entry point, manages BLE lifecycle
- `BLEService.kt` - Foreground service for background operation
- `MeshMessage.kt` - Message format for BLE transmission

### Crypto (`core/crypto/`)

Wraps the buildit-crypto Rust library for cryptographic operations.

```
CryptoManager
├── NIP-44 encryption/decryption
├── NIP-17 gift wrap/unwrap
├── Event signing/verification
└── Key derivation

KeystoreManager
├── Android Keystore integration
├── Biometric authentication
├── Device sync export/import
└── StrongBox HSM support
```

**Key Files:**
- `CryptoManager.kt` - High-level crypto API
- `KeystoreManager.kt` - Android Keystore operations
- `uniffi/buildit_crypto/BuilditCrypto.kt` - FFI bindings

### Nostr (`core/nostr/`)

Implements the Nostr protocol for relay-based messaging.

```
NostrClient
├── WebSocket connection management
├── Multi-relay support
├── Event publishing
├── Subscription management
└── NIP-01, NIP-04, NIP-17, NIP-44 support
```

**Key Files:**
- `NostrClient.kt` - Main Nostr client
- `NostrEvent.kt` - Event data structures
- `NostrFilter.kt` - Subscription filters

### Transport Router (`core/transport/`)

Coordinates message routing across multiple transports.

```
TransportRouter
├── Transport selection (BLE/Nostr)
├── Fallback handling
├── Message deduplication
├── Queue management
└── Delivery status tracking
```

**Key Files:**
- `TransportRouter.kt` - Routes messages
- `MessageQueue.kt` - Queues messages for retry

### Storage (`core/storage/`)

Room database for local persistence.

```
BuildItDatabase
├── ContactEntity
├── ConversationEntity
├── MessageEntity
├── GroupEntity
├── GroupMemberEntity
└── LinkedDeviceEntity
```

## Feature Modules

### Chat (`features/chat/`)

Main messaging feature with conversation list and active chat.

```
ChatViewModel
├── Conversation list
├── Message sending/receiving
├── Real-time updates
└── Transport status

ContactPickerViewModel
├── Contact filtering
├── Search
└── Pubkey validation
```

**Screens:**
- `ChatScreen.kt` - Conversation list + active chat
- `ContactPickerScreen.kt` - New message contact selection

### Device Sync (`features/devicesync/`)

Multi-device identity synchronization.

```
DeviceSyncViewModel
├── QR code generation
├── Transfer session management
├── ECDH key exchange
├── Visual fingerprint verification
└── Linked device management
```

**Protocol:**
- Ephemeral keypair for each session
- Double encryption (PBKDF2 + ECDH)
- Visual emoji fingerprint verification

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Compose Screens                           ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │ StateFlow                          │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │                     ViewModels                               ││
│  └──────────────────────────┬──────────────────────────────────┘│
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                       Domain Layer                               │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │ TransportRouter │ │  CryptoManager  │ │  KeystoreManager    ││
│  └────────┬────────┘ └────────┬────────┘ └─────────────────────┘│
│           │                   │                                  │
│  ┌────────▼────────┐ ┌────────▼────────┐                        │
│  │   NostrClient   │ │   BLEManager    │                        │
│  └────────┬────────┘ └────────┬────────┘                        │
└───────────┼───────────────────┼─────────────────────────────────┘
            │                   │
┌───────────▼───────────────────▼─────────────────────────────────┐
│                        Data Layer                                │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐│
│  │  Room Database  │ │  Nostr Relays   │ │   BLE Devices       ││
│  │  (local)        │ │  (WebSocket)    │ │   (GATT)            ││
│  └─────────────────┘ └─────────────────┘ └─────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Dependency Injection

Hilt is used for dependency injection.

**Modules:**
- `DatabaseModule` - Room database and DAOs
- `NetworkModule` - OkHttp client (if needed)
- Core managers are `@Singleton` scoped

## Threading Model

- **Main Thread**: UI operations, StateFlow collection
- **IO Dispatcher**: Database, network operations
- **Default Dispatcher**: Cryptographic operations, heavy computation
- **BLE callbacks**: Handled on dedicated threads, forwarded via Flow

## Security Model

1. **Key Storage**: All cryptographic keys in Android Keystore
2. **StrongBox**: Used when available (hardware security)
3. **Biometric**: Optional biometric gate for key access
4. **Message Encryption**: NIP-44 (ChaCha20-Poly1305)
5. **Private DMs**: NIP-17 gift wrap for metadata protection
6. **Device Sync**: Double encryption with visual verification

## Configuration

Build flavors control environment:

| Flavor | Relay | Debug Logging |
|--------|-------|---------------|
| `dev`  | `wss://relay.dev.buildit.network` | Yes |
| `prod` | `wss://relay.buildit.network` | No |
