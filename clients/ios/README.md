# BuildIt iOS

A decentralized mesh communication app for iOS that enables secure messaging via BLE mesh networking and Nostr protocol.

## Features

- **BLE Mesh Networking**: Peer-to-peer communication via Bluetooth Low Energy with automatic mesh routing
- **Nostr Protocol**: Connect to Nostr relays for internet-based message delivery
- **Hybrid Transport**: Automatic failover between BLE and Nostr for reliable delivery
- **End-to-End Encryption**: NIP-04 compatible encryption with Curve25519/ChaCha20-Poly1305
- **Device Sync**: Synchronize messages and keys across multiple devices
- **Group Chat**: Create and manage group conversations
- **Secure Key Storage**: Keys protected by iOS Keychain and Secure Enclave

## Architecture

```
BuildIt/
├── App/                    # App entry point and lifecycle
├── Core/
│   ├── BLE/               # Bluetooth mesh networking
│   │   ├── BLEManager     # Central BLE coordinator
│   │   ├── BLECentral     # Central role operations
│   │   ├── BLEPeripheral  # Peripheral role operations
│   │   └── MeshRouter     # Message routing logic
│   ├── Crypto/            # Cryptographic operations
│   │   ├── CryptoManager  # Encryption/signing
│   │   └── KeychainManager# Secure key storage
│   ├── Nostr/             # Nostr protocol
│   │   ├── NostrClient    # Event handling
│   │   └── RelayPool      # Relay connections
│   ├── Transport/         # Message routing
│   │   ├── TransportRouter# Transport selection
│   │   └── MessageQueue   # Queue management
│   └── Storage/           # Local persistence
│       └── Database       # JSON-based storage
├── Features/
│   ├── Chat/              # Direct messaging
│   ├── Groups/            # Group chat
│   ├── Settings/          # App configuration
│   └── DeviceSync/        # Multi-device sync
└── UI/
    └── Components/        # Reusable UI components
```

## Requirements

- iOS 17.0+
- Xcode 15.0+
- Swift 5.9+

## Building

1. Clone the monorepo and navigate to iOS client:
```bash
git clone https://github.com/buildit/buildit.git
cd buildit/clients/ios
```

2. Open in Xcode:
```bash
open BuildIt.xcodeproj
```

3. Build and run on a physical device (BLE requires real hardware)

## BLE Protocol

### Service UUID
- Main Service: `12345678-1234-5678-1234-56789abcdef0`

### Characteristics
- Message: `12345678-1234-5678-1234-56789abcdef1` (Read, Write, Notify)
- Identity: `12345678-1234-5678-1234-56789abcdef2` (Read)
- Routing: `12345678-1234-5678-1234-56789abcdef3` (Read, Write, Notify)
- Handshake: `12345678-1234-5678-1234-56789abcdef4` (Read, Write)

### Message Format
```json
{
  "id": "uuid",
  "sourcePublicKey": "hex",
  "destinationPublicKey": "hex",
  "payload": "base64",
  "timestamp": "ISO8601",
  "ttl": 10,
  "hopCount": 0,
  "signature": "hex",
  "type": 0
}
```

## Nostr Integration

BuildIt uses the Nostr protocol for relay-based communication:

- **Event Kinds**:
  - `4`: Encrypted Direct Messages (NIP-04)
  - `30000`: Mesh Peer Announcement
  - `30001`: Group Message
  - `30002`: Device Sync

- **Default Relays**:
  - `wss://relay.damus.io`
  - `wss://relay.nostr.band`
  - `wss://nos.lol`

## Security

- Private keys stored in iOS Keychain with Secure Enclave protection
- Biometric authentication for key access
- NIP-04 compatible encryption for Nostr DMs
- ChaCha20-Poly1305 for mesh message encryption
- Schnorr signatures for message authentication

## Privacy

- No central servers - peer-to-peer communication
- No phone numbers or email required
- Keys never leave the device
- Option to use only BLE mesh (no internet required)

## License

MIT License - see [LICENSE](LICENSE) file for details.
