# BuildIt Epics Index

All epics for the BuildIt platform, organized by status and priority.

**Last Updated**: 2026-02-05

---

## Existing Epics (Defined in NEXT_ROADMAP.md)

These epics are already defined in `clients/web/NEXT_ROADMAP.md`:

| Epic | Title | Priority | Status | Effort | Blocker |
|------|-------|----------|--------|--------|---------|
| 31 | Legal & Compliance Documentation | P0 | Not Started | 5-10h | Legal review required |
| 36 | Additional Translations | P2 | Technical Complete | 5-10h | Native speakers needed |
| 45 | Pleasure Activism UX Philosophy | P2 | Not Started | 10-15h | Human synthesis |
| 49B | Stripe/PayPal Integration | P2 | Not Started | 10-15h | Epic 62 + arch decision |
| 53B | Newsletter Email Delivery | P2 | Not Started | 10-15h | Epic 62 + arch decision |
| 62 | Backend Service Setup | P2 | Not Started | 8-12h | Architectural decision |
| 54 | ActivityPub Federation | P2 | Not Started | 40-60h | Architectural decision |
| 55 | AT Protocol Integration | P3 | Not Started | 40-60h | Epic 54 completion |
| 73 | Schema Versioning Implementation | P1 | Spec Complete | 25-35h | None |

---

## New Epics (From Codebase Audit)

Created from comprehensive audit of TODOs, TECH_DEBT.md, deferred features, and unfinished work:

| Epic | Title | Priority | Effort | File |
|------|-------|----------|--------|------|
| **74** | [Cross-Platform Calling Completion](epic-74-cross-platform-calling.md) | P1 | 25-35h | CallKit, SMS/RCS, WebRTC SIP, training notifications |
| **75** | [Android Feature Completeness](epic-75-android-feature-completeness.md) | P1 | 30-40h | 12+ TODOs: social, forms, crypto, sync, publishing |
| **76** | [iOS Feature Completeness](epic-76-ios-feature-completeness.md) | P1 | 20-28h | Training nav, notification actions, background sync |
| **77** | [Nostr Protocol Integration](epic-77-nostr-protocol-integration.md) | P1 | 30-40h | NIP-01, NIP-05, friend requests, presence, public data |
| **78** | [Media & File Upload System](epic-78-media-file-upload.md) | P1 | 20-25h | Image/video upload, PDF extraction, offline queue |
| **79** | [Web UI/UX Completions](epic-79-web-ux-completions.md) | P2 | 25-35h | 17 deferred UI items + device transfer + groups |
| **80** | [Advanced Privacy & Security](epic-80-advanced-privacy-security.md) | P2 | 35-50h | WebAuthn, traffic analysis resistance, ephemeral msgs |
| **81** | [Android Module Expansion](epic-81-android-module-expansion.md) | P2 | 40-55h | Tasks, Files, Polls, Wiki modules + voice/video msgs |
| **82** | [Comprehensive Test Coverage](epic-82-test-coverage.md) | P2 | 30-40h | Android tests, visual regression, accessibility |
| **83** | [Governance Quadratic Voting](epic-83-governance-quadratic-voting.md) | P2 | 12-18h | Protocol extension + cross-platform UI |
| **84** | [CI/CD & Monitoring](epic-84-cicd-monitoring.md) | P2 | 20-30h | GitHub Actions, Sentry, Web Vitals, analytics |
| **85** | [Mutual Aid & Location Features](epic-85-mutual-aid-location.md) | P3 | 15-20h | Geolocation matching, map view, privacy controls |
| **86** | [Advanced Publishing](epic-86-publishing-advanced.md) | P3 | 20-30h | Custom domains, navigation, archive pages, SEO |
| **87** | [Cooperative Marketplace](epic-87-content-marketplace.md) | P4 | 100+h | Co-op directory, resource sharing, payment integration |

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Required before public launch |
| **P1** | Core feature gap - blocking real-world usage |
| **P2** | Important enhancement - significant user value |
| **P3** | Nice to have - improves experience |
| **P4** | Future vision - long-term strategic |

---

## Dependency Graph

```
Epic 31 (Legal) ─────────────────────────────────┐
                                                  ├── Production Launch
Epic 73 (Schema Versioning) ─────────────────────┘

Epic 75 (Android Complete) ──► Epic 81 (Android Modules)
Epic 76 (iOS Complete) ──────► (iOS at parity)

Epic 77 (Nostr Integration) ──► Epic 80 (Advanced Privacy)

Epic 78 (Media Upload) ──────► (Unblocks image/video across all modules)

Epic 62 (Backend Setup) ──┬──► Epic 49B (Stripe/PayPal)
                          ├──► Epic 53B (Newsletter Email)
                          └──► Epic 54 (ActivityPub) ──► Epic 55 (AT Protocol)

Epic 85 (Location) ──────► Epic 87 (Marketplace) [location reuse]
Epic 49B (Payments) ─────► Epic 87 (Marketplace) [payment reuse]
```

---

## Effort Summary

| Category | Epics | Total Effort |
|----------|-------|-------------|
| P1 (Core gaps) | 74, 75, 76, 77, 78 | 125-168h |
| P2 (Enhancements) | 79, 80, 81, 82, 83, 84 | 162-228h |
| P3 (Nice to have) | 85, 86 | 35-50h |
| P4 (Future) | 87 | 100+h |
| **Existing (roadmap)** | 31, 36, 45, 49B, 53B, 54, 55, 62, 73 | 149-232h |
| **Grand Total** | **23 epics** | **~571-778h** |

---

## Recommended Execution Order

### Phase A: Core Feature Parity (P1)
1. Epic 73 - Schema Versioning (protocol foundation)
2. Epic 77 - Nostr Protocol Integration (networking foundation)
3. Epic 78 - Media Upload (unblocks content features)
4. Epic 74 - Cross-Platform Calling (high-impact feature)
5. Epic 75 - Android Feature Completeness
6. Epic 76 - iOS Feature Completeness

### Phase B: Quality & Polish (P2)
7. Epic 84 - CI/CD & Monitoring (infrastructure for everything else)
8. Epic 82 - Test Coverage (quality gate)
9. Epic 79 - Web UI/UX Completions
10. Epic 83 - Governance Quadratic Voting
11. Epic 80 - Advanced Privacy & Security
12. Epic 81 - Android Module Expansion

### Phase C: Production Launch
13. Epic 31 - Legal & Compliance (P0, blocks launch)
14. Epic 36 - Translations (human work)

### Phase D: Backend & Federation (Requires Decision)
15. Epic 62 - Backend Setup
16. Epic 49B - Stripe/PayPal
17. Epic 53B - Newsletter Email
18. Epic 54 - ActivityPub Federation

### Phase E: Enhancement & Vision
19. Epic 85 - Mutual Aid Location
20. Epic 86 - Advanced Publishing
21. Epic 45 - Pleasure Activism UX
22. Epic 55 - AT Protocol
23. Epic 87 - Cooperative Marketplace
