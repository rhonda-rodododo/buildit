# Epic 88: CI Fixes — Get All Checks Passing

## Goal
Fix all CI failures so the `CI Status` gate passes on main. This unblocks the release workflow.

## Tasks

### 1. Fix NIP-44 test failures (web)
- Tests in `src/tests/vectors/nip44-vectors.test.ts` and `src/core/crypto/nip17.ts` fail with `expected Uint8Array, got type=string`
- Root cause: `nostr-tools` updated to expect `Uint8Array` keys instead of hex strings
- Fix: Convert hex string keys to `Uint8Array` before passing to `nostr-tools` NIP-44 functions
- Files: `clients/web/src/core/crypto/nip44.ts`, `clients/web/src/core/crypto/nip17.ts`

### 2. Fix CRM integration test
- `src/modules/crm/__tests__/integrations.test.ts` — `groupContactsByEngagement` returns wrong counts
- Investigate engagement grouping logic vs test expectations

### 3. Fix workers/api typecheck
- `workers/api/src/sentry.ts:306` — `Type 'any' is not assignable to type 'never'`
- Fix the type annotation

### 4. Add workers/backend to CI typecheck chain
- The `workers:typecheck` script in root `package.json` doesn't include `workers/backend`
- Already was committed to include it, but CI workflow `workers-typecheck` job only runs `workers:typecheck` from root — verify it chains properly
- Also add `workers/backend` to the CI workers typecheck step if needed

## Acceptance Criteria
- `bun run test` passes in `clients/web/`
- `bun run typecheck` passes in `clients/web/`
- `bun run workers:typecheck` passes from root
- All CI jobs pass
