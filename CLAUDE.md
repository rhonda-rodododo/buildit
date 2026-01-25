# BuildIt Monorepo

> Privacy-first organizing platform for activist groups, co-ops, unions, and community organizers.

## Application Architecture

**There are 3 native applications** - the web client is NOT a standalone app:

| Application | Tech Stack | Notes |
|-------------|------------|-------|
| **Desktop** | Tauri (Rust) + Web UI | Main desktop app - uses `clients/web/` as UI layer |
| **iOS** | Swift + SwiftUI | Native mobile app |
| **Android** | Kotlin + Compose | Native mobile app |

**Web presence for logged-out users**: Simple Cloudflare Workers (not a full app)

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS                              │
├─────────────────────┬─────────────────┬─────────────────────────┤
│   Desktop (Tauri)   │      iOS        │       Android           │
│   ┌───────────────┐ │   Swift/SwiftUI │   Kotlin/Compose        │
│   │ clients/web/  │ │   Native App    │   Native App            │
│   │ (UI layer)    │ │                 │                         │
│   └───────────────┘ │                 │                         │
│   Rust backend      │   Core BT       │   Android BLE           │
│   btleplug BLE      │                 │                         │
└─────────────────────┴─────────────────┴─────────────────────────┘
```

## Repository Structure

```
buildit/
├── clients/
│   ├── web/          # React + Vite UI layer (embedded in Tauri desktop)
│   ├── desktop/      # Tauri (Rust backend wrapping web UI, native BLE)
│   ├── ios/          # Swift + SwiftUI + Core Bluetooth (standalone)
│   └── android/      # Kotlin + Jetpack Compose + Android BLE (standalone)
├── packages/
│   └── crypto/       # Rust crypto library + UniFFI bindings
├── protocol/
│   ├── schemas/      # JSON Schema (SOURCE OF TRUTH for all types)
│   └── test-vectors/ # Cross-client validation tests
├── docs/
│   ├── protocol-spec/  # Protocol specifications
│   ├── architecture/   # System design docs
│   └── guides/         # Implementation guides
└── tools/
    └── codegen/      # Schema → TypeScript/Swift/Kotlin generators (quicktype)
```

## For Claude Code Agents

### Core Principles

1. **Protocol is source of truth** - All type definitions come from `protocol/schemas/`
2. **Schema changes propagate** - After editing schemas, run `bun run codegen`
3. **Cross-client consistency** - Changes affecting multiple clients should be atomic
4. **Test vectors validate** - All clients must pass `protocol/test-vectors/`

### Common Commands

```bash
# From repo root
bun install                    # Install all workspace dependencies
bun run codegen                # Generate types from schemas → all clients
bun run validate               # Validate all clients against protocol
bun run test:all               # Run tests across all clients

# Client-specific (from client directory)
cd clients/web && bun run dev          # Web dev server
cd clients/web && bun run test         # Web tests
cd clients/desktop && cargo tauri dev  # Desktop with Tauri
cd clients/ios && xcodebuild           # iOS build
cd clients/android && ./gradlew build  # Android build
```

### Agent Task Patterns

#### Schema Change (Cross-Client)
```
1. Edit protocol/schemas/modules/{module}/v{N}.json
2. Update protocol/schemas/modules/_registry.json
3. Run: bun run codegen
4. Verify generated types in each client
5. Update client code to use new fields
6. Add test vectors to protocol/test-vectors/
7. Single commit: "feat(protocol): add X to {module} schema"
```

#### Single Client Change
```
1. Edit files in clients/{platform}/
2. Run tests: cd clients/{platform} && bun run test (or platform equivalent)
3. Commit: "feat({platform}): description"
```

#### Parallel Multi-Client Implementation
```
When implementing same feature across clients:
1. Create schema first (protocol/schemas/)
2. Run codegen to generate types
3. Spawn parallel agents:
   - Agent 1: clients/web/ implementation
   - Agent 2: clients/ios/ implementation
   - Agent 3: clients/android/ implementation
4. Each agent works independently using generated types
5. Merge all changes in single commit
```

### Client-Specific Context

Each client has a `CLAUDE.md` with platform-specific instructions:
- `clients/web/CLAUDE.md` - React, TypeScript, Vite, Tailwind
- `clients/desktop/CLAUDE.md` - Tauri, Rust, BLE
- `clients/ios/CLAUDE.md` - Swift, SwiftUI, Core Bluetooth
- `clients/android/CLAUDE.md` - Kotlin, Jetpack Compose, Android BLE

**Always read the client-specific CLAUDE.md when working on that platform.**

### Documentation Locations

| Topic | Location |
|-------|----------|
| Active Roadmap | `clients/web/NEXT_ROADMAP.md` |
| Completed Work | `clients/web/COMPLETED_ROADMAP.md` |
| Architecture | `docs/architecture/` |
| Protocol Specs | `docs/protocol-spec/` |
| Schema Definitions | `protocol/schemas/` |
| Test Vectors | `protocol/test-vectors/` |
| Implementation Guides | `docs/guides/` |

### Key Architectural Decisions

1. **Encryption**: NIP-17 (gift-wrapped NIP-44) for DMs/small groups
2. **Transport**: BLE mesh primary, Nostr relays fallback
3. **Schema Versioning**: 6-month support window, core messaging never breaks
4. **Offline Distribution**: Schema bundles propagate via BLE mesh

### Package Manager

**This project uses `bun` for JavaScript/TypeScript. Always use `bun`, never `npm` or `yarn`.**

### Git Workflow

```bash
# Feature branch
git checkout -b feat/description

# Commit format
feat(scope): description      # New feature
fix(scope): description       # Bug fix
docs(scope): description      # Documentation
refactor(scope): description  # Code refactoring

# Scopes: web, ios, android, desktop, protocol, crypto, docs
# For cross-client: feat(protocol): description

# After completing epic
git tag v0.X.0-description
```

### Quality Gates

Before marking any task complete:
- [ ] Tests pass (`bun run test` or platform equivalent)
- [ ] Types check (`bun run typecheck` or platform equivalent)
- [ ] No regressions in other clients
- [ ] Schema changes have test vectors

## Quick Reference

### Nostr Event Kinds Used
- 0: Profile metadata
- 3: Contact list
- 7: Reaction
- 13: Seal (NIP-17)
- 14: DM Rumor (NIP-17)
- 1059: Gift Wrap (NIP-17)
- 24242-24244: Device transfer

### BLE UUIDs
- Service: `12345678-1234-5678-1234-56789abcdef0`
- Message: `12345678-1234-5678-1234-56789abcdef1`
- Identity: `12345678-1234-5678-1234-56789abcdef2`
- Routing: `12345678-1234-5678-1234-56789abcdef3`

### Encryption
- NIP-44: ChaCha20-Poly1305 (content encryption)
- NIP-17: Gift wrap (metadata protection)
- Argon2id: 64MB memory, 3 iterations, 4 parallelism (password-based KDF)
- Key derivation: HKDF-SHA256
