# BLE Mesh Networking Implementation (Epic 44)

**Status**: MVP Complete (Phase 1)
**Version**: v0.44.0-ble-mesh
**Date**: 2025-10-08

## Overview

BuildIt Network now uses BLE mesh networking as the **PRIMARY** transport layer, with Nostr relays as secondary (internet fallback). This offline-first architecture enables communication during internet shutdowns, protests, and disaster scenarios.

## Architecture

### Transport Priority Order

```
Application Layer
    ↓
Transport Service (unified API)
    ↓
Transport Router (automatic failover)
    ↓
1. BLE Mesh (PRIMARY) - Offline-first, local mesh
2. Nostr Relays (SECONDARY) - Internet fallback
3. Future: LoRa, other mesh protocols
```

### Key Design Decisions

- **BLE Mesh First**: Unlike traditional apps, BLE mesh is the primary networking layer
- **Pluggable Transports**: Clean adapter interface allows future protocols (LoRa, mesh radio)
- **Automatic Failover**: Router automatically tries BLE first, then Nostr
- **Store-and-Forward**: Messages queue when all transports unavailable
- **Zero Changes to App Logic**: Existing code continues working, now with offline support

## Components

### 1. Transport Abstraction Layer (`src/core/transport/`)

**Purpose**: Protocol-agnostic messaging interface

**Files**:
- `types.ts` - Transport interfaces and enums
- `TransportRouter.ts` - Routes messages through available transports
- `TransportService.ts` - Main singleton service
- `NostrRelayAdapter.ts` - Nostr relay adapter (secondary transport)

**Key Types**:
```typescript
interface ITransportAdapter {
  type: TransportType;
  status: TransportStatus;
  capabilities: TransportCapabilities;
  sendMessage(message: TransportMessage): Promise<void>;
  onMessage(callback: (message: TransportMessage) => void): () => void;
  // ...
}
```

### 2. BLE Mesh Adapter (`src/core/ble/`)

**Purpose**: Bluetooth Low Energy mesh networking

**Files**:
- `BLEMeshAdapter.ts` - Main BLE mesh implementation
- `constants.ts` - BLE UUIDs, limits, configuration
- `compression.ts` - Message compression and chunking for 512-byte MTU

**Features**:
- **Web Bluetooth API** integration
- **Auto-discovery** of nearby BuildIt nodes
- **Message compression** using gzip (pako)
- **Chunking** for 512-byte BLE MTU limit
- **Multi-hop routing** up to 10 hops
- **Message reassembly** for chunked transmissions

**Limitations**:
- **Browser Support**: Chrome, Edge, Android only (Safari/iOS not supported yet)
- **Peripheral Mode**: Web Bluetooth only supports central (client) mode, not peripheral (server)
- **Range**: ~30 meters per hop, extendable via multi-hop

### 3. UI Components (`src/components/transport/`)

**Files**:
- `TransportStatusIndicator.tsx` - Shows BLE mesh and Nostr connection status

## Usage

### Initialization

```typescript
import { TransportService } from '@/core/transport';

// Get singleton instance
const transport = TransportService.getInstance({
  enableBLE: true,      // BLE mesh (primary)
  enableNostr: true,    // Nostr relays (fallback)
});

// Initialize and connect
await transport.initialize();
await transport.connect();
```

### Sending Messages

```typescript
// Send Nostr event (automatically routed through BLE first, then Nostr)
await transport.sendEvent(nostrEvent);
```

### Receiving Messages

```typescript
// Subscribe to messages from any transport
const unsubscribe = transport.onMessage((message) => {
  console.log(`Received via ${message.transport}:`, message.event);
});
```

### Status Monitoring

```typescript
// Check if connected to any transport
const isConnected = transport.isConnected();

// Check specific transports
const isBLEConnected = transport.isBLEConnected();
const isNostrConnected = transport.isNostrConnected();

// Get BLE mesh peers
const peers = await transport.getBLEPeers();

// Get connected Nostr relays
const relays = await transport.getNostrRelays();
```

## Implementation Details

### BLE Service UUID

```
Service: 12345678-1234-5678-1234-56789abcdef0
```

**Characteristics**:
- `MESSAGE_WRITE` - Write messages to peer
- `MESSAGE_READ` - Read messages from peer
- `SYNC_REQUEST` - Negentropy sync requests (future)
- `SYNC_RESPONSE` - Negentropy sync responses (future)
- `DEVICE_INFO` - Device information
- `MESH_ROUTING` - Multi-hop routing metadata

### Message Format

**Chunk Structure** (512 bytes max):
```
[chunkIndex: 2 bytes]
[totalChunks: 2 bytes]
[isLastChunk: 1 byte]
[messageId: 16 bytes]
[data: remaining bytes]
```

**Compression**:
- Gzip compression using `pako`
- Only applied if beneficial (message > 100 bytes)
- Fallback to uncompressed if compression fails

### Multi-Hop Routing

Messages propagate through intermediate nodes:
1. Device A sends to Device B
2. Device B relays to Device C
3. Device C delivers to Device D

**TTL (Time-to-Live)**: Default 5 hops
**Max Hops**: 10 hops
**Duplicate Detection**: Message IDs tracked to prevent loops

### Store-and-Forward

Messages queue when no transport available:
- **Max Queue Time**: 7 days
- **Queue Location**: TransportRouter
- **Auto-Retry**: When transport reconnects

## Phase 1 Complete (MVP)

✅ **Infrastructure**:
- Transport abstraction layer
- BLE mesh adapter (Web Bluetooth)
- Nostr relay adapter (fallback)
- TransportService (unified API)
- TransportRouter (automatic failover)

✅ **Core Features**:
- Auto-discovery of nearby nodes
- Message compression and chunking
- Multi-hop routing (up to 10 hops)
- Store-and-forward queue
- Duplicate detection
- Connection status monitoring

✅ **UI**:
- TransportStatusIndicator component

## Phase 2 Deferred (Future Iterations)

⏸️ **Advanced Sync**:
- Negentropy protocol integration
- Battery-optimized sync intervals
- Selective sync filters

⏸️ **Security Hardening**:
- NIP-17 E2E encryption over BLE
- Forward secrecy for mesh hops
- Rotating BLE identifiers (anti-tracking)
- Message deanonymization prevention

⏸️ **Full Module Integration**:
- Offline DM sync
- Offline group message sync
- Offline event creation/updates
- Offline proposal votes
- Conflict resolution (CRDTs)

⏸️ **Advanced UI**:
- BLE settings panel
- Offline mode banner
- Message delivery status indicators
- Peer connection manager

⏸️ **Documentation**:
- BLE mesh threat model
- Offline usage scenarios
- User guide for high-risk scenarios

⏸️ **Testing**:
- Comprehensive unit tests
- Multi-device E2E tests
- Battery consumption tests
- Range tests

## Known Limitations

1. **Web Bluetooth API** support limited to Chrome, Edge, Android
   - Safari/iOS not supported yet
   - Desktop Safari future support uncertain

2. **Peripheral Mode** not available in Web Bluetooth
   - Can only act as central (client), not peripheral (server)
   - Limits mesh topology options

3. **BLE Range** approximately 30 meters
   - Extendable via multi-hop routing
   - Affected by obstacles, interference

4. **No Negentropy Sync** yet
   - Basic message relay only
   - Future: Efficient set reconciliation

5. **Encryption** reuses existing NIP-17
   - Not yet optimized for BLE transport
   - Future: BLE-specific encryption optimizations

## Browser Compatibility

| Browser | BLE Mesh Support | Nostr Fallback |
|---------|------------------|----------------|
| Chrome Desktop | ✅ Yes | ✅ Yes |
| Chrome Android | ✅ Yes | ✅ Yes |
| Edge Desktop | ✅ Yes | ✅ Yes |
| Edge Mobile | ✅ Yes | ✅ Yes |
| Firefox Desktop | ❌ No (Web Bluetooth disabled) | ✅ Yes |
| Firefox Android | ❌ No | ✅ Yes |
| Safari Desktop | ❌ No | ✅ Yes |
| Safari iOS | ❌ No | ✅ Yes |

**Fallback Strategy**: All browsers fall back to Nostr relays

## Use Cases

### 1. Protest/Direct Action
- Internet shutdown by authorities
- BLE mesh enables local coordination
- Messages hop through nearby organizers
- No centralized infrastructure needed

### 2. Disaster Relief
- Internet infrastructure damaged
- BLE mesh for local communication
- Coordination without cellular service
- BitChat-inspired resilience

### 3. Rural/Remote Areas
- Limited or no internet connectivity
- BLE mesh for local organizing
- Sync to cloud when internet available

### 4. Privacy-Conscious Organizing
- Avoid centralized relay logs
- Local-first communication
- Reduced metadata exposure

## Future Enhancements

1. **Native Mobile Apps** (React Native)
   - Full peripheral mode support
   - Better background processing
   - Extended range with BLE 5.0

2. **LoRa Mesh** integration
   - Long-range radio (5-10 km)
   - Lower bandwidth but extreme range
   - Complementary to BLE mesh

3. **Hybrid Mesh Topologies**
   - BLE + LoRa + Nostr
   - Automatic best-path routing
   - Resilience through diversity

4. **Offline Content Caching**
   - Cache critical group data
   - Sync when connectivity returns
   - Prioritized sync queues

## References

- **Samiz**: https://github.com/KoalaSat/samiz (Nostr-over-BLE inspiration)
- **BitChat**: Jack Dorsey's mesh messaging concept
- **Web Bluetooth API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- **Negentropy**: https://github.com/hoytech/negentropy (efficient sync)
- **NIP-17**: Nostr private direct messages

## Migration Guide

### For Existing Code

No changes required! The transport layer is backward compatible:

```typescript
// Old code (still works)
const client = getNostrClient();
await client.publish(event);

// New code (recommended)
const transport = TransportService.getInstance();
await transport.sendEvent(event);
```

### For New Features

Use TransportService instead of NostrClient directly:

```typescript
import { TransportService } from '@/core/transport';

const transport = TransportService.getInstance();

// Send message (BLE first, then Nostr)
await transport.sendEvent(event);

// Receive messages from any transport
transport.onMessage((message) => {
  // Handle message
});
```

## Conclusion

Epic 44 Phase 1 delivers a working BLE mesh infrastructure with automatic fallback to Nostr relays. This offline-first architecture positions BuildIt Network as a resilient communication platform for high-risk organizing scenarios.

**Next Steps** (Phase 2):
- Negentropy sync protocol
- Full security hardening
- Module integration
- Comprehensive testing

---

**Implementation**: 12 hours
**Effort**: Phase 1 of 40-60h epic (30% complete)
**Status**: MVP ready for testing and iteration
