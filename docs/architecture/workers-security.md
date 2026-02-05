# Workers Security Architecture: Zero-Knowledge Design

This document describes the security architecture of BuildIt's Cloudflare Workers infrastructure and how it maintains the zero-knowledge principle: **Workers NEVER see plaintext user data.**

## Core Principle

Every BuildIt Worker is designed so that even a fully compromised Worker (or a malicious Cloudflare employee with access to Worker internals) cannot access user private data. This is achieved through end-to-end encryption at the client level before any data reaches a Worker.

## Worker-by-Worker Analysis

### API Worker (`buildit-api`)

**Purpose**: Link preview metadata fetching, image proxying, oEmbed resolution.

**What it CAN see:**
- The public URL being previewed (passed as a query parameter)
- The requesting client's IP address (via Cloudflare)
- Open Graph metadata fetched from public websites
- Image data being proxied (public images only)

**What it CANNOT see:**
- Who is sharing the link (no user authentication required)
- The context in which the link is shared (message, group, etc.)
- Any user private keys or encrypted content
- Message content, group membership, or personal data

**Why it is safe:**
The API Worker operates exclusively on publicly available URLs. It fetches the same metadata any web browser would fetch when visiting a page. No user data flows through this Worker. CORS and origin restrictions limit which clients can call it.

### Relay Worker (`buildit-relay`)

**Purpose**: Nostr protocol relay -- stores and relays events between clients.

**What it CAN see:**
- Public Nostr event metadata: pubkeys, timestamps, event kind numbers, event IDs
- NIP-17 gift-wrapped ciphertext blobs (encrypted, opaque to the relay)
- IP addresses of connecting clients (via Cloudflare)
- WebSocket connection patterns (who connects, when, for how long)
- Subscription filters (which pubkeys/kinds a client requests)

**What it CANNOT see:**
- Message content (encrypted with NIP-44 ChaCha20-Poly1305 before wrapping)
- The inner event of a gift wrap (sealed inside NIP-17 layers)
- Group membership lists (encoded in encrypted content)
- File contents, document contents, or any user-generated plaintext
- User private keys (never transmitted to the relay)

**Why it is safe:**
All private messages use NIP-17 gift wrapping:

1. The plaintext message is created as a "rumor" (unsigned event)
2. The rumor is sealed with NIP-44 encryption (ChaCha20-Poly1305) to the recipient
3. The seal is gift-wrapped with a random, ephemeral key
4. Only the outer gift wrap (kind 1059) is sent to the relay

The relay stores kind 1059 events containing opaque ciphertext. Even the sender's real pubkey is hidden inside the encrypted layers. The relay cannot determine who is messaging whom, only that events are being stored and retrieved.

**Subscription privacy limitation:** When a client subscribes to events, the relay can observe which pubkeys and event kinds are being requested. This reveals the client's interest in specific pubkeys. This is an inherent limitation of the Nostr protocol subscription model. Clients can mitigate this by subscribing to broader filter sets.

### SSR Worker (`buildit-public`)

**Purpose**: Server-side rendering of public-facing pages for logged-out visitors.

**What it CAN see:**
- IP addresses of visitors (via Cloudflare)
- Which public pages are being viewed (URL paths)
- Public Nostr events fetched from relays (already publicly available)
- Standard web analytics data (user agent, referrer, etc.)

**What it CANNOT see:**
- Any authenticated user data (SSR only serves logged-out content)
- Private messages, group content, or encrypted data
- User private keys or session tokens
- Any data that requires authentication to access

**Why it is safe:**
The SSR Worker exclusively renders content that is already publicly available. It sources data from public Nostr events (articles, public event listings, campaign pages) that any Nostr client could access. No authentication state exists in this Worker. It is functionally equivalent to a static website with dynamic public content.

## Threat Model

### Threats Mitigated

| Threat | Mitigation |
|--------|-----------|
| Cloudflare employee reads user messages | Messages are NIP-44 encrypted; relay only stores ciphertext |
| Worker code compromised via supply chain | No plaintext user data flows through Workers |
| D1 database breach | Database contains only encrypted events and public metadata |
| Network surveillance on Worker traffic | Client-to-Worker uses TLS; content is additionally E2E encrypted |
| Relay correlates sender/recipient | NIP-17 gift wrapping hides real sender pubkey with ephemeral keys |

### Threats NOT Mitigated by Workers

These threats exist at other layers and are addressed by client-side protections:

| Threat | Layer | Mitigation |
|--------|-------|-----------|
| Client device compromise | Client | OS security, secure enclave key storage |
| Key extraction from memory | Client | Argon2id KDF, memory protection |
| Traffic analysis (timing) | Network | Tor integration option, connection padding |
| Metadata analysis (pubkey graph) | Protocol | Ephemeral keys in NIP-17, broad subscription filters |
| IP address exposure | Network | Tor integration option for clients |

## Design Guidelines for New Workers

When adding new Workers to the BuildIt infrastructure:

1. **Never accept user private keys** - All signing happens client-side
2. **Never decrypt user content** - Workers process only ciphertext or public data
3. **Minimize metadata exposure** - Request only the data needed for the Worker's function
4. **No authentication state** - Workers should not maintain user sessions; use signed Nostr events for authentication if needed (NIP-42)
5. **Log minimally** - Do not log request bodies, event content, or subscription filters in production
6. **Validate inputs** - Sanitize all inputs to prevent injection attacks, but do not inspect encrypted content
7. **Rate limit aggressively** - Protect against abuse without requiring user identification
