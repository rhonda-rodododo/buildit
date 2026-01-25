# BuildIt Native App

React Native app for BuildIt Network, built with [One](https://onestack.dev) (OneStack).

## Overview

This native app shares business logic and design tokens with the main web app via the `@buildit/sdk` and `@buildit/design-tokens` packages.

### Architecture

```
┌────────────────────────────────────────────────┐
│              BuildIt Network                    │
├────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────┐         ┌─────────────────┐  │
│  │   Web SPA   │         │   Native App    │  │
│  │ (React/Vite)│         │ (One/RN/Expo)   │  │
│  └──────┬──────┘         └────────┬────────┘  │
│         │                         │            │
│         └────────────┬────────────┘            │
│                      │                         │
│              ┌───────┴───────┐                 │
│              │  Shared Code  │                 │
│              ├───────────────┤                 │
│              │ @buildit/sdk  │ Business logic  │
│              │ - Nostr       │ Encryption      │
│              │ - Crypto      │ Key management  │
│              │ - Types       │ Type defs       │
│              ├───────────────┤                 │
│              │ design-tokens │ Colors, spacing │
│              └───────────────┘                 │
│                                                 │
└────────────────────────────────────────────────┘
```

### Key Features

- **Device Linking**: Link this app to your existing web identity via:
  - NIP-46 (scan QR code from web app)
  - Recovery phrase import
  - Private key import

- **Shared Identity**: Same Nostr keypair works across all devices

- **E2E Encryption**: All DMs and group messages use NIP-17/NIP-44

## Development

### Prerequisites

- [Bun](https://bun.sh) (package manager)
- [Expo Go](https://expo.dev/client) (for iOS/Android testing)
- Xcode (for iOS builds)
- Android Studio (for Android builds)

### Setup

```bash
# From repo root
bun install

# Start development server
bun run native:dev

# Or from apps/native
cd apps/native
bun run dev
```

### Running on Devices

**Web:**
```bash
# Opens at http://localhost:8081
bun run dev
```

**iOS (Expo Go):**
```bash
# Scan QR code with Expo Go app
bun run dev
# Press 'q' then 'r' in terminal for QR code
```

**iOS (Native Build):**
```bash
bun run ios
```

**Android:**
```bash
bun run android
```

## Project Structure

```
apps/native/
├── app/                    # File-system routes (One)
│   ├── _layout.tsx        # Root layout (providers)
│   ├── index.tsx          # Home screen
│   ├── login.tsx          # Create new identity
│   └── import.tsx         # Import existing identity
├── src/
│   ├── components/        # Shared components
│   └── hooks/             # Custom hooks
├── package.json
├── tsconfig.json
└── vite.config.ts         # One configuration
```

## Device Linking Flow

```
Web App (Origin)                    Native App (New Device)
      │                                      │
      ├── Settings > Multi-Device            │
      │                                      │
      ├── Generate NIP-46 QR ────────────────┤
      │                                      │
      │                           ┌──────────┴──────────┐
      │                           │ Import > Device Link │
      │                           │ Scan QR Code         │
      │                           └──────────┬──────────┘
      │                                      │
      ├── Approve connection ◄───────────────┤
      │                                      │
      └── Linked! ───────────────────────────┤
                                             │
                              Same identity, same data
```

## Status: MVP / Experimental

This native app is an MVP. Current status:
- [x] Basic One/Vite configuration
- [x] File-system routing setup
- [x] SDK integration (keypair, crypto)
- [x] Design tokens integration
- [ ] Secure key storage (expo-secure-store)
- [ ] NIP-46 device linking
- [ ] QR code scanning
- [ ] Full navigation structure
- [ ] Offline support
- [ ] Push notifications

## Related Packages

- `@buildit/sdk` - Portable business logic
- `@buildit/design-tokens` - Shared design system
