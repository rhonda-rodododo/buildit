# BuildIt Network Native Apps

This document describes the native app architecture for BuildIt Network.

## Distribution Strategy

**BuildIt Network is distributed exclusively as native applications:**

- **iOS** - Native Swift app via App Store / TestFlight
- **Android** - Native Kotlin app via Google Play
- **Desktop** - Tauri-wrapped webapp for macOS, Windows, Linux

**No standalone web app is published.** The webapp source (`src/`) is used only as the UI layer for the Tauri desktop application.

## Architecture Overview

BuildIt Network has migrated from React Native + Expo to fully native implementations for better BLE mesh support, hardware security, and platform-specific optimizations.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROTOCOL SPECIFICATION                        │
│  (docs/protocol-spec/ - canonical reference for all platforms)  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────┐
│                   RUST CRYPTO CORE                              │
│  (packages/crypto/ - UniFFI bindings for Swift/Kotlin)         │
│  - NIP-44 ChaCha20-Poly1305 encryption                         │
│  - NIP-17 gift wrap/unwrap                                     │
│  - Key derivation (PBKDF2, HKDF)                               │
│  - secp256k1 signing/verification                              │
└─────────────────────────────┼─────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  iOS Native   │    │Android Native │    │ Tauri Desktop │
│ (clients/ios) │    │ (clients/     │    │ (clients/     │
│               │    │  android)     │    │  desktop)     │
│  SwiftUI      │    │ Jetpack       │    │ Rust + Web    │
│  Core Bluetooth│    │ Compose       │    │ btleplug     │
│  Keychain     │    │ Android BLE   │    │ libsecret    │
└───────────────┘    └───────────────┘    └───────────────┘
```

## Native App Repositories

| Platform | Location | Tech Stack |
|----------|----------|------------|
| iOS | `../buildit-ios/` | Swift, SwiftUI, Core Bluetooth |
| Android | `../buildit-android/` | Kotlin, Jetpack Compose, Android BLE |
| Desktop | `./src-tauri/` | Rust, Tauri, btleplug |

## Why Native?

### BLE Mesh Support
- **Web Bluetooth limitations**: No peripheral mode, no background scanning, single connection
- **Native BLE**: Full peripheral + central mode, background operation, multiple connections

### Hardware Security
- **iOS**: Secure Enclave, Keychain Services
- **Android**: Android Keystore, StrongBox, TEE
- **Desktop**: System keyring (libsecret/Keychain/Credential Manager)

### Performance
- Native crypto using Rust via UniFFI
- Platform-optimized UI (SwiftUI, Jetpack Compose)
- Efficient background processing

## Migration from React Native

The previous React Native implementation is archived in `apps/native-deprecated/`.

### Why We Migrated

1. **Crypto Polyfill Issues**: React Native required complex polyfills for WebCrypto and secp256k1
2. **BLE Limitations**: React Native BLE libraries didn't support full mesh networking
3. **Build Complexity**: Expo + React Native + Nostr libraries had version conflicts
4. **Security Concerns**: Native keystores provide better key protection than Expo SecureStore

### What Was Preserved

- UI/UX design patterns
- State management approach (Zustand-like)
- Nostr protocol implementation concepts
- BLE service definitions and constants

## Building the Native Apps

### iOS

```bash
cd ../buildit-ios
# Open in Xcode
open BuildIt.xcodeproj
# Or build from command line
xcodebuild -scheme BuildIt -configuration Release
```

### Android

```bash
cd ../buildit-android
./gradlew assembleRelease
```

### Desktop (Tauri)

```bash
# In this repo
npm run tauri:build
# Or for development
npm run tauri:dev
```

## Protocol Specification

All native implementations follow the canonical protocol specification in `../../docs/protocol-spec/`:

- `08-schema-versioning.md` - Schema versioning
- `09-schema-codegen.md` - Code generation
- `10-version-negotiation.md` - Version negotiation
- `11-client-implementation-guide.md` - Client implementation
- `12-migration-guide.md` - Migration guide

## Cross-Platform Compatibility

All platforms must:
1. Use the same BLE service UUID: `12345678-1234-5678-1234-56789abcdef0`
2. Implement identical message chunking (21-byte header)
3. Use NIP-44 v2 encryption with same parameters
4. Support NIP-17 gift wrap format
5. Pass the same test vectors in `protocol/test-vectors/`

## Development Workflow

1. **Protocol changes**: Update `docs/protocol-spec/` first
2. **Crypto changes**: Update `packages/crypto/`, rebuild UniFFI bindings
3. **Platform updates**: Update each native app independently
4. **Testing**: Run conformance tests on all platforms

## Related Documentation

- [Protocol Specification](../../docs/protocol-spec/)
- [Rust Crypto Library](../../packages/crypto/README.md)
- [iOS App](../ios/README.md)
- [Android App](../android/README.md)
