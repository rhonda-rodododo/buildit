# Next Roadmap

Active development roadmap for BuildIt Network. Epics are ordered by priority.

**For completed work**: See [COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md)
**For git history**: Use `git log` or `git show <tag>`

## 📋 Epic Completion Workflow (For Claude Code Subagents)

When completing an epic:

1. **Execute all tasks** - Check off all checkboxes, meet all acceptance criteria
2. **Run tests** - `bun run test && bun run typecheck` must pass
3. **Create git commit** - Use exact format from epic (e.g., `feat: complete Epic 28 - Critical Bug Fixes`)
4. **Create git tag** - Format: `v0.28.0-bugfixes` (see epic for tag name)
5. **Move epic to COMPLETED_ROADMAP.md**:
   - Cut entire epic section from this file
   - Add row to table in COMPLETED_ROADMAP.md (Epic #, Version, Status ✅, Git Tag, 1-2 line summary)
   - Append full epic details below table in COMPLETED_ROADMAP.md
   - Update "Last Updated" dates in both files
6. **Commit roadmap update** - `git commit -m "docs: complete Epic X - move to COMPLETED_ROADMAP"`

---

## 📊 Current Status

**Last Updated**: 2026-01-24 (Epics 51, 56, 57, 58 completed)
**Active Phase**: Quality Complete (Epic 51 ✅) - Native App (Epic 63)
**Build Status**: ✅ Successful (285.33KB brotli initial load)
**Test Status**: ✅ 1236/1236 tests passing (100% pass rate, 62 test files)
**E2E Coverage**: 85%+ of epics ✅ Epic 68 added 54 new tests (36 test files total)
**Security Audit**: ✅ Complete (Epic 30) - Ready for external audit
**Architecture**: ✅ 100% Client-Side P2P (Nostr + E2EE) → Optional Backend (Phase 3+)
**Native App**: 🚧 Foundation complete (@buildit/sdk, design-tokens, OneStack scaffold)

**🎯 Architectural Decision**: Hybrid Nostr + Optional Backend
- **Phase 1** (33-43h): Client-side only features (crypto payments, publishing, Nostr newsletters)
- **Phase 2**: Decision point - does user need backend? (credit cards, email, federation, SSR)
- **Phase 3** (36-54h): Add backend if needed (Stripe/PayPal, email delivery, SSR)
- **Phase 4** (40-60h): Federation (ActivityPub) - major decision required

**Priority Focus**: Phase 1 client-side features → Evaluate backend need → Phase 3 backend services (optional)

See [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md) for complete architectural analysis.

---

## 🔴 Critical Path: Production Readiness

### Epic 31: Legal & Compliance Documentation 📋
**Status**: Not Started
**Priority**: P0 - Required before public launch
**Effort**: 5-10 hours
**Dependencies**: None (can proceed in parallel)
**Assignable to subagent**: No (requires legal review)

**Context**: Legal documents required for public deployment.

**Tasks**:
- [ ] Draft Terms of Service (consider EFF template)
- [ ] Draft Privacy Policy (GDPR/CCPA compliant)
- [ ] Create Cookie Policy (if applicable)
- [ ] Document GDPR compliance measures (data export, right to erasure)
- [ ] Document CCPA compliance measures (California)
- [ ] Create Content Moderation Policy
- [ ] Draft DMCA policy (if file sharing enabled)
- [ ] Choose open source license (AGPL-3.0 recommended for network services)
- [ ] Create CODE_OF_CONDUCT.md (Contributor Covenant template)
- [ ] Create CONTRIBUTING.md guide
- [ ] Legal review of all documents (consult with lawyer)

**Acceptance Criteria**:
- All legal documents drafted and reviewed by legal counsel
- Documents published and accessible in app footer
- License file added to repository
- GDPR/CCPA compliance verified
- Code of Conduct adopted

**Reference Docs**: [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Production Features section)

**Git Commit Format**: `docs: add legal and compliance documentation (Epic 31)`

---

## 🟢 Medium Priority: Enhanced Features

### Epic 36: Additional Translations (German, Portuguese, Mandarin) 🌍
**Status**: Partial (4/7 languages)
**Priority**: P2
**Effort**: 10-20 hours
**Dependencies**: None
**Assignable to subagent**: No (requires native speakers)

**Context**: i18n infrastructure exists with 4 complete languages (English, Spanish, French, Arabic). Need 3 more for wider reach.

**Tasks**:
- [ ] Dynamically load locales per module, in addition to core locales
- [ ]
- [ ] Create German locale (de.json) - 123 keys
- [ ] Create Portuguese locale (pt.json) - 123 keys
- [ ] Create Mandarin Chinese locale (zh.json) - 123 keys
- [ ] Verify RTL support for Arabic
- [ ] Test all locale switching
- [ ] Add language fallback logic
- [ ] Create translation contribution guide
- [ ] Set up crowdsourced translation workflow (optional)

**Acceptance Criteria**:
- All 7 languages complete (en, es, fr, ar, de, pt, zh)
- All languages have 123+ translation keys
- Language switcher shows all 7 languages
- RTL layout works for Arabic
- Tests verify all locales load correctly

**Testing Requirements**:
- Switch to each language and verify UI renders
- Test RTL layout with Arabic
- Verify fallback to English for missing keys

**Reference Docs**: [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Translation section), `/src/i18n/locales/`

**Git Commit Format**: `i18n: add German, Portuguese, and Mandarin translations (Epic 36)`

---

## 🔵 Feature Completeness: Deferred Features

### Epic 49B: Stripe/PayPal Integration 💳 (Backend Required)
**Status**: Not Started (Deferred to Phase 3)
**Priority**: P2 - Backend-Dependent Features (TIER 1, PHASE 3)
**Effort**: 10-15 hours
**Dependencies**: Epic 49A complete, Epic 62 (Backend Service Setup) complete
**Assignable to subagent**: No (requires backend infrastructure decision)
**Backend Required**: ✅ Yes (API keys, webhooks)

**⚠️ ARCHITECTURAL DECISION REQUIRED**: This epic requires server-side infrastructure. User must decide:
1. Self-host backend service (full control)
2. Use BuildIt-hosted backend (trust required)
3. Skip credit card payments (crypto-only from Epic 49A)

**Context**: Integrate Stripe and PayPal for credit card payment processing. Requires backend service for API key security and webhook handling.

**Architecture**: See [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md) for flow diagram.

**Flow**:
```
Client → NIP-17 encrypted payment intent → Nostr Relay → Backend
Backend → Stripe/PayPal API → Creates checkout session
Backend → Returns checkout URL via Nostr (encrypted)
Client → Opens hosted checkout page
User → Completes payment
Stripe/PayPal → Webhook to backend
Backend → Publishes receipt to Nostr (NIP-17 encrypted)
Client → Receives receipt from Nostr
```

**Tasks**:
- [ ] **Stripe Integration (6-8h)**
  - [ ] Backend: Set up Stripe API key (environment variable)
  - [ ] Backend: Implement checkout session creation endpoint
  - [ ] Backend: Handle webhook events (payment.succeeded, payment.failed)
  - [ ] Client: Send payment intent via NIP-17 to backend
  - [ ] Client: Receive checkout URL, open Stripe hosted page
  - [ ] Client: Receive receipt from Nostr, update UI
- [ ] **PayPal Integration (4-6h)**
  - [ ] Backend: Set up PayPal Business API key
  - [ ] Backend: Implement PayPal Checkout SDK
  - [ ] Backend: Handle PayPal webhooks
  - [ ] Client: PayPal payment flow similar to Stripe

**Acceptance Criteria**:
- Stripe one-time and recurring donations work end-to-end
- PayPal donations work end-to-end
- All payment webhooks handled correctly
- Backend is stateless (no database for payment storage)
- E2E tests cover all payment methods

**Privacy**: ⚠️ Backend sees payment intent (amount, campaign), but not payment details (Stripe/PayPal handles)

**Testing Requirements**:
- E2E tests for Stripe payment flow (test mode)
- E2E tests for PayPal payment flow (sandbox)
- Backend integration tests
- Build successful
- `bun run test && bun run typecheck` passes

**Reference Docs**:
- [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
- [COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md) Epic 38

**Git Commit Format**: `feat: add Stripe and PayPal payment integration with backend relay (Epic 49B)`

**Git Tag**: `v0.49b.0-stripe-paypal`

---

## 🟣 Publishing Platform Features

### Epic 53B: Newsletter Module - Email Delivery 📬 (Backend Required)
**Status**: Not Started (Deferred to Phase 3)
**Priority**: P2 - Publishing Platform (TIER 2)
**Effort**: 20-30 hours (Actual: 15 hours)
**Dependencies**: Epic 32 complete (Documents module)
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: User requested "full blogging as well, like substack or ghost". Build comprehensive publishing module for long-form content with public/subscriber access.

**Tasks**:
- [x] **Schema & Types (3-4h)**
  - [x] Create `articles` table (title, slug, content, status, publishedAt, etc.)
  - [x] Create `publications` table (name, description, theme, domain)
  - [x] Create `subscriptions` table (subscriber pubkey, publication ID, tier)
  - [x] Create `article_views` table (analytics)
  - [x] Define TypeScript interfaces
- [x] **Article Editor (6-8h)**
  - [x] Reuse TipTap editor from Documents module
  - [x] Add article metadata editor (title, subtitle, cover image, tags)
  - [x] Add SEO controls (meta description, OG tags)
  - [x] Draft/publish/schedule workflow
  - [x] Preview mode
  - [x] Auto-save
- [x] **Publication Management (4-6h)**
  - [x] Create publication setup wizard
  - [x] Publication settings (name, description, logo, theme)
  - [ ] Custom domain support (CNAME) - deferred
  - [ ] Navigation menu editor - deferred
  - [x] Theme customization (colors, fonts, layout)
- [x] **Public Article Pages (4-6h)**
  - [x] Public article view page
  - [x] Publication homepage (article list)
  - [ ] Archive/category pages - deferred
  - [ ] Author profile pages - deferred
  - [x] RSS feed generation
  - [x] Social sharing (Open Graph, Twitter Cards)
- [x] **Subscriber Management (3-5h)**
  - [x] Free vs. paid tiers
  - [x] Subscriber-only content
  - [x] Subscription flow (via Nostr identity)
  - [x] Subscriber dashboard
  - [ ] Email notifications - deferred to Epic 53B

**Acceptance Criteria**:
- ✅ Can create and manage publications
- ✅ Articles can be drafted, published, and scheduled
- ✅ Public article pages render beautifully
- ✅ Subscriber-only content works
- ✅ RSS feed generated
- ✅ SEO metadata working (OG tags, meta descriptions)
- ⏳ E2E tests cover publishing flow - deferred to Epic 51

**Testing Requirements**:
- ⏳ E2E tests for article creation and publishing - deferred
- ⏳ E2E tests for subscription flow - deferred
- Manual testing of public pages
- ✅ Build successful
- ✅ `bun run typecheck` passes

**Reference Docs**: [Substack](https://substack.com), [Ghost](https://ghost.org), `/src/modules/documents/`

**Git Commit**: `feat(publishing): implement Long-Form Publishing module (Epic 52)`

**Git Tag**: `v0.52.0-publishing`

---

### Epic 53A: Newsletter Module - Nostr DMs 📧 (Client-Side Only) ✅
**Status**: COMPLETE
**Priority**: P1 - Publishing Platform (TIER 2, PHASE 1)
**Effort**: 12-15 hours (Actual: 10 hours)
**Dependencies**: Epic 52 complete (Publishing module)
**Assignable to subagent**: Yes (`feature-implementer`)
**Backend Required**: ❌ No (100% client-side)

**Context**: Build newsletter module with delivery via Nostr DMs (NIP-17). Fully P2P, privacy-preserving, no email service required. Reaches Nostr users only.

**Architecture**: See [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md) for full details.

**Tasks**:
- [x] **Schema & Types (2-3h)**
  - [x] Create `newsletters` table (name, description, schedule, etc.)
  - [x] Create `newsletter_issues` table (subject, content, sentAt, stats)
  - [x] Create `newsletter_subscribers` table (pubkey, subscription date, preferences)
  - [x] Create `newsletter_sends` table (tracking individual sends)
  - [x] Define TypeScript interfaces
- [x] **Newsletter Editor (4-5h)**
  - [x] Rich newsletter composer (reuse TipTap from Documents module)
  - [x] Template system (header, footer, branding)
  - [ ] Preview mode (markdown rendering) - deferred
  - [x] Draft/schedule workflow
  - [ ] Link tracking (Nostr event IDs) - deferred
- [x] **Subscriber Management (3-4h)**
  - [x] Subscribe via Nostr pubkey
  - [x] Import subscribers (CSV/paste)
  - [x] Export subscribers (CSV)
  - [x] Subscription preferences (frequency, topics)
  - [x] Unsubscribe flow
  - [x] Subscriber analytics (encrypted client-side)
- [x] **Delivery System - Nostr DMs (3-4h)**
  - [x] Batch NIP-17 DM sending (one per subscriber)
  - [x] Rate limiting (avoid relay throttling)
  - [x] Delivery queue with retry logic
  - [x] Delivery status tracking (relay confirmations)
  - [x] Error handling and reporting

**Acceptance Criteria**:
- ✅ Can create and manage newsletters
- ✅ Subscribers can sign up/unsubscribe via Nostr pubkey
- ✅ Newsletter issues sent as NIP-17 DMs
- ✅ Delivery tracking via relay confirmations
- ✅ Analytics track subscriber growth and engagement
- ⏳ E2E tests cover newsletter flow - deferred to Epic 51
- ✅ No backend infrastructure required

**Privacy**: ✅ Fully E2EE (NIP-17), P2P via Nostr, no email service involvement

**Limitations**:
- Only reaches Nostr users (not general public)
- Delivery depends on subscriber checking Nostr DMs
- No HTML email rendering (markdown only)

**Testing Requirements**:
- ⏳ E2E tests for newsletter creation and sending - deferred
- ⏳ E2E tests for subscriber management - deferred
- Manual testing with multiple subscribers
- ✅ Build successful
- ✅ `bun run typecheck` passes

**Reference Docs**:
- [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
- [COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md) Epic 32 (Documents)
- [Buttondown](https://buttondown.email) (inspiration)

**Git Commit**: `feat(newsletters): implement Newsletter module with Nostr DM delivery (Epic 53A)`

**Git Tag**: `v0.53a.0-newsletters-nostr`

---

### Epic 53B: Newsletter Module - Email Delivery 📬 (Backend Required)
**Status**: Not Started (Deferred to Phase 3)
**Priority**: P2 - Backend-Dependent Features (TIER 2, PHASE 3)
**Effort**: 10-15 hours
**Dependencies**: Epic 53A complete, Epic 62 (Backend Service Setup) complete
**Assignable to subagent**: No (requires email service decision)
**Backend Required**: ✅ Yes (SMTP server or email API)

**⚠️ ARCHITECTURAL DECISION REQUIRED**: This epic requires server-side email sending. User must decide:
1. Self-host email service (SendGrid/Mailgun API key)
2. Use BuildIt-hosted email relay (trust required)
3. Skip email delivery (Nostr DMs only from Epic 53A)

**Context**: Add email delivery option for newsletters to reach broader audience beyond Nostr users. Requires backend integration with email service provider.

**Architecture**: See [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md) for flow diagram.

**Flow**:
```
Client → Compose newsletter (TipTap editor)
Client → Encrypt subscriber email list + content
Client → Send to backend via NIP-17 (Nostr)
Backend → Unseal NIP-17 envelope
Backend → Convert markdown/HTML to email template
Backend → Send emails via SendGrid/Mailgun API
Backend → Handle bounces and unsubscribes
Backend → Publish delivery stats to Nostr (encrypted)
Client → Receive stats, update analytics dashboard
```

**Tasks**:
- [ ] **Email Service Integration (4-6h)**
  - [ ] Backend: Set up SendGrid or Mailgun API key
  - [ ] Backend: Email template rendering (markdown → HTML)
  - [ ] Backend: Batch email sending with rate limiting
  - [ ] Backend: Bounce handling and error reporting
  - [ ] Backend: Unsubscribe endpoint (required by CAN-SPAM)
- [ ] **Client Integration (3-4h)**
  - [ ] Add "Enable Email Delivery" toggle in newsletter settings
  - [ ] Import subscriber emails (CSV)
  - [ ] Send newsletter + emails to backend via NIP-17
  - [ ] Receive delivery stats from Nostr
- [ ] **Analytics (2-3h)**
  - [ ] Open rate tracking (pixel tracking)
  - [ ] Click-through rate tracking (link redirects)
  - [ ] Email-specific analytics dashboard
- [ ] **Legal Compliance (1-2h)**
  - [ ] GDPR compliance (consent, right to erasure)
  - [ ] CAN-SPAM compliance (unsubscribe link, physical address)
  - [ ] Privacy policy updates

**Acceptance Criteria**:
- Emails sent successfully via SendGrid/Mailgun
- Bounce handling works (update subscriber status)
- Unsubscribe flow works (one-click, immediate)
- Analytics track opens, clicks, bounces
- GDPR/CAN-SPAM compliant
- E2E tests cover email delivery

**Privacy**: ⚠️ Backend sees newsletter content and email list (mitigation: self-hosting, newsletters typically public)

**Testing Requirements**:
- E2E tests for email delivery flow
- Backend integration tests (SendGrid sandbox)
- Manual testing with real emails
- Build successful
- `bun run test && bun run typecheck` passes

**Reference Docs**:
- [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
- [SendGrid API](https://docs.sendgrid.com/)
- [Mailchimp](https://mailchimp.com) (inspiration)

**Git Commit Format**: `feat: add email delivery option for newsletters with SendGrid/Mailgun (Epic 53B)`

**Git Tag**: `v0.53b.0-newsletters-email`

---

## 🔧 Backend Infrastructure (Phase 3)

### Epic 62: Backend Service Setup 🛠️ (Required for Epics 49B, 53B, 54)
**Status**: Not Started (Deferred to Phase 3)
**Priority**: P2 - Backend Infrastructure (TIER 1, PHASE 3)
**Effort**: 8-12 hours
**Dependencies**: Epics 49A, 52, 53A complete (Phase 1)
**Assignable to subagent**: Yes (`backend-engineer`, `devops`)
**Backend Required**: ✅ This IS the backend setup epic

**⚠️ CRITICAL ARCHITECTURAL MILESTONE**: This epic sets up the optional backend service infrastructure. Only proceed if user confirms need for:
- Credit card payments (Stripe/PayPal) - Epic 49B
- Email newsletter delivery - Epic 53B
- Federation (Mastodon/Bluesky) - Epic 54

**Note**: SSR for SEO is complete (Epic 70) using TanStack Start on Cloudflare Workers - no traditional backend required.

**Context**: Set up Bun backend service in monorepo structure. Backend will be stateless, optional, and self-hostable. Communicates with client via Nostr (NIP-17 encrypted messages).

**Architecture**: See [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md) for complete design.

**Monorepo Structure**:
```
buildit-network/
├── client/           # React SPA (existing)
├── server/           # Bun backend (new)
│   ├── src/
│   │   ├── index.ts
│   │   ├── nostr/
│   │   ├── payments/
│   │   ├── email/
│   │   ├── federation/
│   │   └── ssr/
│   ├── package.json
│   └── Dockerfile
├── shared/           # Shared types (new)
└── package.json      # Root workspace
```

**Tasks**:
- [ ] **Monorepo Setup (2-3h)**
  - [ ] Restructure repo: `client/`, `server/`, `shared/`
  - [ ] Update root `package.json` with workspace config
  - [ ] Move existing files to `client/`
  - [ ] Update build scripts and paths
  - [ ] Update CI/CD for monorepo structure
- [ ] **Backend Service Init (2-3h)**
  - [ ] Initialize Bun server project (`server/`)
  - [ ] Install dependencies (Hono, nostr-tools)
  - [ ] Set up TypeScript config
  - [ ] Create main server entry (`index.ts`)
  - [ ] Set up environment variables (.env)
  - [ ] Health check endpoint (`/health`)
- [ ] **Nostr Integration (2-3h)**
  - [ ] Nostr client setup (connect to relays)
  - [ ] NIP-17 message unsealing (decrypt payment intents, etc.)
  - [ ] Message publisher (publish responses to Nostr)
  - [ ] Subscription filters for backend-relevant events
- [ ] **Docker & Deployment (2-3h)**
  - [ ] Create Dockerfile for backend
  - [ ] Docker Compose for local development
  - [ ] Environment variable documentation
  - [ ] Deploy to Fly.io or Railway (optional hosted version)
  - [ ] Self-hosting documentation

**Acceptance Criteria**:
- ✅ Monorepo structure functional (client + server)
- ✅ Backend server runs locally (`bun run dev`)
- ✅ Backend connects to Nostr relays
- ✅ Backend can unseal NIP-17 messages
- ✅ Backend can publish messages to Nostr
- ✅ Docker setup works for self-hosting
- ✅ Deployment documentation complete

**Privacy**: ✅ Backend never sees private keys, only handles encrypted payloads via Nostr

**Testing Requirements**:
- Backend integration tests (Nostr message handling)
- Docker build successful
- Health check endpoint functional
- `bun run test` passes for backend tests

**Reference Docs**:
- [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md)
- [Bun Documentation](https://bun.sh/docs)
- [Hono Web Framework](https://hono.dev/)

**Git Commit Format**: `feat: add optional backend service infrastructure with Nostr integration (Epic 62)`

**Git Tag**: `v0.62.0-backend-setup`

---

## 🌐 Federation Support (ARCHITECTURAL DECISION REQUIRED)

### Epic 54: ActivityPub Server with Fedify 🌐
**Status**: Not Started
**Priority**: P2 - Federation (TIER 3) - **DECISION REQUIRED**
**Effort**: 40-60 hours
**Dependencies**: None (parallel to client work)
**Assignable to subagent**: No (requires architectural decision)

**⚠️ CRITICAL ARCHITECTURAL DECISION**: This epic requires adding server-side infrastructure to BuildIt Network, which is currently 100% client-side P2P via Nostr. This is a major architectural shift.

**Decision Options**:
1. **Required Federation**: All public activity federates (Mastodon/Bluesky interop)
2. **Optional Federation**: Hybrid mode - users opt-in per identity/group
3. **Skip Federation**: Stay P2P-only, focus on Nostr ecosystem

**Recommendation**: **Option 2 (Hybrid)** - Optional federation per identity/group maintains privacy for activist groups while enabling public reach.

**Context**: User requested ActivityPub and/or ATProto support for public social activity/microblogging. Fedify is the leading TypeScript framework for ActivityPub servers (v1.6.0 in 2025).

**Architecture Changes Required**:
- Add Node.js/Bun server component
- PostgreSQL or SQLite for federation data
- Monorepo structure (`server/` + `client/`)
- Deploy server infrastructure (VPS, Docker, etc.)

**Tasks**:
- [ ] **Server Setup (6-8h)**
  - [ ] Initialize Bun server project
  - [ ] Set up PostgreSQL/SQLite database
  - [ ] Configure Fedify framework
  - [ ] Set up HTTP signatures and WebFinger
  - [ ] Configure CORS and security headers
- [ ] **Actor Implementation (8-12h)**
  - [ ] Map Nostr identities to ActivityPub actors
  - [ ] Actor creation and profile sync
  - [ ] Handle actor updates
  - [ ] Implement inbox/outbox endpoints
  - [ ] Handle follow/unfollow activities
- [ ] **Federation Logic (12-16h)**
  - [ ] Federate public posts to ActivityPub
  - [ ] Receive activities from other servers
  - [ ] Handle replies and mentions
  - [ ] Implement activity validation
  - [ ] Handle server blocks and moderation
- [ ] **Client Integration (6-8h)**
  - [ ] Add federation toggle to identity settings
  - [ ] Add federation status indicators
  - [ ] Handle federated replies in UI
  - [ ] Show follower counts from federation
  - [ ] Add federation analytics
- [ ] **Deployment (4-6h)**
  - [ ] Docker containerization
  - [ ] Deploy to VPS or cloud provider
  - [ ] Set up domain and HTTPS
  - [ ] Configure reverse proxy (Caddy/nginx)
  - [ ] Set up monitoring and logging
- [ ] **Testing & Documentation (4-6h)**
  - [ ] Test federation with Mastodon instance
  - [ ] Test federation with other ActivityPub servers
  - [ ] Write deployment documentation
  - [ ] Write federation usage guide

**Acceptance Criteria**:
- Server runs Fedify and handles ActivityPub activities
- Public posts from BuildIt federate to Mastodon/other servers
- Users can follow BuildIt accounts from Mastodon
- Replies from federated servers appear in BuildIt
- Server is deployed and accessible
- Documentation covers setup and deployment

**Testing Requirements**:
- Integration tests for ActivityPub activities
- Manual testing with Mastodon instance
- Federation interoperability tests
- Build successful for both client and server
- `bun run test` passes

**Reference Docs**: [Fedify Documentation](https://fedify.dev), [ActivityPub Spec](https://www.w3.org/TR/activitypub/), [COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md) Epic 40

**Git Commit Format**: `feat: add ActivityPub federation server with Fedify (Epic 54)`

**Git Tag**: `v0.54.0-federation`

---

### Epic 55: AT Protocol Integration 🦋
**Status**: Not Started (Deferred)
**Priority**: P3 - Federation Alternative (TIER 3)
**Effort**: 40-60 hours
**Dependencies**: Epic 54 complete (or instead of)
**Assignable to subagent**: No (requires architectural decision)

**Context**: ATProto (Bluesky) is an alternative federation protocol. However, it requires a Personal Data Server (PDS) and is more complex than ActivityPub. **Recommend deferring until ActivityPub is proven.**

**Tasks**: TBD (defer until Epic 54 complete and user confirms need for ATProto)

**Git Commit Format**: `feat: add AT Protocol integration for Bluesky federation (Epic 55)`

**Git Tag**: `v0.55.0-atproto`

---

## 📱 Mobile & Social Polish

### Epic 63: React Native App MVP (OneStack) 📱
**Status**: In Progress (Foundation Complete)
**Priority**: P1 - Mobile App
**Effort**: 40-60 hours
**Dependencies**: None (can proceed in parallel with web features)
**Assignable to subagent**: Yes (`epic-executor`)

**Context**: Build native iOS/Android app using [One](https://onestack.dev) (OneStack) framework. Shares business logic via `@buildit/sdk` and design tokens via `@buildit/design-tokens`. Multi-device support (NIP-46, QR device linking) already implemented in web app.

**Architecture**:
```
┌────────────────────────────────────────────────┐
│              BuildIt Network                    │
├────────────────────────────────────────────────┤
│  ┌─────────────┐         ┌─────────────────┐  │
│  │   Web SPA   │         │   Native App    │  │
│  │ (React/Vite)│         │ (One/RN/Expo)   │  │
│  └──────┬──────┘         └────────┬────────┘  │
│         │                         │            │
│    src/core/*               @buildit/sdk      │
│   (full features)         (portable subset)   │
│         └────────────┬────────────┘            │
│              ┌───────┴───────┐                 │
│              │ design-tokens │ Colors, spacing │
│              └───────────────┘                 │
│                                                 │
│  ┌─────────────┐                               │
│  │     SSR     │ @buildit/shared (read-only)  │
│  │  (TanStack) │ Event parsing, relay config   │
│  └─────────────┘                               │
└────────────────────────────────────────────────┘
```

**SDK Integration Decision**:
- **Native App**: Uses `@buildit/sdk` for all crypto/Nostr operations ✅
- **Web SPA**: Continues using `src/core/*` directly (58 imports across 41 files). SDK was extracted from this code - functionally identical. Future migration optional.
- **SSR**: Uses `@buildit/shared` (read-only event parsing). No signing/encryption needed.

**Completed Tasks**:
- [x] Clean up empty stub packages (core, modules, storage, stores, types, ui)
- [x] Create `@buildit/sdk` package with portable business logic
  - [x] Nostr protocol utilities (event creation, verification)
  - [x] NIP-44 encryption with padding
  - [x] Key management (generation, derivation, recovery phrase)
  - [x] Shared types
- [x] Create `@buildit/design-tokens` package
  - [x] OKLCH color definitions (light/dark themes)
  - [x] Spacing scale (Tailwind-compatible)
  - [x] Typography scale and text styles
- [x] Set up OneStack app in `apps/native/`
  - [x] Vite + One configuration
  - [x] File-system routing
  - [x] Basic screens (home, login, import)

**Remaining Tasks**:
- [ ] **Secure Key Storage (4-6h)**
  - [ ] Integrate expo-secure-store for key persistence
  - [ ] Key encryption at rest
  - [ ] Biometric unlock option
- [ ] **Device Linking (8-12h)**
  - [ ] QR code scanner for NIP-46
  - [ ] Device transfer receive flow
  - [ ] Connection approval UI
  - [ ] Linked devices management
- [ ] **Core Navigation (6-8h)**
  - [ ] Tab navigation (Home, Messages, Groups, Settings)
  - [ ] Group list and detail screens
  - [ ] Message thread screen
  - [ ] Settings screen with multi-device
- [ ] **Messaging MVP (10-15h)**
  - [ ] DM list and compose
  - [ ] Group message view
  - [ ] Real-time message updates
  - [ ] Offline message queue
- [ ] **Platform Polish (6-8h)**
  - [ ] iOS-specific optimizations
  - [ ] Android-specific optimizations
  - [ ] Push notification setup (Expo)
  - [ ] App icon and splash screen
- [ ] **Testing & Release (4-6h)**
  - [ ] TestFlight build
  - [ ] Android internal testing track
  - [ ] Basic E2E tests

**Acceptance Criteria**:
- App builds for iOS and Android
- Can create new identity or import via phrase/key/QR
- Can link device to existing web identity via NIP-46
- Can view and send DMs
- Can view group messages
- Offline message queue works
- TestFlight and internal Android builds available

**Testing Requirements**:
- Manual testing on iOS (Expo Go + native build)
- Manual testing on Android (Expo Go)
- `bun run native:dev` works
- `bun run sdk:typecheck` passes
- `bun run tokens:typecheck` passes

**Reference Docs**:
- [One Documentation](https://onestack.dev/docs)
- [Expo Documentation](https://docs.expo.dev)
- Multi-device: `src/core/device-sync/`, `src/core/nostr/nip46/`

**Git Commit Format**: `feat: complete native app MVP with OneStack (Epic 63)`

**Git Tag**: `v0.63.0-native-mvp`

---

### Epic 59: Mobile-First UX 📱
**Status**: Not Started
**Priority**: P2 - Mobile Polish (TIER 5)
**Effort**: 20-30 hours
**Dependencies**: All core features complete
**Assignable to subagent**: Yes (`ux-designer`)

**Context**: Epic 42 noted "Mobile-specific UI not implemented (desktop-first approach)." Optimize UX for mobile devices.

**Tasks**:
- [ ] **Responsive Layouts (8-10h)**
  - [ ] Mobile navigation (bottom nav bar)
  - [ ] Touch-optimized tap targets (44x44px min)
  - [ ] Mobile-friendly forms
  - [ ] Mobile tables (horizontal scroll or stacked)
  - [ ] Mobile modals (full-screen on small devices)
- [ ] **Mobile Interactions (6-8h)**
  - [ ] Swipe gestures (swipe to delete, swipe to archive)
  - [ ] Pull to refresh
  - [ ] Infinite scroll optimization
  - [ ] Touch-friendly drag and drop
  - [ ] Haptic feedback (where supported)
- [ ] **Mobile Performance (4-6h)**
  - [ ] Reduce initial load time for mobile
  - [ ] Optimize images for mobile (responsive images)
  - [ ] Lazy load below-the-fold content
  - [ ] Reduce mobile bundle size
  - [ ] Service worker optimization
- [ ] **Mobile Testing (2-4h)**
  - [ ] Test on iOS (Safari, Chrome)
  - [ ] Test on Android (Chrome, Firefox)
  - [ ] Test on tablets
  - [ ] Lighthouse mobile audit
  - [ ] Real device testing

**Acceptance Criteria**:
- All pages responsive on mobile (320px-768px)
- Touch gestures work smoothly
- Mobile Lighthouse score 90+
- No horizontal scroll on mobile
- E2E tests pass on mobile viewports

**Testing Requirements**:
- E2E tests on mobile viewports
- Lighthouse mobile audit
- Manual testing on real devices
- Build successful
- `bun run test && bun run typecheck` passes

**Reference Docs**: [Material Design Mobile](https://m3.material.io/), [iOS HIG](https://developer.apple.com/design/human-interface-guidelines/)

**Git Commit Format**: `feat: optimize UX for mobile devices (Epic 59)`

**Git Tag**: `v0.59.0-mobile-ux`

---

### Epic 60: Offline Mode Enhancement 📡
**Status**: Not Started
**Priority**: P2 - PWA Polish (TIER 5)
**Effort**: 15-20 hours
**Dependencies**: None
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Improve PWA offline support beyond current implementation. Enable full app functionality offline.

**Tasks**:
- [ ] **Offline Composition (6-8h)**
  - [ ] Queue messages for sending when online
  - [ ] Queue posts for publishing when online
  - [ ] Queue file uploads for later
  - [ ] Show pending queue in UI
  - [ ] Retry logic with exponential backoff
- [ ] **Background Sync (4-6h)**
  - [ ] Implement Background Sync API
  - [ ] Sync when network returns
  - [ ] Handle sync failures
  - [ ] Show sync status
- [ ] **Offline Data Access (3-4h)**
  - [ ] Verify all data accessible offline (IndexedDB)
  - [ ] Optimize IndexedDB queries
  - [ ] Add offline data pruning (keep last N days)
  - [ ] Export offline data
- [ ] **Cache Management (2-3h)**
  - [ ] Implement cache-first strategy
  - [ ] Add cache size limits
  - [ ] Add cache eviction (LRU)
  - [ ] Clear cache option
  - [ ] Show cache usage

**Acceptance Criteria**:
- Can compose messages/posts offline and send when online
- Background Sync API works reliably
- All cached data accessible offline
- Cache management prevents storage overflow
- E2E tests cover offline scenarios

**Testing Requirements**:
- E2E tests for offline mode
- E2E tests for background sync
- Manual testing with network throttling
- Build successful
- `bun run test && bun run typecheck` passes

**Reference Docs**: [PWA Offline Cookbook](https://web.dev/offline-cookbook/), [Background Sync API](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)

**Git Commit Format**: `feat: enhance offline mode with queue and background sync (Epic 60)`

**Git Tag**: `v0.60.0-offline-enhanced`

---

### Epic 61: Advanced Social Features 🎭
**Status**: Not Started
**Priority**: P2 - Social Polish (TIER 5)
**Effort**: 25-35 hours
**Dependencies**: Epics 40, 50 complete
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Add advanced social features to match modern social platforms: polls, stories, better moderation.

**Tasks**:
- [ ] **Polls (6-8h)**
  - [ ] Create poll composer
  - [ ] Multiple choice polls
  - [ ] Single choice polls
  - [ ] Poll duration settings
  - [ ] Vote on polls
  - [ ] View poll results (live)
  - [ ] Poll analytics
- [ ] **Stories (8-12h)**
  - [ ] Stories composer (image/video/text)
  - [ ] Stories viewer (carousel)
  - [ ] Stories expiration (24h)
  - [ ] Stories analytics (views)
  - [ ] Reply to stories
  - [ ] Stories privacy settings
- [ ] **Enhanced Moderation (6-8h)**
  - [ ] Mute users (hide posts)
  - [ ] Block users (prevent interaction)
  - [ ] Report content (abuse, spam)
  - [ ] Moderation queue for admins
  - [ ] Auto-moderation rules (keyword filters)
  - [ ] Moderation logs
- [ ] **Additional Features (5-7h)**
  - [ ] Bookmarks (save posts for later)
  - [ ] Lists (curated user lists)
  - [ ] Trending topics
  - [ ] Suggested follows
  - [ ] User mentions notifications

**Acceptance Criteria**:
- Polls can be created and voted on
- Stories work with 24h expiration
- Moderation tools work (mute, block, report)
- Bookmarks and lists functional
- E2E tests cover new features

**Testing Requirements**:
- E2E tests for polls
- E2E tests for stories
- E2E tests for moderation
- Build successful
- `bun run test && bun run typecheck` passes

**Reference Docs**: [Twitter Polls](https://help.twitter.com/en/using-twitter/twitter-polls), [Instagram Stories](https://help.instagram.com/1660923094227526)

**Git Commit Format**: `feat: add advanced social features - polls, stories, moderation (Epic 61)`

**Git Tag**: `v0.61.0-social-advanced`

---

## 📋 Backlog: Nice to Have

### Backlog Item 0: Content Curation & Marketplace (Epic 46+)
**Effort**: 100+ hours (far future)
**Priority**: Lowest (deferred until core platform complete)
**Context**: One-stop-shop for launching worker co-ops, independent businesses, creative initiatives. Social marketplace with purpose-driven curation. Addresses "Pleasure Activism" vision of joyful economic organizing.
**Tasks**: TBD (draft epic when ready to prioritize)
**Features**: Worker co-op marketplace, independent business directory, creative initiatives, event promotion, mutual aid marketplace, skill/resource sharing economy
**Dependencies**: Epics 38, 41, 42, 44, 37, 39, 43 complete

---

### Backlog Item 1: Visual Regression Testing
**Effort**: 5-10 hours
**Tools**: Percy, Chromatic, or Playwright screenshots
**Tasks**: Screenshot comparison, component visual tests, responsive layout tests, theme consistency tests

---

### Backlog Item 2: Accessibility Audit & Improvements
**Effort**: 10-15 hours
**Tasks**: WCAG 2.1 compliance, screen reader testing, keyboard navigation, color contrast, ARIA labels, focus management
**Tools**: axe, Pa11y, Lighthouse

---

### Backlog Item 3: Monitoring & Observability
**Effort**: 10-15 hours
**Tasks**: Error tracking (Sentry), performance monitoring (Web Vitals), privacy-preserving analytics, crash reporting, user feedback system

---

### Backlog Item 4: CI/CD Pipeline
**Effort**: 10-15 hours
**Tasks**: GitHub Actions or GitLab CI, automated testing, automated builds, automated deployment, preview deployments, rollback capability

---

### Backlog Item 5: SEO & Public Presence
**Effort**: 10-15 hours
**Tasks**: Server-side rendering or static generation, meta tags, robots.txt, sitemap.xml, Schema.org markup, Open Graph tags

---

### Backlog Item 6: Advanced Mutual Aid Features
**Effort**: 5-10 hours
**Tasks**: Geolocation distance calculation (replace exact string match), radius-based matching, map view for requests/offers

---

### Backlog Item 7: GroupSettings Implementation
**Effort**: 3-5 hours
**File**: `/src/components/groups/GroupSettingsDialog.tsx`
**Tasks**: Implement general settings tab, implement member management tab (currently TODO comments)

---

### Backlog Item 8: PWA Offline Enhancements
**Effort**: 10-15 hours
**Tasks**: Offline message composition with queue, background sync API, offline data access verification, cache management, custom install prompt

---

### Backlog Item 9: Additional Languages
**Effort**: 5-10 hours per language
**Languages**: Russian, Hindi, Japanese, Korean, Italian, Dutch, Polish, Turkish

---

### Backlog Item 10: Advanced CRM Analytics
**Effort**: 10-15 hours
**Tasks**: Pipeline movement tracking, conversion rate analysis, organizer performance metrics, department/shift analysis

---

## 🎯 Recommended Execution Order (OUTDATED - See Updated Order Below)

**⚠️ This section is outdated. Epics 28-30, 32-34 are complete. See "Updated Recommended Execution Order" below for current priorities after roadmap re-prioritization (2025-10-08).**

---

~~### Phase 1: Production Readiness (P0)~~
~~1. Epic 28: Critical Bug Fixes (5-10h)~~ ✅ COMPLETED
~~2. Epic 29: E2E Test Suite (20-30h)~~ ✅ COMPLETED
~~3. Epic 30: Security Audit Prep (15-20h) + External Audit~~ ✅ COMPLETED
~~4. Epic 31: Legal & Compliance (5-10h)~~ - Deferred to pre-launch

---

~~### Phase 2: Core Features (P1)~~
~~5. Epic 34: Social Features Core (30-40h)~~ ✅ COMPLETED
~~6. Epic 32: Documents Module (20-30h)~~ ✅ COMPLETED
~~7. Epic 33: Files Module (25-35h)~~ ✅ COMPLETED
~~8. Epic 35: Performance Optimization (10-15h)~~ - Moved to P2

---

~~### Phase 3: Enhanced Features (P2)~~
~~9. Epic 36: Additional Translations (10-20h)~~
~~10. Epic 37: Forms & Fundraising (30-40h)~~
~~11. Epic 38: Advanced Social Features (10-20h)~~
~~12. Epic 39: Tor Integration (20-30h)~~

---

## 📊 Effort Summary (OUTDATED - See Updated Summary Below)

~~**Critical Path (P0)**: 50-70 hours + audit~~
~~**Core Features (P1)**: 85-120 hours~~
~~**Enhanced Features (P2)**: 70-110 hours~~
~~**Backlog Items**: 60-100+ hours~~

~~**Grand Total**: ~265-400+ hours (6-10 weeks full-time)~~

**⚠️ This section is outdated. See "Updated Effort Summary" below for current priorities after roadmap re-prioritization (2025-10-08).**

---

## 🛠️ Using This Roadmap

### For Autonomous Execution
```bash
# Complete next epic
"Complete the next incomplete epic from NEXT_ROADMAP.md"

# Complete specific epic
"Complete Epic 28 from NEXT_ROADMAP.md"

# Work on specific task within epic
"Complete task 1 of Epic 28 (BUG-001 fix)"
```

### For Subagent Delegation
See [.claude/subagents.yml](./.claude/subagents.yml) for subagent task patterns:
- `epic-executor`: Execute full epic autonomously
- `bug-fixer`: Fix specific bugs (Epic 28)
- `test-writer`: Write E2E tests (Epic 29)
- `feature-implementer`: Implement new features (Epics 32-39)
- `performance-optimizer`: Optimize performance (Epic 35)
- `auditor`: Perform security/quality audits (Epic 30)

---

**Last Updated**: 2026-01-24 (Epic 72 Account Recovery System complete)
**Total Epics Pending**: ~13 (Epic 31, 36, 45, 49B, 51, 53B, 54-63)
**Total Backlog Items**: 5+ (includes Epic 46+ content/marketplace, Epic 44 Phase 2)

---

### Epic 45: Pleasure Activism UX Philosophy 🌸
**Status**: Not Started
**Priority**: P2 (Research Spike)
**Effort**: 10-15 hours (research + recommendations)
**Dependencies**: None
**Assignable to subagent**: No (requires human reading/synthesis)

**Context**: Apply adrienne maree brown's "Pleasure Activism" principles to BuildIt Network's UX/UI design. Make organizing, justice work, and liberation feel *joyful* and *pleasurable*, not just another burden. Research spike to inform future UX work.

**Core Principles (from brown's work)**:
1. **What you pay attention to grows** - UI should highlight joy, wins, solidarity moments
2. **We become what we practice** - Interaction patterns should reinforce positive organizing behaviors
3. **Yes is the way** - Use pleasure as decision-making guide for UX flows
4. **Your no makes way for your yes** - Boundaries (privacy controls, consent) create authentic engagement
5. **Make justice feel good** - Organizing should be delightful, not dour

**Tasks**:

- [ ] **Epic 45.1: Literature Review (4-6h)**
  - [ ] Read "Pleasure Activism: The Politics of Feeling Good" (adrienne maree brown)
  - [ ] Review "Emergent Strategy" (brown) for related UX insights
  - [ ] Research black feminist tradition in design
  - [ ] Study joyful/playful UX patterns (e.g., Duolingo celebrations, Discord emotes)

- [ ] **Epic 45.2: Design Recommendations (4-6h)**
  - [ ] Map 5 principles to BuildIt UX patterns
  - [ ] Identify opportunities for micro-celebrations (e.g., proposal passed, event RSVP milestone)
  - [ ] Design playful interactions (animations, sound, haptics)
  - [ ] Create warm color palette options (vs. purely utilitarian design)
  - [ ] Recommend illustration/iconography style (joyful, not corporate)

- [ ] **Epic 45.3: Implementation Roadmap (2-3h)**
  - [ ] Draft Epic 46: Joyful UX Patterns (micro-interactions, celebrations)
  - [ ] Identify quick wins (e.g., add confetti animation when proposal passes)
  - [ ] Outline larger UX overhauls (e.g., redesign onboarding to feel welcoming)
  - [ ] Document anti-patterns to avoid (shame, guilt, exhaustion)

**Deliverables**:
- Document: `docs/PLEASURE_ACTIVISM_UX_PHILOSOPHY.md`
- List of recommended design changes (prioritized)
- Draft Epic 46 spec for joyful UX implementation
- Updated design system principles

**Acceptance Criteria**:
- Comprehensive synthesis of Pleasure Activism → UX patterns
- At least 10 specific recommendations with examples
- Draft Epic 46 ready for execution
- Design team (or AI) can reference doc for all future UX work

**Testing Requirements**:
- N/A (research spike, no code)

**Reference Docs**:
- Book: "Pleasure Activism: The Politics of Feeling Good" (adrienne maree brown)
- Book: "Emergent Strategy" (adrienne maree brown)
- Black feminist design traditions

**Git Commit Format**: `docs: add Pleasure Activism UX philosophy and recommendations (Epic 45)`
**Git Tag**: `v0.45.0-ux-philosophy`

---

## 📊 Updated Effort Summary

**Critical Path (P0)**: 5-10 hours (Epic 31 only - deferred to pre-launch)
**Core Features (P1)**:
- ✅ Epic 38: 10-20h (social features) - COMPLETED (moved to COMPLETED_ROADMAP)
- ✅ Epic 41: 10-15h (friends) - COMPLETED
- ✅ Epic 42: 25-35h (messaging UX) - COMPLETED
- ✅ Epic 44: 12h (BLE mesh Phase 1) - COMPLETED
- **P1 Total**: 57-82 hours (all completed)

**Enhanced Features (P2)**:
- ✅ Epic 37: 15-20h (Forms module) - COMPLETED
- ✅ Epic 37.5: 5-8h (Public module) - COMPLETED
- ✅ Epic 38: 10-15h (Fundraising module) - COMPLETED
- ✅ Epic 39: 20-30h (Tor) - COMPLETED
- ✅ Epic 43: 15-20h (group entity) - COMPLETED
- ✅ Epic 35: 10-15h (performance) - COMPLETED
- Epic 36: 10-20h (translations)
- Epic 45: 10-15h (Pleasure Activism research) ⭐ NEW
- **P2 Total**: 105-158 hours (93-98h completed, 20-35h remaining)

**Backlog Items**: 160-200+ hours (includes Epic 46+ content/marketplace)

**New Grand Total**: ~297-432+ hours (7-10 weeks full-time)
**Recently Completed**: Epic 40 (15-20h), Epic 38 (10-20h), Epic 41 (10-15h), Epic 42 (25-35h), Epic 44 Phase 1 (12h) ✅

---

## 🎯 Updated Recommended Execution Order

### **Immediate Priority (Next 2-3 weeks)**
1. ✅ Epic 40: Username System (15-20h) - COMPLETED
2. ✅ Epic 38: Advanced Social Features (10-20h) - COMPLETED
3. ✅ Epic 41: Friend System (10-15h) - COMPLETED
4. ✅ Epic 42: Messaging UX Overhaul (25-35h) - COMPLETED
5. ✅ Epic 44: BLE Mesh Phase 1 (12h) - COMPLETED
6. ✅ Epic 47: E2E Test Coverage (60-80h) - COMPLETED Phases 1-3 (Phase 4 deferred)

### **Phase 1: Public Engagement (P1)** - COMPLETED ✅
7. ✅ **Epic 37: Forms Module** (15-20h) - COMPLETED
   - ✅ Schema complete (3h)
   - ✅ Public-facing forms (volunteer signup, event registration)
   - ✅ Form builder UI (drag & drop, 11 field types)
   - ✅ Anti-spam protection (honeypot, CAPTCHA, rate limiting)

8. ✅ **Epic 37.5: Public Module** (5-8h) - COMPLETED
   - ✅ Schema complete (2h)
   - ✅ Public page editor with SEO controls
   - ✅ Privacy-preserving analytics dashboard
   - ✅ Infrastructure for Forms and Fundraising

9. ✅ **Epic 38: Fundraising Module** (10-15h) - COMPLETED
   - ✅ Schema complete (3h)
   - ✅ Fundraising campaigns (bail funds, strike funds)
   - ✅ Donation flow (one-time, recurring)
   - ✅ Payment integration (Stripe, PayPal, crypto placeholders)

### **Phase 2: Security & Advanced Features (P2)** - 6-8 weeks
10. ✅ **Epic 39: Tor Integration** (20-30h) - COMPLETED
   - ✅ Metadata protection
   - ✅ .onion relay support (11 relays)
   - ✅ Pairs with BLE mesh for defense-in-depth

11. ✅ **Epic 43: Group Entity & Coalition** (15-20h) - COMPLETED
   - ✅ Groups as collective identities
   - ✅ Multi-group coalition chats
   - ✅ Anonymous screening

12. ✅ **Epic 35: Performance Optimization** (10-15h) - COMPLETED
    - Bundle size reduction (285.33 KB brotli)

### **Phase 3: Localization & UX Philosophy (P2)** - 3-4 weeks
13. **Epic 36: Additional Translations** (10-20h)
    - German, Portuguese, Mandarin
    - Requires native speakers (can parallelize)

14. **Epic 45: Pleasure Activism UX Spike** (10-15h) ⭐ **NEW**
    - Research adrienne maree brown's principles
    - Design joyful organizing UX
    - Informs Epic 46 (Joyful UX Patterns)

### **Pre-Launch (P0)** - 1 week
15. **Epic 31: Legal & Compliance** (5-10h)
    - Terms of Service, Privacy Policy
    - Before public launch

---

## 🎯 NEW ARCHITECTURE: Hybrid Nostr + Optional Backend

**Last Updated**: 2025-10-09 (ARCHITECTURE EVOLUTION - Hybrid Approach Defined)

**See [ARCHITECTURE_EVOLUTION.md](./ARCHITECTURE_EVOLUTION.md) for complete architectural analysis**

### Phase-Based Execution Plan

#### **Phase 1: Client-Side First** (33-43 hours, NO BACKEND) ✅ COMPLETE
**Goal**: Implement all features that can be done 100% client-side
- ✅ Epic 49A: Crypto Payment Integration (6-8h) - Bitcoin, Ethereum, client-side only - **COMPLETE** `v0.49a.0-crypto-payments`
- ✅ Epic 52: Long-Form Publishing (15-20h) - Nostr storage, RSS, SEO - **COMPLETE** `v0.52.0-publishing`
- ✅ Epic 53A: Newsletter - Nostr DMs (12-15h) - NIP-17 delivery, fully P2P - **COMPLETE** `v0.53a.0-newsletters-nostr`

**Deliverable**: Fully functional payments, publishing, and newsletters without any backend infrastructure

---

#### **Phase 2: Decision Point** (User Input Required)
**Questions to answer before proceeding to Phase 3**:

1. **Payments**: Need credit cards (Stripe/PayPal) or crypto-only acceptable?
   - Crypto-only → Phase 1 complete, no backend needed ✅
   - Credit cards → Proceed to Phase 3 (Epic 49B)

2. **Newsletters**: Nostr DMs only or email delivery too?
   - Nostr DMs only → Phase 1 complete, no backend needed ✅
   - Email delivery → Proceed to Phase 3 (Epic 53B)

3. **Federation**: Is Mastodon/Bluesky interop important?
   - No → Stay pure P2P Nostr ✅
   - Yes → Proceed to Phase 4 (Epic 54)

4. **SEO**: Server-side rendering needed for public pages?
   - ✅ **COMPLETE** (Epic 70) - TanStack Start SSR on Cloudflare Workers

5. **Hosting**: If backend needed, self-host or use hosted service?
   - Self-host → Full privacy control
   - Hosted → Easier setup, trust BuildIt-hosted

---

#### **Phase 3: Backend Services** (36-54 hours, BACKEND REQUIRED)
**Goal**: Add backend for features that need it (only if user confirms)

**Prerequisites**: User decides backend is needed (from Phase 2)

- Epic 62: Backend Service Setup (8-12h) - Monorepo, Bun, Nostr integration
- Epic 49B: Stripe/PayPal Integration (10-15h) - Credit card payments
- Epic 53B: Newsletter - Email Delivery (10-15h) - SendGrid/Mailgun
- ~~Epic SSR: Server-Side Rendering (8-12h)~~ ✅ **COMPLETE** (Epic 70)

**Deliverable**: Optional backend service for credit cards, email, and SSR

---

#### **Phase 4: Federation** (40-60 hours, MAJOR DECISION)
**Goal**: Enable Mastodon/Bluesky interoperability (only if confirmed)

- Epic 54: ActivityPub Server (40-60h) - Fedify, hybrid opt-in mode
- Epic 55: AT Protocol (40-60h) - Deferred until ActivityPub proven

**Deliverable**: Optional federation for public content (private groups stay P2P)

---

### Architecture Summary

| Feature | Phase | Backend? | Effort | Privacy | Status |
|---------|-------|----------|--------|---------|--------|
| **Crypto payments** | 1 | ❌ | 6-8h | ✅✅✅ | ✅ Complete |
| **Long-form publishing** | 1 | ❌ | 15-20h | ✅✅✅ | ✅ Complete |
| **Newsletters (Nostr)** | 1 | ❌ | 12-15h | ✅✅✅ | ✅ Complete |
| **SSR for SEO** | 1 | ❌ | 8-12h | ✅ | ✅ Complete (Epic 70) |
| **Backend setup** | 3 | ✅ | 8-12h | ✅ | Not started |
| **Stripe/PayPal** | 3 | ✅ | 10-15h | ⚠️ | Not started |
| **Newsletters (Email)** | 3 | ✅ | 10-15h | ⚠️ | Not started |
| **ActivityPub** | 4 | ✅ | 40-60h | ⚠️ | Not started |

**Total Effort**:
- Phase 1 only: 33-43 hours (2-3 weeks) ✅ No backend
- Phase 1-3: 69-97 hours (5-7 weeks) ⚠️ Backend required
- All phases: 109-157 hours (10-15 weeks) ⚠️ Backend + Federation

---

### Key Architectural Principles

✅ **Core remains 100% client-side P2P**
- Nostr protocol for all private communication
- NIP-17 E2EE for all sensitive data
- IndexedDB for local-first storage
- Works offline (PWA)

✅ **Backend is optional enhancement**
- Users/groups enable backend features per-need
- Self-hosting option for privacy
- Backend never sees private keys
- Stateless design (no user data stored)

✅ **Privacy preserved**
- Private groups: Always pure Nostr E2EE, never backend
- DMs: Always NIP-17, never backend
- Public content: Can use backend for payments/SSR/federation
- User controls what uses backend (opt-in)

---

### Next Steps

**Immediate**: Start Phase 1 (Epic 49A, 52, 53A)
**Then**: Evaluate backend need (Phase 2 decision point)
**If needed**: Implement Phase 3 (backend services)
**If needed**: Implement Phase 4 (federation)

**Priority**: Phase 1 first, then reassess
