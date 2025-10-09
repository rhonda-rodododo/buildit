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

**Last Updated**: 2025-10-09 (Epic 43 complete - Group Entity & Coalition)
**Active Epic**: Epic 35 (Performance Optimization)
**Build Status**: ✅ Successful (233KB brotli initial load)
**Test Status**: 121/149 tests passing (integration test reliability improved)
**E2E Coverage**: 66% of epics (21/32) ✅ Epic 47 delivered 207 tests across 12 files
**Security Audit**: ✅ Complete (Epic 30) - Ready for external audit
**Completion**: 98% for organizing platform features
**New Priorities**: Advanced organizing features (Group Entity, Coalitions), Performance optimization

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

**Last Updated**: 2025-10-08 (Epic 47 complete - moved to COMPLETED_ROADMAP)
**Total Epics Pending**: 10 (Epic 31, 35-39, 43, 45)
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

### Epic 35: Performance Optimization 🚀
**Status**: Not Started
**Priority**: P2 (Performance)
**Effort**: 10-15 hours
**Dependencies**: Major features complete
**Assignable to subagent**: Yes (`performance-optimizer`)

**Context**: Optimize bundle size, load time, and runtime performance after implementing major features (Epics 32-44).

**Key Areas**:
1. **Bundle Size Reduction** - Target: <200KB initial load (currently 233KB brotli)
2. **Code Splitting** - Lazy load modules, routes, heavy components
3. **Tree Shaking** - Remove unused code
4. **Load Time Optimization** - Preload critical resources, defer non-critical
5. **Runtime Performance** - Profile and optimize hot paths

**Tasks**:
- [ ] Analyze bundle with `bun run build --analyze`
- [ ] Implement lazy loading for modules (Events, Mutual Aid, Governance, Wiki, Database, CRM, Documents, Files)
- [ ] Implement lazy loading for routes (use React.lazy + Suspense)
- [ ] Lazy load heavy dependencies (TipTap, Yjs, jsPDF, markdown renderers)
- [ ] Optimize image assets (compression, WebP, lazy loading)
- [ ] Remove unused dependencies
- [ ] Profile runtime performance with React DevTools Profiler
- [ ] Optimize hot paths (messaging, feed rendering)
- [ ] Add loading states for lazy-loaded components
- [ ] Measure Core Web Vitals (LCP, FID, CLS)

**Acceptance Criteria**:
- Bundle size <200KB brotli for initial load
- All modules lazy-loaded (only load when needed)
- Heavy dependencies lazy-loaded (TipTap, Yjs, jsPDF)
- Routes lazy-loaded with proper loading states
- Core Web Vitals meet "Good" thresholds
- Build size documented in ARCHITECTURE.md

**Testing Requirements**:
- Build passes (`bun run build`)
- Tests pass (`bun test && bun run typecheck`)
- Manual testing: Verify app still works after optimizations
- Lighthouse audit: Performance score >90

**Reference Docs**: [ARCHITECTURE.md](./ARCHITECTURE.md), [MISSING_FEATURES.md](./MISSING_FEATURES.md) (Performance section)

**Git Commit Format**: `perf: optimize bundle size and load time (Epic 35)`
**Git Tag**: `v0.35.0-performance`

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
- Epic 35: 10-15h (performance)
- Epic 36: 10-20h (translations)
- Epic 45: 10-15h (Pleasure Activism research) ⭐ NEW
- **P2 Total**: 95-143 hours (83h completed, 12-55h remaining)

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

12. **Epic 35: Performance Optimization** (10-15h) ⬅ **DO NEXT**
    - Bundle size reduction
    - After major features complete

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

**Last Updated**: 2025-10-09 (Epic 43 complete - Group Entity & Coalition)
**Pending Epics**: 4 total (Epic 31, 35, 36, 45)
**Next Epic**: Epic 35 (Performance Optimization)
**Strategic Shift**: Performance → UX Philosophy → Launch
**Module Refactoring**: ✅ Forms, Public, and Fundraising modules complete
**Recent Completion**: ✅ Epic 43 (Group Entity & Coalition) - Collective identities, encrypted keypairs, "speak as group" toggle, coalitions, channels
