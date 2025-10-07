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

**Last Updated**: 2025-10-06
**Active Epic**: Epic 28.5 (Routing Refactor)
**Build Status**: ✅ Successful (1.44MB, 476KB gzipped)
**Test Status**: 122/149 tests passing (27 integration test failures to address)
**Completion**: 85% for organizing platform features

---

## 🔴 Critical Path: Production Readiness

### Epic 28: Critical Bug Fixes 🔴
**Status**: Not Started
**Priority**: P0 - Blocking
**Effort**: 5-10 hours
**Dependencies**: None
**Assignable to subagent**: Yes (`bug-fixer`)

**Context**: Three critical bugs prevent production deployment and break key features.

**Tasks**:
- [ ] **BUG-001**: Fix Governance CreateProposalDialog not connected to backend
  - File: `/src/modules/governance/components/CreateProposalDialog.tsx` (lines 31-56)
  - Issue: Only logs to console, doesn't call `proposalManager.createProposal()`
  - Impact: Users cannot create proposals - entire Governance voting system non-functional from UI
  - Fix: Replace console.log with actual proposalManager integration
  - Estimated: 30 minutes

- [ ] **BUG-002**: Fix all Integration Tests (IndexedDB/Nostr)
  - Files: `/src/tests/integration/*.test.ts`
  - Issue 1: IndexedDB API missing (`fake-indexeddb` not configured in Vitest)
  - Issue 2: NostrClient missing `disconnect()` method
  - Impact: 0/19 integration tests passing - cannot verify Nostr↔Storage sync
  - Fix: Configure IndexedDB polyfill, add disconnect() to NostrClient
  - Estimated: 2-3 hours

- [ ] **BUG-003**: Fix Device Trust/Revocation Functions
  - File: `/src/lib/notifications/DeviceLoginNotifications.ts` (lines 99, 124)
  - Issue: `db.table('devices').update()` fails with "undefined"
  - Impact: Device trust/revoke features broken in security system
  - Fix: Verify 'devices' table exists in schema and is initialized
  - Estimated: 1 hour

- [ ] **BUG-006**: Add error display to LoginForm
  - File: `/src/components/auth/LoginForm.tsx`
  - Issue: Login errors only logged to console, no user feedback
  - Fix: Add error state and Alert component for user-facing messages
  - Estimated: 30 minutes

- [ ] **BUG-007**: Remove @ts-ignore/@ts-expect-error suppressions
  - Files: DeviceLoginNotifications.ts (5), eventManager.ts (1)
  - Fix: Properly type interfaces or use type assertions with guards
  - Estimated: 1-2 hours

**Acceptance Criteria**:
- All 5 bugs fixed and verified
- Integration tests passing (19/19)
- Governance proposal creation working from UI
- Device trust/revoke working
- Login form shows errors
- Zero @ts-ignore in modified files

**Testing Requirements**:
- `bun test` - all tests passing
- Manual test: Create proposal in Governance module
- Manual test: Trust/revoke device in Security page
- Manual test: Trigger login error and verify UI message

**Reference Docs**: [BUGS.md](./BUGS.md)

**Git Commit Format**: `fix: resolve critical bugs (Epic 28 - BUG-001 through BUG-007)`

---

### Epic 28.5: Routing Refactor - Group-Based Paths 🛣️
**Status**: Not Started
**Priority**: P0 - Foundation for Social Features
**Effort**: 10-12 hours
**Dependencies**: None
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Current routing uses `/app/groups/:groupId` but modules are accessed via tabs. Need proper group-based routing where each group has distinct URL paths and modules load dynamically based on group configuration.

**Tasks**:
- [ ] **Task 1**: Update Module Route Registration (2h)
  - Ensure all modules register routes with correct paths
  - Add route registration to documents and files modules
  - Verify routes respect group module enable/disable config
  - Update module plugin type to support `requiresEnabled` flag

- [ ] **Task 2**: Create GroupContext Provider (1h)
  - Create `src/contexts/GroupContext.tsx` with `useGroupContext()` hook
  - Provide current groupId, group data, and enabled modules
  - Wrap GroupLayout with context provider
  - Handle groupId changes and navigation

- [ ] **Task 3**: Refactor Navigation Components (3h)
  - Update `GroupSidebar` to show only enabled module routes
  - Filter navigation items based on group's enabled modules
  - Update `Breadcrumbs` for group-aware paths
  - Ensure `MobileNav` works with new structure
  - Add active route highlighting

- [ ] **Task 4**: Update Module Components (2h)
  - Refactor module views to use `useGroupContext()`
  - Update data fetching to filter by current groupId
  - Remove groupId props in favor of context
  - Ensure all module views work within group context

- [ ] **Task 5**: Create Group-Level Pages (2h)
  - Create `GroupFeedPage` (group-specific activity feed)
  - Create `GroupMembersPage` (member management UI)
  - Create `GroupSettingsPage` (group configuration)
  - Create `GroupMessagesPage` (group chat view)
  - Register these routes in router

- [ ] **Task 6**: Update Route Configuration (1h)
  - Update `src/routes/index.tsx` with new group routes
  - Add group-level routes: feed, messages, members, settings
  - Ensure module routes are properly nested
  - Add route guards for module access

- [ ] **Task 7**: Testing & Verification (1h)
  - Test navigation between groups
  - Verify module enable/disable works
  - Test deep linking to module pages
  - Verify breadcrumbs and back navigation
  - Test mobile navigation

**Target Route Structure**:
```
/app/groups                          # Group list
/app/groups/:groupId                 # Group dashboard
/app/groups/:groupId/feed            # Group-specific feed
/app/groups/:groupId/messages        # Group chat
/app/groups/:groupId/members         # Member management
/app/groups/:groupId/settings        # Group settings
/app/groups/:groupId/events          # Events module (if enabled)
/app/groups/:groupId/mutual-aid      # Mutual aid module (if enabled)
/app/groups/:groupId/governance      # Governance module (if enabled)
/app/groups/:groupId/wiki            # Wiki module (if enabled)
/app/groups/:groupId/database        # Database module (if enabled)
/app/groups/:groupId/crm             # CRM module (if enabled)
/app/groups/:groupId/documents       # Documents module (if enabled)
/app/groups/:groupId/files           # File manager module (if enabled)
/app/groups/:groupId/microblogging   # Microblogging module (if enabled)
```

**Acceptance Criteria**:
- Each group has its own distinct route path
- Module routes are dynamically registered based on module configuration
- Navigation sidebar shows only enabled modules for current group
- GroupContext provides groupId to all nested components
- All module views work within group context
- Deep linking works for all group and module routes
- Breadcrumbs show correct path hierarchy
- Mobile navigation works with new structure

**Testing Requirements**:
- Navigate to different groups and verify URL changes
- Enable/disable module and verify route appears/disappears
- Test deep linking: `/app/groups/abc123/events`
- Verify breadcrumbs show correct path
- Test back/forward browser navigation

**Reference Docs**: [ARCHITECTURE.md](./ARCHITECTURE.md), `/src/routes/index.tsx`, `/src/modules/*/index.ts`

**Git Commit Format**: `feat: implement group-based routing with dynamic module paths (Epic 28.5)`

**Git Tag**: `v0.28.5-routing-refactor`

---

### Epic 29: E2E Test Suite with Playwright 🧪
**Status**: Not Started
**Priority**: P0 - Blocking production
**Effort**: 20-30 hours
**Dependencies**: Epic 28 complete
**Assignable to subagent**: Yes (`test-writer`)

**Context**: End-to-end testing is completely missing. Playwright is installed but no tests written. Critical for production confidence.

**Tasks**:
- [ ] Configure Playwright properly (`playwright.config.ts`)
- [ ] Write authentication flow tests (4 scenarios):
  - User registration/identity creation
  - nsec import
  - Key export/backup
  - Identity switching
- [ ] Write group management tests (6 scenarios):
  - Group creation
  - Group settings modification
  - Module enable/disable per group
  - Member invitation
  - Permission changes
  - Group deletion
- [ ] Write messaging tests (3 scenarios):
  - Send/receive DM
  - Group message threads
  - Notification delivery
- [ ] Write events tests (5 scenarios):
  - Event creation with custom fields
  - RSVP flow
  - Calendar view
  - iCal export
  - Event privacy levels
- [ ] Write governance tests (3 scenarios):
  - Proposal creation (all voting methods)
  - Voting flow
  - Results display
- [ ] Write mutual aid tests (3 scenarios):
  - Request creation
  - Offer matching
  - Fulfillment flow
- [ ] Set up CI integration for E2E tests
- [ ] Add visual regression testing (screenshots)

**Acceptance Criteria**:
- 18+ E2E test scenarios passing
- Tests run in CI/CD pipeline
- Visual regression baseline established
- Cross-browser testing (Chrome, Firefox)
- Documentation for running E2E tests

**Testing Requirements**:
- `bun run test:e2e` passes all scenarios
- Tests run in headless and headed modes
- Screenshots captured for visual regression

**Reference Docs**: `/tests/e2e/` directory, [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Testing section)

**Git Commit Format**: `test: implement comprehensive E2E test suite with Playwright (Epic 29)`

---

### Epic 30: Security Audit Preparation 🔐
**Status**: Not Started
**Priority**: P0 - Required before production
**Effort**: 15-20 hours (internal prep) + External audit
**Dependencies**: Epic 28, 29 complete
**Assignable to subagent**: Partial (`auditor` for internal prep)

**Context**: Security audit is critical before deploying to production, especially for activist/high-risk use cases. Need internal preparation before external audit.

**Tasks**:
- [ ] Document all encryption implementations (NIP-17, NIP-44, NIP-59)
- [ ] Create threat model documentation (expand PRIVACY.md)
- [ ] Document key management and storage strategies
- [ ] Run automated security scanning (npm audit equivalent: `bun audit`)
- [ ] Implement Content Security Policy (CSP) headers
- [ ] Add security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- [ ] Implement rate limiting for sensitive operations
- [ ] Add session timeout and auto-lock functionality
- [ ] Create security.txt file (responsible disclosure)
- [ ] Document all third-party dependencies and their security posture
- [ ] Prepare penetration testing scope document
- [ ] Create vulnerability disclosure program documentation
- [ ] Engage external security auditor (Trail of Bits, Cure53, NCC Group)

**Acceptance Criteria**:
- All security documentation complete and reviewed
- CSP and security headers implemented
- Rate limiting active on auth/sensitive endpoints
- `bun audit` shows no critical vulnerabilities
- External audit scheduled with reputable firm
- Vulnerability disclosure process published

**Testing Requirements**:
- Security header verification (securityheaders.com)
- CSP testing (no violations in console)
- Rate limiting tested with automated requests
- Session timeout verified

**Reference Docs**: [ENCRYPTION_STRATEGY.md](./ENCRYPTION_STRATEGY.md), [PRIVACY.md](./PRIVACY.md), [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Security section)

**Git Commit Format**: `security: prepare for external security audit (Epic 30)`

---

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
**Status**: Placeholder Only
**Priority**: P1
**Effort**: 20-30 hours
**Dependencies**: Epic 28 complete
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Documents module is currently a placeholder. Need full WYSIWYG editor with real-time collaboration.

**Tasks**:
- [ ] Install TipTap editor and dependencies (use Context7 for latest docs)
- [ ] Create Document schema and types
- [ ] Implement DocumentsStore (Zustand)
- [ ] Build WYSIWYG editor component with TipTap
  - Rich formatting (bold, italic, headings, lists)
  - Tables, images, code blocks
  - Markdown shortcuts
  - Toolbar and keyboard shortcuts
- [ ] Implement document CRUD operations
- [ ] Add document templates (meeting notes, proposals, manifestos, press releases)
- [ ] Implement version control:
  - Auto-save every 30 seconds
  - Version history view
  - Diff viewer
  - Rollback functionality
- [ ] Add real-time collaboration (optional for MVP+):
  - Cursor position indicators
  - User presence
  - Operational Transform or CRDT
- [ ] Implement export features:
  - PDF export
  - Markdown export
  - HTML export
  - Plain text export
- [ ] Add document encryption for private/sensitive docs
- [ ] Create comprehensive seed data
- [ ] Write unit tests for document operations

**Acceptance Criteria**:
- Documents module functional (not placeholder)
- Can create, edit, delete documents
- Version history working
- Export to PDF/MD/HTML functional
- Auto-save working with 30s interval
- At least 3 document templates available
- Tests passing for document operations

**Testing Requirements**:
- `bun test src/modules/documents/` passing
- Manual test: Create document with rich formatting
- Manual test: View version history and rollback
- Manual test: Export document to PDF

**Reference Docs**: [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Documents Module section), `/src/modules/documents/`

**Git Commit Format**: `feat: implement Documents module with TipTap WYSIWYG editor (Epic 32)`

---

### Epic 33: Files Module Implementation 📁
**Status**: Placeholder Only
**Priority**: P1
**Effort**: 25-35 hours
**Dependencies**: Epic 28 complete
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Files module is currently a placeholder. Need file upload, storage, and management system.

**Tasks**:
- [ ] Research and choose file storage backend:
  - NIP-94 (File Metadata)
  - NIP-96 (HTTP File Storage)
  - Blossom protocol
  - IPFS (optional)
  - Local IndexedDB for small files
- [ ] Create File schema and types
- [ ] Implement FilesStore (Zustand)
- [ ] Build file upload component:
  - Drag & drop interface
  - Browse file picker
  - Multiple file selection
  - Upload progress indicators
  - Chunked upload for large files
  - File type and size validation
- [ ] Implement folder management:
  - Create/rename/delete folders
  - Nested folder structure
  - Drag & drop files between folders
  - Breadcrumb navigation
- [ ] Add file preview:
  - Image viewer (JPEG, PNG, GIF, WebP)
  - PDF viewer
  - Video/audio player
  - Text file viewer
  - Code syntax highlighting
- [ ] Implement client-side file encryption (AES-GCM)
- [ ] Create file sharing system:
  - Share with group members
  - Generate shareable links
  - Set permissions (view/download/edit)
  - Expiring links
  - Password-protected links
- [ ] Add file operations:
  - Rename, move, copy, delete
  - Bulk operations (multi-select)
  - File metadata (size, type, date, owner)
  - File versioning
- [ ] Implement storage quota management:
  - Track storage usage per group
  - Storage visualization
  - Low storage warnings
  - Cleanup tools
- [ ] Create comprehensive seed data
- [ ] Write unit tests for file operations

**Acceptance Criteria**:
- Files module functional (not placeholder)
- Can upload, organize, preview, and share files
- Folder hierarchy working
- File encryption/decryption working
- Storage quota tracking functional
- File sharing with expiring links working
- Tests passing for file operations

**Testing Requirements**:
- `bun test src/modules/files/` passing
- Manual test: Upload file with drag & drop
- Manual test: Create folders and organize files
- Manual test: Generate shareable link with expiration
- Manual test: Preview different file types

**Reference Docs**: [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Files Module section), `/src/modules/files/`, Epic 12.3 (media encryption reference)

**Git Commit Format**: `feat: implement Files module with encrypted storage (Epic 33)`

---

### Epic 34: Social Features - Core (Microblogging & Activity Feed) 📱
**Status**: Not Started
**Priority**: P1
**Effort**: 30-40 hours
**Dependencies**: Epic 28 complete
**Assignable to subagent**: Yes (`feature-implementer`)

**Context**: Core social media features are completely missing. Platform needs posts, activity feed, and comments to be a true "social action network."

**Tasks**:
- [ ] **Epic 34.1: Microblogging Module (10-15h)**
  - [ ] Create Post schema and types (NIP-01 kind:1 notes)
  - [ ] Implement PostsStore (Zustand)
  - [ ] Build PostComposer component:
    - Rich text input
    - Media attachments (images, videos)
    - Link previews
    - Hashtag support (#tag)
    - @mentions support
    - Privacy levels (public/group/followers/private)
    - Character limit (optional)
  - [ ] Create PostCard component:
    - Author info and avatar
    - Post content rendering
    - Timestamp (relative time)
    - Media display
    - Edit/delete actions (author only)
  - [ ] Implement post CRUD operations
  - [ ] Add hashtag indexing and search
  - [ ] Publish posts to Nostr relays

- [ ] **Epic 34.2: Activity Feed (8-12h)**
  - [ ] Create ActivityFeed component:
    - Chronological timeline
    - Infinite scroll/pagination
    - Filter by content type (posts/events/proposals)
    - Filter by group
    - Mark all as read
    - Pull-to-refresh
  - [ ] Implement feed aggregation:
    - Posts from followed users
    - Group posts
    - Events
    - Proposals
    - Mutual aid requests/offers
  - [ ] Add feed subscription system (real-time updates)
  - [ ] Implement feed caching for offline

- [ ] **Epic 34.3: Comments System (8-10h)**
  - [ ] Create Comment schema and types
  - [ ] Build CommentInput component
  - [ ] Create CommentThread component:
    - Nested replies/threading
    - Depth limit (e.g., 5 levels)
    - Collapse/expand threads
  - [ ] Integrate comments on:
    - Posts (microblog)
    - Events
    - Proposals
    - Wiki pages
  - [ ] Add @mentions in comments
  - [ ] Implement comment notifications

- [ ] **Epic 34.4: Nostr Integration (4-6h)**
  - [ ] Implement NIP-01 for posts (kind:1)
  - [ ] Publish posts to relays
  - [ ] Subscribe to post feeds
  - [ ] Handle post deletions (kind:5 events)
  - [ ] Sync comments via Nostr

- [ ] Write comprehensive tests for social features
- [ ] Create seed data for demo posts and comments

**Acceptance Criteria**:
- Can create and publish posts
- Activity feed displays posts, events, proposals
- Comments working on posts with threading
- Real-time feed updates via Nostr
- Posts sync across devices
- Hashtag and @mention parsing working
- Feed pagination and infinite scroll functional
- Tests passing for social features

**Testing Requirements**:
- `bun test src/modules/microblogging/` passing
- Manual test: Create post → See in feed → Add comment
- Manual test: @mention user in comment
- Manual test: Filter feed by content type
- Manual test: Verify real-time updates

**Reference Docs**:
- **[docs/SOCIAL_FEATURES_IMPLEMENTATION_GUIDE.md](./docs/SOCIAL_FEATURES_IMPLEMENTATION_GUIDE.md)** - Detailed checklist with exact schemas, components, and tests (Epic 21-25)
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Module system and data flow

**Git Commit Format**: `feat: implement social features - microblogging, feed, and comments (Epic 34)`

---

### Epic 35: Performance Optimization & Bundle Size Reduction ⚡
**Status**: Needs Improvement
**Priority**: P1
**Effort**: 10-15 hours
**Dependencies**: None
**Assignable to subagent**: Yes (`performance-optimizer`)

**Context**: Bundle size is 1.44MB (476KB gzipped), triggering Vite warning. Need more aggressive code splitting and optimization.

**Tasks**:
- [ ] Analyze bundle composition with `vite-plugin-visualizer`
- [ ] Implement lazy loading for modules:
  - Load module code on first access (not all at initialization)
  - Dynamic imports for module components
  - Suspense boundaries for loading states
- [ ] Further split vendor chunks:
  - Separate Nostr libraries
  - Separate UI libraries (Radix, shadcn)
  - Separate data libraries (Dexie, Zustand)
- [ ] Optimize images and media:
  - Compress images
  - Use WebP format
  - Lazy load images below fold
- [ ] Optimize fonts:
  - Subset fonts to used characters
  - Use font-display: swap
  - Consider system fonts
- [ ] Tree-shaking verification:
  - Audit unused exports
  - Remove dead code
  - Verify tree-shaking in build
- [ ] Implement route-based code splitting:
  - Lazy load route components
  - Preload critical routes
- [ ] Add resource hints:
  - Preconnect to relays
  - Prefetch important routes
  - DNS prefetch for external resources
- [ ] Configure compression in deployment (Brotli, gzip)
- [ ] Run Lighthouse audit and address recommendations
- [ ] Set up bundle size monitoring in CI

**Acceptance Criteria**:
- Initial bundle <300KB gzipped (down from 476KB)
- Lighthouse performance score >90
- First Contentful Paint <1.5s
- Time to Interactive <3s
- No Vite bundle size warnings
- Bundle size tracked in CI/CD

**Testing Requirements**:
- `bun run build` succeeds with no warnings
- Lighthouse audit score >90
- Manual test: Measure load time on 3G connection
- Verify lazy loading with Network tab throttling

**Reference Docs**: [BUGS.md](./BUGS.md) (BUG-009), [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Performance section)

**Git Commit Format**: `perf: optimize bundle size and implement lazy loading (Epic 35)`

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

**Last Updated**: 2025-10-06
**Total Epics Pending**: 12 (Epic 28-39)
**Total Backlog Items**: 10+
**Next Git Tag**: `v0.28.0-bugfixes` (after Epic 28 complete)
