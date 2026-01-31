# BuildIt Web Client (Tauri UI Layer)

> React + TypeScript + Vite **UI layer for the Tauri desktop application**

**IMPORTANT: This is NOT a standalone web app.** This codebase provides the UI that runs inside Tauri desktop. The "web client" naming is historical - it refers to the web technologies (React, TypeScript) used to build the UI, not a deployment target.

**Deployment architecture:**
- **Desktop app** → Tauri wraps this UI with native Rust backend (BLE, crypto, keyring)
- **Mobile apps** → iOS (Swift) and Android (Kotlin) are separate native implementations
- **Web presence** → Simple Cloudflare Workers for logged-out users (marketing, docs)

**Parent instructions**: See `/CLAUDE.md` for monorepo-wide context.

---

## ⚙️ Package Manager

**This project uses `bun` exclusively. Always use `bun` commands, never `npm` or `yarn`.**

```bash
bun install        # Install dependencies
bun run dev        # Start dev server
bun run test           # Run tests
bun run build      # Production build
```

## 🔒 Active Epic Locks

**Check before starting work. Claim your epic. Release when done.**

```
# Format: AGENT_ID: EPIC_NUMBER(s)
# Example: claude-session-abc123: 51, 54
# Remove your line when done or blocked

# Currently locked:
(none)
```

**Protocol:**
1. Before starting: Check no other agent has your epic
2. Claim: Add your line with `AGENT_ID: EPIC_NUMBER`
3. Release: Remove your line when done, blocked, or deferring
4. Conflict: If locked, pick a different epic or coordinate with user

## Guiding Principles for Claude Code

- You are an expert software engineer with extensive experience in React, TypeScript, WebCrypto, E2EE encryption, and building social media platforms
- ALWAYS be honest about what is complete or not and check to make sure it's completed fully to spec before marking it done
- ALWAYS use high quality third party libraries when applicable, and check the context7 docs
- ALWAYS try to solve problems rather than working around them, and if you don't completely implement something, take note of that
- ALWAYS use clean UX principles, and pay attention to mobile responsiveness/UX, offline support, user friendliness, accessibility, and internationalization
- ALWAYS track your progress, and track changes to requirements in NEXT_ROADMAP.md, changes impacting any of the files below, and use git commit and git logs to track/review changes
- When installing shadcn ui components, just copy the code directly from the latest github files. There is an issue with the shadcn UI registry. Do not just invent your own shadcn ui components, they should ALWAYS be the latest canonical ones
- Modules should be modular, all new features across modules should load to their respective interfaces dynamically from the module registry

## 📚 Documentation Structure (For Claude Code)

### Active Development
- **[NEXT_ROADMAP.md](./NEXT_ROADMAP.md)** - Active roadmap with prioritized epics, tasks, and acceptance criteria
- **[.claude/agents/](./.claude/agents/)** - Specialized subagent definitions for autonomous task execution

### Completed Work
- **[COMPLETED_ROADMAP.md](./COMPLETED_ROADMAP.md)** - Archive of finished epics (Epics 1-27) with git tags

### Technical Reference (Stable)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow
- **[Encryption Strategy](../../docs/architecture/encryption-strategy.md)** - Encryption decisions and implementation
- **[Privacy & OPSEC](../../docs/PRIVACY.md)** - Threat model and security considerations

### Product Context (Shared)
- **[Vision & Mission](../../docs/VISION.md)** - Who we serve, why we exist
- **[User Personas](../../docs/personas/)** - Spectrum of Support personas across all target communities
- **[Design Principles](../../docs/design-principles.md)** - Cross-platform UX standards

### Implementation Guides
- **[docs/SOCIAL_FEATURES_IMPLEMENTATION_GUIDE.md](./docs/SOCIAL_FEATURES_IMPLEMENTATION_GUIDE.md)** - Detailed implementation checklist for social features (Epics 21-25)
- **[docs/GIT_WORKFLOW.md](./docs/GIT_WORKFLOW.md)** - Git worktrees for parallel Claude Code sessions

### User Research
- **[User Personas](../../docs/personas/)** - Spectrum of Support personas across all communities
- **[docs/archive/](./docs/archive/)** - Historical strategy docs (stubs pointing to new locations)

### Navigation & Discovery
- **[PRODUCT_INDEX.md](./PRODUCT_INDEX.md)** - Complete documentation index (for humans)
- **[README.md](./README.md)** - Project overview and setup (for humans)

## 🔄 Using Git History Strategically

Git history is a rich source of context. Use it strategically:

```bash
# View commits for a specific epic
git log --grep="Epic 28"

# View all commits for a file
git log -- path/to/file.ts

# View changes in a specific commit
git show <commit-hash>

# View changes for a git tag
git show v0.27.0-security

# Find when a bug was introduced
git blame path/to/file.ts

# View diff between tags
git diff v0.26.0-privacy..v0.27.0-security
```

**When to use git history:**
- Understanding why code was written a certain way
- Finding when a feature was added
- Reviewing epic implementation details
- Debugging when a bug was introduced
- Understanding architectural decisions

## 🤖 Autonomous Task Execution

### Epic Completion Protocol

**IMPORTANT**: When you complete an epic, you MUST move it to COMPLETED_ROADMAP.md. Follow these steps:

1. **Complete all tasks** - Check off all checkboxes in NEXT_ROADMAP.md
2. **Meet acceptance criteria** - Verify all criteria from epic
3. **Run tests** - `bun run test && bun run typecheck` must pass
4. **Create implementation commit** - Use format from epic (e.g., `feat: complete Epic 28 - Critical Bug Fixes`)
5. **Create git tag** - Format specified in epic (e.g., `v0.28.0-bugfixes`)
6. **Move epic to COMPLETED_ROADMAP.md**:
   - Cut the entire epic section from NEXT_ROADMAP.md
   - Add row to table in COMPLETED_ROADMAP.md with: Epic #, Version, Status ✅, Git Tag, 1-2 line summary
   - Append full epic details below the table
   - Update "Last Updated" dates in both files
7. **Commit roadmap update** - `git commit -m "docs: complete Epic X - move to COMPLETED_ROADMAP"`

**See [NEXT_ROADMAP.md](./NEXT_ROADMAP.md) header for detailed workflow.**

### Using Subagents

This project is designed for autonomous execution via Claude Code subagents. Common patterns:

```bash
# Execute next epic (will auto-move to COMPLETED_ROADMAP when done)
"Complete the next epic from NEXT_ROADMAP.md"

# Execute specific epic
"Complete Epic 28 from NEXT_ROADMAP.md"

# Fix specific bug
"Fix BUG-001 from Epic 28"

# Write tests
"Write E2E tests for authentication flow (Epic 29)"

# Implement feature
"Implement Documents module (Epic 32)"

# Perform audit
"Run security audit for Epic 30"

# Optimize performance
"Reduce bundle size (Epic 35)"
```

See [.claude/agents/](./.claude/agents/) for detailed subagent definitions and execution patterns.

### Available Agents

**Development & Implementation**:
- `epic-executor` - Execute complete epics from NEXT_ROADMAP.md
- `bug-fixer` - Fix specific bugs with root cause analysis
- `test-writer` - Write comprehensive unit, integration, and E2E tests
- `refactorer` - Improve code structure, types, and maintainability

**Quality & Auditing**:
- `security-auditor` - Security audits for encryption, auth, and privacy
- `performance-auditor` - Bundle size, load time, and runtime performance audits
- `accessibility-auditor` - WCAG 2.1 AA compliance and inclusive design audits
- `test-coverage-auditor` - Test coverage analysis and gap identification

**Optimization**:
- `performance-optimizer` - Implement performance improvements and bundle size reduction

**Product & Design**:
- `product-manager` - Product strategy, feature prioritization, and roadmap planning
- `ux-designer` - UX/UI design, accessibility, and mobile responsiveness

**Localization**:
- `translator` - Internationalization and translation into multiple languages

### Execution Principles

1. **Check epic locks first** - Read "Active Epic Locks" section above, ensure your epic is free
2. **Claim your epic** - Add your agent ID and epic number to the locks section
3. **Read NEXT_ROADMAP.md** - Understand what needs to be done
4. **Use TodoWrite tool** - Track progress through epic tasks
5. **Test frequently** - Run `bun run test` after each significant change
6. **Check types** - Run `bun run typecheck` before committing
7. **Use Context7 MCP** - Fetch latest library docs when needed
8. **Commit with proper format** - Follow epic's commit format specification
9. **Update roadmap** - Move completed epics to COMPLETED_ROADMAP.md
10. **Release your lock** - Remove your line from "Active Epic Locks" when done/blocked

### 🚀 Autonomous & Parallel Execution

**CRITICAL: Continue working until the task is truly complete. Don't stop prematurely.**

When the user asks you to work autonomously or in parallel:

1. **Keep working** - After completing one task, immediately proceed to the next logical task
2. **Don't wait for approval** - If the user said "implement this plan" or "complete this epic", execute all steps without stopping to ask
3. **Chain tasks together** - Finish one commit, then continue to the next feature, then the next epic
4. **Work in parallel when asked** - If user says "run in parallel" or "work on multiple things", spawn multiple Task agents simultaneously
5. **Only stop when**:
   - All requested work is complete
   - You encounter a blocking issue that requires user input
   - The user explicitly asks you to pause

**Parallel Execution Pattern**:
```
User: "Complete Epics 53A, 53B, and 54 in parallel"
Agent: Spawns 3 Task agents simultaneously, each working on one epic
```

**Sequential Execution Pattern**:
```
User: "Implement this plan"
Agent: Completes step 1 → commits → completes step 2 → commits → ... → reports all done
```

**Signs you should NOT stop**:
- You just finished one task but the plan has more steps
- You committed code but haven't run tests yet
- Tests pass but you haven't updated documentation
- The epic has more items in the checklist
- The user asked for "complete" or "implement" (not just "start")

### Best Practices

#### Always Do
- Read NEXT_ROADMAP.md to understand current priorities
- Check git status before starting work (`git status`)
- Use TodoWrite to track epic/task progress
- Run tests frequently (after each significant change)
- Use Context7 MCP for latest library documentation
- Follow existing code patterns and conventions
- Write comprehensive commit messages
- Update documentation when adding features
- Fix root causes, not symptoms
- Use comprehensive TypeScript types (avoid `any`)

#### Never Do
- Make workarounds or simplify instead of fixing root causes
- Skip tests ("I'll add them later")
- Use npm commands (always use `bun`)
- Ignore TypeScript errors or add `@ts-ignore` without good reason
- Create duplicate files instead of refactoring
- Commit without running tests
- Break existing functionality unless you're replacing it

#### When Blocked
- Document the blocker clearly
- Update NEXT_ROADMAP.md with blocker status
- Suggest next steps or alternatives
- Ask user for clarification if needed

## Project Overview

**UI layer for the BuildIt desktop application** - a privacy-first organizing platform for activist groups, co-ops, unions, and community organizers.

This code runs inside Tauri desktop (`clients/desktop/`), which provides the native Rust backend for:
- **BLE mesh networking** (btleplug)
- **Cryptographic operations** (buildit-crypto)
- **Secure key storage** (OS keyring)
- **Local database** (SQLite)

## Core Technologies

**UI Layer (this codebase):**
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Storage**: Dexie (IndexedDB wrapper) - for UI state caching

**Native Backend (provided by Tauri desktop):**
- **BLE Mesh**: btleplug (Rust)
- **Crypto**: buildit-crypto via Tauri commands
- **Secure Storage**: SQLite + OS keyring

**Protocol:**
- **Nostr**: Decentralized social protocol
- **Encryption**: NIP-17 (gift-wrapped NIP-44) for DMs and small groups

## Architecture
See ARCHITECTURE.md for detailed system design.

## Module System Architecture

**Core Principle**: All modules are loaded at app initialization. Enable/disable is purely a per-group configuration that controls UI visibility and features, NOT database schema loading.

### Core vs Modular Separation

**CORE (always present, `src/core/`)**:
- Identity management (keypairs, profiles)
- Groups (creation, membership, roles, permissions)
- Basic messaging (DMs - essential for coordination)
- Nostr protocol layer (relays, events, signing)
- Encryption (NIP-17, NIP-44)
- Storage foundation (Dexie with dynamic schema composition)
- Module system itself (registry, loading, lifecycle)

**MODULAR (optional features, `src/modules/`)**:
- **Custom Fields** (base) - Dynamic field capabilities for other modules
- **Events** - Event creation, RSVPs, campaigns (uses custom-fields)
- **Mutual Aid** - Requests, offers, rideshare (uses custom-fields)
- **Governance** - Proposals, voting systems, ballots
- **Wiki** - Collaborative knowledge base, version control
- **Database** - Airtable-like data management (uses custom-fields)
- **CRM** - Contact management with templates (uses database)
- **Document Suite** - WYSIWYG editor, collaboration
- **File Manager** - Encrypted file storage, folders
- All future modules

### Module Dependency Chain

```
Custom Fields (foundational)
├── Events (extends Custom Fields)
├── Mutual Aid (extends Custom Fields)
├── Database (extends Custom Fields)
│   └── CRM (uses Database + templates)
└── Other modules as needed
```

### Module Structure (Complete Encapsulation)

Each module is fully self-contained:
```
src/modules/[module-name]/
├── index.ts              # Module registration (schema + i18n) & exports
├── schema.ts             # DB tables, types
├── migrations.ts         # Version upgrades
├── seeds.ts              # Example/template data
├── types.ts              # TypeScript interfaces
├── [module]Store.ts      # Zustand store
├── [module]Manager.ts    # Business logic
├── components/           # ALL UI components
├── hooks/                # Module hooks
└── i18n/                 # Module translations (scoped)
    └── index.ts          # Uses defineModuleTranslations()
```

**Required in index.ts**: Every module must register both schema and translations:
```typescript
import { registerModuleSchema } from '@/core/storage/db';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import { myModuleSchema } from './schema';
import myModuleTranslations from './i18n';

registerModuleSchema('my-module', myModuleSchema);
registerModuleTranslations('my-module', myModuleTranslations);
```

### Dynamic Database Schema Composition

- All module tables loaded at initialization regardless of enable/disable state
- Schema composed from core + all available module schemas
- Enable/disable is UI-level only - data persists when modules disabled
- New modules require database version migration

### Feature Overview by Module

#### 1. Custom Fields (Base Module)
- Field types: text, number, date, select, multi-select, file, relationship
- Field validation and serialization
- UI components for rendering/editing
- Foundation for Events, Mutual Aid, Database

#### 2. Events & Organizing
- Event creation with privacy levels (public/group/private/direct-action)
- RSVP system with capacity management
- Campaign coordination across multiple events
- Custom fields for dietary preferences, skills, etc.
- Calendar integration (iCal export)

#### 3. Mutual Aid
- Resource request/offer system
- Solidarity ride share network
- Request matching algorithm
- Custom fields for specific needs, allergies, availability
- Community resource directory

#### 4. Governance
- Proposal creation and discussion
- Multiple voting systems (simple, ranked-choice, quadratic, D'Hondt method, consensus)
- Anonymous ballots with optional identity verification
- Decision history and audit logs

#### 5. Wiki (Knowledge Base)
- Collaborative wiki with version control
- Markdown editor
- Document categories and tagging
- Search functionality

#### 6. Database (Airtable-like)
- Create tables from scratch using custom fields
- Multiple views: table, board, calendar, gallery
- Define relationships (one-to-many, many-to-many)
- Query system (filtering, sorting, grouping)

#### 7. CRM (Contact Management)
- Uses Database module with pre-built templates
- Templates: Union Organizing, Fundraising, Volunteer Management, Legal/NLG Tracking, Civil Defense
- Shared contact databases per group
- Privacy controls per field

#### 8. Document Suite
- WYSIWYG editor for comprehensive documents
- Longform posts or shared with colleagues
- Document types and collaboration
- Inspiration: Cryptpad, Tresorit

#### 9. File Manager
- Encrypted file uploads and storage
- Folder organization (group or private)
- File sharing with privacy controls
- Inspiration: DocumentCloud, OwnCloud

### Module Configuration

- **Per-group toggles**: Each group can enable/disable modules independently
- **Custom permissions**: Module-specific permission schemes
- **Module settings**: Configuration per module per group
- **Cross-group views**: Events, aid requests viewable across groups (where permitted)
- **Official modules only**: Users cannot create modules (ensures encapsulation and quality)

## Security & Privacy
See [docs/PRIVACY.md](../../docs/PRIVACY.md) for threat model and security architecture.

Key principles:
- E2E encryption for private data
- Zero-knowledge relay architecture
- Local-first data storage
- Tor integration option
- Hardware wallet support (NIP-46)

## Implementation Phases & Progress
- **Execution Plan**: See [PROMPT.md](./PROMPT.md) for all epics (1-18) and tasks
- **Progress Tracking**: See [PROGRESS.md](./PROGRESS.md) for detailed status with checkboxes
- **Current Status**: Epics 1-13 complete (v0.13.0-modules)
- **Architecture Updates**: New epics added for Custom Fields (13.5), Module Refactoring (14), Database/CRM (15)
- **Epic Renumbering**: Security (16), Testing (17), Production (18) - see PROGRESS.md