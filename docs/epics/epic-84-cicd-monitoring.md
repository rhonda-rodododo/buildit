# Epic 84: CI/CD Pipeline & Monitoring

**Status**: Not Started
**Priority**: P2 - Infrastructure
**Effort**: 20-30 hours
**Platforms**: All (infrastructure)
**Dependencies**: None

---

## Context

The project has no CI/CD pipeline or production monitoring. Tests run locally but aren't enforced on PR. Builds are manual. There's no error tracking, performance monitoring, or privacy-preserving analytics. This is blocking production readiness.

**Source**: `clients/web/NEXT_ROADMAP.md` - Backlog Items 3 (Monitoring) and 4 (CI/CD)

---

## Tasks

### CI/CD Pipeline (10-14h)

#### GitHub Actions Setup
- [ ] Create `.github/workflows/ci.yml` for pull request validation
- [ ] Run web tests (`bun run test`) on PR
- [ ] Run typecheck (`bun run typecheck`) on PR
- [ ] Run protocol test vector validation on PR
- [ ] Build verification (ensure `bun run build` succeeds)

#### Multi-Platform CI
- [ ] Android build verification (`./gradlew build`)
- [ ] iOS build verification (`xcodebuild` - may need macOS runner)
- [ ] Desktop build verification (`cargo build` for Tauri backend)
- [ ] Crypto library build (`cargo test` in `packages/crypto/`)

#### Schema Validation CI
- [ ] Validate JSON schemas on change (`protocol/schemas/`)
- [ ] Run codegen and verify no uncommitted diffs
- [ ] Cross-client type compatibility check

#### Deployment Pipeline
- [ ] Cloudflare Workers deployment (relay, SSR, API)
- [ ] Preview deployments for PRs (Workers preview URLs)
- [ ] Production deployment with approval gate
- [ ] Rollback mechanism

### Error Tracking (4-6h)

#### Sentry Integration
- [ ] Set up Sentry project for BuildIt
- [ ] Integrate Sentry SDK in web client (Tauri)
- [ ] Integrate Sentry in Cloudflare Workers
- [ ] Source map upload for readable stack traces
- [ ] Configure alert rules (error rate spikes, new errors)
- [ ] Privacy: ensure no PII in error reports (strip pubkeys, usernames)

### Performance Monitoring (4-6h)

#### Web Vitals
- [ ] Implement Core Web Vitals tracking (LCP, FID, CLS)
- [ ] Track custom metrics (message send latency, BLE connect time)
- [ ] Bundle size tracking (alert on size increase)
- [ ] Privacy-preserving: no user identification, aggregate only

#### Crash Reporting
- [ ] iOS crash reporting (Apple Crash Reports or Sentry)
- [ ] Android crash reporting (Firebase Crashlytics or Sentry)
- [ ] Desktop crash reporting (Tauri panic handler)
- [ ] Strip sensitive data from crash reports

### Privacy-Preserving Analytics (4-6h)

#### Anonymous Usage Analytics
- [ ] Implement privacy-first analytics (Plausible, Fathom, or custom)
- [ ] No cookies, no PII, no tracking across sessions
- [ ] Track aggregate feature usage (which modules enabled)
- [ ] Track aggregate error rates
- [ ] Opt-out mechanism (respect Do Not Track)
- [ ] Self-hosted option for maximum privacy

#### User Feedback System
- [ ] In-app feedback button (text only, no screenshots to avoid PII)
- [ ] Feedback submission via Nostr or direct API
- [ ] Feedback dashboard for maintainers

---

## Acceptance Criteria

- [ ] PRs are validated automatically (tests, types, build)
- [ ] Multi-platform builds verified in CI
- [ ] Schema changes validated and codegen verified
- [ ] Sentry captures errors with readable stack traces
- [ ] Web Vitals tracked and dashboarded
- [ ] Crash reports collected on all native platforms
- [ ] Analytics are truly privacy-preserving (no PII, opt-out)
- [ ] Feedback mechanism available to users

---

## Privacy Considerations

- Error reports must NOT contain: pubkeys, usernames, message content, IP addresses
- Analytics must NOT use cookies or fingerprinting
- All monitoring data must be aggregate, not per-user
- Self-hosted analytics option for organizations that need it
- Crash reports should redact local file paths

---

**Git Commit Format**: `infra: add CI/CD and monitoring (Epic 84)`
**Git Tag**: `v0.84.0-cicd-monitoring`
