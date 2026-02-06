# BuildIt Monorepo

> Privacy-first organizing platform for activist groups, co-ops, unions, and community organizers.

## Project Vision & Philosophy

BuildIt exists because organizers need tools that are private by default,
work offline, and serve the full spectrum of engagement — from casual
supporters to core organizers to opposition researchers.

**Read these to understand WHY we build what we build:**

- **[Vision & Mission](docs/VISION.md)** — Who we serve, why we exist, design principles
- **[User Personas](docs/personas/)** — Spectrum of Support personas across all target communities
- **[Design Principles](docs/design-principles.md)** — Cross-platform UX standards
- **[Privacy & OPSEC Guide](docs/PRIVACY.md)** — User-facing security guidance
- **[Encryption Strategy](docs/architecture/encryption-strategy.md)** — Layered encryption architecture

Every feature, on every platform, should serve these communities and embody
these principles. When in doubt, ask: "Does this help an organizer coordinate
safely and effectively?"

## Application Architecture

**There are 3 native applications** - the web client is NOT a standalone app:

| Application | Tech Stack | Notes |
|-------------|------------|-------|
| **Desktop** | Tauri (Rust) + Web UI | Main desktop app - uses `clients/web/` as UI layer |
| **iOS** | Swift + SwiftUI | Native mobile app |
| **Android** | Kotlin + Compose | Native mobile app |

**Web presence for logged-out users**: Cloudflare Workers SSR (not a full app)

**Cloudflare Workers infrastructure:**

| Worker | Purpose | Location |
|--------|---------|----------|
| **buildit-relay** | Nosflare-based Nostr relay (D1 + Durable Objects) | `workers/relay/` |
| **buildit-public** | SSR public pages for logged-out visitors | `workers/ssr/` |
| **buildit-api** | Shared API (link-preview, image-proxy, oEmbed) | `workers/api/` |

**NOTE**: `clients/web/` is NOT deployed standalone to Cloudflare. It is only the UI layer embedded in Tauri desktop.

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
┌─────────────────────────────────────────────────────────────────┐
│                   CLOUDFLARE WORKERS                             │
├─────────────────────────────┬───────────────────────────────────┤
│   buildit-relay     │  buildit-public  │  buildit-api        │
│   Nosflare relay    │  SSR pages       │  Link preview,      │
│   D1 + Durable Obj  │  TanStack Start  │  image proxy, embed │
└─────────────────────┴──────────────────┴─────────────────────┘
```

## Repository Structure

```shell
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
├── workers/
│   └── api/          # Shared Cloudflare Worker: link-preview, image-proxy, oEmbed
├── docs/
│   ├── VISION.md        # Core vision, mission, principles
│   ├── personas/        # Spectrum of Support user personas
│   ├── visions/         # Multi-epic product direction docs
│   ├── protocol-spec/   # Protocol specifications
│   ├── architecture/    # System design docs (encryption strategy, etc.)
│   └── guides/          # Implementation guides
└── tools/
    └── codegen/      # Schema → TypeScript/Swift/Kotlin generators (quicktype)
```

## For Claude Code Agents

### Core Principles

1. **Protocol schema FIRST, then codegen, then implement**:
    - All protocol type definitions come from `protocol/schemas/` (which you should change/improve as needed)
    - **NEVER define types manually in client code that should come from the protocol schema.** Always define the JSON Schema first, run `bun run codegen`, then import generated types in client modules.
    - Client module `types.ts` files must re-export from `@/generated/validation/{module}.zod` (for web) — only UI-only types (form inputs, computed results) are defined locally
    - Schema files require: `version`, `minReaderVersion`, `coreModule` top-level fields, and `_v` field in all `$defs` object types
    - Everything adheres to the `docs/protocol-spec` or enhances/improves on it
    - The `packages/crypto` is a shared implementation of the protocol's non-platform-specific functionality
    - You are constantly auditing and improving all of these on a regular cadence via new spec additions and iterations
2. **Schema changes propagate** - After editing schemas, run `bun run codegen`. Generated files go to `clients/web/src/generated/`, `clients/ios/Sources/Generated/`, `clients/android/.../generated/`, `packages/crypto/src/generated/`
3. **Cross-client consistency** - Changes affecting multiple clients should be atomic
4. **Test vectors validate** - All clients must pass `protocol/test-vectors/`
5. **Privacy, E2EE, zero knowledge** -  All clients must be resilient to crisis scenarios and state level repression threat models based on the ever evolving [security guidelines](docs/SECURITY.md) and [threat model](docs/THREAT_MODEL.md)
6. **Fix actual issues, fully implement solutions** - no workarounds, everything is fully implemented, no surpressing type issues, get to the root of the problem
7. **DRY, Clean, Readable**: All clients are made by teams claude code agents who are experts in each platform, and a team of security experts as well

### Common Commands

```bash
# From repo root
bun install                    # Install all workspace dependencies
bun run codegen                # Generate types from schemas → all clients
bun run validate               # Validate all clients against protocol
bun run test:all               # Run tests across all clients

# Client-specific (from client directory)
cd clients/web && bun run dev          # Web dev server (Tauri UI layer)
cd clients/web && bun run test         # Web tests
cd clients/desktop && cargo tauri dev  # Desktop with Tauri
cd clients/ios && xcodebuild           # iOS build
cd clients/android && ./gradlew build  # Android build

# Cloudflare Workers
bun run workers:dev:relay               # Relay local dev
bun run workers:deploy:relay            # Deploy relay to Cloudflare
bun run workers:dev:ssr                 # SSR local dev
bun run workers:deploy:ssr              # Deploy SSR to Cloudflare
cd workers/api && bun run dev           # API worker local dev
cd workers/api && bun run deploy        # Deploy API worker to Cloudflare
```

### Agent Task Patterns

#### New Module Implementation (MANDATORY WORKFLOW)

**Always follow this order — schema first, codegen, then client code:**

1. Create `protocol/schemas/modules/{module}/v1.json` with:
   - `version`, `minReaderVersion`, `coreModule` top-level fields
   - `$defs` with all protocol types (each object type must include `_v` field)
   - `x-storage` if the module needs local DB tables
2. Add module entry to `protocol/schemas/modules/_registry.json`
3. Run: `bun run codegen` — generates types for ALL platforms
4. Create client module `types.ts` that **re-exports from generated types**:
   ```typescript
   // Re-export protocol types from codegen
   export {
     MyTypeSchema, type MyType,
     MODULE_SCHEMA_VERSION,
   } from '@/generated/validation/{module}.zod';

   // Only define UI-only types here (form inputs, computed results)
   export interface CreateMyTypeInput { /* ... */ }
   ```
5. Implement client components, stores, managers using the generated types
6. Add test vectors to `protocol/test-vectors/`
7. Run typecheck: `bun run typecheck`

**Common mistake**: Defining types manually in client `types.ts` instead of importing from `@/generated/`. This causes type drift across platforms and requires rework.

#### Schema Change (Cross-Client)

1. Edit protocol/schemas/modules/{module}/v{N}.json
2. Update protocol/schemas/modules/_registry.json
3. Run: bun run codegen
4. Verify generated types in each client
5. Update client code to use new fields
6. Add test vectors to protocol/test-vectors/
7. Single commit: "feat(protocol): add X to {module} schema"

#### Single Client Change

1. Edit files in clients/{platform}/
2. Run tests: cd clients/{platform} && bun run test (or platform equivalent)
3. Commit: "feat({platform}): description"

#### Parallel Multi-Client Implementation

When implementing same feature across clients:

1. Create schema first (protocol/schemas/)
2. Run codegen to generate types
3. Spawn parallel agents:
   - Agent 1: clients/web/ implementation
   - Agent 2: clients/ios/ implementation
   - Agent 3: clients/android/ implementation
4. Each agent works independently using generated types
5. Merge all changes in single commit

### Client-Specific Context

Each client has a `CLAUDE.md` with platform-specific instructions:

- `clients/web/CLAUDE.md` - React, TypeScript, Vite, Tailwind
- `clients/desktop/CLAUDE.md` - Tauri, Rust, BLE (wraps web ^)
- `clients/ios/CLAUDE.md` - Swift, SwiftUI, Core Bluetooth
- `clients/android/CLAUDE.md` - Kotlin, Jetpack Compose, Android BLE

**Always read the client-specific CLAUDE.md when working on that platform.**

### Documentation Locations

| Topic | Location |
|-------|----------|
| Vision & Philosophy | `docs/VISION.md` |
| User Personas | `docs/personas/` |
| Design Principles | `docs/design-principles.md` |
| Product Visions | `docs/visions/` |
| Privacy & OPSEC | `docs/PRIVACY.md` |
| Active Roadmap | `clients/web/NEXT_ROADMAP.md` |
| Completed Work | `clients/web/COMPLETED_ROADMAP.md` |
| Epics | `docs/epics/*` |
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

**This project uses `bun` for JavaScript/TypeScript. Always use `bun`, never `npm` or `yarn`. Same for `bunx`, etc**

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
