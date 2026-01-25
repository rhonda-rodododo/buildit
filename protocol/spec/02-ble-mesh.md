# 02. BLE Mesh Protocol

## Service Definition

### Primary Service

```
Service UUID: 12345678-1234-5678-1234-56789abcdef0
Service Name: BuildIt Network Mesh
```

### Characteristics

| Name | UUID Suffix | Properties | Description |
|------|-------------|------------|-------------|
| MESSAGE_WRITE | `0001` | Write, WriteNoResponse | Client → Server messages |
| MESSAGE_READ | `0002` | Read, Notify | Server → Client messages |
| SYNC_REQUEST | `0003` | Write | Negentropy sync initiation |
| SYNC_RESPONSE | `0004` | Read, Notify | Negentropy sync response |
| MESH_ROUTING | `0005` | Read, Write, Notify | Routing table updates |
| DEVICE_INFO | `0006` | Read | Device metadata |

Full UUIDs are formed as: `12345678-1234-5678-1234-56789abcdef{suffix}`

Example: MESSAGE_WRITE = `12345678-1234-5678-1234-56789abcdef1`

## Constants

```
MAX_MTU            = 512      # Maximum BLE transmission unit
CHUNK_SIZE         = 500      # Payload size after header
CHUNK_HEADER_SIZE  = 21       # Header overhead per chunk
MAX_MESSAGE_SIZE   = 102400   # 100 KB max uncompressed
MAX_HOPS           = 10       # Maximum mesh hops
DEFAULT_TTL        = 5        # Default time-to-live
MAX_PEERS          = 7        # Maximum concurrent connections
SCAN_INTERVAL      = 5000     # Periodic scan interval (ms)
SCAN_DURATION      = 10000    # Initial scan duration (ms)
CONNECTION_TIMEOUT = 30000    # Connection timeout (ms)
MESSAGE_TIMEOUT    = 10000    # Message send timeout (ms)
SYNC_INTERVAL      = 60000    # Negentropy sync interval (ms)
RECONNECT_DELAY    = 5000     # Reconnection delay (ms)
REASSEMBLY_TIMEOUT = 30000    # Chunk reassembly timeout (ms)
MESSAGE_TTL_DAYS   = 7        # Store-and-forward retention
```

## Chunk Frame Format

All messages larger than MTU are split into chunks with a 21-byte header:

```
+--------+--------+--------+--------+-----------------+------------------+
| Offset |  0-1   |  2-3   |   4    |      5-20       |     21-N         |
+--------+--------+--------+--------+-----------------+------------------+
| Field  | Chunk  | Total  | Flags  |   Message ID    |   Payload        |
|        | Index  | Chunks |        |   (16 bytes)    |                  |
+--------+--------+--------+--------+-----------------+------------------+
| Size   | uint16 | uint16 | uint8  |   16 bytes      |   0-491 bytes    |
|        | BE     | BE     |        |   UUID          |                  |
+--------+--------+--------+--------+-----------------+------------------+

BE = Big Endian (network byte order)
```

### Flags Byte

```
Bit 0: isLast        (1 = final chunk of message)
Bit 1: isCompressed  (1 = payload is DEFLATE compressed)
Bit 2-7: Reserved    (must be 0)
```

### Message ID

16-byte UUID v4 identifying the message across all chunks:
- Generated once per message
- Used for reassembly and deduplication
- Should be random (crypto.randomUUID())

## Message Types

```
DIRECT     = 0x01  # Point-to-point message to specific device
BROADCAST  = 0x02  # Flood to all connected peers
RELAY      = 0x03  # Multi-hop forwarded message
SYNC_REQ   = 0x04  # Negentropy sync request
SYNC_RESP  = 0x05  # Negentropy sync response
DISCOVERY  = 0x06  # Peer discovery beacon
```

## Message Envelope

After reassembly and decompression, the message envelope:

```json
{
  "type": 1,
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "senderId": "device-uuid",
  "recipientId": "device-uuid-or-null",
  "ttl": 5,
  "hopCount": 0,
  "timestamp": 1706140800000,
  "payload": {
    "event": { /* Nostr event */ }
  }
}
```

## Compression

### Rules

1. Messages < 100 bytes: Send uncompressed
2. Messages >= 100 bytes: Apply DEFLATE compression
3. Set `isCompressed` flag in chunk header

### Detection (Receiver)

```
1. Check isCompressed flag
2. If set, attempt DEFLATE inflate
3. If unset or inflate fails, treat as raw bytes
4. Decode as UTF-8 JSON
```

### Implementation Notes

- Use zlib/pako DEFLATE (not gzip header)
- Compression level: default (6)
- If compressed size > original, send uncompressed

## Multi-Hop Routing

### Routing Table Entry

```typescript
interface RoutingEntry {
  deviceId: string;    // Target device ID
  nextHop: string;     // Next hop device ID
  hopCount: number;    // Distance in hops
  lastSeen: number;    // Timestamp of last contact
  rssi: number;        // Signal strength (dBm)
  txPower: number;     // Transmit power level
}
```

### Forwarding Algorithm

```
RECEIVE message M:

1. IF M.messageId IN seenMessages THEN
     DROP (duplicate)
     RETURN

2. ADD M.messageId TO seenMessages WITH timestamp
     SET expiry = 5 minutes

3. IF M.hopCount >= M.ttl THEN
     DROP (TTL exceeded)
     RETURN

4. IF M.recipientId == self.deviceId THEN
     DELIVER to application layer
     RETURN

5. IF M.type == BROADCAST THEN
     DELIVER to application layer
     # Continue to forward below

6. IF meshRoutingEnabled THEN
     INCREMENT M.hopCount
     FOR EACH peer IN connectedPeers:
       IF peer.deviceId != M.senderId THEN
         SEND M TO peer
```

### Seen Message Cleanup

```
EVERY 60 seconds:
  FOR EACH (messageId, timestamp) IN seenMessages:
    IF now - timestamp > 5 minutes:
      DELETE messageId FROM seenMessages
```

## Peer Discovery

### Advertising Data

When acting as peripheral, advertise:
- Service UUID: `12345678-1234-5678-1234-56789abcdef0`
- Local name: "BuildIt" (truncated if needed)
- Connectable: true

### Scan Response

Optional scan response data:
- Device ID (first 8 chars of UUID)
- Supported features (bitmap)

### Discovery Flow

```
1. Start advertising as peripheral
2. Simultaneously scan for BuildIt service UUID
3. On discovering new peer:
   a. Check if already connected
   b. If not, initiate connection
   c. Discover services
   d. Subscribe to MESSAGE_READ notifications
   e. Read DEVICE_INFO
4. Maintain up to MAX_PEERS connections
5. Prefer peers with better RSSI
```

## Connection Management

### State Machine

```
DISCONNECTED
     │
     ▼ startScan()
 SCANNING
     │
     ▼ didDiscover()
CONNECTING ─────────────────┐
     │                      │
     ▼ didConnect()         ▼ timeout/error
 CONNECTED              DISCONNECTED
     │                      ▲
     ▼ didDisconnect()      │
DISCONNECTED ◄──────────────┘
```

### Reconnection Strategy

```
ON disconnect:
  IF wasConnected AND shouldReconnect:
    WAIT RECONNECT_DELAY
    IF peer still in range:
      ATTEMPT reconnection
      IF failed:
        EXPONENTIAL backoff (max 60 seconds)
```

### Connection Priority

When at MAX_PEERS, prioritize:
1. Explicitly requested peers
2. Recently active peers
3. Better signal strength (RSSI)
4. Disconnect least priority to make room

## Store-and-Forward

### Queue Entry

```typescript
interface QueuedMessage {
  id: string;
  event: NostrEvent;
  recipientId: string;
  ttl: number;
  hopCount: number;
  createdAt: number;
  lastAttemptAt: number;
  attempts: number;
  status: 'pending' | 'sent' | 'expired';
}
```

### Processing

```
ON peer connect:
  FOR EACH message IN queue:
    IF message.recipientId == peer.deviceId OR
       message.type == BROADCAST:
      ATTEMPT send
      IF success:
        MARK message AS sent
      ELSE:
        INCREMENT attempts

ON queue cleanup (hourly):
  FOR EACH message IN queue:
    IF now - message.createdAt > MESSAGE_TTL_DAYS:
      DELETE message
```

## Native vs Web Bluetooth Comparison

| Feature | Web Bluetooth | Native (iOS/Android) |
|---------|--------------|---------------------|
| Peripheral Mode | ❌ Not supported | ✅ Full support |
| Background Scanning | ❌ Page must be visible | ✅ Foreground service |
| Multiple Connections | Limited to 1 | ✅ Up to 7 peers |
| RSSI Monitoring | ❌ Not available | ✅ Continuous |
| MTU Negotiation | Fixed 512 | ✅ Up to 517 (BLE 5.0) |
| Service Discovery | Limited | ✅ Full GATT |
| Advertising Data | ❌ Not supported | ✅ Custom data |
| Connection Interval | Not configurable | ✅ Configurable |

## Error Codes

```
BLE_NOT_AVAILABLE      = 0x01  # BLE hardware unavailable
BLE_NOT_AUTHORIZED     = 0x02  # Permission denied
BLE_POWERED_OFF        = 0x03  # Bluetooth disabled
PEER_NOT_FOUND         = 0x04  # Target device not in range
CONNECTION_FAILED      = 0x05  # Connection attempt failed
CONNECTION_TIMEOUT     = 0x06  # Connection timed out
WRITE_FAILED           = 0x07  # Characteristic write failed
READ_FAILED            = 0x08  # Characteristic read failed
MESSAGE_TOO_LARGE      = 0x09  # Message exceeds MAX_MESSAGE_SIZE
REASSEMBLY_TIMEOUT     = 0x0A  # Chunk reassembly timed out
INVALID_CHUNK          = 0x0B  # Malformed chunk received
MAX_PEERS_REACHED      = 0x0C  # Cannot accept more connections
```

## Platform Implementation Notes

### iOS (Core Bluetooth)

```swift
// Central mode
let centralManager = CBCentralManager()
centralManager.scanForPeripherals(withServices: [serviceUUID])

// Peripheral mode
let peripheralManager = CBPeripheralManager()
peripheralManager.add(service)
peripheralManager.startAdvertising([
    CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
    CBAdvertisementDataLocalNameKey: "BuildIt"
])
```

### Android (Android BLE API)

```kotlin
// Central mode
val scanner = bluetoothAdapter.bluetoothLeScanner
scanner.startScan(filters, settings, callback)

// Peripheral mode
val advertiser = bluetoothAdapter.bluetoothLeAdvertiser
val gattServer = bluetoothManager.openGattServer(context, callback)
advertiser.startAdvertising(settings, data, callback)
```

### Desktop (btleplug)

```rust
// Central mode
let manager = Manager::new().await?;
let adapters = manager.adapters().await?;
let central = adapters.into_iter().next().unwrap();
central.start_scan(ScanFilter::default()).await?;

// Note: btleplug does not support peripheral mode
// Desktop acts as central only, connecting to mobile peripherals
```
