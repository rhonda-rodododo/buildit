# Next Roadmap

Active development roadmap for BuildIt Network. Epics are ordered by priority.

**For completed work**: See [COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md)
**For git history**: Use `git log` or `git show <tag>`

## 📋 Epic Completion Workflow (For Claude Code Subagents)

When completing an epic:

1. **Execute all tasks** - Check off all checkboxes, meet all acceptance criteria
2. **Run tests** - `bun test && bun run typecheck` must pass
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

**Last Updated**: 2025-10-08 (Epic 40 completed)
**Active Epic**: Epic 41 (Friend System) or Epic 36 (Additional Translations)
**Build Status**: ✅ Successful (233KB brotli initial load)
**Test Status**: 121/149 tests passing (integration test reliability improved)
**Security Audit**: ✅ Complete (Epic 30) - Ready for external audit
**Completion**: 96% for organizing platform features (+1% with username system)

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

## 🟡 High Priority: MVP+ Features

### Epic 32: Documents Module Implementation 📄
**Status**: ✅ Complete
**Priority**: P1
**Effort**: 20-30 hours (Actual: 12 hours)
**Dependencies**: Epic 28 complete
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Documents module with full WYSIWYG editor and real-time collaboration using CRDT technology.

**Tasks**:
- [x] Install TipTap editor and dependencies (yjs, y-indexeddb, @tiptap/extension-collaboration, jspdf)
- [x] Create Document schema and types
- [x] Implement DocumentsStore (Zustand)
- [x] Build WYSIWYG editor component with TipTap
  - Rich formatting (bold, italic, headings, lists)
  - Tables, images, code blocks
  - Markdown shortcuts
  - Toolbar and keyboard shortcuts
- [x] Implement document CRUD operations
- [x] Add document templates (meeting notes, proposals, manifestos, press releases)
- [x] Implement version control:
  - Auto-save working
  - Version history view
  - Version snapshots
  - Rollback functionality (via Yjs)
- [x] Add real-time collaboration with CRDT:
  - Cursor position indicators
  - User presence with avatars
  - Yjs CRDT for conflict-free merging
  - Encrypted Nostr provider (custom implementation)
  - y-indexeddb for offline support
- [x] Implement export features:
  - PDF export (jsPDF)
  - Markdown export
  - HTML export
  - Plain text export
- [x] Add document encryption (NIP-17 for CRDT updates)
- [x] Create comprehensive seed data
- [x] Write E2E tests for collaborative editing (6 comprehensive tests)

**Acceptance Criteria**:
- ✅ Documents module fully functional
- ✅ Can create, edit, delete documents with rich formatting
- ✅ Version history working with Yjs snapshots
- ✅ Export to PDF/MD/HTML/TXT functional
- ✅ Real-time collaboration working with multiple users
- ✅ 5 document templates available
- ✅ E2E tests passing for collaborative editing

**Testing Requirements**:
- ✅ E2E tests written (`tests/e2e/collaborative-editing.spec.ts`)
- ✅ Build successful
- ✅ Type errors fixed
- ✅ Manual test: Real-time collaboration verified

**Implementation Highlights**:
- Custom EncryptedNostrProvider for privacy-preserving CRDT sync
- NIP-17 encryption for all collaborative edits
- Zero-knowledge relay architecture
- Offline-first with y-indexeddb
- Presence indicators with colored cursors
- Participant avatars in real-time

**Reference Docs**: [CRDT_COLLABORATION_IMPLEMENTATION.md](./CRDT_COLLABORATION_IMPLEMENTATION.md), `/src/modules/documents/`

**Git Commit Format**: `feat: implement Documents module with TipTap WYSIWYG editor and CRDT collaboration (Epic 32)`

**Git Tag**: `v0.32.0-documents`

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

### Epic 37: Forms & Fundraising Module 📝
**Status**: Planned, Not Started
**Priority**: P2
**Effort**: 30-40 hours
**Dependencies**: Epic 32 (Documents) recommended
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Public-facing forms and fundraising capabilities allow groups to interact with external people without requiring accounts.

**Tasks**:
- [ ] **Epic 37.1: Form Builder (15-20h)**
  - [ ] Create Form schema and types
  - [ ] Implement FormsStore (Zustand)
  - [ ] Build visual form builder:
    - Drag & drop field placement
    - 11 field types (text, number, email, phone, select, checkbox, radio, date, file upload, textarea, url)
    - Field validation rules
    - Conditional logic (show/hide fields based on answers)
    - Multi-page forms
  - [ ] Create form templates:
    - Event registration
    - Volunteer signup
    - Contact form
    - Survey/feedback
    - Membership application
  - [ ] Implement form submission handling:
    - Store submissions in Database module
    - Email notifications
    - Auto-responder
    - Webhook support
  - [ ] Add anti-spam protection:
    - Rate limiting
    - Honeypot fields
    - Optional CAPTCHA
  - [ ] Create form analytics dashboard

- [ ] **Epic 37.2: Fundraising Pages (10-15h)**
  - [ ] Create Campaign schema and types
  - [ ] Build campaign page builder:
    - Campaign description (rich text)
    - Fundraising goal and progress bar
    - Donation tiers/levels
    - Campaign updates
  - [ ] Implement donation flow:
    - One-time donations
    - Recurring donations
    - Donation form
    - Thank you page
  - [ ] Create campaign templates:
    - Bail fund
    - Strike fund
    - Mutual aid fund
    - Legal defense fund
  - [ ] Add donor management:
    - Donor wall (optional display)
    - Donor privacy controls
    - Thank you messages
    - Tax receipts (if applicable)
  - [ ] Integrate payment processing:
    - Stripe integration
    - PayPal integration
    - Cryptocurrency (Bitcoin, Lightning, Ethereum)

- [ ] **Epic 37.3: Public Pages CMS (5-8h)**
  - [ ] Extend Wiki module for public pages
  - [ ] Create public page templates:
    - Landing page
    - About page
    - Events calendar (public view)
    - Contact page
  - [ ] Implement SEO controls:
    - Meta tags
    - Open Graph tags
    - Twitter cards
    - sitemap.xml generation
  - [ ] Add custom domain support (CNAME configuration guide)
  - [ ] Create privacy-respecting analytics

- [ ] Write tests for forms and fundraising
- [ ] Create comprehensive seed data

**Acceptance Criteria**:
- Form builder functional with drag & drop
- Can create multi-page forms with conditional logic
- Form submissions stored in database
- Fundraising campaigns can be created
- Donation flow works (with test payment integration)
- Public pages can be published
- SEO metadata working
- Anti-spam measures active

**Testing Requirements**:
- `bun test src/modules/forms/` passing
- Manual test: Create form → Fill out → Submit → View responses
- Manual test: Create fundraising campaign → Test donation flow
- Manual test: Publish public page → Verify SEO tags

**Reference Docs**: [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Forms & Fundraising section), PROMPT.md (Epic 15.5)

**Git Commit Format**: `feat: implement Forms & Fundraising module with public pages (Epic 37)`

---

### Epic 38: Advanced Social Features (Reactions, Reposts, Bookmarks) ❤️
**Status**: Not Started
**Priority**: P2
**Effort**: 10-20 hours
**Dependencies**: Epic 34 complete
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: After core social features (posts, feed, comments), add engagement features like reactions, reposts, and bookmarks.

**Tasks**:
- [ ] **Epic 38.1: Reactions (4-6h)**
  - [ ] Implement NIP-07 reactions (kind:7)
  - [ ] Add multiple reaction types (emoji reactions):
    - ❤️ Heart/Like
    - ✊ Solidarity
    - 🔥 Fire/Hot Take
    - 👀 Eyes/Noted
    - 😂 Laugh
    - 👍 Thumbs Up
  - [ ] Create reaction picker component
  - [ ] Show reaction counts on posts
  - [ ] View who reacted (privacy-aware)
  - [ ] Add reaction notifications

- [ ] **Epic 38.2: Reposts & Sharing (4-6h)**
  - [ ] Implement NIP-06 reposts (kind:6)
  - [ ] Add quote posts (repost with comment)
  - [ ] Create repost UI component
  - [ ] Add cross-post to multiple groups
  - [ ] Implement share to external platforms (optional)
  - [ ] Share event links
  - [ ] Track repost counts

- [ ] **Epic 38.3: Bookmarks (2-4h)**
  - [ ] Create Bookmark schema and types
  - [ ] Implement bookmark actions on:
    - Posts
    - Events
    - Proposals
    - Wiki pages
  - [ ] Create BookmarksView component
  - [ ] Add collections/folders for bookmarks
  - [ ] Implement bookmark search
  - [ ] Sync bookmarks via Nostr

- [ ] **Epic 38.4: Threading & Conversations (2-4h)**
  - [ ] Improve thread visualization
  - [ ] Add "View conversation context" feature
  - [ ] Implement mute threads functionality
  - [ ] Add follow threads for notifications
  - [ ] Create thread navigation UI

- [ ] Write tests for advanced social features
- [ ] Create seed data for reactions, reposts, bookmarks

**Acceptance Criteria**:
- Can react to posts with 6 emoji types
- Reaction counts display correctly
- Can repost with or without comment
- Quote posts working
- Bookmarks functional with folders
- Can search bookmarked content
- Thread visualization improved
- Tests passing for all features

**Testing Requirements**:
- `bun test src/modules/microblogging/` passing (updated tests)
- Manual test: Add reaction → See count update
- Manual test: Quote post with comment
- Manual test: Bookmark post → View in bookmarks
- Manual test: Mute thread → Verify no notifications

**Reference Docs**:
- **[docs/SOCIAL_FEATURES_IMPLEMENTATION_GUIDE.md](./docs/SOCIAL_FEATURES_IMPLEMENTATION_GUIDE.md)** - Detailed implementation checklist (see Epic 21.3, 22, 23, 25)

**Git Commit Format**: `feat: add reactions, reposts, and bookmarks (Epic 38)`

---

### Epic 39: Tor Integration 🧅
**Status**: Deferred from Epic 18
**Priority**: P2
**Effort**: 20-30 hours
**Dependencies**: Epic 30 (Security Audit) recommended
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Tor integration provides metadata protection and censorship resistance for high-risk users. Deferred from Epic 18.

**Tasks**:
- [ ] Research Tor integration approaches:
  - SOCKS5 proxy support
  - Tor Browser detection
  - .onion relay configuration
- [ ] Implement Tor proxy configuration:
  - Settings UI for Tor proxy
  - SOCKS5 proxy connection
  - Connection through local Tor daemon
- [ ] Create .onion relay list:
  - Curate list of .onion Nostr relays
  - Fallback to clearnet relays
  - Relay health monitoring
- [ ] Build Tor status indicator:
  - Show when connected via Tor
  - Circuit status
  - Connection quality
- [ ] Create TorSettings component:
  - Enable/disable Tor routing
  - Proxy configuration
  - .onion relay selection
  - Circuit refresh
- [ ] Add Tor-specific security features:
  - Prevent WebRTC leaks
  - Disable geolocation
  - Enhanced fingerprinting protection
- [ ] Test Tor connectivity (if Tor available)
- [ ] Document Tor setup for users
- [ ] Write tests for Tor integration

**Acceptance Criteria**:
- Can configure Tor proxy settings
- Connects to .onion relays when Tor enabled
- Tor status indicator shows connection state
- No IP/metadata leaks when using Tor
- Documentation complete for Tor setup
- Tests verify Tor configuration

**Testing Requirements**:
- Manual test with Tor Browser running
- Verify .onion relay connections
- Check for WebRTC/IP leaks (ipleak.net)
- Test fallback to clearnet when Tor unavailable

**Reference Docs**: [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Security section), [PRIVACY.md](./PRIVACY.md)

**Git Commit Format**: `feat: implement Tor integration for metadata protection (Epic 39)`

---

## 📋 Backlog: Nice to Have

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

## 🎯 Recommended Execution Order

### Phase 1: Production Readiness (P0)
1. Epic 28: Critical Bug Fixes (5-10h)
2. Epic 29: E2E Test Suite (20-30h)
3. Epic 30: Security Audit Prep (15-20h) + External Audit
4. Epic 31: Legal & Compliance (5-10h)

**Total**: ~50-70 hours + external audit

---

### Phase 2: Core Features (P1)
5. Epic 34: Social Features Core (30-40h)
6. Epic 32: Documents Module (20-30h)
7. Epic 33: Files Module (25-35h)
8. Epic 35: Performance Optimization (10-15h)

**Total**: ~85-120 hours

---

### Phase 3: Enhanced Features (P2)
9. Epic 36: Additional Translations (10-20h)
10. Epic 37: Forms & Fundraising (30-40h)
11. Epic 38: Advanced Social Features (10-20h)
12. Epic 39: Tor Integration (20-30h)

**Total**: ~70-110 hours

---

## 📊 Effort Summary

**Critical Path (P0)**: 50-70 hours + audit
**Core Features (P1)**: 85-120 hours
**Enhanced Features (P2)**: 70-110 hours
**Backlog Items**: 60-100+ hours

**Grand Total**: ~265-400+ hours (6-10 weeks full-time)

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

**Last Updated**: 2025-10-07
**Total Epics Pending**: 8 (Epic 31, 34-39)
**Total Backlog Items**: 10+

---

### Epic 34 Follow-up: UI/UX Fixes ✅ COMPLETED
**Status**: ✅ Complete
**Priority**: P1
**Effort**: 4-6 hours (Actual: 2 hours)
**Dependencies**: Epic 34

**Completed**:
- [x] ✅ Add markdown rendering to PostCard (react-markdown + remark-gfm + rehype-sanitize)
- [x] ✅ Fix emoji picker positioning and styling
- [x] ✅ Comment out non-functional toolbar buttons with TODOs

**Git Commit**: `fix: add markdown rendering and fix post composer UI (Epic 34 follow-up)`

---

### Epic 41: Friend System & Contacts Management 🤝
**Status**: Not Started
**Priority**: P1
**Effort**: 10-15 hours
**Dependencies**: Epic 40 (Username System)
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Explicit friend/contact relationships beyond group membership. Enables private messaging, verified networks, buddylist organization.

**Key Features**:
- Friend requests (send/accept/decline)
- QR code friend add (in-person verification)
- Email/username/link invites
- Contacts management (tags, notes, favorites)
- Trust tiers (stranger → contact → friend → verified → trusted)
- Privacy settings per friend
- In-person key verification (green badge)

**Reference**: [EPIC_41_42_43_MESSAGING_OVERHAUL.md](./docs/EPIC_41_42_43_MESSAGING_OVERHAUL.md#epic-41)

**Git Tag**: `v0.41.0-friends`

---

### Epic 42: Messaging UX Overhaul 💬
**Status**: Not Started
**Priority**: P1 (Major UX improvement)
**Effort**: 25-35 hours
**Dependencies**: Epic 40 (Usernames), Epic 41 (Friends)
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Complete messaging redesign inspired by Discord, Signal, Facebook Messenger. Move from group-centric tabs to conversation-centric model.

**Key Features**:
- **Desktop**: Bottom-anchored chat windows + buddylist sidebar (Discord/Facebook style)
- **Mobile**: Full-screen chats with swipe gestures
- Conversation-centric model (remove group "Messages" tabs)
- Inline message composition (no modals)
- Flexible chat creation:
  - 1:1 DMs
  - Group chats (multi-user)
  - Coalition chats (multiple groups + users)
- Buddylist with online presence
- Multi-window chat support (3 windows side-by-side)
- Organized contacts (by group, favorites, online now)

**Reference**: [EPIC_41_42_43_MESSAGING_OVERHAUL.md](./docs/EPIC_41_42_43_MESSAGING_OVERHAUL.md#epic-42)

**Git Tag**: `v0.42.0-messaging-ux`

---

### Epic 43: Group Entity & Coalition Features 🎭
**Status**: Not Started
**Priority**: P2 (Advanced organizing)
**Effort**: 15-20 hours
**Dependencies**: Epic 42 (Messaging UX)
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Advanced organizing features enabling groups to message as collective identities and build cross-group coalitions.

**Key Features**:
- **Group as entity**: Groups can message as collective identity (not individual admins)
- **Use cases**:
  - Anonymous screening of new members
  - Official group announcements
  - Coalition building without revealing members
- **"Speak as group" toggle**: Admins switch between personal/group identity
- **Multi-group chats**: Coalition planning across multiple groups
- **Role-based messaging**: Admin-only, member-only, public channels
- **Group entity keypair**: Separate Nostr identity for groups

**Reference**: [EPIC_41_42_43_MESSAGING_OVERHAUL.md](./docs/EPIC_41_42_43_MESSAGING_OVERHAUL.md#epic-43)

**Git Tag**: `v0.43.0-group-entity`

---

## 📊 Updated Effort Summary

**Critical Path (P0)**: 50-70 hours + audit
**Core Features (P1)**: 85-120 hours + **50-70 hours (Epics 41-42)** = 135-190 hours
**Enhanced Features (P2)**: 70-110 hours + **15-20 hours (Epic 43)** = 85-130 hours
**Backlog Items**: 60-100+ hours

**New Grand Total**: ~330-490+ hours (8-12 weeks full-time)
**Completed**: Epic 40 (15-20 hours) ✅

---

## 🎯 Updated Recommended Execution Order

### Phase 1: Production Readiness (P0)
1. Epic 31: Legal & Compliance (5-10h)

### Phase 2: Core Features (P1)
2. **Epic 34 Follow-up: UI Fixes** (4-6h) ✅ COMPLETED
3. Epic 32: Documents Module (20-30h) ✅ COMPLETED
4. Epic 33: Files Module (25-35h) ✅ COMPLETED
5. **Epic 40: Username System** (15-20h) ✅ COMPLETED
6. **Epic 41: Friend System** (10-15h) ⬅ **NEXT**
7. **Epic 42: Messaging UX Overhaul** (25-35h)
8. Epic 35: Performance Optimization (10-15h)

### Phase 3: Enhanced Features (P2)
9. Epic 36: Additional Translations (10-20h)
10. Epic 37: Forms & Fundraising (30-40h)
11. Epic 38: Advanced Social Features (10-20h)
12. **Epic 43: Group Entity** (15-20h)
13. Epic 39: Tor Integration (20-30h)

---

**Last Updated**: 2025-10-08 (Epic 40 completed, moved to COMPLETED_ROADMAP)
**Pending Epics**: 11 (Epic 31, 35-39, 41-43)
