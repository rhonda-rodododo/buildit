# 07. Message Types

## Overview

BuildIt supports various message types through the Nostr protocol and BLE mesh transport.

## Direct Messages (DMs)

### Format

DMs use NIP-17 gift wrapping for metadata protection.

```typescript
interface DirectMessage {
  id: string;              // Message ID (rumor event ID)
  content: string;         // Message text
  sender: string;          // Sender pubkey
  recipient: string;       // Recipient pubkey
  createdAt: number;       // Unix timestamp
  replyTo?: string;        // Optional: referenced message ID
  attachments?: Attachment[];
}

interface Attachment {
  type: 'image' | 'file' | 'audio' | 'video';
  url: string;             // Content URL or data URL
  mimeType: string;
  size: number;            // bytes
  name?: string;           // filename
  dimensions?: { width: number; height: number };
  duration?: number;       // seconds (audio/video)
  blurhash?: string;       // Image placeholder
}
```

### Rumor Event (Kind 14)

```typescript
{
  kind: 14,
  pubkey: '<sender_pubkey>',
  created_at: randomizedTimestamp(),  // ±2 days
  tags: [
    ['p', '<recipient_pubkey>'],
    ['e', '<reply_to_id>', '', 'reply'],  // Optional
  ],
  content: 'Hello!',
  // Note: NO signature (rumor is unsigned)
}
```

### Gift Wrap Flow

1. Create rumor (kind 14, unsigned)
2. Wrap in seal (kind 13, sender signature)
3. Wrap in gift wrap (kind 1059, ephemeral signature)
4. Publish gift wrap to relays

## Group Messages

### Group Types

```typescript
type GroupType = 'small' | 'large';

interface Group {
  id: string;              // Group ID
  name: string;
  description?: string;
  avatar?: string;
  type: GroupType;
  members: GroupMember[];
  admins: string[];        // Admin pubkeys
  createdAt: number;
  createdBy: string;       // Creator pubkey
  settings: GroupSettings;
}

interface GroupMember {
  pubkey: string;
  role: 'admin' | 'member';
  joinedAt: number;
  invitedBy?: string;
}

interface GroupSettings {
  encryption: 'nip17' | 'noise';  // small vs large groups
  allowInvites: 'admins' | 'members' | 'none';
  messageRetention?: number;       // days, 0 = forever
  readReceipts: boolean;
}
```

### Small Groups (NIP-17)

For groups with ≤20 members, use NIP-17:
- Send gift-wrapped message to each member
- Same content, different encryption per recipient

```typescript
async function sendSmallGroupMessage(
  content: string,
  group: Group,
  senderKey: Uint8Array
): Promise<void> {
  const rumor = createRumor(content, group.id);

  for (const member of group.members) {
    if (member.pubkey === getPublicKey(senderKey)) continue;

    const giftWrap = await createGiftWrap(rumor, senderKey, member.pubkey);
    await publishToRelays(giftWrap);
  }
}
```

### Large Groups (Future: Noise Protocol)

For groups with >20 members:
- Shared group key (rotated on membership change)
- Single encrypted message to group relay
- Forward secrecy via ratcheting

## Reactions

### Format

```typescript
interface Reaction {
  type: 'emoji' | 'custom';
  content: string;         // Emoji or custom reaction
  targetId: string;        // Message/event ID
  targetPubkey: string;    // Author of target
}
```

### Event (Kind 7)

```typescript
{
  kind: 7,
  pubkey: '<reactor_pubkey>',
  created_at: timestamp,
  tags: [
    ['e', '<target_event_id>'],
    ['p', '<target_pubkey>'],
  ],
  content: '👍',  // or custom reaction
}
```

## Read Receipts

### Format

```typescript
interface ReadReceipt {
  messageIds: string[];    // Messages marked as read
  conversationId: string;  // DM partner pubkey or group ID
  readAt: number;          // Timestamp
}
```

### Event (Kind 15)

```typescript
// Gift-wrapped for privacy
{
  kind: 15,
  pubkey: '<reader_pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<conversation_partner>'],  // For DMs
    ['g', '<group_id>'],              // For groups
  ],
  content: JSON.stringify({
    lastRead: '<last_message_id>',
    readAt: timestamp,
  }),
}
```

## Typing Indicators

### Format

```typescript
interface TypingIndicator {
  conversationId: string;
  isTyping: boolean;
}
```

### Event (Ephemeral, Kind 25)

```typescript
// Not persisted, gift-wrapped
{
  kind: 25,
  pubkey: '<typer_pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<recipient_pubkey>'],
    ['expiration', (timestamp + 10).toString()],  // 10 second TTL
  ],
  content: JSON.stringify({ typing: true }),
}
```

## Profile Updates

### Format

```typescript
interface Profile {
  name?: string;
  displayName?: string;
  about?: string;
  picture?: string;         // Avatar URL
  banner?: string;          // Banner URL
  nip05?: string;           // NIP-05 identifier
  lud16?: string;           // Lightning address
  website?: string;
}
```

### Event (Kind 0)

```typescript
{
  kind: 0,
  pubkey: '<user_pubkey>',
  created_at: timestamp,
  tags: [],
  content: JSON.stringify(profile),
}
```

## Contact List

### Format

```typescript
interface Contact {
  pubkey: string;
  relay?: string;          // Preferred relay
  petname?: string;        // Local nickname
}
```

### Event (Kind 3)

```typescript
{
  kind: 3,
  pubkey: '<user_pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<contact1_pubkey>', '<relay_url>', '<petname>'],
    ['p', '<contact2_pubkey>', '<relay_url>', '<petname>'],
  ],
  content: '',
}
```

## BLE Mesh Message Types

### Envelope

All BLE messages are wrapped in an envelope:

```typescript
interface BLEEnvelope {
  type: BLEMessageType;
  messageId: string;        // UUID
  senderId: string;         // Device ID
  recipientId?: string;     // Null for broadcast
  ttl: number;
  hopCount: number;
  timestamp: number;
  payload: BLEPayload;
}

type BLEPayload =
  | { type: 'nostr'; event: NostrEvent }
  | { type: 'sync'; negentropy: string }
  | { type: 'discovery'; info: DeviceInfo }
  | { type: 'ack'; messageId: string };
```

### Message Type Codes

```typescript
enum BLEMessageType {
  DIRECT     = 0x01,  // Point-to-point
  BROADCAST  = 0x02,  // Flood to all
  RELAY      = 0x03,  // Multi-hop forward
  SYNC_REQ   = 0x04,  // Negentropy request
  SYNC_RESP  = 0x05,  // Negentropy response
  DISCOVERY  = 0x06,  // Peer announcement
  ACK        = 0x07,  // Delivery acknowledgment
}
```

### Device Discovery

```typescript
interface DeviceInfo {
  deviceId: string;
  deviceName?: string;
  publicKey?: string;      // For DH key exchange
  capabilities: string[];  // ['mesh', 'sync', 'relay']
  version: string;         // Protocol version
  batteryLevel?: number;   // 0-100
}
```

## Negentropy Sync

### Request

```typescript
interface NegentropyRequest {
  sessionId: string;
  filter: Filter;          // Nostr subscription filter
  query: string;           // Base64 negentropy query
  timestamp: number;
}
```

### Response

```typescript
interface NegentropyResponse {
  sessionId: string;
  message: string;         // Base64 negentropy message
  have: string[];          // Event IDs we have that they don't
  need: string[];          // Event IDs they have that we need
  done: boolean;           // Sync complete
}
```

## Delivery Status

### Local Tracking

```typescript
interface MessageDeliveryStatus {
  messageId: string;
  status: DeliveryStatus;
  transport: TransportType;
  sentAt?: number;
  deliveredAt?: number;
  readAt?: number;
  error?: string;
}

enum DeliveryStatus {
  PENDING   = 'pending',    // In queue
  SENT      = 'sent',       // Sent to transport
  RELAYED   = 'relayed',    // Forwarded by mesh
  DELIVERED = 'delivered',  // Received by recipient
  READ      = 'read',       // Read by recipient
  FAILED    = 'failed',     // Delivery failed
}
```

### Status Updates (Kind 16)

```typescript
// Gift-wrapped delivery receipt
{
  kind: 16,
  pubkey: '<recipient_pubkey>',
  created_at: timestamp,
  tags: [
    ['e', '<message_id>'],
    ['p', '<sender_pubkey>'],
    ['status', 'delivered'],
  ],
  content: '',
}
```

## Application-Specific Events

BuildIt may define additional event kinds for modules:

| Kind Range | Purpose |
|------------|---------|
| 30000-39999 | Parameterized replaceable events |
| 40000-49999 | Application-specific events |

### Custom Event Template

```typescript
{
  kind: 4xxxx,
  pubkey: '<user_pubkey>',
  created_at: timestamp,
  tags: [
    ['d', '<unique_identifier>'],
    ['module', '<module_name>'],
    // Module-specific tags
  ],
  content: JSON.stringify({
    // Module-specific content
  }),
}
```

## Content Validation

All message content is validated before processing:

```typescript
import { z } from 'zod';

const MessageContentSchema = z.object({
  text: z.string().max(65535),
  attachments: z.array(z.object({
    type: z.enum(['image', 'file', 'audio', 'video']),
    url: z.string().url(),
    mimeType: z.string(),
    size: z.number().int().positive(),
    name: z.string().optional(),
  })).optional(),
});

function validateMessageContent(content: unknown): boolean {
  try {
    MessageContentSchema.parse(content);
    return true;
  } catch {
    return false;
  }
}
```

## Size Limits

| Type | Limit |
|------|-------|
| Message text | 65,535 bytes |
| Attachment URL | 2,048 bytes |
| Total message JSON | 100 KB (BLE) |
| Nostr event content | 64 KB (relay) |
| Profile JSON | 10 KB |
| Group name | 256 bytes |
| Group description | 4,096 bytes |
