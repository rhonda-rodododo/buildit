# BuildIt Android

Native Android application for the BuildIt decentralized, censorship-resistant messaging network.

## Features

- **BLE Mesh Networking**: Communicate with nearby devices even without internet
- **Nostr Protocol**: End-to-end encrypted messaging via Nostr relays
- **Multi-Transport**: Seamlessly switches between BLE and internet connectivity
- **Device Sync**: Link multiple devices to your identity
- **Groups**: Private and public group conversations
- **Hardware Security**: Keys secured in Android Keystore with optional StrongBox

## Architecture

```
app/
├── core/
│   ├── ble/          # Bluetooth Low Energy mesh networking
│   ├── crypto/       # Cryptographic operations (wraps packages/crypto)
│   ├── nostr/        # Nostr protocol implementation
│   ├── transport/    # Multi-transport message routing
│   └── storage/      # Local database (Room)
├── features/
│   ├── chat/         # Chat screens and logic
│   ├── groups/       # Group management
│   ├── settings/     # App settings
│   └── devicesync/   # Multi-device sync
├── ui/
│   ├── theme/        # Material 3 theming
│   └── components/   # Reusable UI components
└── di/               # Hilt dependency injection
```

## Tech Stack

- **UI**: Jetpack Compose with Material 3
- **Architecture**: MVVM with StateFlow
- **DI**: Hilt
- **Database**: Room
- **Networking**: OkHttp WebSocket
- **Async**: Kotlin Coroutines & Flow
- **BLE**: Android Bluetooth LE API

## BLE Service UUID

- **Service**: `12345678-1234-5678-1234-56789abcdef0`
- **Message Characteristic**: `12345678-1234-5678-1234-56789abcdef1`
- **Identity Characteristic**: `12345678-1234-5678-1234-56789abcdef2`
- **Routing Characteristic**: `12345678-1234-5678-1234-56789abcdef3`

## Building

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34
- Android NDK 25.2.9519653
- Rust toolchain (for packages/crypto)

### Setup packages/crypto Native Library

The cryptographic operations are handled by a Rust library via JNI. To build:

1. **Install Rust and Android targets:**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
   cargo install cargo-ndk
   ```

2. **Set NDK environment:**
   ```bash
   export ANDROID_NDK_HOME=/path/to/ndk/25.2.9519653
   ```

3. **Build native libraries and generate bindings:**
   ```bash
   ./scripts/build-crypto.sh
   ```

   This will:
   - Generate Kotlin bindings via UniFFI
   - Build native `.so` files for arm64-v8a, armeabi-v7a, x86_64
   - Place files in the correct locations

### Build Variants

| Variant | Description |
|---------|-------------|
| `devDebug` | Development relay, debug logging enabled |
| `devRelease` | Development relay, optimized |
| `prodDebug` | Production relay, debug logging enabled |
| `prodRelease` | Production relay, optimized, minified |

### Build Commands

```bash
# Debug build (dev flavor)
./gradlew assembleDevDebug

# Release build (prod flavor)
./gradlew assembleProdRelease

# All variants
./gradlew assembleDebug
./gradlew assembleRelease
```

### Signing Release Builds

Create `keystore.properties` in the project root:

```properties
storeFile=path/to/your.keystore
storePassword=your_store_password
keyAlias=your_key_alias
keyPassword=your_key_password
```

### Run Tests

```bash
# Unit tests
./gradlew testDebugUnitTest

# Instrumentation tests
./gradlew connectedDevDebugAndroidTest

# Lint checks
./gradlew lint

# Static analysis
./gradlew detekt ktlintCheck
```

## Security

- All keys are stored in Android Keystore
- StrongBox HSM used when available
- Optional biometric authentication
- End-to-end encryption for all messages
- No cloud backup of cryptographic keys

## Permissions

- `BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` - BLE mesh
- `INTERNET` - Nostr relay connections
- `FOREGROUND_SERVICE` - Background BLE operation
- `USE_BIOMETRIC` - Optional biometric authentication
- `CAMERA` - QR code scanning for device sync

## License

MIT License - see LICENSE file
