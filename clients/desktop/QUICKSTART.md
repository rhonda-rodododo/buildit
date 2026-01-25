# BuildIt Desktop - Quick Start Guide

## Development Setup

### Prerequisites

#### All Platforms
- Rust 1.70+ (`rustup update`)
- Node.js 18+ with bun (`npm install -g bun`)
- Tauri CLI

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libjavascriptcoregtk-4.1-dev \
  libsoup-3.0-dev \
  libbluetooth-dev \
  libdbus-1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  librsvg2-dev
```

#### macOS
```bash
xcode-select --install
brew install bluetooth-support
```

#### Windows
- Install Visual Studio Build Tools
- Ensure Bluetooth is enabled

### First Build

```bash
# Clone repository
cd buildit/clients/desktop

# Install dependencies
bun install

# Build crypto library first
cd ../../packages/crypto
cargo build --release

# Back to desktop
cd ../../clients/desktop

# Run tests
cargo test

# Run in development
cargo tauri dev

# Build for production
cargo tauri build
```

## Tauri Command Reference

### BLE Commands

```typescript
import { invoke } from '@tauri-apps/api/core';

// Start scanning for devices
await invoke('start_ble_scan', { timeoutSeconds: 30 });

// Stop scanning
await invoke('stop_ble_scan');

// Get discovered devices
const result = await invoke<CommandResult<DiscoveredDevice[]>>(
  'get_discovered_devices'
);

// Connect to a device
await invoke('connect_device', { address: 'XX:XX:XX:XX:XX:XX' });

// Disconnect from a device
await invoke('disconnect_device', { address: 'XX:XX:XX:XX:XX:XX' });

// Send mesh message
const bytes = new TextEncoder().encode('Hello');
await invoke('send_mesh_message', {
  address: 'XX:XX:XX:XX:XX:XX', // or null for broadcast
  data: Array.from(bytes)
});

// Get BLE status
const status = await invoke<CommandResult<BleStatus>>('get_ble_status');
```

### Crypto Commands

```typescript
// Generate keypair
const kp = await invoke<CommandResult<KeyPairResponse>>('generate_keypair');
// kp.data = { private_key: "hex...", public_key: "hex..." }

// Store secret in keyring
await invoke('store_secret', {
  user: 'alice',
  secretType: { type: 'nostr_private_key' },
  value: kp.data!.private_key,
  label: 'Alice Nostr Key'
});

// Retrieve secret
const secret = await invoke<CommandResult<string>>('retrieve_secret', {
  user: 'alice',
  secretType: { type: 'nostr_private_key' }
});

// Delete secret
await invoke('delete_secret', {
  user: 'alice',
  secretType: { type: 'nostr_private_key' }
});

// Check if secret exists
const exists = await invoke<CommandResult<boolean>>('has_secret', {
  user: 'alice',
  secretType: { type: 'nostr_private_key' }
});

// Derive conversation key
const convKey = await invoke<CommandResult<string>>('derive_conversation_key', {
  privateKeyHex: myPrivateKey,
  recipientPubkeyHex: theirPubkey
});

// Encrypt with NIP-44
const encrypted = await invoke<CommandResult<string>>('encrypt_nip44', {
  conversationKeyHex: convKey.data!,
  plaintext: 'Secret message'
});

// Decrypt with NIP-44
const decrypted = await invoke<CommandResult<string>>('decrypt_nip44', {
  conversationKeyHex: convKey.data!,
  ciphertext: encrypted.data!
});
```

### Nostr Commands

```typescript
// Sign event
const unsigned = {
  pubkey: myPubkey,
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Hello, Nostr!'
};

const signed = await invoke<CommandResult<NostrEvent>>('sign_nostr_event', {
  privateKeyHex: myPrivateKey,
  event: unsigned
});

// Verify event
const valid = await invoke<CommandResult<boolean>>('verify_nostr_event', {
  event: someEvent
});

// Gift wrap message (NIP-17)
const wrapped = await invoke<CommandResult<NostrEvent>>('gift_wrap_message', {
  senderPrivateKeyHex: myPrivateKey,
  recipientPubkey: theirPubkey,
  content: 'Private DM'
});

// Unwrap gift message
const unwrapped = await invoke<CommandResult<UnwrapResponse>>('unwrap_gift_message', {
  recipientPrivateKeyHex: myPrivateKey,
  giftWrap: receivedEvent
});
// unwrapped.data = { rumor, sender_pubkey, seal_verified }
```

### Storage Commands

```typescript
// Store encrypted key
await invoke('store_encrypted_key', {
  user: 'alice',
  keyId: 'device_transfer_key',
  encryptedKey: encryptedKeyHex
});

// Retrieve encrypted key
const key = await invoke<CommandResult<string>>('retrieve_encrypted_key', {
  user: 'alice',
  keyId: 'device_transfer_key'
});

// Delete key
await invoke('delete_key', {
  user: 'alice',
  keyId: 'device_transfer_key'
});
```

## TypeScript Types

```typescript
interface CommandResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface KeyPairResponse {
  private_key: string; // hex
  public_key: string;  // hex
}

interface DiscoveredDevice {
  address: string;
  name?: string;
  rssi?: number;
  is_buildit_device: boolean;
  last_seen: number; // unix ms
}

interface BleStatus {
  is_scanning: boolean;
  connected_devices: string[];
  discovered_count: number;
}

interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface UnsignedEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

interface UnwrapResponse {
  rumor: NostrEvent;
  sender_pubkey: string;
  seal_verified: boolean;
}

type SecretType =
  | { type: 'nostr_private_key' }
  | { type: 'master_key' }
  | { type: 'database_key' }
  | { type: 'api_token' }
  | { type: 'custom', name: string };
```

## Common Patterns

### Error Handling

```typescript
async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | null> {
  try {
    const result = await invoke<CommandResult<T>>(command, args);
    if (result.success && result.data) {
      return result.data;
    } else {
      console.error(`Command ${command} failed:`, result.error);
      return null;
    }
  } catch (error) {
    console.error(`Failed to invoke ${command}:`, error);
    return null;
  }
}

// Usage
const keypair = await safeInvoke<KeyPairResponse>('generate_keypair');
if (keypair) {
  console.log('Generated:', keypair.public_key);
}
```

### Complete Encryption Flow

```typescript
async function encryptedChat(
  myPrivateKey: string,
  theirPubkey: string,
  message: string
): Promise<string | null> {
  // 1. Derive conversation key
  const convKeyResult = await invoke<CommandResult<string>>(
    'derive_conversation_key',
    {
      privateKeyHex: myPrivateKey,
      recipientPubkeyHex: theirPubkey
    }
  );

  if (!convKeyResult.success) {
    console.error('Failed to derive key:', convKeyResult.error);
    return null;
  }

  // 2. Encrypt message
  const encryptResult = await invoke<CommandResult<string>>(
    'encrypt_nip44',
    {
      conversationKeyHex: convKeyResult.data!,
      plaintext: message
    }
  );

  if (!encryptResult.success) {
    console.error('Failed to encrypt:', encryptResult.error);
    return null;
  }

  return encryptResult.data!;
}
```

### BLE Device Discovery

```typescript
async function discoverDevices(timeoutSec: number = 10) {
  // Start scan
  await invoke('start_ble_scan', { timeoutSeconds: timeoutSec });

  // Poll for devices
  const checkInterval = setInterval(async () => {
    const result = await invoke<CommandResult<DiscoveredDevice[]>>(
      'get_discovered_devices'
    );

    if (result.success && result.data) {
      console.log('Found devices:', result.data.length);
      result.data.forEach(dev => {
        if (dev.is_buildit_device) {
          console.log('BuildIt device:', dev.name, dev.address);
        }
      });
    }
  }, 1000);

  // Stop after timeout
  setTimeout(async () => {
    clearInterval(checkInterval);
    await invoke('stop_ble_scan');
  }, timeoutSec * 1000);
}
```

## Testing

### Run All Tests
```bash
cargo test
```

### Run Specific Tests
```bash
# Crypto integration
cargo test --test crypto_integration

# BLE chunking
cargo test --test ble_chunk_tests

# Specific test function
cargo test test_nip44_encrypt_decrypt
```

### Enable Debug Logging
```bash
RUST_LOG=debug cargo tauri dev
```

### Test Specific Module
```bash
cargo test --lib ble::chunk
```

## Debugging

### Enable Rust Logging
```rust
// In src/lib.rs or main.rs
env_logger::init();
```

```bash
RUST_LOG=trace cargo tauri dev
```

### View BLE Operations
```bash
RUST_LOG=buildit_network_desktop::ble=debug cargo tauri dev
```

### View Crypto Operations
```bash
RUST_LOG=buildit_crypto=debug cargo tauri dev
```

### Chrome DevTools
When running `cargo tauri dev`, press F12 to open DevTools for frontend debugging.

## Troubleshooting

### BLE Not Working

**macOS:**
- Check System Preferences → Privacy → Bluetooth
- Ensure app has Bluetooth permission

**Linux:**
- Install BlueZ: `sudo apt install bluez`
- Start service: `sudo systemctl start bluetooth`
- Check permissions: `sudo usermod -a -G bluetooth $USER`

**Windows:**
- Enable Bluetooth in Settings
- Restart Bluetooth service

### Keyring Errors

**macOS:**
- Open Keychain Access
- Look for "network.buildit.desktop" entries
- Grant access if prompted

**Linux:**
- Install: `sudo apt install gnome-keyring libsecret-1-dev`
- Unlock keyring: `gnome-keyring-daemon --unlock`

**Windows:**
- Check Credential Manager
- Ensure app has permission

### Build Errors

```bash
# Clean build
cargo clean
rm -rf node_modules
bun install
cargo build

# Update dependencies
cargo update
rustup update

# Check for conflicts
cargo tree | grep -i buildit
```

## Performance Tips

### Frontend
- Cache conversation keys (don't re-derive)
- Batch BLE messages when possible
- Debounce scanning operations

### Backend
- Use broadcast for multiple recipients
- Enable compression for large messages
- Limit concurrent BLE connections

## Security Best Practices

1. **Never log private keys**
   - Use keyring for storage
   - Zeroize after use
   - Don't send over network

2. **Validate inputs**
   - Check hex string lengths
   - Verify public key format
   - Sanitize user input

3. **Handle errors gracefully**
   - Don't expose internal errors to UI
   - Log securely
   - Clear sensitive data on error

4. **Use HTTPS/WSS**
   - Always use secure WebSocket (wss://)
   - Verify TLS certificates
   - Don't disable SSL verification

## Useful Resources

- [Tauri Docs](https://tauri.app/v1/guides/)
- [NIP-44 Spec](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-17 Spec](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [btleplug Examples](https://github.com/deviceplug/btleplug/tree/master/examples)
- [Rust Async Book](https://rust-lang.github.io/async-book/)

## Support

For issues or questions:
1. Check IMPLEMENTATION.md for detailed docs
2. Review test files for usage examples
3. Enable debug logging
4. Check GitHub issues
