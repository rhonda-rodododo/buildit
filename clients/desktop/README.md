# BuildIt Network Desktop (Tauri)

This directory contains the Tauri backend for the BuildIt Network desktop application.

## Features

- **BLE Mesh Networking**: Bluetooth Low Energy support via btleplug for peer-to-peer mesh communication
- **System Keyring**: Secure credential storage using platform-native keyrings (Keychain, Credential Manager, libsecret)
- **NIP-44 Encryption**: Integration with buildit-crypto for Nostr encryption
- **System Tray**: Quick access menu and status management
- **Deep Links**: Handle `buildit://` protocol URLs

## Prerequisites

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y \
    libwebkit2gtk-4.1-dev \
    libjavascriptcoregtk-4.1-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf \
    libbluetooth-dev \
    libdbus-1-dev \
    libsecret-1-dev
```

### macOS

```bash
# Xcode Command Line Tools (required)
xcode-select --install

# Optional: Homebrew packages
brew install pkg-config
```

### Windows

- Install [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- Install [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Development

### From the root buildit-network directory:

```bash
# Install dependencies
bun install

# Run in development mode
bun run tauri:dev

# Build for production
bun run tauri:build
```

### Direct cargo commands (from this directory):

```bash
# Check compilation
cargo check

# Run tests
cargo test

# Build release
cargo build --release
```

## Architecture

```
src-tauri/
├── src/
│   ├── main.rs              # Entry point
│   ├── lib.rs               # Library with app setup
│   ├── tray.rs              # System tray configuration
│   ├── ble/
│   │   ├── mod.rs           # BLE module exports
│   │   ├── manager.rs       # btleplug BLE manager
│   │   └── mesh.rs          # Mesh networking protocol
│   ├── crypto/
│   │   ├── mod.rs           # Crypto module exports
│   │   └── keyring.rs       # System keyring integration
│   └── commands/
│       ├── mod.rs           # Command module exports
│       ├── ble_commands.rs  # Tauri BLE commands
│       └── crypto_commands.rs # Tauri crypto commands
├── icons/                   # Application icons
├── Cargo.toml               # Rust dependencies
├── tauri.conf.json          # Tauri configuration
└── build.rs                 # Build script
```

## BLE Service UUIDs

The BuildIt Network uses custom BLE service UUIDs for mesh networking:

- **Service UUID**: `b0000001-4e0d-4e70-8c3f-6c7e8d9a0b1c`
- **Mesh Message Characteristic**: `b0000002-4e0d-4e70-8c3f-6c7e8d9a0b1c`
- **Identity Characteristic**: `b0000003-4e0d-4e70-8c3f-6c7e8d9a0b1c`

## Tauri Commands

### BLE Commands

| Command | Description |
|---------|-------------|
| `start_ble_scan` | Start scanning for BuildIt devices |
| `stop_ble_scan` | Stop BLE scanning |
| `get_discovered_devices` | Get list of discovered devices |
| `connect_device` | Connect to a device by address |
| `disconnect_device` | Disconnect from a device |
| `send_mesh_message` | Send a mesh message |
| `get_ble_status` | Get current BLE status |

### Crypto Commands

| Command | Description |
|---------|-------------|
| `store_secret` | Store a secret in the system keyring |
| `retrieve_secret` | Retrieve a secret from the keyring |
| `delete_secret` | Delete a secret from the keyring |
| `has_secret` | Check if a secret exists |
| `generate_keypair` | Generate a new secp256k1 keypair |
| `encrypt_nip44` | Encrypt using NIP-44 |
| `decrypt_nip44` | Decrypt using NIP-44 |
| `derive_conversation_key` | Derive a conversation key |

## Frontend Integration

In your React/TypeScript code, use the Tauri API:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Example: Generate a keypair
const keypair = await invoke('generate_keypair');

// Example: Store in keyring
await invoke('store_secret', {
  user: 'default',
  secretType: 'nostr_private_key',
  value: keypair.private_key,
  label: 'My Nostr Key'
});

// Example: Start BLE scan
await invoke('start_ble_scan', { timeoutSeconds: 30 });
```

## License

MIT - See [LICENSE](../LICENSE) for details.
