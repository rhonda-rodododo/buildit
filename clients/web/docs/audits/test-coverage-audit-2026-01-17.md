# Test Coverage Audit - 2026-01-17

## Executive Summary

The BuildIt Network codebase has **178 passing tests and 45 failing tests** (out of 223 total tests). TypeScript compilation passes without errors. The primary issues are:

1. **Database initialization failures** in integration tests (IndexedDB mocking issues)
2. **WebCrypto operation failures** in key rotation tests (environment compatibility)
3. **Playwright E2E test import errors** being incorrectly loaded by vitest

The core crypto module tests (NIP-17, NIP-44, keyManager) pass successfully, indicating strong coverage for security-critical code. However, several modules have no unit tests at all.

## Current Test Results

### Overall Status
- **Total Tests**: 223 tests across 50 files
- **Passing**: 178 tests (80%)
- **Failing**: 45 tests (20%)
- **Errors**: 32 test-level errors
- **TypeScript**: Clean compile (no errors)

### Test Breakdown by Category

| Category | Files | Tests | Status |
|----------|-------|-------|--------|
| Core Crypto (`src/core/crypto/__tests__/`) | 3 | ~20 | PASSING |
| Media Encryption (`src/lib/media/__tests__/`) | 1 | ~20 | PASSING |
| Fuzzy Search (`src/lib/autocomplete/__tests__/`) | 1 | ~5 | PASSING |
| Module Permissions (`src/lib/modules/__tests__/`) | 1 | ~10 | PASSING |
| Custom Fields (`src/modules/custom-fields/__tests__/`) | 2 | ~10 | PASSING |
| Module Store (`src/stores/__tests__/`) | 1 | ~10 | PASSING |
| Username Utils (`tests/unit/`) | 1 | ~10 | PASSING |
| Nostr Filter Merging (`tests/unit/`) | 1 | ~10 | PASSING |
| Device Notifications (`tests/unit/`) | 1 | ~10 | PASSING |
| Key Rotation (`tests/unit/`) | 1 | ~8 | FAILING |
| Microblogging PostsStore (`src/modules/microblogging/`) | 1 | ~30 | FAILING |
| Integration Tests (`src/tests/integration/`) | 3 | ~15 | FAILING |
| Forms Manager (`tests/forms/`) | 1 | ~10 | FAILING |
| E2E Tests (Playwright) | 36 | 0 | EXCLUDED (but incorrectly loading) |

---

## Critical Findings

### CRITICAL-001: E2E Tests Loading in Vitest

**Category**: Test Infrastructure
**Files Affected**: All `tests/e2e/*.spec.ts` files (36 files)
**Impact**: Tests fail immediately with Playwright import error
**Root Cause**: vitest config excludes `*.spec.ts` but some spec files are still being loaded

**Error**:
```
error: Playwright Test did not expect test.describe() to be called here.
```

**Recommendation**: Write test for vitest config to ensure proper exclusion patterns, or rename E2E tests to `*.e2e.ts` to avoid conflicts.

---

### CRITICAL-002: Key Rotation Tests Failing (WebCrypto)

**Category**: Security-Critical Code
**Files Affected**: `tests/unit/key-rotation.test.ts`
**Current Coverage**: 0% (all tests failing)
**Impact**: Key rotation functionality is untested

**Error**:
```
DOMException: OperationError - The operation failed for an operation-specific reason
```

**Root Cause**: WebCrypto SubtleCrypto operations (encrypt/decrypt) failing in the Node.js test environment. The ProtectedKeyStorageService uses AES-GCM encryption which requires specific crypto context setup.

**Recommendation**:
1. Add crypto polyfill or environment setup in test-utils.ts
2. Mock WebCrypto API for unit tests
3. Create integration tests that run in browser environment (Playwright)

---

### CRITICAL-003: Microblogging PostsStore Tests Failing (Database)

**Category**: Feature Module
**Files Affected**: `src/modules/microblogging/postsStore.test.ts`
**Current Coverage**: 0% (all tests failing)
**Impact**: New microblogging features are untested

**Error**:
```
TypeError: undefined is not an object (evaluating 'db.posts.add')
```

**Root Cause**: The postsStore tests try to use real database operations but the database is not properly initialized. The tests call `setupTestDatabase()` in beforeAll but `getDB()` returns undefined.

**Recommendation**:
1. Ensure database initialization completes before tests run
2. Add explicit waits or initialization checks
3. Consider mocking database for pure unit tests
4. Add integration tests that use real database

---

### HIGH-001: Integration Tests Failing (Database Initialization)

**Category**: Integration Tests
**Files Affected**:
- `src/tests/integration/encryptionStorage.test.ts`
- `src/tests/integration/moduleSystem.test.ts`
- `src/tests/integration/nostrStorage.test.ts`

**Current Coverage**: Partial (some tests pass, some fail)
**Impact**: Integration tests for encryption and storage are unreliable

**Error**:
```
DatabaseClosedError: MissingAPIError IndexedDB API missing
```

**Root Cause**: fake-indexeddb is being used but database initialization is timing-dependent.

**Recommendation**:
1. Ensure fake-indexeddb is imported before any Dexie code
2. Add explicit database ready checks
3. Consider using vitest's happy-dom environment for all integration tests

---

### HIGH-002: Forms Manager Tests Failing

**Category**: Feature Module
**Files Affected**: `tests/forms/formsManager.test.ts`
**Current Coverage**: 0% (tests failing)
**Impact**: Forms module business logic untested

**Root Cause**: Database tables (forms, campaigns, etc.) not properly initialized during test setup.

**Recommendation**:
1. Add proper test setup using test-utils.ts
2. Ensure module schemas are registered before tests run

---

## Modules with NO Unit Tests

The following source modules have no dedicated unit tests:

### Core Modules (HIGH Priority)
| Module | Files | Lines | Test Coverage |
|--------|-------|-------|---------------|
| `src/core/groups/` | N/A | N/A | NO TESTS |
| `src/core/messaging/` | Multiple | ~1000 | NO TESTS |
| `src/core/friends/` | Multiple | ~500 | NO TESTS |
| `src/core/groupEntity/` | Multiple | ~800 | NO TESTS |
| `src/core/username/` | 1 | ~100 | 1 test file |
| `src/core/storage/` | 6 | ~2000 | NO TESTS |
| `src/core/nostr/` | Multiple | ~1500 | NO TESTS |
| `src/core/tor/` | Multiple | ~300 | NO TESTS |

### Feature Modules (MEDIUM Priority)
| Module | Files | Lines | Test Coverage |
|--------|-------|-------|---------------|
| `src/modules/governance/` | 5+ | ~600 | NO TESTS |
| `src/modules/events/` | 5+ | ~700 | NO TESTS |
| `src/modules/mutual-aid/` | 5+ | ~600 | NO TESTS |
| `src/modules/wiki/` | 4 | ~400 | NO TESTS |
| `src/modules/documents/` | 5+ | ~600 | NO TESTS |
| `src/modules/files/` | 5+ | ~800 | NO TESTS |
| `src/modules/database/` | Multiple | ~1000 | NO TESTS |
| `src/modules/crm/` | Multiple | ~800 | NO TESTS |
| `src/modules/fundraising/` | Multiple | ~600 | NO TESTS |
| `src/modules/public/` | Multiple | ~500 | NO TESTS |

---

## Test Quality Assessment

### Well-Tested Modules (Good Quality)

#### 1. Core Crypto (`src/core/crypto/__tests__/`)
- **Quality**: EXCELLENT
- **Coverage**: High - covers key generation, NIP-44 encryption, NIP-17 gift wrapping
- **Test Style**: Good arrange/act/assert, meaningful assertions
- **Edge Cases**: Unicode handling, multiple recipients, error cases
- **Recommendations**: None - exemplary tests

#### 2. Media Encryption (`src/lib/media/__tests__/`)
- **Quality**: EXCELLENT
- **Coverage**: High - key management, file encryption/decryption
- **Test Style**: Comprehensive, tests both success and failure cases
- **Edge Cases**: Large files, binary data, wrong keys, special characters
- **Recommendations**: None - exemplary tests

#### 3. Custom Fields (`src/modules/custom-fields/__tests__/`)
- **Quality**: GOOD
- **Coverage**: Medium - covers schema generation
- **Test Style**: Uses proper mocking
- **Recommendations**: Add tests for CRUD operations, validation

#### 4. Module Store (`src/stores/__tests__/moduleStore.test.ts`)
- **Quality**: GOOD
- **Coverage**: High - registration, enable/disable, lifecycle hooks
- **Recommendations**: Add tests for error handling

### Problematic Tests (Need Fixes)

#### 1. Key Rotation Tests
- **Quality**: Good test design but environment issues
- **Issue**: WebCrypto not working in Node environment
- **Fix Required**: Add crypto setup or mock

#### 2. PostsStore Tests
- **Quality**: Good test design but database issues
- **Issue**: Database not initialized properly
- **Fix Required**: Fix test setup or add mocking

#### 3. Forms Manager Tests
- **Quality**: Good test design but database issues
- **Issue**: Module schemas not registered
- **Fix Required**: Use test-utils properly

---

## E2E Test Coverage

The project has 36 E2E test files covering major features:

| E2E Test File | Module/Feature |
|---------------|----------------|
| auth.spec.ts | Authentication |
| groups.spec.ts | Groups CRUD |
| messaging.spec.ts | Direct Messages |
| events.spec.ts | Events Module |
| governance.spec.ts | Governance/Voting |
| mutual-aid.spec.ts | Mutual Aid |
| microblogging.spec.ts | Posts/Social Feed |
| activity-feed.spec.ts | Activity Feed |
| files.spec.ts | File Manager |
| wiki.spec.ts | Wiki Module |
| crm.spec.ts | CRM Module |
| database.spec.ts | Database Module |
| forms.spec.ts | Forms Module |
| fundraising.spec.ts | Fundraising |
| conversations.spec.ts | Conversations |
| friends.spec.ts | Friends System |
| usernames.spec.ts | Username Claims |
| security.spec.ts | Security Features |
| collaborative-editing.spec.ts | CRDT Collaboration |
| custom-fields.spec.ts | Custom Fields |
| public-pages.spec.ts | Public Pages |
| analytics.spec.ts | Analytics |
| bulk-operations.spec.ts | Bulk Operations |
| engagement-ladder.spec.ts | Engagement Ladder |
| activity-logs.spec.ts | Activity Logs |
| forms-builder.spec.ts | Form Builder |
| forms-submission.spec.ts | Form Submission |
| forms-accessibility.spec.ts | Forms A11y |
| fundraising-campaigns.spec.ts | Campaigns |
| visual-regression.spec.ts | Visual Tests |
| tor-integration.spec.ts | Tor Support |
| groupEntity.spec.ts | Group Entity |

**Note**: E2E tests are designed for Playwright and should not run under vitest.

---

## Recent Microblogging Changes Analysis

The git status shows modified microblogging files:

| File | Status | Has Tests? |
|------|--------|------------|
| `ActivityFeed.tsx` | Modified | NO |
| `PostCard.tsx` | Modified | NO |
| `PostComposer.tsx` | Modified | NO |
| `postsStore.ts` | Modified | YES (failing) |
| `schema.ts` | Modified | NO |
| `types.ts` | Modified | NO |
| `ScheduledPostsView.tsx` | NEW | NO |

**Coverage Gap**: The new/modified microblogging code has no working tests.

**Recommendations**:
1. Fix the postsStore.test.ts database initialization
2. Add component tests for modified components
3. Add unit tests for new ScheduledPostsView component
4. Run E2E tests for microblogging module

---

## Recommended Testing Plan

### Phase 1: Fix Critical Test Infrastructure (Immediate)

1. **Fix E2E test exclusion** (1 hour)
   - Update vitest.config.ts to properly exclude Playwright tests
   - Verify exclusion patterns work

2. **Fix WebCrypto in test environment** (2-3 hours)
   - Add crypto polyfill to test setup
   - Or mock WebCrypto for unit tests
   - Files: `src/test/setup.ts`

3. **Fix database initialization** (2-3 hours)
   - Ensure fake-indexeddb loads first
   - Add database ready checks
   - Files: `src/test/test-utils.ts`, `src/test/setup.ts`

### Phase 2: Critical Path Tests (High Priority)

1. **Core Storage Tests** (8-12 hours)
   - `src/core/storage/db.ts` - CRUD operations
   - `src/core/storage/EncryptedDB.ts` - Encryption layer
   - `src/core/storage/sync.ts` - Sync operations

2. **Core Messaging Tests** (6-8 hours)
   - Message encryption/decryption
   - Conversation management
   - Group messaging

3. **Core Groups Tests** (4-6 hours)
   - Group CRUD
   - Membership management
   - Permission checks

### Phase 3: Feature Module Tests (Medium Priority)

1. **Governance Module** (4-6 hours)
   - proposalManager.ts
   - Voting algorithms
   - Ballot creation

2. **Events Module** (4-6 hours)
   - eventManager.ts
   - RSVP handling
   - Calendar operations

3. **Microblogging Module** (4-6 hours)
   - Fix existing postsStore tests
   - Add component tests
   - Add ScheduledPostsView tests

### Phase 4: Integration Tests (Medium Priority)

1. **Module System Integration** (4-6 hours)
   - Module enable/disable flow
   - Cross-module interactions

2. **Encryption + Storage Integration** (4-6 hours)
   - End-to-end encryption tests
   - Encrypted sync tests

---

## Summary

**Total Findings**: 14

| Priority | Count | Description |
|----------|-------|-------------|
| CRITICAL | 3 | E2E import errors, WebCrypto failures, DB init issues |
| HIGH | 2 | Integration test failures, forms manager issues |
| MEDIUM | 8 | Modules without unit tests |
| LOW | 1 | Test quality improvements |

**Priority Actions**:
1. Fix vitest config to properly exclude E2E tests
2. Add WebCrypto polyfill/mock for key rotation tests
3. Fix database initialization in test-utils.ts
4. Write tests for core/storage module (critical code)
5. Write tests for core/messaging module (critical code)

**Estimated Effort to Achieve 80% Coverage**:
- Infrastructure fixes: 6-8 hours
- Critical path tests: 20-30 hours
- Feature module tests: 30-40 hours
- **Total**: ~60-80 hours of testing work

---

## Appendix: Test File Inventory

### Passing Test Files
```
src/core/crypto/__tests__/nip17.test.ts
src/core/crypto/__tests__/nip44.test.ts
src/core/crypto/__tests__/keyManager.test.ts
src/lib/media/__tests__/mediaEncryption.test.ts
src/lib/autocomplete/__tests__/fuzzySearch.test.ts
src/lib/modules/__tests__/permissions.test.ts
src/modules/custom-fields/__tests__/customFieldsManager.test.ts
src/modules/custom-fields/__tests__/templates.test.ts
src/stores/__tests__/moduleStore.test.ts
tests/unit/usernameUtils.test.ts
tests/unit/nostr-filter-merging.test.ts
tests/unit/device-login-notifications.test.ts
```

### Failing Test Files
```
tests/unit/key-rotation.test.ts (WebCrypto issues)
src/modules/microblogging/postsStore.test.ts (DB init)
src/tests/integration/encryptionStorage.test.ts (DB init)
src/tests/integration/moduleSystem.test.ts (DB init)
src/tests/integration/nostrStorage.test.ts (DB init)
tests/forms/formsManager.test.ts (schema not registered)
```

### Incorrectly Loaded (Should be E2E only)
```
tests/e2e/*.spec.ts (36 files)
```
