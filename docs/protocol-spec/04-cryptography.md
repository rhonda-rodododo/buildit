# 04. Cryptographic Protocol

## Overview

BuildIt uses a layered encryption approach:
1. **Key Derivation**: Password → Master Key → Identity Key
2. **Message Encryption**: NIP-44 ChaCha20-Poly1305
3. **Metadata Protection**: NIP-17 Gift Wrap

## Key Hierarchy

```
User Password (or Biometric)
        │
        ▼ PBKDF2 (600,000 iterations, SHA-256)
Master Encryption Key (MEK) ─── 256 bits
        │
        ├──────────────────────────────────────────┐
        │                                          │
        ▼                                          ▼
Identity Private Key                    Database Encryption Key (DEK)
(secp256k1, 256 bits)                  (AES-256, 256 bits)
Encrypted with AES-256-GCM             HKDF derived from MEK
```

## Key Derivation

### Master Key from Password

```typescript
interface PBKDF2Config {
  algorithm: 'PBKDF2';
  hash: 'SHA-256';
  iterations: 600000;     // OWASP 2023 recommendation
  keyLength: 256;         // bits
  saltLength: 32;         // bytes
}
```

#### Implementation

```typescript
async function deriveMasterKey(
  password: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const masterKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: salt,
      iterations: 600000,
    },
    keyMaterial,
    256
  );

  return new Uint8Array(masterKeyBits);
}
```

### Database Key from Master Key

```typescript
interface HKDFConfig {
  algorithm: 'HKDF';
  hash: 'SHA-256';
  salt: 'BuildItNetwork-DEK-v1';
  info: 'database-encryption';
  keyLength: 256;         // bits
}
```

#### Implementation

```typescript
async function deriveDatabaseKey(
  masterKey: Uint8Array
): Promise<Uint8Array> {
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    masterKey,
    'HKDF',
    false,
    ['deriveBits']
  );

  const databaseKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: encoder.encode('BuildItNetwork-DEK-v1'),
      info: encoder.encode('database-encryption'),
    },
    keyMaterial,
    256
  );

  return new Uint8Array(databaseKeyBits);
}
```

## Identity Key Encryption

The secp256k1 private key is encrypted with AES-256-GCM using the master key.

### Encryption

```typescript
interface EncryptedKey {
  ciphertext: Uint8Array;  // Encrypted private key
  iv: Uint8Array;          // 12-byte nonce
  tag: Uint8Array;         // 16-byte auth tag
  salt: Uint8Array;        // PBKDF2 salt
}

async function encryptPrivateKey(
  privateKey: Uint8Array,
  masterKey: Uint8Array
): Promise<EncryptedKey> {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const aesKey = await crypto.subtle.importKey(
    'raw',
    masterKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    privateKey
  );

  return {
    ciphertext: new Uint8Array(ciphertext.slice(0, -16)),
    tag: new Uint8Array(ciphertext.slice(-16)),
    iv,
    salt: /* stored separately */,
  };
}
```

### Decryption

```typescript
async function decryptPrivateKey(
  encrypted: EncryptedKey,
  masterKey: Uint8Array
): Promise<Uint8Array> {
  const aesKey = await crypto.subtle.importKey(
    'raw',
    masterKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // Combine ciphertext + tag for WebCrypto
  const combined = new Uint8Array(
    encrypted.ciphertext.length + encrypted.tag.length
  );
  combined.set(encrypted.ciphertext);
  combined.set(encrypted.tag, encrypted.ciphertext.length);

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    aesKey,
    combined
  );

  return new Uint8Array(plaintext);
}
```

## NIP-44 Encryption

NIP-44 version 2 uses ChaCha20-Poly1305 for message encryption.

### Parameters

```typescript
interface NIP44Config {
  version: 2;
  algorithm: 'ChaCha20-Poly1305';
  keyLength: 256;          // bits
  nonceLength: 12;         // bytes
  tagLength: 16;           // bytes
}
```

### Conversation Key

Derived from ECDH shared secret:

```typescript
function getConversationKey(
  privateKey: Uint8Array,
  recipientPubkey: string
): Uint8Array {
  // 1. Compute ECDH shared point
  const sharedPoint = secp256k1.getSharedSecret(
    privateKey,
    '02' + recipientPubkey  // Compressed pubkey
  );

  // 2. Extract x-coordinate (skip prefix byte)
  const sharedX = sharedPoint.slice(1, 33);

  // 3. HKDF extract + expand
  const conversationKey = hkdf(
    sha256,
    sharedX,
    'nip44-v2',
    32
  );

  return conversationKey;
}
```

### Padding

NIP-44 uses power-of-2 padding:

```typescript
function calcPaddedLen(unpaddedLen: number): number {
  const nextPower = 1 << Math.ceil(Math.log2(unpaddedLen));
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * Math.ceil(unpaddedLen / chunk);
}

function pad(plaintext: string): Uint8Array {
  const unpadded = new TextEncoder().encode(plaintext);
  const unpaddedLen = unpadded.length;

  if (unpaddedLen < 1 || unpaddedLen > 65535) {
    throw new Error('Invalid plaintext length');
  }

  const paddedLen = calcPaddedLen(unpaddedLen);
  const padded = new Uint8Array(2 + paddedLen);

  // Write unpadded length as big-endian uint16
  padded[0] = (unpaddedLen >> 8) & 0xff;
  padded[1] = unpaddedLen & 0xff;

  // Copy plaintext
  padded.set(unpadded, 2);

  // Remaining bytes are zero-padded
  return padded;
}
```

### Encryption

```typescript
async function nip44Encrypt(
  plaintext: string,
  conversationKey: Uint8Array
): Promise<string> {
  // 1. Generate random nonce
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // 2. Derive message key using HKDF
  const messageKey = hkdf(
    sha256,
    conversationKey,
    nonce,
    76  // 32 bytes chacha key + 12 bytes chacha nonce + 32 bytes hmac key
  );

  const chachaKey = messageKey.slice(0, 32);
  const chachaNonce = messageKey.slice(32, 44);
  const hmacKey = messageKey.slice(44, 76);

  // 3. Pad plaintext
  const padded = pad(plaintext);

  // 4. Encrypt with ChaCha20-Poly1305
  const ciphertext = chacha20poly1305(chachaKey, chachaNonce).encrypt(padded);

  // 5. Compute HMAC
  const hmac = hmacSha256(hmacKey, concat(nonce, ciphertext));

  // 6. Encode as base64
  const payload = concat(
    [1],  // Version byte
    nonce,
    ciphertext,
    hmac
  );

  return base64Encode(payload);
}
```

### Decryption

```typescript
async function nip44Decrypt(
  ciphertext: string,
  conversationKey: Uint8Array
): Promise<string> {
  // 1. Decode base64
  const payload = base64Decode(ciphertext);

  // 2. Extract components
  const version = payload[0];
  if (version !== 1) throw new Error('Unsupported version');

  const nonce = payload.slice(1, 13);
  const encrypted = payload.slice(13, -32);
  const mac = payload.slice(-32);

  // 3. Derive message key
  const messageKey = hkdf(sha256, conversationKey, nonce, 76);
  const chachaKey = messageKey.slice(0, 32);
  const chachaNonce = messageKey.slice(32, 44);
  const hmacKey = messageKey.slice(44, 76);

  // 4. Verify HMAC
  const expectedMac = hmacSha256(hmacKey, concat(nonce, encrypted));
  if (!constantTimeEqual(mac, expectedMac)) {
    throw new Error('Invalid MAC');
  }

  // 5. Decrypt
  const padded = chacha20poly1305(chachaKey, chachaNonce).decrypt(encrypted);

  // 6. Unpad
  const unpaddedLen = (padded[0] << 8) | padded[1];
  const plaintext = padded.slice(2, 2 + unpaddedLen);

  return new TextDecoder().decode(plaintext);
}
```

## NIP-17 Gift Wrap

Gift wrapping provides sender metadata protection.

### Event Kinds

```
Kind 14:   Rumor (unsigned inner message)
Kind 13:   Seal (encrypted rumor, signed by sender)
Kind 1059: Gift Wrap (encrypted seal, signed by ephemeral key)
```

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         SENDER SIDE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Step 1: Create Rumor (kind: 14, UNSIGNED)                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ {                                                        │    │
│  │   "kind": 14,                                            │    │
│  │   "pubkey": "<sender_pubkey>",                           │    │
│  │   "created_at": <randomized ±2 days>,                    │    │
│  │   "content": "Hello!",                                   │    │
│  │   "tags": [["p", "<recipient_pubkey>"]],                 │    │
│  │   "id": "<hash>",                                        │    │
│  │   "sig": "" // NO SIGNATURE                              │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  Step 2: Create Seal (kind: 13)                                 │
│  - Derive conversationKey(senderPrivKey, recipientPubKey)       │
│  - NIP-44 encrypt the rumor JSON                                │
│  - Sign with sender's private key                               │
│  - Randomize created_at ±2 days                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ {                                                        │    │
│  │   "kind": 13,                                            │    │
│  │   "pubkey": "<sender_pubkey>",                           │    │
│  │   "created_at": <randomized>,                            │    │
│  │   "content": "<nip44_encrypted_rumor>",                  │    │
│  │   "tags": [],                                            │    │
│  │   "id": "<hash>",                                        │    │
│  │   "sig": "<sender_signature>"                            │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  Step 3: Create Gift Wrap (kind: 1059)                          │
│  - Generate ephemeral keypair                                   │
│  - Derive conversationKey(ephemeralPrivKey, recipientPubKey)    │
│  - NIP-44 encrypt the seal JSON                                 │
│  - Sign with ephemeral private key                              │
│  - Add recipient tag                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ {                                                        │    │
│  │   "kind": 1059,                                          │    │
│  │   "pubkey": "<ephemeral_pubkey>",                        │    │
│  │   "created_at": <randomized>,                            │    │
│  │   "content": "<nip44_encrypted_seal>",                   │    │
│  │   "tags": [["p", "<recipient_pubkey>"]],                 │    │
│  │   "id": "<hash>",                                        │    │
│  │   "sig": "<ephemeral_signature>"                         │    │
│  │ }                                                        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│                    PUBLISH TO RELAYS                             │
└─────────────────────────────────────────────────────────────────┘
```

### Unwrapping (Receiver Side)

```typescript
interface UnwrapResult {
  rumor: NostrEvent;       // Decrypted message
  senderPubkey: string;    // Verified sender
  sealVerified: boolean;   // Signature valid
}

async function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientPrivKey: Uint8Array
): Promise<UnwrapResult> {
  // 1. Decrypt gift wrap to get seal
  const conversationKey1 = getConversationKey(
    recipientPrivKey,
    giftWrap.pubkey
  );
  const sealJson = await nip44Decrypt(giftWrap.content, conversationKey1);
  const seal = JSON.parse(sealJson);

  // 2. Validate seal schema
  validateSealSchema(seal);

  // 3. Verify seal signature
  const sealVerified = verifyEvent(seal);
  const senderPubkey = seal.pubkey;

  // 4. Decrypt seal to get rumor
  const conversationKey2 = getConversationKey(
    recipientPrivKey,
    senderPubkey
  );
  const rumorJson = await nip44Decrypt(seal.content, conversationKey2);
  const rumor = JSON.parse(rumorJson);

  // 5. Validate rumor schema
  validateRumorSchema(rumor);

  return { rumor, senderPubkey, sealVerified };
}
```

### Security Considerations

1. **Use seal.pubkey as sender**: The gift wrap pubkey is ephemeral and untrusted
2. **Randomize timestamps**: ±2 days to prevent timing analysis
3. **Validate JSON schemas**: Prevent prototype pollution
4. **Constant-time comparisons**: For MAC verification
5. **Zero memory after use**: Clear keys from memory

## Key Storage

### Platform-Specific Secure Storage

| Platform | Primary | Fallback | Hardware |
|----------|---------|----------|----------|
| iOS | Keychain Services | - | Secure Enclave |
| Android | Android Keystore | EncryptedSharedPrefs | StrongBox/TEE |
| Linux | libsecret | Encrypted file | TPM |
| macOS | Keychain | - | Secure Enclave |
| Windows | Credential Manager | DPAPI | TPM |

### Stored Key Data

```typescript
interface StoredKeyData {
  publicKey: string;              // Hex, unencrypted for lookup
  encryptedPrivateKey: string;    // Base64, AES-GCM encrypted
  salt: string;                   // Base64, PBKDF2 salt
  iv: string;                     // Base64, AES-GCM IV
  webAuthnProtected: boolean;     // Biometric enabled
  credentialId?: string;          // WebAuthn credential ID
  createdAt: number;              // Creation timestamp
  keyVersion: number;             // Rotation version
}
```

## Biometric Authentication

### iOS Face ID / Touch ID

```swift
let context = LAContext()
context.evaluatePolicy(
  .deviceOwnerAuthenticationWithBiometrics,
  localizedReason: "Unlock your keys"
) { success, error in
  if success {
    // Retrieve key from Keychain
  }
}
```

### Android BiometricPrompt

```kotlin
val biometricPrompt = BiometricPrompt(
  activity,
  executor,
  object : BiometricPrompt.AuthenticationCallback() {
    override fun onAuthenticationSucceeded(result: AuthenticationResult) {
      // Keystore key is now unlocked
    }
  }
)

biometricPrompt.authenticate(promptInfo, cryptoObject)
```

### Security Settings

```typescript
interface SecuritySettings {
  authMethod: 'password-always' | 'biometric-preferred' | 'biometric-only';
  inactivityTimeout: number;     // Minutes, 0 = never
  lockOnBackground: boolean;     // Lock when app backgrounded
  lockOnClose: boolean;          // Require auth on reopen
  requirePasswordForExport: boolean;  // Always true for nsec
}
```
