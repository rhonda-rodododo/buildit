# Claude Code Autonomous Execution Guide

## 🎯 Quick Start

To build this entire Social Action Network MVP autonomously:

```
Please execute PROMPT.md to build the complete Social Action Network MVP.
```

Claude Code will:
1. Read all documentation files (PROMPT.md, ENCRYPTION_STRATEGY.md, ARCHITECTURE.md, etc.)
2. Execute Epic 1-12 sequentially
3. Use MCP tools (Context7 for docs, Puppeteer for testing, IDE for diagnostics)
4. Commit frequently with clear messages
5. Validate after each epic
6. Complete in under 30 hours

## 📋 Pre-Execution Checklist

Before starting, Claude Code should verify:
- [ ] All documentation files are readable
- [ ] MCP servers are available (Context7, Puppeteer, IDE)
- [ ] Git is initialized
- [ ] Node.js 18+ is available
- [ ] Sufficient disk space for dependencies

## 📚 Documentation Structure

### Core Documents (Read First)
1. **PROMPT.md** - Main autonomous build instructions (12 epics)
2. **ENCRYPTION_STRATEGY.md** - Encryption architecture and decisions
3. **ARCHITECTURE.md** - System architecture and data flow
4. **PRIVACY.md** - Threat model and security considerations
5. **ROADMAP.md** - Development phases and priorities

### Reference Documents
- **CLAUDE.md** - Project overview and tech stack
- **GETTING_STARTED.md** - User guide and developer setup
- **This file** - Execution guidance for Claude Code

## 🔧 Technology Stack Summary

### Frontend
- **Framework**: React 18 + TypeScript 5.3+ + Vite
- **UI**: shadcn/ui (Radix primitives + Tailwind CSS)
- **State**: Zustand with persistence
- **Storage**: Dexie.js (IndexedDB)
- **Testing**: Vitest + React Testing Library + Playwright

### Crypto & Nostr
- **Nostr Client**: nostr-tools
- **Encryption**: NIP-17 (gift-wrapped NIP-44)
  - DMs: NIP-17 for metadata protection
  - Small Groups (<100): NIP-17 multi-wrap
  - Large Groups (>100): Noise Protocol (Phase 2)
- **Key Management**: @noble/secp256k1
- **Future**: Noise Protocol for BLE mesh (offline)

### Key Dependencies
```json
{
  "react": "^18.3.0",
  "nostr-tools": "^2.0.0",
  "@noble/secp256k1": "^2.0.0",
  "zustand": "^4.5.0",
  "dexie": "^4.0.0",
  "@radix-ui/*": "latest",
  "tailwindcss": "^3.4.0"
}
```

## 🏗️ Architecture Highlights

### Encryption Strategy (Critical)
**Read ENCRYPTION_STRATEGY.md before implementing crypto!**

- **NIP-17 for DMs** (MVP):
  - Best metadata protection
  - Two-layer encryption (seal + gift wrap)
  - Timestamp randomization
  - Ephemeral keys for anonymity

- **NIP-17 Multi-Wrap for Small Groups** (<100 members):
  - One gift wrap per member
  - Same strong privacy as DMs
  - Acceptable duplication for <100 members

- **Noise Protocol for Large Groups** (Phase 2):
  - Forward secrecy with key rotation
  - Efficient for >100 members
  - Post-compromise security

### Project Structure
```
buildit-network/
├── src/
│   ├── core/              # Nostr, crypto, storage
│   │   ├── nostr/        # NIPs 01, 17, 44, 59
│   │   ├── crypto/       # NIP-17 implementation
│   │   └── storage/      # Dexie database
│   ├── lib/              # Shared utilities
│   ├── modules/          # Feature plugins
│   │   ├── events/
│   │   ├── mutual-aid/
│   │   ├── governance/
│   │   ├── wiki/
│   │   └── crm/
│   ├── components/       # UI components
│   │   ├── ui/          # shadcn/ui
│   │   └── layouts/
│   ├── stores/          # Zustand
│   ├── hooks/
│   └── types/
└── tests/               # Unit, integration, E2E
```

## 🚀 Execution Flow (12 Epics)

### Epic 1: Foundation (6h)
- Project setup + dependencies
- Nostr client (NIPs 01, 17, 44, 59)
- NIP-17 encryption layer
- Dexie storage

**Validation**: Tests pass, crypto works, storage persists

### Epic 2: Auth & Groups (5h)
- Identity management
- Group CRUD
- Basic UI with shadcn/ui
- Routing and layouts

**Validation**: Create identity → Create group → View dashboard

### Epic 3: Messaging (4h)
- NIP-17 DMs
- NIP-17 group messages (<100)
- Notifications

**Validation**: Encrypted DM → Group message → Notification

### Epic 4: Events (3h)
- Event creation with privacy levels
- RSVP system
- Calendar view + iCal export

**Validation**: Create event → RSVP → Export calendar

### Epic 5: Mutual Aid (3h)
- Request/offer system
- Matching algorithm
- Ride share network

**Validation**: Create request → Match offer → Coordinate

### Epic 6: Governance (3.5h)
- Proposal system
- Multiple voting methods (simple, RCV, quadratic, D'Hondt, consensus)
- Anonymous ballots

**Validation**: Create proposal → Vote → See results

### Epic 7: Wiki (2.5h)
- Markdown editor
- Version control
- Search functionality

**Validation**: Create page → Edit → View history → Search

### Epic 8: CRM (3h)
- Airtable-style interface
- Custom fields
- Multiple views (table, board, calendar)
- Templates

**Validation**: Create contacts → Apply template → Switch views

### Epic 9: Plugin System (2h)
- Module registry
- Per-group configuration
- Module isolation

**Validation**: Enable/disable modules per group

### Epic 10: Security (2.5h)
- Hardware wallet (NIP-46)
- Tor integration
- Key rotation
- Security audit

**Validation**: Connect hardware wallet → Use Tor → Rotate keys

### Epic 11: Testing (2h)
- Unit tests (>80% coverage)
- Integration tests
- E2E tests (Playwright)

**Validation**: All tests pass

### Epic 12: Polish (2h)
- Performance optimization
- Documentation
- Production build
- PWA setup

**Validation**: Lighthouse >90, bundle <500KB, works offline

## 🛠️ MCP Tool Usage

### Context7 (Documentation)
Use for latest library docs:
```
/nbd-wtf/nostr-tools      # Nostr NIPs
/pmndrs/zustand           # State management
/websites/dexie           # IndexedDB
/shadcn-ui/ui             # UI components
/vitest-dev/vitest        # Testing
```

### Puppeteer (Browser Testing)
Use for:
- Visual regression tests
- E2E user flows
- Performance monitoring
- Console error detection

### IDE (Diagnostics)
Use for:
- Real-time TypeScript errors
- Linting issues
- Build diagnostics

## 🔒 Security Considerations

### Key Management
- Never store plaintext keys
- Derive keys using HKDF
- Encrypt keys at rest in IndexedDB
- Support hardware wallets (NIP-46)

### Metadata Protection
- Use NIP-17 gift wraps
- Randomize timestamps (±2 days)
- Ephemeral keys for publishing
- Multiple relay usage

### Operational Security
- Tor integration
- Device encryption
- Separate identities per risk level
- Regular security audits

## 📊 Success Criteria

### Functional
- [x] All 6 modules working (events, mutual-aid, governance, wiki, crm, messaging)
- [x] NIP-17 encryption for DMs and groups
- [x] Multi-identity support
- [x] Offline PWA support

### Technical
- [x] TypeScript strict mode (minimal `any`)
- [x] Test coverage >80% (core >90%)
- [x] Lighthouse score >90
- [x] Bundle size <500KB initial
- [x] Works offline

### Documentation
- [x] User guides
- [x] Developer docs
- [x] Security documentation
- [x] API documentation

## 🎯 Git Workflow

### Commit Strategy
- `feat: <description>` - New features
- `fix: <description>` - Bug fixes
- `refactor: <description>` - Code refactoring
- `test: <description>` - Test additions
- `docs: <description>` - Documentation

### Epic Tags
After each epic validation:
```bash
git tag v0.1.0-foundation
git tag v0.2.0-auth-groups
git tag v0.3.0-messaging
# ... etc
git tag v1.0.0-mvp  # Final
```

## ⚠️ Common Pitfalls to Avoid

1. **Don't skip ENCRYPTION_STRATEGY.md** - Critical for crypto implementation
2. **Don't use NIP-04** - Use NIP-17/44 instead
3. **Don't store plaintext keys** - Always encrypt at rest
4. **Don't skip metadata randomization** - Timestamps must be randomized
5. **Don't create alternative files** - Refactor existing files, use git
6. **Don't use workarounds** - Fix underlying issues
7. **Don't skip tests** - Run after each feature
8. **Don't ignore TypeScript errors** - Fix immediately
9. **Don't use `any`** strategically only
10. **Don't forget git commits** - Commit frequently

## 🚦 Validation Checklist (Per Epic)

After each epic:
- [ ] All tests passing (`npm run test:all`)
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Manual testing complete
- [ ] Git committed with clear message
- [ ] Git tagged with epic version
- [ ] Documentation updated (if needed)

## 📈 Progress Tracking

Claude Code should update PROMPT.md with checkmarks after completing each task.

Example:
```markdown
- [x] Initialize Vite + React + TypeScript project
- [x] Install core dependencies
- [x] Configure TypeScript
```

## 🆘 Troubleshooting

### If stuck on encryption:
1. Re-read ENCRYPTION_STRATEGY.md
2. Check NIP-17 spec: https://github.com/nostr-protocol/nips/blob/master/17.md
3. Verify NIP-44 implementation
4. Test with unit tests first

### If tests failing:
1. Check test output for specific errors
2. Verify mocks are set up correctly
3. Check async handling
4. Review test setup/teardown

### If performance issues:
1. Use React DevTools Profiler
2. Check for unnecessary re-renders
3. Verify virtual scrolling is working
4. Check IndexedDB query optimization

## 🎉 Completion

When all 12 epics are complete:
1. Run full test suite: `npm run test:all`
2. Run production build: `npm run build`
3. Run Lighthouse audit
4. Verify PWA works offline
5. Git tag: `v1.0.0-mvp`
6. Celebrate! 🎊

## 📝 Notes for Claude Code

- This is a **greenfield build** - no existing code
- Work **autonomously** - make decisions, don't ask
- **Commit frequently** - after each sub-task
- **Test continuously** - after each feature
- **Use MCP tools** - Context7, Puppeteer, IDE
- **Follow ENCRYPTION_STRATEGY.md** - Critical for security
- **Build incrementally** - Each epic produces working features
- **Refactor fearlessly** - Use git to track changes
- **No workarounds** - Fix underlying issues
- **Type safety** - Avoid `any`, use strategic typing

---

**Ready to build!** Start by reading PROMPT.md and executing Epic 1. 🚀
