# 06. Device Sync Protocol

## Overview

Device sync enables secure transfer of identity keys between devices:
- New device setup (import identity)
- Multi-device key sharing
- Recovery from backup device

## QR Code Format

### Schema

```typescript
interface DeviceTransferQR {
  version: 1;
  type: 'buildit-device-transfer';
  sessionId: string;           // 64-char hex (32 bytes random)
  publicKey: string;           // Ephemeral ECDH public key (hex)
  relays: string[];            // Relay URLs for coordination
  npub?: string;               // Optional: identity npub
  expiresAt: number;           // Session expiration (unix timestamp)
  deviceName?: string;         // Optional: initiator device name
}
```

### URL Format

```
buildit://transfer?data=<base64url-encoded-json>
```

### Encoding

```typescript
function encodeQRData(data: DeviceTransferQR): string {
  const json = JSON.stringify(data);
  const base64 = btoa(json);
  // Base64URL encoding (URL-safe)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function decodeQRData(encoded: string): DeviceTransferQR {
  // Restore standard base64
  let base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  // Add padding
  while (base64.length % 4) base64 += '=';
  const json = atob(base64);
  return JSON.parse(json);
}
```

### QR Code Generation

```typescript
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function generateTransferQR(): Promise<{
  qrData: string;
  session: DeviceTransferSession;
}> {
  // 1. Generate ephemeral keypair
  const privateKey = secp256k1.utils.randomPrivateKey();
  const publicKey = secp256k1.getPublicKey(privateKey);

  // 2. Generate session ID
  const sessionId = crypto.randomUUID().replace(/-/g, '');

  // 3. Create session
  const session: DeviceTransferSession = {
    id: sessionId,
    role: 'initiator',
    status: 'awaiting_scan',
    ephemeralPrivateKey: bytesToHex(privateKey),
    ephemeralPublicKey: bytesToHex(publicKey),
    relays: DEFAULT_RELAYS.map(r => r.url),
    expiresAt: Date.now() + SESSION_TIMEOUT_MS,
    createdAt: Date.now(),
  };

  // 4. Create QR data
  const qrPayload: DeviceTransferQR = {
    version: 1,
    type: 'buildit-device-transfer',
    sessionId: session.id,
    publicKey: session.ephemeralPublicKey,
    relays: session.relays,
    expiresAt: session.expiresAt,
  };

  return {
    qrData: 'buildit://transfer?data=' + encodeQRData(qrPayload),
    session,
  };
}
```

## ECDH Key Exchange

### Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    OLD DEVICE (Initiator)                        │
├─────────────────────────────────────────────────────────────────┤
│ 1. Generate ephemeral keypair (secp256k1)                        │
│ 2. Generate session ID (32 random bytes → hex)                   │
│ 3. Create QR code with publicKey, sessionId, relays              │
│ 4. Display QR code, start listening on relays                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEW DEVICE (Receiver)                         │
├─────────────────────────────────────────────────────────────────┤
│ 1. Scan QR code, parse DeviceTransferQR                          │
│ 2. Validate: version == 1, type == 'buildit-device-transfer'     │
│ 3. Validate: expiresAt > now                                     │
│ 4. Generate own ephemeral keypair                                │
│ 5. Connect to relays                                             │
│ 6. Send handshake event with our publicKey                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED SECRET DERIVATION                      │
├─────────────────────────────────────────────────────────────────┤
│ // Both devices compute the same shared secret:                  │
│                                                                  │
│ sharedPoint = secp256k1.getSharedSecret(ourPrivKey, theirPubKey)│
│ sharedX = sharedPoint.slice(1, 33)  // x-coordinate only         │
│ sharedSecret = SHA256(sharedX)                                   │
│                                                                  │
│ transferKey = HKDF(                                              │
│   secret: sharedSecret,                                          │
│   salt: "BuildItNetwork-Transfer-v1",                            │
│   info: "buildit-device-transfer",                               │
│   length: 32 bytes                                               │
│ )                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
async function deriveTransferKey(
  ourPrivateKey: Uint8Array,
  theirPublicKey: string
): Promise<Uint8Array> {
  // 1. Compute ECDH shared point
  const sharedPoint = secp256k1.getSharedSecret(
    ourPrivateKey,
    theirPublicKey
  );

  // 2. Extract x-coordinate
  const sharedX = sharedPoint.slice(1, 33);

  // 3. Hash to get shared secret
  const sharedSecret = sha256(sharedX);

  // 4. Derive transfer key using HKDF
  const encoder = new TextEncoder();
  const transferKey = hkdf(
    sha256,
    sharedSecret,
    encoder.encode('BuildItNetwork-Transfer-v1'),
    encoder.encode('buildit-device-transfer'),
    32
  );

  return transferKey;
}
```

## Double Encryption

Identity keys are protected with two layers of encryption:

### Layer 1: Passphrase Encryption

```typescript
interface PassphraseEncryptionConfig {
  algorithm: 'PBKDF2';
  hash: 'SHA-256';
  iterations: 310000;      // OWASP 2023 minimum for SHA-256
  keyLength: 256;          // bits
}
```

```typescript
async function encryptWithPassphrase(
  data: Uint8Array,
  passphrase: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; iv: Uint8Array }> {
  // 1. Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(32));

  // 2. Derive key from passphrase
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const keyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: 310000,
    },
    keyMaterial,
    256
  );

  // 3. Encrypt with AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  return {
    ciphertext: new Uint8Array(ciphertext),
    salt,
    iv,
  };
}
```

### Layer 2: Transfer Encryption

```typescript
async function encryptForTransfer(
  passphraseEncrypted: {
    ciphertext: Uint8Array;
    salt: Uint8Array;
    iv: Uint8Array;
  },
  transferKey: Uint8Array
): Promise<{ payload: Uint8Array; iv: Uint8Array }> {
  // 1. Serialize passphrase-encrypted data
  const data = JSON.stringify({
    ciphertext: base64Encode(passphraseEncrypted.ciphertext),
    salt: base64Encode(passphraseEncrypted.salt),
    iv: base64Encode(passphraseEncrypted.iv),
  });

  // 2. Encrypt with transfer key
  const aesKey = await crypto.subtle.importKey(
    'raw',
    transferKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(data)
  );

  return {
    payload: new Uint8Array(payload),
    iv,
  };
}
```

### Decryption (Receiver)

```typescript
async function decryptTransfer(
  encryptedPayload: Uint8Array,
  payloadIv: Uint8Array,
  transferKey: Uint8Array,
  passphrase: string
): Promise<Uint8Array> {
  // 1. Decrypt transfer layer
  const aesKey = await crypto.subtle.importKey(
    'raw',
    transferKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: payloadIv },
    aesKey,
    encryptedPayload
  );

  const { ciphertext, salt, iv } = JSON.parse(
    new TextDecoder().decode(decrypted)
  );

  // 2. Decrypt passphrase layer
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const keyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: base64Decode(salt),
      iterations: 310000,
    },
    keyMaterial,
    256
  );

  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    keyBits,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  const privateKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64Decode(iv) },
    passphraseKey,
    base64Decode(ciphertext)
  );

  return new Uint8Array(privateKey);
}
```

## Session State Machine

```typescript
interface DeviceTransferSession {
  id: string;
  role: 'initiator' | 'receiver';
  status: SessionStatus;
  ephemeralPrivateKey: string;
  ephemeralPublicKey: string;
  remotePubkey?: string;
  sharedSecret?: string;
  relays: string[];
  identityPubkey?: string;
  expiresAt: number;
  createdAt: number;
  errorMessage?: string;
}

type SessionStatus =
  | 'awaiting_scan'     // QR displayed, waiting for scan
  | 'connected'         // Handshake received
  | 'authenticating'    // Passphrase entry
  | 'transferring'      // Key transfer in progress
  | 'completed'         // Transfer successful
  | 'failed'            // Transfer failed
  | 'expired';          // Session timed out
```

### State Transitions

```
INITIATOR:
  awaiting_scan ──[handshake received]──► connected
  connected ──[passphrase entered]──► authenticating
  authenticating ──[key encrypted]──► transferring
  transferring ──[ack received]──► completed
  * ──[timeout]──► expired
  * ──[error]──► failed

RECEIVER:
  (scan) ──► connected
  connected ──[handshake sent]──► authenticating
  authenticating ──[key received]──► transferring
  transferring ──[decryption success]──► completed
  * ──[timeout]──► expired
  * ──[error]──► failed
```

## Visual Verification

### Fingerprint Generation

Both devices show the same visual fingerprint to verify the connection.

```typescript
const EMOJI_SET = [
  '🍎', '🍊', '🍋', '🍌',
  '🍇', '🍉', '🍍', '🍒',
  '🍭', '🎂', '🍩', '🎂',
  '⭐', '🌟', '🌙', '🌈',
];

function generateFingerprint(
  sessionId: string,
  publicKey1: string,
  publicKey2: string
): string {
  // Sort keys for consistent ordering
  const sortedKeys = [publicKey1, publicKey2].sort();
  const input = `${sessionId}:${sortedKeys[0]}:${sortedKeys[1]}`;

  // Hash
  const hash = sha256(new TextEncoder().encode(input));

  // Convert first 4 bytes to 4 emojis
  const emojis = [];
  for (let i = 0; i < 4; i++) {
    const index = hash[i] % EMOJI_SET.length;
    emojis.push(EMOJI_SET[index]);
  }

  return emojis.join(' ');
}
```

### Verification UI

```
┌────────────────────────────────────┐
│                                    │
│   Verify Connection                │
│                                    │
│       🍎 🍌 🌙 🍒                  │
│                                    │
│   Does this match the other        │
│   device?                          │
│                                    │
│   [Cancel]        [Confirm]        │
│                                    │
└────────────────────────────────────┘
```

## Nostr Event Coordination

Devices coordinate via Nostr relays using ephemeral events.

### Handshake Event

```typescript
// Receiver → Initiator
{
  kind: 24242,  // BuildIt transfer handshake
  pubkey: '<receiver_ephemeral_pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<initiator_ephemeral_pubkey>'],
    ['session', '<session_id>'],
  ],
  content: '',  // Empty, just announcing presence
  sig: '<signature>'
}
```

### Key Transfer Event

```typescript
// Initiator → Receiver
{
  kind: 24243,  // BuildIt key transfer
  pubkey: '<initiator_ephemeral_pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<receiver_ephemeral_pubkey>'],
    ['session', '<session_id>'],
  ],
  content: nip44Encrypt(JSON.stringify({
    payload: '<base64_double_encrypted_key>',
    iv: '<base64_iv>',
    identityPubkey: '<npub>',
  }), transferKey),
  sig: '<signature>'
}
```

### Acknowledgment Event

```typescript
// Receiver → Initiator
{
  kind: 24244,  // BuildIt transfer ack
  pubkey: '<receiver_ephemeral_pubkey>',
  created_at: timestamp,
  tags: [
    ['p', '<initiator_ephemeral_pubkey>'],
    ['session', '<session_id>'],
    ['status', 'success'],  // or 'failed'
  ],
  content: '',
  sig: '<signature>'
}
```

## Security Considerations

1. **Session Expiration**: 5-minute timeout prevents stale attacks
2. **Ephemeral Keys**: Used only for one transfer, then discarded
3. **Double Encryption**: Even if ECDH is compromised, passphrase protects key
4. **Visual Verification**: User confirms fingerprint match
5. **No Key Storage**: Ephemeral keys never touch permanent storage
6. **Relay Privacy**: Events expire quickly (kind 24242-24244 are ephemeral)

## Error Handling

```typescript
enum TransferError {
  EXPIRED = 'expired',              // Session timed out
  INVALID_QR = 'invalid_qr',        // Malformed QR code
  VERSION_MISMATCH = 'version',     // Incompatible version
  CONNECTION_FAILED = 'connection', // Relay connection failed
  DECRYPTION_FAILED = 'decrypt',    // Wrong passphrase
  VERIFICATION_FAILED = 'verify',   // Fingerprint mismatch
  CANCELLED = 'cancelled',          // User cancelled
}
```
