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

**Last Updated**: 2025-10-08 (Epic 47 E2E Test Coverage added)
**Active Epic**: Epic 47 (E2E Test Coverage) Phase 1 - Starting immediately
**Build Status**: ✅ Successful (233KB brotli initial load)
**Test Status**: 121/149 tests passing (integration test reliability improved)
**E2E Coverage**: 31% of epics (10/32) - Target: 95% (30/32) with Epic 47
**Security Audit**: ✅ Complete (Epic 30) - Ready for external audit
**Completion**: 97% for organizing platform features (+1% with advanced social features)
**New Priorities**: E2E test coverage for production readiness, UX-first approach, offline resilience

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

### Epic 47: E2E Test Coverage Completion 🧪
**Status**: Not Started
**Priority**: P1 - Critical for production readiness
**Effort**: 60-80 hours (phased implementation)
**Dependencies**: None (can run in parallel with other epics)
**Assignable to subagent**: Yes (`test-writer`)

**Context**: Comprehensive E2E test gap analysis (see [E2E_TEST_COVERAGE_ANALYSIS.md](./E2E_TEST_COVERAGE_ANALYSIS.md)) revealed 69% of completed epics have no E2E test coverage. This epic systematically fills those gaps to prevent regressions as we move toward production.

**Current Coverage**: ~80 E2E tests across 10 epics
**Target Coverage**: ~310 E2E tests across 30+ epics (95% coverage)

**Phase 1: Critical Gaps (Priority 1) - 20-25 hours**
- [ ] **Epic 42 - Conversations/Messaging UX** (15-20 tests)
  - Desktop chat windows (open, minimize, restore, taskbar)
  - Buddylist sidebar (organization, presence indicators)
  - Online presence system (green/yellow/gray, last seen)
  - Conversation management (pin/mute/archive, unread tracking)
  - File: `tests/e2e/conversations.spec.ts`

- [ ] **Epic 34/38 - Social Features/Microblogging** (20-25 tests)
  - Posts CRUD with privacy levels
  - Reactions (6 emoji types) and "who reacted" popover
  - Comments and nested threading (max depth 5)
  - Bookmarks and collections/folders
  - Hashtags and @mentions
  - File: `tests/e2e/microblogging.spec.ts`, `tests/e2e/activity-feed.spec.ts`

- [ ] **Epic 41 - Friend System** (12-15 tests)
  - Friend requests (username, QR code, email, links)
  - QR code verification flow
  - Trust tiers (Stranger → Trusted)
  - Privacy settings per friend
  - Contact organization (tags, favorites, notes)
  - File: `tests/e2e/friends.spec.ts`

- [ ] **Epic 40 - Username System** (10-12 tests)
  - Username registration and validation
  - NIP-05 verification flow
  - User directory browsing
  - Privacy controls (search visibility, directory inclusion)
  - Verified badge display
  - File: `tests/e2e/usernames.spec.ts`

- [ ] **Epic 7 - Wiki Module** (8-10 tests)
  - Page CRUD operations
  - Version control and history
  - Diff viewing between versions
  - Category and tag organization
  - Search functionality
  - File: `tests/e2e/wiki.spec.ts`

- [ ] **Epic 33 - Files Module** (10-12 tests)
  - File upload (drag & drop)
  - Folder management (create, navigate, delete)
  - Encryption verification
  - Storage quota tracking
  - Breadcrumb navigation
  - Grid/list view switching
  - File: `tests/e2e/files.spec.ts`

**Phase 2: Security & Analytics (Priority 2) - 15-20 hours**
- [ ] **Epic 18/26/27 - Security Features** (15-20 tests)
  - WebAuthn/Passkey registration
  - Device management and revocation
  - Anonymous voting (cryptographic privacy)
  - Member verification UI
  - Trust score system (0-100)
  - Audit logs (search, filter, export)
  - File: `tests/e2e/security.spec.ts`

- [ ] **Epic 22 - Analytics** (8-10 tests)
  - CRM analytics dashboard
  - Campaign metrics (membership, events, voting)
  - Support level distribution charts
  - Engagement trends over time
  - File: `tests/e2e/analytics.spec.ts`

**Phase 3: Remaining Modules (Priority 2) - 15-20 hours**
- [ ] **Epic 23 - Bulk Operations** (8-10 tests)
  - Multi-select checkboxes
  - Bulk send message/add tag/update field
  - Export to CSV
  - Task manager with filtering
  - File: `tests/e2e/bulk-operations.spec.ts`

- [ ] **Epic 24 - Activity Logs** (5-7 tests)
  - ContactActivityLog timeline view
  - ConversationHistory with chat bubbles
  - Activity summary stats
  - Search and filter by activity type
  - File: `tests/e2e/activity-logs.spec.ts`

- [ ] **Epic 25 - Engagement Ladder** (6-8 tests)
  - Engagement level detection (Neutral → Core Organizer)
  - OnboardingFlow (5 entry-point flows)
  - SmartNotifications by engagement level
  - Milestone tracking
  - File: `tests/e2e/engagement-ladder.spec.ts`

- [ ] **Improve Partial Coverage** (10-15 tests)
  - Custom Fields: Add 10+ field type tests
  - Database: Relationship fields, complex queries
  - CRM: Support level tracking, analytics integration
  - Messaging: Update existing tests for Epic 42 features

**Phase 4: Low Priority (Backlog) - 10-15 hours**
- [ ] **Theme System** (3-5 tests)
  - Switch between 7 color themes
  - Dark mode toggle
  - Theme persistence
  - File: `tests/e2e/themes.spec.ts`

- [ ] **i18n** (3-5 tests)
  - Language switcher
  - RTL support
  - Translation key loading
  - File: `tests/e2e/i18n.spec.ts`

- [ ] **Routing & Module System** (4-5 tests)
  - Group-based routing
  - Module route registration
  - Breadcrumb navigation
  - File: `tests/e2e/routing.spec.ts`

**Deferred**:
- **Epic 44 - BLE Mesh** - Manual testing only (Web Bluetooth E2E limitations)

**Acceptance Criteria**:
- Phase 1 complete: 75-94 new tests, 60% epic coverage
- Phase 2 complete: 23-30 new tests, 70% epic coverage
- Phase 3 complete: 29-40 new tests, 85% epic coverage
- Phase 4 complete: 10-15 new tests, 95% epic coverage
- All new tests follow best practices (see E2E_TEST_COVERAGE_ANALYSIS.md)
- Tests use data-testid for critical selectors
- Multi-user tests use multiple browser contexts
- Real end-to-end workflows tested (not just isolated features)

**Testing Requirements**:
- `bun test` passes for all new E2E tests
- No flaky tests (deterministic, proper waits)
- CI/CD integration working
- All tests documented with clear descriptions

**Reference Docs**: [E2E_TEST_COVERAGE_ANALYSIS.md](./E2E_TEST_COVERAGE_ANALYSIS.md), [COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md), `/tests/e2e/`

**Git Commit Format** (per phase):
- Phase 1: `test: add E2E tests for 6 critical epics (Epic 47 Phase 1)`
- Phase 2: `test: add security and analytics E2E tests (Epic 47 Phase 2)`
- Phase 3: `test: add E2E tests for remaining modules (Epic 47 Phase 3)`
- Phase 4: `test: add E2E tests for themes, i18n, routing (Epic 47 Phase 4)`

**Git Tags** (per phase):
- `v0.47.1-phase1-tests`
- `v0.47.2-phase2-tests`
- `v0.47.3-phase3-tests`
- `v0.47.4-complete`

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

**Last Updated**: 2025-10-08 (Epic 47 added for E2E test coverage)
**Total Epics Pending**: 11 (Epic 31, 35-37, 39, 43, 45, 47)
**Total Backlog Items**: 11+ (includes Epic 46+ content/marketplace, Epic 44 Phase 2)

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
- ✅ Epic 38: 10-20h (social features) - COMPLETED
- ✅ Epic 41: 10-15h (friends) - COMPLETED
- ✅ Epic 42: 25-35h (messaging UX) - COMPLETED
- ✅ Epic 44: 12h (BLE mesh Phase 1) - COMPLETED
- Epic 37: 30-40h (forms/fundraising)
- **P1 Total**: 87-122 hours (57-82h completed, 30-40h remaining)

**Enhanced Features (P2)**:
- Epic 39: 20-30h (Tor)
- Epic 43: 15-20h (group entity)
- Epic 35: 10-15h (performance)
- Epic 36: 10-20h (translations)
- Epic 45: 10-15h (Pleasure Activism research) ⭐ NEW
- **P2 Total**: 65-100 hours

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

### **Phase 1: Test Coverage & Public Engagement (P1)** - 4-6 weeks
6. **Epic 47: E2E Test Coverage** (60-80h) ⬅ **DO NEXT (Phase 1: 20-25h)**
   - Fill critical test gaps (Epic 42, 34/38, 41, 40, 7, 33)
   - Prevent regressions before production
   - Can run in parallel with Epic 37
   - **Phase 1 Priority**: 75-94 new tests for 6 critical epics

7. **Epic 37: Forms & Fundraising** (30-40h) ⬅ **Parallel with Epic 47**
   - Public-facing forms (volunteer signup, event registration)
   - Fundraising campaigns (bail funds, strike funds)
   - Entry point for overwhelmed participants
   - Replaces donation/volunteer apps

### **Phase 2: Security & Advanced Features (P2)** - 6-8 weeks
8. **Epic 39: Tor Integration** (20-30h)
   - Metadata protection
   - .onion relay support
   - Pairs with BLE mesh for defense-in-depth

9. **Epic 43: Group Entity & Coalition** (15-20h)
   - Groups as collective identities
   - Multi-group coalition chats
   - Anonymous screening

10. **Epic 35: Performance Optimization** (10-15h)
    - Bundle size reduction
    - After major features complete

### **Phase 3: Localization & UX Philosophy (P2)** - 3-4 weeks
11. **Epic 36: Additional Translations** (10-20h)
    - German, Portuguese, Mandarin
    - Requires native speakers (can parallelize)

12. **Epic 45: Pleasure Activism UX Spike** (10-15h) ⭐ **NEW**
    - Research adrienne maree brown's principles
    - Design joyful organizing UX
    - Informs Epic 46 (Joyful UX Patterns)

### **Pre-Launch (P0)** - 1 week
13. **Epic 31: Legal & Compliance** (5-10h)
    - Terms of Service, Privacy Policy
    - Before public launch

---

**Last Updated**: 2025-10-08 (Epic 44 Phase 1 completed and moved to COMPLETED_ROADMAP)
**Pending Epics**: 10 total (Epic 31, 35-37, 39, 43, 45)
**Next Epic**: Epic 37 (Forms & Fundraising)
**Strategic Shift**: UX-first (Complete) → Public Engagement → Security → Philosophy → Launch
