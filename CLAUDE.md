# BuildIt Network - a social action network

## Guiding Principle
- You are an expert software engineer with extensive experience in react, typescript, webcrypto, in e2ee encryption, and in building social media platforms
- ALWAYS be honest about what is complete or not and check to make sure it's completed fully to spec before marking it done
- ALWAYS use high quality third party libraries when applicable, and check the context7 docs
- ALWAYS try to solve problems rather than working around them, and if you don't completely implement something, take note of that.
- ALWAYS use clean UX principles, and pay attention to mobile responsiveness/UX, offline support, user friendliness, accessibility, and internationalization
- ALWAYS track your progress, and track changes to requirements in PROMPT.md and PROGRESS.md, changes impacting any of the files below, and use git commit and git logs to track/review changes.
- When installing shadcn ui components, just copy the code directly from the latest github files. there is an issue with the shadcn UI registry. Do not just invent your own shadcn ui components, they should ALWAYS be the latest canonical ones
- Modules should be modular, all new features across modules should load to their respective interfaces dynamically from the module registry


## 📚 Project Documentation

**Quick Navigation:**
- **[PROMPT.md](./PROMPT.md)** - Complete execution plan for autonomous build (all epics and tasks)
- **[PROGRESS.md](./PROGRESS.md)** - Detailed progress tracking with checkboxes (single source of truth for status)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and data flow
- **[ENCRYPTION_STRATEGY.md](./ENCRYPTION_STRATEGY.md)** - Encryption decisions and implementation
- **[PRIVACY.md](./PRIVACY.md)** - Threat model and security considerations

## Project Overview
A privacy-first organizing platform built on Nostr protocol and NIP-17 encryption layer for activist groups, co-ops, unions, and community organizers.

## Core Technologies
- **Protocol**: Nostr (decentralized social protocol)
- **Encryption**:
  - NIP-17 (gift-wrapped NIP-44) for DMs and small groups - Best metadata protection
  - Noise Protocol for large groups (Phase 2) - Forward secrecy
  - Future: BLE mesh with Noise for offline (BitChat-inspired)
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui (design tokens for React Native prep)
- **State**: Zustand
- **Storage**: Dexie (IndexedDB wrapper)
- **Crypto**: @noble/secp256k1, nostr-tools (NIP-17/44/59)

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
├── index.ts              # Module registration
├── schema.ts             # DB tables, types
├── migrations.ts         # Version upgrades
├── seeds.ts              # Example/template data
├── types.ts              # TypeScript interfaces
├── [module]Store.ts      # Zustand store
├── [module]Manager.ts    # Business logic
├── components/           # ALL UI components
├── hooks/                # Module hooks
└── i18n/                 # Module translations
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
See PRIVACY.md for threat model and security architecture.

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