# Privacy Policy

**Last Updated: January 2026**

BuildIt Network ("BuildIt", "we", "us") is a privacy-first organizing platform.
This policy describes how we handle data.

## Core Privacy Architecture

BuildIt is designed so that **we cannot access your data**:

- **End-to-End Encryption (E2EE)**: All private messages are encrypted using
  NIP-44 (ChaCha20-Poly1305) with NIP-17 gift wrapping for metadata protection.
  Only you and your intended recipients can read message content.

- **Zero-Knowledge Relays**: Our Cloudflare Workers relay stores only encrypted
  event blobs. We cannot decrypt message content, view group membership details,
  or access personal data.

- **Local-First Storage**: Your data is stored on your device. Private keys,
  contacts, messages, and files are stored locally, not on our servers.

## What Our Servers CAN See

Our infrastructure (Cloudflare Workers) can observe:

- IP addresses (standard Cloudflare processing)
- Encrypted Nostr event metadata: public keys, timestamps, event kind numbers
- Encrypted ciphertext blobs
- Public relay events (non-encrypted posts)

## What Our Servers CANNOT See

- Message content (encrypted end-to-end)
- Group membership details
- Personal information, contacts, or files
- Private key material
- BLE mesh communication content

## BLE Mesh Data

BuildIt uses Bluetooth Low Energy (BLE) for offline peer-to-peer communication.
BLE device identifiers are ephemeral and rotate. All BLE mesh content is encrypted.

## Key Management

You control your cryptographic keys. We never have access to your private keys.
If you lose your keys, we cannot recover your data. This is by design.

## GDPR Compliance

- **Data location**: Client-side only. You hold your data.
- **Right to erasure**: Delete your local database. Relay stores only encrypted
  blobs which are meaningless without your keys.
- **Data portability**: Nostr events are portable by protocol design.
- **Data minimization**: Servers store the minimum necessary for relay operation.

## CCPA Compliance

BuildIt does not collect, sell, or share personal information as defined by CCPA.
Our servers process only encrypted data blobs.

## Third-Party Services

- **Cloudflare**: CDN and Workers hosting. See [Cloudflare Privacy Policy](https://www.cloudflare.com/privacypolicy/).

## Changes to This Policy

We will notify users of material changes through the application and by updating
this document.

## Contact

privacy@buildit.network
