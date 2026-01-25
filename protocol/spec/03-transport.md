# 03. Transport Layer Protocol

## Transport Types

```typescript
enum TransportType {
  BLE_MESH    = 'ble-mesh',    // Primary: offline, local
  NOSTR_RELAY = 'nostr-relay', // Secondary: online, global
  LORA_MESH   = 'lora-mesh',   // Future: long-range radio
  MESH_RADIO  = 'mesh-radio',  // Future: other protocols
}
```

## Priority Order

Transports are tried in order of preference:

```
1. BLE_MESH    - Offline-first, ~30m range, free
2. NOSTR_RELAY - Internet required, global, relay dependent
3. LORA_MESH   - Future: long-range, low bandwidth
4. MESH_RADIO  - Future: other protocols
```

## Transport Adapter Interface

All transports implement this interface:

```typescript
interface ITransportAdapter {
  readonly type: TransportType;
  readonly status: TransportStatus;
  readonly capabilities: TransportCapabilities;

  // Lifecycle
  initialize(): Promise<void>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  // Messaging
  send(message: TransportMessage): Promise<void>;
  subscribe(filter: SubscriptionFilter): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;

  // Events
  onMessage: (callback: (message: TransportMessage) => void) => void;
  onStatusChange: (callback: (status: TransportStatus) => void) => void;
}
```

## Transport Status

```typescript
enum TransportStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING   = 'connecting',
  CONNECTED    = 'connected',
  ERROR        = 'error',
}
```

## Transport Capabilities

```typescript
interface TransportCapabilities {
  canSend: boolean;
  canReceive: boolean;
  supportsMultiHop: boolean;
  supportsStoreAndForward: boolean;
  maxMessageSize: number;      // bytes
  estimatedRange: number;      // meters (0 = unlimited)
  requiresInternet: boolean;
  batteryEfficiency: 'low' | 'medium' | 'high';
}
```

### Capability Matrix

| Transport | Multi-hop | Store/Fwd | Max Size | Range | Internet | Battery |
|-----------|-----------|-----------|----------|-------|----------|---------|
| BLE Mesh | ✅ | ✅ | 100 KB | 30m | ❌ | High |
| Nostr | ❌ | ❌ | 64 KB | ∞ | ✅ | Medium |
| LoRa | ✅ | ✅ | 255 B | 10km | ❌ | High |

## Transport Message

```typescript
interface TransportMessage {
  id: string;                   // Unique message ID (UUID)
  event: NostrEvent;            // Wrapped Nostr event
  transport: TransportType;     // Transport used/target
  status: DeliveryStatus;       // Delivery state
  ttl: number;                  // Time-to-live (hops or retries)
  hopCount: number;             // Current hop count
  createdAt: number;            // Creation timestamp (ms)
  lastRelayedAt?: number;       // Last relay timestamp
  senderId?: string;            // Sender device ID
  recipientId?: string;         // Recipient device ID (null = broadcast)
  compressed?: boolean;         // Compression flag
  encrypted?: boolean;          // Encryption flag
}
```

## Delivery Status

```typescript
enum DeliveryStatus {
  PENDING   = 'pending',   // Queued, not sent
  SENT      = 'sent',      // Sent to transport
  RELAYED   = 'relayed',   // Forwarded by mesh
  DELIVERED = 'delivered', // Confirmed receipt
  FAILED    = 'failed',    // Delivery failed
}
```

## Transport Router

The router manages transport selection and failover.

### Configuration

```typescript
interface TransportRouterConfig {
  preferredOrder: TransportType[];  // Priority order
  autoFailover: boolean;            // Try next on failure
  autoFallback: boolean;            // Use internet when mesh unavailable
  maxRetries: number;               // Retries per transport
  timeout: number;                  // Operation timeout (ms)
  storeAndForward: boolean;         // Queue when offline
  maxStoreTime: number;             // Max queue retention (ms)
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: TransportRouterConfig = {
  preferredOrder: [
    TransportType.BLE_MESH,
    TransportType.NOSTR_RELAY,
  ],
  autoFailover: true,
  autoFallback: true,
  maxRetries: 3,
  timeout: 30000,           // 30 seconds
  storeAndForward: true,
  maxStoreTime: 604800000,  // 7 days
};
```

## Failover Logic

### Send Algorithm

```
FUNCTION send(message):
  FOR EACH transport IN preferredOrder:
    IF transport.status != CONNECTED:
      CONTINUE

    FOR attempt = 1 TO maxRetries:
      TRY:
        AWAIT transport.send(message) WITH timeout
        message.status = SENT
        RETURN SUCCESS
      CATCH error:
        IF attempt < maxRetries:
          WAIT exponentialBackoff(attempt)
        CONTINUE

    IF autoFailover:
      CONTINUE to next transport
    ELSE:
      THROW error

  # No transport succeeded
  IF storeAndForward:
    QUEUE message FOR later
    message.status = PENDING
    RETURN QUEUED
  ELSE:
    message.status = FAILED
    THROW "No transport available"
```

### Exponential Backoff

```typescript
function exponentialBackoff(attempt: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 30000; // 30 seconds
  const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
  const jitter = Math.random() * 0.3 * delay; // 0-30% jitter
  return delay + jitter;
}
```

## Message Queue

### Queue Entry

```typescript
interface QueueEntry {
  id: string;
  message: TransportMessage;
  priority: number;           // Higher = more urgent
  attempts: number;           // Retry count
  lastAttemptAt: number;      // Last attempt timestamp
  nextAttemptAt: number;      // Scheduled retry time
  expiresAt: number;          // Queue expiration
}
```

### Queue Processing

```
ON transport.status CHANGED TO CONNECTED:
  PROCESS queue FOR transport.type

FUNCTION processQueue(transportType):
  entries = GET entries WHERE
    message.transport == transportType OR
    message.transport IS NULL
  ORDER BY priority DESC, createdAt ASC

  FOR EACH entry IN entries:
    IF entry.expiresAt < now:
      DELETE entry
      CONTINUE

    TRY:
      AWAIT send(entry.message) VIA transportType
      DELETE entry
    CATCH:
      entry.attempts++
      entry.lastAttemptAt = now
      entry.nextAttemptAt = now + exponentialBackoff(entry.attempts)
      IF entry.attempts >= maxRetries:
        entry.message.status = FAILED
        # Keep in queue until expires for potential other transport
```

### Queue Cleanup

```
EVERY hour:
  DELETE entries WHERE expiresAt < now
  DELETE entries WHERE status == FAILED AND attempts >= maxRetries
```

## Deduplication

### Deduplicator

```typescript
class MessageDeduplicator {
  private seen: Map<string, number>; // messageId -> timestamp
  private maxAge: number = 300000;   // 5 minutes

  isDuplicate(messageId: string): boolean {
    this.cleanup();

    if (this.seen.has(messageId)) {
      return true;
    }

    this.seen.set(messageId, Date.now());
    return false;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.maxAge;
    for (const [id, timestamp] of this.seen) {
      if (timestamp < cutoff) {
        this.seen.delete(id);
      }
    }
  }
}
```

### Deduplication Strategy

1. **Per-message ID**: Each message has unique UUID
2. **5-minute window**: Seen IDs expire after 5 minutes
3. **Cross-transport**: Same ID deduplicated across BLE and Nostr
4. **Cleanup on interval**: Hourly cleanup of expired entries

## Subscription Management

### Subscription Filter

```typescript
interface SubscriptionFilter {
  kinds?: number[];          // Nostr event kinds
  authors?: string[];        // Pubkey hex strings
  since?: number;            // Unix timestamp
  until?: number;            // Unix timestamp
  limit?: number;            // Max events to return
  '#p'?: string[];           // Tagged pubkeys
  '#e'?: string[];           // Referenced events
}
```

### Subscription Flow

```
FUNCTION subscribe(filter):
  subscriptionId = generateUUID()

  FOR EACH transport IN activeTransports:
    IF transport.capabilities.canReceive:
      transport.subscribe(subscriptionId, filter)

  RETURN subscriptionId

FUNCTION unsubscribe(subscriptionId):
  FOR EACH transport IN activeTransports:
    transport.unsubscribe(subscriptionId)
```

## Statistics

### Transport Statistics

```typescript
interface TransportStats {
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  failures: number;
  avgLatency: number;          // milliseconds
  lastActiveAt: number;        // timestamp
  uptime: number;              // milliseconds
  peersConnected?: number;     // BLE only
  relaysConnected?: number;    // Nostr only
}
```

### Metrics Collection

```
ON message sent:
  stats.messagesSent++
  stats.bytesSent += message.size

ON message received:
  stats.messagesReceived++
  stats.bytesReceived += message.size

ON failure:
  stats.failures++

ON connect:
  stats.connectedAt = now

ON disconnect:
  stats.uptime += now - stats.connectedAt
```

## Error Handling

### Transport Errors

```typescript
enum TransportError {
  CONNECTION_FAILED = 'connection_failed',
  SEND_FAILED = 'send_failed',
  TIMEOUT = 'timeout',
  INVALID_MESSAGE = 'invalid_message',
  NOT_CONNECTED = 'not_connected',
  PERMISSION_DENIED = 'permission_denied',
  UNSUPPORTED = 'unsupported',
}
```

### Error Recovery

```
ON transport error:
  LOG error details

  IF error.type == CONNECTION_FAILED:
    SCHEDULE reconnection with backoff

  IF error.type == SEND_FAILED:
    IF autoFailover:
      TRY next transport
    ELSE:
      QUEUE message IF storeAndForward

  IF error.type == TIMEOUT:
    INCREMENT retry counter
    IF retries < maxRetries:
      RETRY with backoff
```

## Platform Notes

### iOS
- Use `NWPathMonitor` for connectivity changes
- Background fetch for queue processing
- Network extension for always-on mesh

### Android
- Use `ConnectivityManager` for network state
- WorkManager for reliable background sync
- Foreground service for active mesh

### Desktop
- Native network APIs via Tauri
- System tray for background operation
- Auto-start on login option
