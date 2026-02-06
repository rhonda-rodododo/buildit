# Epic 82: Comprehensive Test Coverage

**Status**: Not Started
**Priority**: P2 - Quality Assurance
**Effort**: 30-40 hours
**Platforms**: All
**Dependencies**: None (can run in parallel with feature work)

---

## Context

The web client has strong test coverage (1274 tests, 100% pass rate) but Android has extensive test TODOs documented in `MODULE_SYSTEM.md`, and cross-platform validation lacks depth. This epic fills test gaps across Android (repository, viewmodel, UI, integration, migration tests), adds visual regression testing, and expands accessibility testing to WCAG 2.1 AA compliance.

**Sources**:
- `clients/android/MODULE_SYSTEM.md` (lines 331-334, 472-476)
- `clients/web/NEXT_ROADMAP.md` - Backlog Items (visual regression, accessibility)
- `docs/ACCESSIBILITY_AUDIT_REPORT.md`

---

## Tasks

### Android Test Suite (16-20h)

#### Repository Layer Tests
- [ ] `EventsRepository` - Data access tests
- [ ] `MessagingRepository` - Message persistence tests
- [ ] `FormsRepository` - Form CRUD tests
- [ ] `WikiRepository` - Wiki page tests
- [ ] Mock Nostr relay responses for isolated testing
- **Source**: `clients/android/MODULE_SYSTEM.md:331`

#### ViewModel Tests
- [ ] `EventsViewModel` - UI state management tests
- [ ] `MessagingViewModel` - Conversation state tests
- [ ] `FormsViewModel` - Form interaction tests
- [ ] Test state transitions and error handling
- **Source**: `clients/android/MODULE_SYSTEM.md:332`

#### UI Tests (Compose Test)
- [ ] Event creation flow tests
- [ ] Message sending flow tests
- [ ] Form submission flow tests
- [ ] Navigation tests across modules
- [ ] Test accessibility (content descriptions, focus order)
- **Source**: `clients/android/MODULE_SYSTEM.md:474`

#### Integration Tests
- [ ] End-to-end event creation → RSVP flow
- [ ] End-to-end message send → receive flow
- [ ] BLE mesh sync integration tests
- [ ] Nostr relay integration tests (with mock relay)
- **Source**: `clients/android/MODULE_SYSTEM.md:334`

#### Database Migration Tests
- [ ] Test schema migrations between versions
- [ ] Test data preservation across migrations
- [ ] Test rollback scenarios
- **Source**: `clients/android/MODULE_SYSTEM.md:475`

### Visual Regression Testing (6-8h)

#### Screenshot Comparison Setup
- [ ] Set up Playwright screenshot comparison (or Percy/Chromatic)
- [ ] Capture baseline screenshots for all major pages
- [ ] Configure threshold for acceptable pixel diff
- [ ] Integrate with CI pipeline

#### Component Visual Tests
- [ ] Test all shadcn/ui component variants
- [ ] Test responsive breakpoints (mobile, tablet, desktop)
- [ ] Test dark mode / light mode variants
- [ ] Test RTL layout for Arabic locale

#### Theme Consistency
- [ ] Verify design token consistency across components
- [ ] Test color contrast ratios programmatically
- [ ] Verify typography scale

### Accessibility Testing (6-8h)

#### WCAG 2.1 AA Compliance
- [ ] Run axe/Pa11y automated audit on all pages
- [ ] Fix all Level A and AA violations
- [ ] Document any Level AAA improvements made
- **Reference**: `docs/ACCESSIBILITY_AUDIT_REPORT.md`

#### Screen Reader Testing
- [ ] Test with VoiceOver (macOS/iOS)
- [ ] Test with TalkBack (Android)
- [ ] Test with NVDA/JAWS (Windows via Tauri)
- [ ] Verify all interactive elements have accessible names

#### Keyboard Navigation
- [ ] Test full keyboard navigation through all workflows
- [ ] Verify focus management in dialogs and modals
- [ ] Test skip links and landmark navigation
- [ ] Verify focus trap in modals

#### ARIA & Semantics
- [ ] Audit and fix ARIA labels across all components
- [ ] Verify semantic HTML usage (headings, lists, tables)
- [ ] Test live regions for dynamic content updates

### Cross-Platform Protocol Tests (4-6h)

#### Expand Test Vectors
- [ ] Add test vectors for new protocol features (ephemeral messages, multi-sig)
- [ ] Add negative test vectors (malformed data, version mismatches)
- [ ] Verify all clients pass all test vectors
- [ ] Automate test vector validation in CI

---

## Acceptance Criteria

- [ ] Android has repository, viewmodel, UI, integration, and migration tests
- [ ] Visual regression catches unintended UI changes
- [ ] WCAG 2.1 AA compliance verified (zero Level A/AA violations)
- [ ] Screen reader navigation works for core workflows
- [ ] Keyboard-only navigation works for all interactive elements
- [ ] All test vectors pass on all platforms
- [ ] Tests integrated into CI pipeline

---

## Tools & Infrastructure

- **Android**: JUnit 5, Compose Test, MockK, Turbine (Flow testing)
- **Visual Regression**: Playwright screenshots or Percy
- **Accessibility**: axe-core, Pa11y, Lighthouse
- **Cross-platform**: Protocol test vectors in `protocol/test-vectors/`

---

**Git Commit Format**: `test: comprehensive test coverage (Epic 82)`
**Git Tag**: `v0.82.0-test-coverage`
