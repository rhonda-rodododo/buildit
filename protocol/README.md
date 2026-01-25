# BuildIt Protocol Specification

**Version**: 1.0.0
**Status**: Draft
**Last Updated**: 2025-01-25

The canonical protocol specification for BuildIt Network - a privacy-focused, offline-first communication platform using BLE mesh networking and Nostr.

## Overview

BuildIt Network enables secure, decentralized communication through:
- **BLE Mesh**: Local, offline-first communication with multi-hop routing
- **Nostr Relays**: Internet-based fallback with gift-wrapped encryption
- **Cross-Platform**: iOS, Android, Desktop (Tauri)

## Specification Documents

| Document | Description |
|----------|-------------|
| [01-overview.md](spec/01-overview.md) | Architecture overview and design principles |
| [02-ble-mesh.md](spec/02-ble-mesh.md) | BLE mesh protocol specification |
| [03-transport.md](spec/03-transport.md) | Transport layer and failover logic |
| [04-cryptography.md](spec/04-cryptography.md) | Encryption and key management |
| [05-nostr-extensions.md](spec/05-nostr-extensions.md) | Nostr NIP implementations |
| [06-device-sync.md](spec/06-device-sync.md) | Cross-device key transfer |
| [07-message-types.md](spec/07-message-types.md) | Application message formats |

## Schemas

JSON schemas for validation:
- [schemas/message.json](schemas/message.json) - Transport message format
- [schemas/chunk.json](schemas/chunk.json) - BLE chunk frame format
- [schemas/events.json](schemas/events.json) - Nostr event kinds

## Test Vectors

Test cases for implementation conformance:
- [test-vectors/encryption.json](test-vectors/encryption.json) - NIP-44 encryption test cases
- [test-vectors/chunking.json](test-vectors/chunking.json) - Message chunking test cases
- [test-vectors/routing.json](test-vectors/routing.json) - Mesh routing test cases
- [test-vectors/gift-wrap.json](test-vectors/gift-wrap.json) - NIP-17 gift wrap test cases

## Implementation Requirements

All BuildIt Network implementations MUST:
1. Implement the BLE mesh protocol exactly as specified
2. Support NIP-17 gift-wrapped messages
3. Use NIP-44 (ChaCha20-Poly1305) for encryption
4. Pass all test vectors
5. Be interoperable with other BuildIt implementations

## Monorepo Locations

| Path | Description |
|------|-------------|
| [packages/crypto](../packages/crypto) | Rust crypto core with UniFFI bindings |
| [clients/ios](../clients/ios) | Native iOS app (SwiftUI) |
| [clients/android](../clients/android) | Native Android app (Jetpack Compose) |
| [clients/desktop](../clients/desktop) | Tauri desktop app |
| [clients/web](../clients/web) | Web app and SDK |
| [docs/protocol-spec](../docs/protocol-spec) | Protocol specifications |

## License

MIT License - See LICENSE file for details.
