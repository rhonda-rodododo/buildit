# Social Action Network

## Project Overview
A privacy-first organizing platform built on Nostr protocol and Samiz encryption layer for activist groups, co-ops, and community organizers.

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

## Feature Modules

### 1. Core Communication (Foundation)
- Privacy-aware DMs with E2E encryption
- Encrypted group threads
- Public microblogging
- Nostr relay management

### 2. Events & Organizing
- Event creation with privacy levels (public/group/private/direct-action)
- RSVP system with capacity management
- Campaign coordination across multiple events
- Task assignment and tracking
- Calendar integration (iCal export)

### 3. Mutual Aid
- Resource request/offer system (with optional per-requester trusted intermediaries)
- Solidarity ride share network
- Request matching algorithm
- Community resource directory

### 4. Co-ops & Governance
- Proposal creation and discussion
- Multiple voting systems (simple, ranked-choice, quadratic, D'Hondt_method, consensus)
- Anonymous ballots with optional identity verification
- Decision history and audit logs
- Member management

### 5. Knowledge Base
- Collaborative wiki with version control
- Markdown editor
- Document categories and tagging
- Search functionality

### 6. Relationship CRM/Database
- Airtable-style interface
- Shared contact databases per group
- Custom fields and views
- Privacy controls per field
- provide templates for everything from organizing unions and collectives, fundraising, volunteer management, human rights/legal tracking (ala NLG/Amensty International), civil defense, etc

## Groups Plugin System
Each group can enable/configure modules independently.
Plugin architecture allows for:
- Per-group feature toggles
- Custom permission schemes
- Module-specific settings
- cross-group views - such as events, aid requests, almost any non-
Plugins are not user created yet, only officially provided plugins - this allows us to encapsulate all of the above, and make some functionality reusable


## Security & Privacy
See PRIVACY.md for threat model and security architecture.

Key principles:
- E2E encryption for private data
- Zero-knowledge relay architecture
- Local-first data storage
- Tor integration option
- Hardware wallet support (NIP-46)

## Getting Started
See GETTING_STARTED.md for setup instructions.

## Implementation Phases
See ROADMAP.md for development phases and priorities.