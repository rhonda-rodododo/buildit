# 05. Nostr Protocol Extensions

## Supported NIPs

| NIP | Name | Status | Description |
|-----|------|--------|-------------|
| NIP-01 | Basic Protocol | Full | Core event structure, subscriptions |
| NIP-04 | Encrypted DMs | Full | Legacy DM support (for compatibility) |
| NIP-17 | Private DMs | Full | Gift-wrapped messages |
| NIP-44 | Versioned Encryption | Full | ChaCha20-Poly1305 |
| NIP-46 | Nostr Connect | Full | Remote signing |
| NIP-51 | Lists | Partial | Contact/mute lists |
| NIP-59 | Gift Wrap | Full | Metadata protection |

## Event Structure (NIP-01)

### Base Event

```typescript
interface NostrEvent {
  id: string;           // 32-byte hex, SHA256 hash of serialized event
  pubkey: string;       // 32-byte hex, secp256k1 public key
  created_at: number;   // Unix timestamp (seconds)
  kind: number;         // Event type
  tags: string[][];     // Array of tag arrays
  content: string;      // Event content
  sig: string;          // 64-byte hex, Schnorr signature
}
```

### Event ID Calculation

```typescript
function getEventId(event: UnsignedEvent): string {
  const serialized = JSON.stringify([
    0,                   // Reserved
    event.pubkey,        // Pubkey hex
    event.created_at,    // Timestamp
    event.kind,          // Kind number
    event.tags,          // Tags array
    event.content,       // Content string
  ]);

  return sha256Hex(serialized);
}
```

### Event Signing

```typescript
function signEvent(
  event: UnsignedEvent,
  privateKey: Uint8Array
): NostrEvent {
  const id = getEventId(event);
  const sig = schnorrSign(hexToBytes(id), privateKey);

  return {
    ...event,
    id,
    sig: bytesToHex(sig),
  };
}
```

### Event Verification

```typescript
function verifyEvent(event: NostrEvent): boolean {
  // 1. Verify ID
  const expectedId = getEventId(event);
  if (event.id !== expectedId) return false;

  // 2. Verify signature
  return schnorrVerify(
    hexToBytes(event.sig),
    hexToBytes(event.id),
    hexToBytes(event.pubkey)
  );
}
```

## Event Kinds

### Core Kinds

| Kind | Name | Encryption | Description |
|------|------|------------|-------------|
| 0 | Metadata | None | User profile |
| 1 | Short Text Note | None | Public post |
| 3 | Contact List | None | Following list |
| 4 | Encrypted DM | NIP-04 | Legacy DM (deprecated) |

### NIP-17 Private DM Kinds

| Kind | Name | Encryption | Description |
|------|------|------------|-------------|
| 13 | Seal | NIP-44 | Encrypted rumor container |
| 14 | DM Rumor | NIP-44 | Actual message (unsigned) |
| 1059 | Gift Wrap | NIP-44 | Encrypted seal container |

### NIP-46 Remote Signing Kinds

| Kind | Name | Encryption | Description |
|------|------|------------|-------------|
| 24133 | NIP-46 Request | NIP-44 | Signing request |
| 24134 | NIP-46 Response | NIP-44 | Signing response |

## Relay Connection

### WebSocket Protocol

```typescript
// Client → Relay messages
type ClientMessage =
  | ['EVENT', NostrEvent]                        // Publish event
  | ['REQ', string, ...Filter[]]                 // Subscribe
  | ['CLOSE', string]                            // Unsubscribe
  | ['AUTH', NostrEvent];                        // NIP-42 auth

// Relay → Client messages
type RelayMessage =
  | ['EVENT', string, NostrEvent]                // Subscription event
  | ['OK', string, boolean, string]              // Publish result
  | ['EOSE', string]                             // End of stored events
  | ['CLOSED', string, string]                   // Subscription closed
  | ['NOTICE', string]                           // Human-readable message
  | ['AUTH', string];                            // NIP-42 challenge
```

### Subscription Filter

```typescript
interface Filter {
  ids?: string[];        // Event IDs
  authors?: string[];    // Pubkey hex strings
  kinds?: number[];      // Event kinds
  since?: number;        // Unix timestamp
  until?: number;        // Unix timestamp
  limit?: number;        // Max events
  '#e'?: string[];       // Referenced events
  '#p'?: string[];       // Tagged pubkeys
  '#t'?: string[];       // Hashtags
}
```

### Connection Management

```typescript
interface RelayConfig {
  url: string;           // WebSocket URL (wss://)
  read: boolean;         // Read events from relay
  write: boolean;        // Publish events to relay
  priority?: number;     // Lower = higher priority
}

const DEFAULT_RELAYS: RelayConfig[] = [
  { url: 'wss://relay.damus.io', read: true, write: true },
  { url: 'wss://relay.primal.net', read: true, write: true },
  { url: 'wss://nos.lol', read: true, write: true },
  { url: 'wss://relay.nostr.band', read: true, write: true },
];
```

### Relay Status

```typescript
interface RelayStatus {
  url: string;
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastConnected: number | null;
  messagesSent: number;
  messagesReceived: number;
  latency: number;        // ms
}
```

## NIP-04 Legacy Encryption

For backward compatibility with older clients.

### Encryption (AES-256-CBC)

```typescript
async function nip04Encrypt(
  plaintext: string,
  privateKey: Uint8Array,
  recipientPubkey: string
): Promise<string> {
  // 1. Compute shared secret
  const sharedPoint = secp256k1.getSharedSecret(
    privateKey,
    '02' + recipientPubkey
  );
  const sharedX = sharedPoint.slice(1, 33);

  // 2. Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(16));

  // 3. Encrypt with AES-256-CBC
  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedX,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    new TextEncoder().encode(plaintext)
  );

  // 4. Return base64(ciphertext)?iv=base64(iv)
  return base64Encode(ciphertext) + '?iv=' + base64Encode(iv);
}
```

### Decryption

```typescript
async function nip04Decrypt(
  ciphertext: string,
  privateKey: Uint8Array,
  senderPubkey: string
): Promise<string> {
  // 1. Parse ciphertext and IV
  const [encryptedData, ivParam] = ciphertext.split('?iv=');
  const encrypted = base64Decode(encryptedData);
  const iv = base64Decode(ivParam);

  // 2. Compute shared secret
  const sharedPoint = secp256k1.getSharedSecret(
    privateKey,
    '02' + senderPubkey
  );
  const sharedX = sharedPoint.slice(1, 33);

  // 3. Decrypt
  const aesKey = await crypto.subtle.importKey(
    'raw',
    sharedX,
    { name: 'AES-CBC' },
    false,
    ['decrypt']
  );

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    aesKey,
    encrypted
  );

  return new TextDecoder().decode(plaintext);
}
```

## NIP-46 Remote Signing

### Bunker Connection String

```
bunker://<signer_pubkey>?relay=<relay1>&relay=<relay2>&secret=<optional_secret>
```

### Request Format

```typescript
interface NIP46Request {
  id: string;            // Random request ID
  method: string;        // Method name
  params: string[];      // Method parameters
}

type NIP46Method =
  | 'get_public_key'     // Get signer's pubkey
  | 'sign_event'         // Sign an event
  | 'nip04_encrypt'      // NIP-04 encrypt
  | 'nip04_decrypt'      // NIP-04 decrypt
  | 'nip44_encrypt'      // NIP-44 encrypt
  | 'nip44_decrypt';     // NIP-44 decrypt
```

### Response Format

```typescript
interface NIP46Response {
  id: string;            // Matching request ID
  result?: string;       // Success result
  error?: string;        // Error message
}
```

### Connection Flow

```
┌─────────────┐                    ┌─────────────┐
│   Client    │                    │   Bunker    │
│ (App/Web)   │                    │  (Signer)   │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  1. Parse bunker:// URL          │
       │                                  │
       │  2. Connect to shared relay      │
       │◄────────────────────────────────►│
       │                                  │
       │  3. Send request (kind: 24133)   │
       │─────────────────────────────────►│
       │                                  │
       │  4. User approves (if required)  │
       │                                  │
       │  5. Receive response (kind: 24134)
       │◄─────────────────────────────────│
       │                                  │
```

### Request/Response Events

```typescript
// Request event (kind: 24133)
{
  kind: 24133,
  pubkey: '<client_pubkey>',
  created_at: timestamp,
  tags: [['p', '<bunker_pubkey>']],
  content: nip44Encrypt(JSON.stringify({
    id: '<random_id>',
    method: 'sign_event',
    params: [JSON.stringify(unsignedEvent)]
  })),
  sig: '<signature>'
}

// Response event (kind: 24134)
{
  kind: 24134,
  pubkey: '<bunker_pubkey>',
  created_at: timestamp,
  tags: [['p', '<client_pubkey>']],
  content: nip44Encrypt(JSON.stringify({
    id: '<matching_id>',
    result: '<signed_event_json>'
  })),
  sig: '<signature>'
}
```

## Profile Metadata (Kind 0)

```typescript
interface ProfileMetadata {
  name?: string;         // Display name
  about?: string;        // Bio
  picture?: string;      // Avatar URL
  banner?: string;       // Banner URL
  nip05?: string;        // NIP-05 identifier
  lud16?: string;        // Lightning address
  website?: string;      // Website URL
}

// Event structure
{
  kind: 0,
  pubkey: '<pubkey>',
  created_at: timestamp,
  tags: [],
  content: JSON.stringify(profileMetadata),
  sig: '<signature>'
}
```

## Contact List (Kind 3)

```typescript
// Event structure
{
  kind: 3,
  pubkey: '<pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<contact1_pubkey>', '<relay_url>', '<petname>'],
    ['p', '<contact2_pubkey>', '<relay_url>', '<petname>'],
    // ...
  ],
  content: JSON.stringify({ /* optional relay preferences */ }),
  sig: '<signature>'
}
```

## Error Handling

### Relay Error Codes

```typescript
enum RelayErrorCode {
  BLOCKED = 'blocked',           // Pubkey blocked
  RATE_LIMITED = 'rate-limited', // Too many requests
  INVALID = 'invalid',           // Invalid event format
  POW_REQUIRED = 'pow',          // Proof of work required
  RESTRICTED = 'restricted',     // Access restricted
  ERROR = 'error',               // Generic error
}
```

### Error Recovery

```
ON relay error:
  IF error == RATE_LIMITED:
    WAIT exponentialBackoff
    RETRY

  IF error == BLOCKED:
    LOG warning
    REMOVE relay from pool

  IF error == POW_REQUIRED:
    IF canDoPOW:
      ADD POW to event
      RETRY
    ELSE:
      SKIP relay

  IF error == INVALID:
    LOG error with event details
    DO NOT retry
```
