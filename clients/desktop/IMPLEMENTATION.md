# BuildIt Desktop Backend Implementation

This document describes the complete Rust backend implementation for the Tauri desktop application.

## Architecture Overview

```
clients/desktop/
├── src/
│   ├── main.rs               # Entry point
│   ├── lib.rs                # Library exports and app state
│   ├── commands/             # Tauri IPC commands
│   │   ├── mod.rs
│   │   ├── ble_commands.rs   # BLE mesh operations
│   │   ├── crypto_commands.rs # Cryptographic operations
│   │   ├── nostr_commands.rs # Nostr and NIP-17 operations
│   │   └── storage_commands.rs # Secure storage operations
│   ├── ble/                  # BLE mesh implementation
│   │   ├── mod.rs
│   │   ├── manager.rs        # Device manager (scan, connect)
│   │   ├── mesh.rs           # Mesh protocol and routing
│   │   └── chunk.rs          # Message chunking/reassembly
│   ├── crypto/               # Cryptographic operations
│   │   ├── mod.rs
│   │   └── keyring.rs        # OS keychain integration
│   ├── nostr/                # Nostr relay client
│   │   ├── mod.rs
│   │   ├── types.rs          # Nostr message types
│   │   └── relay.rs          # WebSocket relay client
│   └── tray.rs               # System tray integration
├── tests/                    # Integration tests
│   ├── crypto_integration.rs
│   └── ble_chunk_tests.rs
├── Cargo.toml                # Dependencies
└── tauri.conf.json           # Tauri configuration
```

## Core Modules

### 1. BLE Mesh (`src/ble/`)

#### Manager (`manager.rs`)
- **Device Discovery**: Scans for BuildIt Network devices using service UUID
- **Connection Management**: Handles connect/disconnect with error recovery
- **GATT Operations**: Read/write to BuildIt characteristics
- **Event Broadcasting**: Real-time events to frontend via broadcast channels

**Key Features:**
- Cross-platform BLE via `btleplug`
- Automatic characteristic discovery
- Notification subscription for incoming messages
- Connection status tracking

**Service UUIDs:**
```rust
BUILDIT_SERVICE_UUID: b0000001-4e0d-4e70-8c3f-6c7e8d9a0b1c
BUILDIT_MESH_CHAR_UUID: b0000002-4e0d-4e70-8c3f-6c7e8d9a0b1c
BUILDIT_IDENTITY_CHAR_UUID: b0000003-4e0d-4e70-8c3f-6c7e8d9a0b1c
```

#### Mesh Protocol (`mesh.rs`)
- **Message Types**: Direct, Broadcast, Ack, Ping/Pong, SyncRequest/Response
- **TTL Management**: Default 5 hops, decremented on forwarding
- **Loop Prevention**: Tracks hops to prevent infinite routing loops
- **Routing Table**: Maintains discovered nodes with hop counts

**Message Format:**
```rust
struct MeshMessage {
    id: String,              // UUID
    message_type: MessageType,
    sender_pubkey: String,   // Hex-encoded
    recipient_pubkey: Option<String>,
    ttl: u8,
    timestamp: u64,          // Unix milliseconds
    payload: Vec<u8>,        // Encrypted with NIP-44
    signature: String,       // Schnorr signature
    hops: Vec<String>,       // Public keys of relayers
}
```

**Processing Logic:**
1. Check for duplicates (seen message IDs)
2. Verify TTL and hop list
3. Deliver if for us, forward if TTL > 0
4. Send ACK for received messages
5. Update routing table

#### Chunking (`chunk.rs`)
- **MTU**: 512 bytes (conservative estimate)
- **Header**: 21 bytes (UUID, index, total, length, flags)
- **Payload**: Up to 491 bytes per chunk
- **Compression**: DEFLATE for messages ≥100 bytes
- **Reassembly**: ChunkBuffer handles out-of-order arrival

**Chunk Header Format (21 bytes):**
```
[0-15]   Message ID (UUID, 16 bytes)
[16]     Chunk Index (0-255)
[17]     Total Chunks (1-256)
[18-19]  Payload Length (big-endian u16)
[20]     Flags (bit 0: compressed)
```

**Compression Logic:**
- Only apply if message ≥ 100 bytes
- Only use if compressed size < original
- DEFLATE compression with best level

### 2. Cryptography (`src/crypto/`)

#### Keyring (`keyring.rs`)
- **Platform Integration**: macOS Keychain, Windows Credential Manager, Linux libsecret
- **Secret Types**: Nostr private keys, master keys, database keys, API tokens
- **Metadata**: Created timestamp, last accessed, optional labels
- **Serialization**: JSON with zeroization of sensitive data

**Stored Secret Format:**
```rust
struct StoredSecret {
    value: String,           // Hex-encoded for binary data
    secret_type: SecretType,
    created_at: u64,
    last_accessed: Option<u64>,
    label: Option<String>,
}
```

**Key Naming Convention:**
```
service: "network.buildit.desktop"
key: "{user}_{secret_type}"
```

**Integration with buildit-crypto:**
All cryptographic primitives (NIP-44, NIP-17, key derivation, signing) are provided by the shared `buildit-crypto` crate located in `packages/crypto/`.

### 3. Nostr Relay Client (`src/nostr/`)

#### Types (`types.rs`)
- **NostrMessage**: Enum for all relay message types
- **Filter**: NIP-01 subscription filters
- **Subscription**: Active subscription state
- **RelayEvent**: Events broadcast to frontend

**Filter Capabilities:**
- Event IDs
- Authors (pubkeys)
- Event kinds
- Referenced events (e tags)
- Referenced pubkeys (p tags)
- Time ranges (since/until)
- Limit results

#### Relay (`relay.rs`)
- **WebSocket Client**: tokio-tungstenite for async WebSocket
- **Connection Management**: Connect, disconnect, reconnect
- **Subscriptions**: Create, manage, close subscriptions
- **Event Publishing**: Send events with OK confirmations
- **Message Handling**: Parse and route incoming messages

**Connection Lifecycle:**
1. Connect to relay URL
2. Upgrade to WebSocket
3. Store connection in state
4. Spawn message handler task
5. Broadcast Connected event

**Message Handler:**
- Runs in background tokio task
- Parses incoming JSON messages
- Routes to appropriate handlers
- Broadcasts events to subscribers
- Handles disconnections gracefully

**Supported Message Types:**
- `EVENT`: Incoming event for subscription
- `EOSE`: End of stored events
- `NOTICE`: Relay notice/error
- `OK`: Event publication confirmation

### 4. Tauri Commands (`src/commands/`)

#### BLE Commands (`ble_commands.rs`)
```rust
start_ble_scan(timeout_seconds: Option<u64>)
stop_ble_scan()
get_discovered_devices() -> Vec<DiscoveredDevice>
connect_device(address: String)
disconnect_device(address: String)
send_mesh_message(address: Option<String>, data: Vec<u8>) -> usize
get_ble_status() -> BleStatus
```

#### Crypto Commands (`crypto_commands.rs`)
```rust
store_secret(user, secret_type, value, label)
retrieve_secret(user, secret_type) -> String
delete_secret(user, secret_type)
has_secret(user, secret_type) -> bool
generate_keypair() -> KeyPairResponse
encrypt_nip44(conversation_key_hex, plaintext) -> String
decrypt_nip44(conversation_key_hex, ciphertext) -> String
derive_conversation_key(private_key_hex, recipient_pubkey_hex) -> String
```

#### Nostr Commands (`nostr_commands.rs`)
```rust
sign_nostr_event(private_key_hex, event) -> NostrEvent
verify_nostr_event(event) -> bool
gift_wrap_message(sender_private_key_hex, recipient_pubkey, content) -> NostrEvent
unwrap_gift_message(recipient_private_key_hex, gift_wrap) -> UnwrapResponse
```

#### Storage Commands (`storage_commands.rs`)
```rust
store_encrypted_key(user, key_id, encrypted_key)
retrieve_encrypted_key(user, key_id) -> String
delete_key(user, key_id)
```

### 5. Application State (`src/lib.rs`)

```rust
struct AppState {
    ble_manager: Arc<RwLock<BleManager>>,
    keyring_manager: Arc<KeyringManager>,
    nostr_relays: Arc<RwLock<HashMap<String, Arc<NostrRelay>>>>,
}
```

**Concurrency:**
- `Arc<RwLock<>>` for shared mutable state
- Read-write locks allow multiple readers
- Parking_lot for efficient locking

**Initialization:**
1. Create BleManager (not initialized until first scan)
2. Create KeyringManager with service name
3. Create empty relay map
4. Register all Tauri commands
5. Setup system tray

## Key Dependencies

### Core
- `tauri = "2"` - Desktop app framework
- `tokio = "1"` - Async runtime
- `serde = "1"` - Serialization
- `buildit-crypto` - Shared crypto library

### BLE
- `btleplug = "0.11"` - Cross-platform BLE
- `uuid = "1"` - UUIDs for messages
- `flate2 = "1"` - DEFLATE compression

### Storage
- `keyring = "3"` - OS keychain integration

### Networking
- `tokio-tungstenite = "0.24"` - WebSocket client
- `futures = "0.3"` - Async utilities

### Utilities
- `thiserror = "2"` - Error handling
- `log = "0.4"` - Logging
- `env_logger = "0.11"` - Log initialization
- `parking_lot = "0.12"` - Efficient locks
- `hex = "0.4"` - Hex encoding

## Testing

### Unit Tests
Each module includes inline unit tests:
- `ble/mesh.rs`: Message creation, forwarding, routing
- `ble/chunk.rs`: Chunking, compression, reassembly
- `crypto/keyring.rs`: Key storage, retrieval, deletion

### Integration Tests
- `tests/crypto_integration.rs`: Full NIP-44 encrypt/decrypt flow
- `tests/ble_chunk_tests.rs`: Chunking with various message sizes

### Running Tests
```bash
cd clients/desktop
cargo test                    # All tests
cargo test --lib             # Library tests only
cargo test ble_chunk         # Specific test module
```

## Error Handling

All operations return `Result<T, E>` with appropriate error types:

- `BleError`: BLE operations
- `KeyringError`: Keyring operations
- `RelayError`: Nostr relay operations
- `ChunkError`: Chunking operations
- `CryptoError`: Cryptographic operations (from buildit-crypto)

Tauri commands wrap results in `CommandResult<T>`:
```rust
struct CommandResult<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}
```

## Security Considerations

### Key Storage
- Private keys stored in OS keychain
- Zeroized after use
- Never logged or serialized to disk

### Encryption
- NIP-44 ChaCha20-Poly1305 AEAD
- HKDF-SHA256 key derivation
- 32-byte random nonces
- HMAC-SHA256 authentication

### BLE Security
- Messages encrypted with NIP-44
- Schnorr signatures for authentication
- Public keys in cleartext for routing
- No plaintext content over BLE

### Network Security
- WSS (WebSocket Secure) for relays
- Certificate validation via native-tls
- No credentials in relay connections
- Events signed client-side

## Frontend Integration

### Invoking Commands
```typescript
import { invoke } from '@tauri-apps/api/core';

// Generate keypair
const result = await invoke<CommandResult<KeyPairResponse>>('generate_keypair');
if (result.success) {
  const { private_key, public_key } = result.data!;
}

// Encrypt message
const encrypted = await invoke<CommandResult<string>>('encrypt_nip44', {
  conversation_key_hex: convKey,
  plaintext: 'Hello, World!',
});

// Send BLE message
const count = await invoke<CommandResult<number>>('send_mesh_message', {
  address: null,  // null = broadcast
  data: Array.from(msgBytes),
});
```

### Event Listeners
BLE and Nostr events are broadcast via Tauri's event system (future enhancement):
```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for BLE events
await listen('ble-device-discovered', (event) => {
  const device = event.payload as DiscoveredDevice;
  console.log('Found device:', device.name);
});

// Listen for Nostr events
await listen('relay-event', (event) => {
  const relayEvent = event.payload as RelayEvent;
  if (relayEvent.type === 'Event') {
    handleNostrEvent(relayEvent.event);
  }
});
```

## Performance Optimizations

### BLE
- Notification streaming for real-time messages
- Write without response for broadcasts
- Chunk buffer cleanup with configurable TTL
- Compression for large messages

### Crypto
- Conversation key caching (in keyring)
- HKDF for fast key derivation
- Parallel message processing

### Networking
- Tokio for async I/O
- Broadcast channels for fan-out
- RwLock for concurrent reads

### Memory
- Zeroization of secrets
- Chunk buffer expiration
- Seen message garbage collection

## Future Enhancements

### BLE
- [ ] Peripheral mode (advertising)
- [ ] Automatic reconnection
- [ ] Connection prioritization
- [ ] Power management

### Nostr
- [ ] Multi-relay broadcasting
- [ ] Relay pool management
- [ ] Automatic failover
- [ ] NIP-42 authentication

### Storage
- [ ] SQLite for message history
- [ ] Encrypted database
- [ ] Message sync protocol
- [ ] Conflict resolution

### Security
- [ ] Hardware key support
- [ ] Biometric authentication
- [ ] Key rotation
- [ ] Perfect forward secrecy

## Troubleshooting

### BLE Not Working
1. Check platform permissions (macOS: Info.plist, Linux: BlueZ)
2. Verify Bluetooth is enabled
3. Check adapter availability
4. Enable debug logging: `RUST_LOG=debug cargo run`

### Keyring Errors
- macOS: Check Keychain Access permissions
- Windows: Verify Credential Manager access
- Linux: Install libsecret-1-dev

### Build Issues
- Install system dependencies (see tauri.conf.json)
- Update Rust: `rustup update`
- Clean build: `cargo clean && cargo build`

## References

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-44: Encrypted Direct Messages](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [btleplug Documentation](https://docs.rs/btleplug/)
