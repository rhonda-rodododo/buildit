# Architecture Evolution: Adding Server Components to BuildIt Network

**Version**: 1.0.0
**Date**: 2025-10-09
**Status**: Planning
**Decision**: Hybrid Nostr + Optional Backend Layer

## 📋 Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture](#current-architecture)
3. [Architectural Challenges](#architectural-challenges)
4. [Proposed Solution: Nostr-First Hybrid](#proposed-solution-nostr-first-hybrid)
5. [Feature Analysis](#feature-analysis)
6. [E2EE Preservation Strategy](#e2ee-preservation-strategy)
7. [Implementation Plan](#implementation-plan)
8. [Decision Matrix](#decision-matrix)

---

## Executive Summary

BuildIt Network is currently a **100% client-side P2P application** built on Nostr protocol with end-to-end encryption. The roadmap includes features that traditionally require server-side infrastructure:

1. **Payment APIs** (Stripe, PayPal) - Epic 49
2. **Email/Newsletter delivery** - Epic 53
3. **Federation** (ActivityPub/ATProto) - Epics 54-55
4. **Server-rendered pages** (SEO, public content)

**Challenge**: How do we add these features while preserving:
- ✅ Nostr protocol at the core
- ✅ End-to-end encryption for private content
- ✅ Peer-to-peer decentralization
- ✅ Local-first storage
- ✅ Privacy guarantees

**Solution**: Implement a **Nostr-First Hybrid Architecture** with an optional, stateless backend service that users can enable per-group and self-host if desired.

---

## Current Architecture

### System Overview (v0.48.0)

```
┌─────────────────────────────────────────────────┐
│                   Client Layer                   │
│  (React + TypeScript + shadcn/ui + Tailwind)    │
└──────────────────┬─────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────┐
│              Application Layer                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │   Groups    │  │   Modules   │  │   UI    ││
│  │   System    │  │   (Events,  │  │ Comps   ││
│  │             │  │  Mutual Aid,│  │         ││
│  └─────────────┘  └─────────────┘  └─────────┘│
└──────────────────┬─────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────┐
│                Core Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │   Nostr     │  │   Crypto    │  │ Storage ││
│  │   Client    │  │  (NIP-17)   │  │ (Dexie) ││
│  └─────────────┘  └─────────────┘  └─────────┘│
└──────────────────┬─────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────┐
│            Nostr Relay Network                   │
│   (Decentralized, censorship-resistant storage) │
└─────────────────────────────────────────────────┘
```

### Key Properties (Current)

**✅ Strengths**:
- 100% client-side (no server dependencies)
- Nostr protocol for decentralization
- NIP-17 E2EE for metadata protection
- Local-first storage (IndexedDB)
- Works offline (PWA)
- Censorship-resistant (multi-relay)
- Privacy-preserving (zero-knowledge relays)

**⚠️ Limitations**:
- Cannot integrate traditional payment APIs (server-side secrets required)
- Cannot send emails (SMTP server needed)
- Cannot federate with ActivityPub/Mastodon (server endpoints required)
- Limited SEO for public pages (client-side rendering only)

---

## Architectural Challenges

### 1. Payment Integration (Epic 49)

**Required**: Stripe/PayPal/crypto payment processing

**Challenge**:
- Stripe/PayPal require server-side API keys (cannot be exposed in client)
- Webhooks need server endpoints (payment.succeeded, payment.failed)
- Credit card processing requires PCI compliance (server-side only)

**Client-Side Options**:
- ✅ Cryptocurrency (Bitcoin, Ethereum) - fully client-side
- ❌ Stripe/PayPal - require server-side integration

---

### 2. Email/Newsletter Delivery (Epic 53)

**Required**: Send newsletters to subscribers

**Challenge**:
- Email requires SMTP server or email service API (SendGrid, Mailgun)
- API keys cannot be stored client-side
- Sending emails requires server-side execution

**Client-Side Options**:
- ✅ Nostr DMs (NIP-17) - fully client-side, P2P
- ❌ Email delivery - requires server-side integration

**Trade-off**: Nostr DMs only reach Nostr users. Email reaches broader audience.

---

### 3. Federation (Epics 54-55)

**Required**: ActivityPub (Mastodon) and/or AT Protocol (Bluesky) interoperability

**Challenge**:
- ActivityPub requires server endpoints (inbox, outbox, actor, webfinger)
- HTTP signatures require server-side signing
- ATProto requires Personal Data Server (PDS)

**Client-Side Options**:
- ✅ Pure Nostr (interop with other Nostr clients)
- ❌ ActivityPub/ATProto - require server-side infrastructure

---

### 4. Server-Rendered Pages (SEO)

**Required**: SEO-friendly public pages for events, fundraising campaigns, etc.

**Challenge**:
- Search engines need server-rendered HTML (not client-side SPA)
- Open Graph tags, meta descriptions need to be in initial HTML
- Client-side rendering limits discoverability

**Client-Side Options**:
- ⚠️ Static Site Generation (SSG) - can prerender pages at build time
- ❌ Dynamic SSR - requires server-side rendering

---

## Proposed Solution: Nostr-First Hybrid

### Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Client (React SPA)                              │
│  - Nostr protocol (always)                       │
│  - E2EE encryption (always)                      │
│  - Local-first storage (IndexedDB)               │
│  - Optional: Call backend APIs (payments, email) │
└──────────────────┬─────────────────────────────┘
                   │
    ┌──────────────┴────────────────┐
    │                               │
┌───▼────────┐              ┌──────▼────────────┐
│   Nostr    │              │  Backend Service   │
│  Relays    │              │  (Bun/Node.js)    │
│  (Always)  │              │  (Optional)       │
└────────────┘              └───────────────────┘
                            │
                            ├─ Payment APIs (Stripe, PayPal)
                            ├─ Email Service (SendGrid, SES)
                            ├─ ActivityPub Server (Fedify)
                            └─ SSR/SEO endpoints
```

### Core Principles

1. **Client Never Depends on Backend**
   - Core features work P2P via Nostr
   - Backend is enhancement, not requirement
   - App functions offline without backend

2. **Backend is Opt-In Per Group**
   - Groups enable features they need (payments, email, federation)
   - Privacy-focused groups stay pure P2P
   - No forced backend dependency

3. **E2EE Preserved**
   - Backend never sees decrypted private content
   - Private groups stay pure Nostr E2EE
   - Backend only handles public content or encrypted payloads

4. **Self-Hostable**
   - Users can run their own backend instance
   - Open source, auditable backend code
   - No vendor lock-in

5. **Privacy-Preserving**
   - Minimal data sent to backend
   - Stateless design where possible
   - No user tracking or analytics without consent

6. **Nostr as Communication Layer**
   - Client ↔ Backend communication via Nostr (encrypted)
   - Backend publishes responses to Nostr relays
   - No direct client-backend HTTP APIs (except SSR)

---

## Feature Analysis

### Payment Integration (Epic 49)

#### Epic 49A: Crypto Payments (Client-Side Only) ✅

**Implementation**: 100% client-side, no backend required

**Flow**:
```
1. User creates fundraising campaign
2. Client generates HD wallet addresses (BIP32/BIP44)
   - Bitcoin address
   - Ethereum address
3. Client displays QR codes for donations
4. Client polls blockchain explorers (client-side API calls)
   - Blockstream.info for Bitcoin
   - Etherscan.io for Ethereum
5. Client detects transactions, updates donation totals
6. Client publishes donation confirmations to Nostr (encrypted)
```

**Privacy**: ✅ Fully P2P, no third-party involvement

**Libraries**:
- `bitcoinjs-lib` - Bitcoin address generation
- `ethers.js` - Ethereum wallet management
- `qrcode.react` - QR code generation (already installed)

**Effort**: 6-8 hours

---

#### Epic 49B: Stripe/PayPal Integration (Backend Required) ⚠️

**Implementation**: Requires backend service

**Flow**:
```
1. User initiates payment (client)
2. Client sends payment intent to backend via Nostr (NIP-17 encrypted)
   {
     type: 'payment.intent',
     amount: 50.00,
     currency: 'USD',
     campaignId: 'campaign-123',
     successNostrEvent: 'event-id-to-publish'
   }
3. Backend receives encrypted message from Nostr relay
4. Backend unseals NIP-17 envelope (has decryption key)
5. Backend creates Stripe checkout session
6. Backend publishes checkout URL to Nostr (NIP-17 encrypted to user)
7. Client receives checkout URL, opens Stripe hosted page
8. User completes payment on Stripe
9. Stripe sends webhook to backend (payment.succeeded)
10. Backend publishes receipt to Nostr (NIP-17 encrypted)
11. Client receives receipt, updates UI
```

**Privacy**: ⚠️ Backend sees payment intent (amount, campaign), but Stripe handles actual payment

**Backend Requirements**:
- Stripe API key (environment variable)
- Webhook endpoint (HTTPS required)
- Nostr relay connection (to receive intents, publish responses)

**Alternative Flow (Stateless)**:
```
1. Client generates payment intent locally
2. Client calls backend `/create-checkout-session` endpoint (HTTPS)
3. Backend returns checkout URL
4. Stripe webhook → backend → publish to Nostr
```

**Effort**: 10-15 hours (includes backend setup)

---

### Newsletter Module (Epic 53)

#### Epic 53A: Newsletter via Nostr DMs (Client-Side Only) ✅

**Implementation**: 100% client-side, no backend required

**Flow**:
```
1. User creates newsletter issue (TipTap editor)
2. User selects subscribers (from encrypted subscriber list)
3. Client encrypts newsletter content (NIP-17)
4. Client sends NIP-17 DMs to each subscriber
5. Subscribers receive in their DM inbox
6. Client tracks delivery status (from relay confirmations)
```

**Privacy**: ✅ Fully E2EE, P2P via Nostr

**Subscriber Management**:
- Subscriber list stored client-side (IndexedDB)
- Encrypted with group key
- Subscribers add themselves via Nostr pubkey

**Limitations**:
- Only reaches Nostr users
- No HTML email rendering (Nostr clients display markdown)
- Delivery depends on subscriber being online/checking Nostr

**Effort**: 12-15 hours

---

#### Epic 53B: Newsletter via Email (Backend Required) ⚠️

**Implementation**: Requires backend service

**Flow**:
```
1. User creates newsletter issue (client)
2. User exports subscriber email list (encrypted, client-side)
3. Client sends newsletter + emails to backend via Nostr (encrypted)
4. Backend unseals Nostr message
5. Backend converts markdown/HTML to email
6. Backend sends emails via SendGrid/Mailgun API
7. Backend publishes delivery report to Nostr (encrypted)
8. Client receives delivery stats (opens, clicks)
```

**Privacy**: ⚠️ Backend sees newsletter content and email list

**Mitigation**:
- Newsletter content is typically public (not DMs)
- Users can self-host backend for full control
- Encrypted subscriber list only decrypted in backend memory, not stored

**Backend Requirements**:
- SendGrid or Mailgun API key
- Email template rendering
- Bounce handling
- Unsubscribe endpoint (required by law)

**Alternative (Hybrid)**:
- Default: Nostr DMs (53A)
- Optional: Email delivery if user enables and configures backend

**Effort**: 10-15 hours (includes backend email service)

---

### Federation (Epic 54)

#### ActivityPub Server with Fedify (Backend Required) ⚠️

**Implementation**: Requires backend service (cannot be client-side)

**Architecture**:
```
┌────────────────────────────────────────────┐
│  BuildIt Client (Nostr P2P)                 │
│  - Private groups: Pure Nostr (no federation)│
│  - Public identity: Opt-in federation       │
└──────────────────┬─────────────────────────┘
                   │
    ┌──────────────┴────────────────┐
    │                               │
┌───▼────────┐              ┌──────▼─────────────┐
│   Nostr    │              │  Federation Server │
│  Relays    │              │  (Fedify/ActivityPub)│
│            │              │  - Per-user actor   │
│  (Always)  │              │  - Inbox/outbox     │
└────────────┘              │  - HTTP signatures  │
                            └─────────┬───────────┘
                                      │
                        ┌─────────────┴────────────┐
                        │                          │
                   ┌────▼────┐              ┌──────▼─────┐
                   │ Mastodon│              │  Bluesky   │
                   │ Instance│              │    PDS     │
                   └─────────┘              └────────────┘
```

**Federation Modes**:

1. **No Federation (Default)**: Pure Nostr P2P, no server needed
2. **Optional Federation (Per Identity)**: User opts in, enables federation for public microblogging
3. **Required Federation**: All public posts federate (not recommended for privacy)

**Flow**:
```
1. User creates public post (client)
2. Client publishes to Nostr (as usual)
3. Client optionally sends "federate" signal to backend via Nostr
   {
     type: 'federate.post',
     nostrEventId: 'event-abc',
     federationEnabled: true
   }
4. Backend fetches post from Nostr relay
5. Backend converts Nostr event to ActivityPub format
6. Backend sends ActivityPub "Create" activity to followers' inboxes
7. Mastodon/other servers receive post, display in followers' feeds
8. Replies from federated servers → backend inbox
9. Backend converts ActivityPub replies to Nostr events
10. Backend publishes to Nostr relays
11. Client receives replies from Nostr (as usual)
```

**Privacy Guarantees**:
- ✅ Private groups **never federate** (pure Nostr E2EE)
- ✅ Encrypted DMs **never federate**
- ⚠️ Public posts can federate (user controls via toggle)
- ⚠️ Federation server sees public post metadata (timestamps, follows)
- ❌ Server cannot decrypt private content (no keys)

**Backend Requirements**:
- Fedify framework (TypeScript/Bun)
- PostgreSQL (for actor storage, inbox/outbox)
- HTTPS domain (required for ActivityPub)
- HTTP signatures (built into Fedify)
- WebFinger endpoint

**Self-Hosting Options**:
- Users run their own federation server
- Multiple users share a federation server (multi-tenant)
- BuildIt-hosted federation service (open source, auditable)

**Effort**: 40-60 hours

---

### Server-Rendered Pages (SSR for SEO)

#### Option A: Static Site Generation (No Backend) ⚠️

**Implementation**: Prerender pages at build time

**Limitations**:
- Only works for content known at build time
- Cannot handle dynamic content (new events, campaigns)
- Requires rebuild for new pages

**Use Case**: Marketing pages, docs, about pages

---

#### Option B: Server-Side Rendering (Backend Required) ✅

**Implementation**: Backend renders React components to HTML

**Flow**:
```
1. Search engine crawler requests /events/public/[id]
2. Backend receives request
3. Backend queries Nostr relays for event data
4. Backend renders React component server-side (renderToString)
5. Backend injects SEO meta tags (Open Graph, Twitter Cards)
6. Backend returns HTML with embedded JSON-LD (schema.org)
7. Crawler indexes page
8. Client-side hydration for interactivity
```

**Privacy**: ✅ Only public events rendered server-side, no private data

**Backend Requirements**:
- React Server Components or renderToString
- Nostr client (to query relays)
- Cache layer (Redis/in-memory for performance)

**Effort**: 8-12 hours

---

## E2EE Preservation Strategy

### Backend Security Rules

**Backend MUST NEVER**:
- ❌ Store user private keys
- ❌ Decrypt NIP-17 private messages (except newsletters if user consents)
- ❌ See private group content
- ❌ Track user activity beyond what's needed for service (GDPR/CCPA compliance)
- ❌ Store unencrypted sensitive data (payment details, personal info)

**Backend CAN**:
- ✅ Relay webhooks (Stripe → Nostr)
- ✅ Send emails (if user opts in, for public newsletters)
- ✅ Federate public posts (ActivityPub)
- ✅ Render public pages (SSR for SEO)
- ✅ Query Nostr relays for public events
- ✅ Unseal NIP-17 envelopes for payment intents (with user consent, stateless)

### Privacy Guarantees by Feature

| Feature | Backend Involvement | Privacy Level | Data Backend Sees |
|---------|---------------------|---------------|-------------------|
| **Private groups** | None | ✅✅✅ Excellent | Nothing (pure Nostr E2EE) |
| **DMs** | None | ✅✅✅ Excellent | Nothing (NIP-17 E2EE) |
| **Crypto payments** | None | ✅✅✅ Excellent | Nothing (client-side) |
| **Stripe/PayPal** | Webhook relay | ✅✅ Good | Payment intent (amount, campaign) |
| **Newsletters (Nostr)** | None | ✅✅✅ Excellent | Nothing (NIP-17 DMs) |
| **Newsletters (Email)** | Email sending | ⚠️ Moderate | Newsletter content + emails |
| **Federation** | ActivityPub server | ⚠️ Moderate | Public posts only |
| **SSR (Public pages)** | Page rendering | ✅✅ Good | Public event data only |

---

## Implementation Plan

### Phase 1: Client-Side First (No Backend Required)

**Goal**: Implement all features that can be done client-side

**Epics**:
1. **Epic 49A: Crypto Payment Integration** (6-8h)
   - Bitcoin/Ethereum address generation
   - QR code display
   - Blockchain explorer polling
   - Donation tracking

2. **Epic 52: Long-Form Publishing** (15-20h)
   - Article editor (TipTap, already implemented)
   - NIP-23 for long-form content
   - RSS feed generation (client-side)
   - SEO meta tags (static)

3. **Epic 53A: Newsletter via Nostr DMs** (12-15h)
   - Newsletter composer
   - Subscriber management (encrypted)
   - NIP-17 delivery
   - Delivery tracking

**Total Effort**: 33-43 hours

**Deliverable**: Fully functional payment, publishing, and newsletter features without any backend

---

### Phase 2: Evaluate Backend Need (Decision Point)

**Questions for User**:

1. **Payments**: Do you need credit card payments (Stripe/PayPal) or is crypto-only acceptable?
   - Crypto-only → No backend needed (Phase 1 complete)
   - Credit cards → Proceed to Phase 3 (Epic 49B)

2. **Newsletters**: Nostr DMs only or email delivery too?
   - Nostr DMs → No backend needed (Phase 1 complete)
   - Email delivery → Proceed to Phase 3 (Epic 53B)

3. **Federation**: Is Mastodon/Bluesky interop important?
   - No → Stay pure P2P Nostr
   - Yes → Proceed to Phase 4 (Epic 54)

4. **Hosting**: If backend needed, self-host or use hosted service?
   - Self-host → Provide Docker setup
   - Hosted → Deploy to Vercel/Fly.io

5. **SEO**: Is server-side rendering needed for public pages?
   - No → Static generation works (Phase 1)
   - Yes → Proceed to Phase 3 (SSR)

---

### Phase 3: Backend Service (If Needed)

**Goal**: Add backend for features that require it

**Epic 62: Backend Service Setup** (8-12h)
- Setup Bun server project
- Monorepo structure (`client/` + `server/`)
- Nostr client integration (nostr-tools)
- NIP-17 encryption/decryption
- Environment variables (API keys)
- Docker setup for self-hosting
- Deploy to hosting provider

**Epic 49B: Stripe/PayPal Integration** (10-15h)
- Stripe checkout session creation
- PayPal SDK integration
- Webhook endpoints (payment.succeeded, etc.)
- Nostr message handling (receive intents, publish receipts)
- Stateless design (no database for payments)

**Epic 53B: Email Newsletter Delivery** (10-15h)
- SendGrid/Mailgun API integration
- Email template rendering
- Subscriber email management
- Bounce handling
- Unsubscribe endpoint

**Epic: Server-Side Rendering for SEO** (8-12h)
- SSR endpoints for public pages
- React Server Components or renderToString
- SEO meta tags (Open Graph, Twitter Cards)
- JSON-LD schema.org markup
- Sitemap generation

**Total Effort**: 36-54 hours

---

### Phase 4: Federation (Major Decision, Optional)

**Goal**: Enable Mastodon/Bluesky interoperability

**Epic 54: ActivityPub Server with Fedify** (40-60h)
- Fedify framework integration
- PostgreSQL setup (actor storage)
- Actor creation per identity
- Inbox/outbox endpoints
- HTTP signatures
- WebFinger endpoint
- Nostr → ActivityPub conversion
- ActivityPub → Nostr conversion
- Hybrid opt-in mode (per identity toggle)
- Deploy federation server

**Epic 55: AT Protocol Integration** (40-60h, deferred)
- Personal Data Server (PDS) setup
- Bluesky interop
- **Defer until ActivityPub proven**

**Total Effort**: 40-60 hours

---

## Decision Matrix

### Implementation Priorities

| Epic | Feature | Client-Only | Backend Required | Effort | Priority | Phase |
|------|---------|-------------|------------------|--------|----------|-------|
| **49A** | Crypto payments | ✅ | ❌ | 6-8h | P1 | 1 |
| **52** | Long-form publishing | ✅ | ❌ | 15-20h | P1 | 1 |
| **53A** | Newsletter (Nostr DMs) | ✅ | ❌ | 12-15h | P1 | 1 |
| **62** | Backend service setup | ❌ | ✅ | 8-12h | P2 | 3 |
| **49B** | Stripe/PayPal payments | ❌ | ✅ | 10-15h | P2 | 3 |
| **53B** | Newsletter (Email) | ❌ | ✅ | 10-15h | P2 | 3 |
| **SSR** | Server-side rendering | ❌ | ✅ | 8-12h | P2 | 3 |
| **54** | ActivityPub federation | ❌ | ✅ | 40-60h | P3 | 4 |
| **55** | AT Protocol | ❌ | ✅ | 40-60h | P3 | Deferred |

### Technology Stack

**Client** (No Changes):
- React 18 + TypeScript
- Vite + Tailwind CSS
- Nostr: nostr-tools
- Crypto: @noble/secp256k1
- Storage: Dexie (IndexedDB)

**Backend** (New):
- **Runtime**: Bun (TypeScript, Node.js compatible)
- **Framework**: Hono (fast, lightweight web framework)
- **Nostr**: nostr-tools (same as client)
- **Encryption**: NIP-17 unsealing (for payment intents)
- **Database**: PostgreSQL (only for federation actor storage)
- **APIs**:
  - Stripe SDK (@stripe/stripe-js)
  - PayPal SDK (@paypal/checkout-server-sdk)
  - SendGrid API (@sendgrid/mail)
  - Fedify (ActivityPub framework)

**Deployment**:
- **Client**: Vercel, Netlify, IPFS (no change)
- **Backend**: Fly.io, Railway, or self-hosted Docker

---

## Monorepo Structure

```
buildit-network/
├── client/                  # React SPA (existing)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── server/                  # Bun backend (new)
│   ├── src/
│   │   ├── index.ts         # Main server entry
│   │   ├── nostr/           # Nostr client integration
│   │   │   ├── client.ts    # Connect to relays
│   │   │   ├── nip17.ts     # Unseal messages
│   │   │   └── publisher.ts # Publish responses
│   │   ├── payments/        # Payment integrations
│   │   │   ├── stripe.ts    # Stripe API
│   │   │   ├── paypal.ts    # PayPal API
│   │   │   └── webhooks.ts  # Webhook handlers
│   │   ├── email/           # Email service
│   │   │   ├── sendgrid.ts  # SendGrid API
│   │   │   └── templates.ts # Email templates
│   │   ├── federation/      # ActivityPub server
│   │   │   ├── actors.ts    # Actor management
│   │   │   ├── inbox.ts     # Inbox endpoint
│   │   │   ├── outbox.ts    # Outbox endpoint
│   │   │   └── webfinger.ts # WebFinger endpoint
│   │   └── ssr/             # Server-side rendering
│   │       ├── render.ts    # React SSR
│   │       └── routes.ts    # Public page routes
│   ├── package.json
│   ├── bun.lock
│   └── Dockerfile
│
├── shared/                  # Shared types and utils
│   ├── types/
│   │   ├── nostr.ts         # Nostr event types
│   │   ├── payments.ts      # Payment types
│   │   └── activitypub.ts   # ActivityPub types
│   └── utils/
│       └── crypto.ts        # Shared crypto utils
│
├── package.json             # Root workspace config
└── README.md
```

---

## Conclusion

**Recommended Architecture**: Nostr-First Hybrid

BuildIt Network remains a P2P Nostr application at its core. Backend services are **optional add-ons** for specific features (payments, email, federation) that users can enable if needed.

**Philosophy**:
- ✅ Core app works 100% without backend (P2P via Nostr)
- ✅ Backend adds features, not dependencies
- ✅ E2EE preserved for private content
- ✅ Self-hosting option for privacy-conscious users
- ✅ Maintains alignment with Nostr philosophy

**Next Steps**:
1. Implement Phase 1 (client-side features: Epics 49A, 52, 53A)
2. User evaluates need for backend (payments, email, federation)
3. If needed, implement Phase 3 (backend service)
4. If needed, implement Phase 4 (federation)

**Timeline**:
- Phase 1: 33-43 hours (2-3 weeks)
- Phase 2: Decision point
- Phase 3: 36-54 hours (3-4 weeks)
- Phase 4: 40-60 hours (4-6 weeks)

**Total Effort** (if all phases): 109-157 hours (10-15 weeks)

---

**Document Status**: Planning
**Next Update**: After Phase 1 implementation
**Owner**: Development Team
**Last Reviewed**: 2025-10-09
