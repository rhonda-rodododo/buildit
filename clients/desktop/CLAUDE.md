# BuildIt Desktop Client (Tauri)

> Rust-based desktop application with native BLE support

**Parent instructions**: See `/CLAUDE.md` for monorepo-wide context.

## Tech Stack

- **Framework**: Tauri 2.x
- **Backend**: Rust
- **Frontend**: Web client (`clients/web/`)
- **BLE**: btleplug (native Bluetooth)
- **Storage**: SQLite via Tauri plugins
- **Crypto**: Rust native (secp256k1, chacha20poly1305)

## Commands

```bash
cargo tauri dev      # Development with hot reload
cargo tauri build    # Production build

# Output locations:
# macOS: target/release/bundle/macos/
# Windows: target/release/bundle/msi/
# Linux: target/release/bundle/appimage/
```

## Directory Structure

```
src-tauri/
├── src/
│   ├── main.rs          # Entry point
│   ├── lib.rs           # Library exports
│   ├── commands/        # Tauri commands (called from frontend)
│   │   ├── ble.rs       # BLE mesh operations
│   │   ├── crypto.rs    # Crypto operations
│   │   └── storage.rs   # Secure storage
│   ├── ble/             # BLE mesh implementation
│   │   ├── central.rs   # Central role (scanning, connecting)
│   │   ├── peripheral.rs # Peripheral role (advertising)
│   │   └── mesh.rs      # Mesh routing logic
│   └── crypto/          # Native crypto operations
├── Cargo.toml           # Rust dependencies
├── tauri.conf.json      # Tauri configuration
└── capabilities/        # Permission definitions
```

## BLE Mesh

The desktop app provides native BLE mesh via btleplug:

```rust
// Tauri command exposed to frontend
#[tauri::command]
async fn send_ble_message(
    state: State<'_, BleState>,
    recipient: String,
    payload: Vec<u8>,
) -> Result<(), String> {
    state.mesh.send(recipient, payload).await
}
```

**Frontend calls via**:
```typescript
import { invoke } from '@tauri-apps/api/core';
await invoke('send_ble_message', { recipient, payload });
```

## Key Configuration

**`tauri.conf.json`**:
```json
{
  "app": {
    "withGlobalTauri": true,
    "security": {
      "csp": "default-src 'self'; connect-src 'self' wss://*.nostr.* wss://relay.*"
    }
  },
  "plugins": {
    "ble": { "enabled": true }
  }
}
```

## Permissions

BLE requires platform-specific permissions:
- **macOS**: `Info.plist` with Bluetooth usage description
- **Windows**: Manifest with Bluetooth capability
- **Linux**: BlueZ permissions

## Building

```bash
# Debug
cargo tauri dev

# Release (code-signed)
cargo tauri build --release

# Platform-specific
cargo tauri build --target x86_64-apple-darwin    # macOS Intel
cargo tauri build --target aarch64-apple-darwin   # macOS ARM
cargo tauri build --target x86_64-pc-windows-msvc # Windows
cargo tauri build --target x86_64-unknown-linux-gnu # Linux
```

## Testing

```bash
cargo test                        # Rust unit tests
cargo test --features ble-mock    # With BLE mocking
```
