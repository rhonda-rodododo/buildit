# BuildIt iOS Client

> Native iOS app with Swift, SwiftUI, and Core Bluetooth

**Parent instructions**: See `/CLAUDE.md` for monorepo-wide context.

**Product context**: Read [`docs/VISION.md`](../../docs/VISION.md) for who we serve and why.
Read [`docs/design-principles.md`](../../docs/design-principles.md) for cross-platform UX standards.
Read [`docs/personas/`](../../docs/personas/) for user personas across all target communities.

## Tech Stack

- **Language**: Swift 5.9+
- **UI**: SwiftUI
- **BLE**: Core Bluetooth (Central + Peripheral)
- **Crypto**: CryptoKit + packages/crypto (UniFFI)
- **Storage**: SwiftData / Keychain
- **Nostr**: Native Swift implementation

## Build System

**Primary**: Swift Package Manager (SPM) via `Package.swift`

The Xcode project exists as a shell for IDE support. SPM is the source of truth for build configuration.

```bash
# Build with SPM
swift build

# Run tests with SPM
swift test

# Open in Xcode (creates workspace from Package.swift)
open Package.swift

# Or via xcodebuild with SPM scheme
xcodebuild -scheme BuildItCore -destination 'platform=iOS Simulator,name=iPhone 15' build
xcodebuild -scheme BuildItCore -destination 'platform=iOS Simulator,name=iPhone 15' test
```

## Directory Structure

```
BuildIt/
├── Sources/
│   ├── App/              # App entry, lifecycle
│   ├── Core/
│   │   ├── BLE/          # Core Bluetooth manager
│   │   ├── Crypto/       # CryptoKit + UniFFI bindings
│   │   ├── Nostr/        # Nostr client, relay pool
│   │   └── Storage/      # SwiftData, Keychain
│   ├── Features/         # Feature modules
│   │   ├── Messaging/
│   │   ├── Events/
│   │   └── ...
│   ├── Generated/        # AUTO-GENERATED from protocol schemas
│   └── UI/               # Shared SwiftUI components
├── Tests/
└── BuildIt.xcodeproj
```

## BLE Implementation

```swift
// Sources/Core/BLE/BLEManager.swift
class BLEManager: NSObject, CBCentralManagerDelegate, CBPeripheralManagerDelegate {
    static let serviceUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef0")
    static let messageCharUUID = CBUUID(string: "12345678-1234-5678-1234-56789abcdef1")

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            central.scanForPeripherals(withServices: [Self.serviceUUID])
        }
    }
}
```

## Crypto via UniFFI

The app uses `packages/crypto` (Rust) via UniFFI bindings:

```swift
import BuildItCrypto

let encrypted = try nip44Encrypt(
    plaintext: message.data(using: .utf8)!,
    senderPrivkey: senderKey,
    recipientPubkey: recipientKey
)
```

## Key Files

| File | Purpose |
|------|---------|
| `Info.plist` | App permissions (BLE, etc.) |
| `BuildIt.entitlements` | App capabilities |
| `Sources/Core/BLE/` | BLE mesh implementation |
| `Sources/Generated/` | Auto-generated schema types |

## Coding Standards

- **Swift Concurrency** - Use async/await, actors for thread safety
- **SwiftUI** - Declarative UI, avoid UIKit unless necessary
- **Sendable** - All shared types must be Sendable
- **Codable** - All schema types implement Codable with unknown field preservation

## Testing

```bash
# Unit tests
xcodebuild test -scheme BuildIt -destination 'platform=iOS Simulator,name=iPhone 15'

# UI tests
xcodebuild test -scheme BuildItUITests -destination 'platform=iOS Simulator,name=iPhone 15'
```

## Schema Types

Generated types from `protocol/schemas/` include:
- Codable conformance
- Unknown field preservation for relay
- Version metadata

```swift
// Generated: Sources/Generated/Schemas/Events.swift
public struct Event: Codable, Sendable {
    public let _v: String
    public let id: UUID
    public let title: String
    // ... fields from schema
    private var _unknownFields: [String: AnyCodable] = [:]
}
```
