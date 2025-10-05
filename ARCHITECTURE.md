# System Architecture

## Overview

BuildIt Network - a social action network is built on a decentralized architecture using the Nostr protocol as the foundation, with NIP-17 encryption providing privacy-aware group communication.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                       │
│  (React + TypeScript + shadcn/ui + Tailwind)        │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              Application Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Groups    │  │   Modules   │  │     UI      │ │
│  │   System    │  │   (Events,  │  │ Components  │ │
│  │             │  │  Mutual Aid,│  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│                Core Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Nostr     │  │   Crypto    │  │   Storage   │ │
│  │   Client    │  │  (NIP-17)   │  │   (Dexie)   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│            Nostr Relay Network                       │
│   (Decentralized, censorship-resistant storage)     │
└─────────────────────────────────────────────────────┘
```

## Core vs Modular Separation

**Core Functionality** (`src/core/`):
- Identity management (keypairs, profiles)
- Groups (creation, membership, roles, permissions)
- Basic messaging (DMs - essential for coordination)
- Nostr protocol layer (relays, events, signing)
- Encryption (NIP-17, NIP-44)
- Storage foundation (Dexie initialization, but schema extended by modules)
- Module system itself (registry, loading, lifecycle)

**Modular Functionality** (`src/modules/`):
- **Custom Fields** - Base module for dynamic fields (foundational)
- **Events** - Event creation, RSVPs, campaigns (extends Custom Fields)
- **Mutual Aid** - Requests, offers, rideshare (extends Custom Fields)
- **Governance** - Proposals, voting systems, ballots
- **Wiki** - Collaborative knowledge base, version control
- **Database** - Airtable-like data management (extends Custom Fields)
- **CRM** - Contact management with templates (uses Database)
- **Document Suite** - WYSIWYG editor, collaboration
- **File Manager** - Encrypted file storage, folders
- All future modules

## Core Components

### 1. Nostr Client Layer

**Purpose**: Manage connections to Nostr relays and handle event lifecycle

**Key Classes**:
- `NostrClient`: Main relay pool manager
- `RelayConnection`: Individual relay connection handler
- `EventPublisher`: Publish events with retries
- `EventSubscriber`: Subscribe to event filters
- `EventValidator`: Verify event signatures

**Files**:
```
src/core/nostr/
├── client.ts           # Main Nostr client
├── relay.ts            # Relay connection management
├── events.ts           # Event creation/validation
├── filters.ts          # Subscription filter builders
└── nips/
    ├── nip01.ts        # Basic protocol
    ├── nip04.ts        # Encrypted DMs
    ├── nip46.ts        # Remote signing (hardware wallets)
    └── nip29.ts        # Group chats (if used)
```

### 2. Crypto Layer (NIP-17 + Noise Protocol)

**Purpose**: Provide end-to-end encryption with strong metadata protection

**Encryption Strategy** (See ENCRYPTION_STRATEGY.md for full details):
- **DMs & Small Groups**: NIP-17 (gift-wrapped NIP-44) - Best metadata protection
- **Large Groups**: Noise Protocol (Phase 2) - Forward secrecy
- **Future BLE**: Noise Protocol mesh (offline)

**Key Functions**:
- NIP-44 encryption/decryption (ChaCha20-Poly1305)
- NIP-17 gift wrap (seal + wrap)
- Key derivation from master key
- Metadata randomization
- Ephemeral key generation

**Files**:
```
src/core/crypto/
├── nip17.ts            # NIP-17 gift wrap implementation
├── nip44.ts            # NIP-44 encryption (ChaCha20-Poly1305)
├── nip59.ts            # Seals and gift wraps
├── identity.ts         # Key pair management
├── keyring.ts          # Multi-identity support
└── noise.ts            # Noise Protocol (Phase 2)
```

**Encryption Flow (NIP-17 DM)**:
```
plaintext → create rumor (unsigned) →
seal with sender key → gift wrap for recipient →
randomize metadata → publish with ephemeral key
```

**Encryption Flow (NIP-17 Group <100)**:
```
plaintext → create rumor → seal →
for each member: gift wrap individually →
publish multiple wrapped events
```

### 3. Storage Layer (Dynamic Schema Composition)

**Purpose**: Local-first data persistence with IndexedDB, dynamically composed from modules

**Schema Composition Strategy**:
```typescript
// Core tables (always present)
const coreSchema = {
  identities: 'publicKey, name, created, lastUsed',
  groups: 'id, name, created, privacy',
  groupMembers: '++id, [groupId+pubkey], groupId, pubkey, role',
  messages: 'id, groupId, authorPubkey, recipientPubkey, timestamp, threadId',
  nostrEvents: 'id, kind, pubkey, created_at',
  moduleInstances: 'id, [groupId+moduleId], groupId, moduleId, state, updatedAt'
};

// Module schemas (loaded dynamically)
import { eventsSchema } from '@/modules/events/schema';
import { mutualAidSchema } from '@/modules/mutual-aid/schema';
import { governanceSchema } from '@/modules/governance/schema';
// ... import all module schemas

// Composed schema at initialization
const completeSchema = {
  ...coreSchema,
  ...eventsSchema,
  ...mutualAidSchema,
  ...governanceSchema,
  // ... all other module schemas
};

// Database initialized with complete schema
const db = new Dexie('BuildItNetworkDB');
db.version(1).stores(completeSchema);
```

**Key Points**:
- **All module tables are loaded** regardless of enable/disable state
- **Enable/disable is UI-level only** - data persists even when module disabled
- **New modules** require database migration (version bump)
- **Each module owns** its schema, migrations, and seed data

**Files**:
```
src/core/storage/
├── db.ts               # Dexie database with dynamic schema composition
├── cache.ts            # Event caching strategy
├── sync.ts             # Sync with Nostr relays
└── migrations.ts       # Schema version migrations (orchestrates module migrations)
```

## Application Layer

### Groups System

**Purpose**: Manage group creation, membership, and permissions

**Group Data Model**:
```typescript
interface Group {
  id: string;              // Unique group ID
  name: string;
  description: string;
  adminPubkeys: string[];  // Group administrators
  created: number;
  privacy: 'public' | 'private';
  enabledModules: string[];  // Module IDs (e.g., ['events', 'mutual-aid'])
  moduleConfigs: Record<string, ModuleConfig>;  // Per-module settings
  groupKey?: string;       // Encrypted group key
}

interface ModuleConfig {
  enabled: boolean;
  settings: Record<string, unknown>;
}
```

**Nostr Representation**:
```json
{
  "kind": 39000,
  "content": "{encrypted-group-metadata}",
  "tags": [
    ["d", "group-unique-id"],
    ["name", "Group Name"],
    ["privacy", "private"],
    ["admin", "admin-pubkey-1"],
    ["admin", "admin-pubkey-2"],
    ["module", "events"],
    ["module", "mutual-aid"]
  ]
}
```

### Module System Architecture

**Core Principle**: All modules are loaded at initialization. Enable/disable is purely a per-group configuration setting that controls UI visibility and feature access, NOT database schema loading.

**Module Registry Flow**:
```
1. App initialization
   ↓
2. Module registry imports all available modules
   ↓
3. Each module exports schema fragment
   ↓
4. Core composes complete Dexie schema from all modules
   ↓
5. Database initialized with ALL module tables
   ↓
6. Groups configure which modules are enabled (UI-level only)
```

**Module Interface**:
```typescript
interface Module {
  id: string;                                    // Unique module ID
  name: string;                                  // Display name
  description: string;                           // Module description
  version: string;                               // Semantic version
  dependencies?: string[];                       // Module dependencies

  // Schema
  schema: DexieSchema;                           // DB tables for this module
  migrations?: Migration[];                      // Version upgrades
  seeds?: SeedData[];                           // Example/template data

  // Lifecycle
  initialize(group: Group): Promise<void>;
  enable(groupId: string): Promise<void>;
  disable(groupId: string): Promise<void>;

  // Nostr integration
  getEventKinds(): number[];
  handleEvent(event: NostrEvent): Promise<void>;

  // UI
  renderUI(): React.ComponentType;
  renderSettings?(): React.ComponentType;
}
```

**Module Structure (Complete Encapsulation)**:
```
src/modules/[module-name]/
├── index.ts              # Module registration & exports
├── schema.ts             # Database schema (Dexie tables, types)
├── migrations.ts         # Schema version upgrades
├── seeds.ts              # Example data and templates
├── types.ts              # TypeScript interfaces
├── [moduleName]Store.ts  # Zustand store (module state)
├── [moduleName]Manager.ts # Business logic
├── components/           # ALL UI components for this module
│   ├── [Component].tsx
│   └── ...
├── hooks/                # Module-specific React hooks
│   ├── use[Module].ts
│   └── ...
└── i18n/                 # Module translations
    ├── en.json
    ├── es.json
    └── ...
```

**Example: Events Module**:
```
src/modules/events/
├── index.ts              # Exports EventsModule
├── schema.ts             # DBEvent, DBRSVP tables
├── migrations.ts         # v1→v2 add imageUrl field
├── seeds.ts              # Sample events for demo
├── types.ts              # Event, RSVP, Privacy types
├── eventsStore.ts        # Zustand store
├── eventManager.ts       # Business logic
├── components/
│   ├── EventList.tsx
│   ├── EventDetail.tsx
│   ├── CreateEventForm.tsx
│   ├── RSVPButton.tsx
│   └── CalendarView.tsx
├── hooks/
│   ├── useEvents.ts
│   └── useRSVPs.ts
└── i18n/
    ├── en.json           # "events.create.title": "Create Event"
    └── es.json
```

### Custom Fields System

**Architecture**: Custom Fields is the foundational module that provides dynamic field capabilities to other modules.

**Module Dependency Chain**:
```
Custom Fields (base)
├── Events (extends Custom Fields)
├── Mutual Aid (extends Custom Fields)
├── Database (extends Custom Fields)
│   └── CRM (uses Database + templates)
└── Other modules as needed
```

**Custom Fields Module Provides**:
- Field type definitions (text, number, date, select, multi-select, file)
- Field validation and serialization
- UI components for field rendering and editing
- Storage layer for custom field data

**Field Type System**:
```typescript
type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'multi-select'
  | 'file'
  | 'relationship';

interface CustomField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  options?: string[];        // For select types
  validation?: ValidationRule;
}

interface CustomFieldValue {
  fieldId: string;
  entityId: string;          // Event ID, Contact ID, etc.
  value: unknown;
}
```

**Module Usage Examples**:

**Events Module** (lightweight extension):
```typescript
// Events extends Custom Fields for dynamic attributes
interface Event {
  id: string;
  title: string;
  startTime: number;
  // Standard fields...
  customFields: CustomFieldValue[];  // Dietary prefs, skill requirements, etc.
}
```

**Database Module** (full Airtable-like system):
```typescript
// Database provides complete data management
interface DatabaseTable {
  id: string;
  name: string;
  fields: CustomField[];     // Uses Custom Fields for schema
  views: View[];             // Table, board, calendar views
  relationships: Relationship[];
}

// CRM uses Database for opinionated templates
interface CRMTemplate {
  name: string;              // "Union Organizing", "Legal Tracking"
  baseTable: DatabaseTable;
  customViews: View[];
  workflows: Workflow[];
}
```

**Benefits of This Architecture**:
1. **Separation of Concerns**: Lightweight modules only import Custom Fields
2. **Progressive Enhancement**: Database builds on Custom Fields for power users
3. **Reusability**: Custom Fields used across Events, Mutual Aid, Database, etc.
4. **Flexibility**: CRM templates leverage full Database capabilities

## Data Flow

### Publishing an Event (Example)

```
1. User fills form in CreateEvent.tsx
   ↓
2. EventManager.createEvent(data)
   ↓
3. Encrypt private fields with group key (NIP-17)
   ↓
4. Build Nostr event (kind: 31923)
   ↓
5. Sign event with user's private key
   ↓
6. NostrClient.publish(event)
   ↓
7. Send to multiple relays in parallel
   ↓
8. Cache locally in Dexie
   ↓
9. Update UI optimistically
```

### Receiving an Event

```
1. NostrClient receives event from relay subscription
   ↓
2. Validate signature and event structure
   ↓
3. Route to appropriate module by kind
   ↓
4. Module decrypts content (if encrypted)
   ↓
5. Store in local database
   ↓
6. Emit state change notification
   ↓
7. UI components re-render via hooks
```

## Security Architecture

### Key Management Hierarchy

```
Master Key (nsec)
├── Identity Key (derived)
├── Group Keys (per group, derived)
│   ├── Message Keys (ephemeral)
│   ├── Event Keys (ephemeral)
│   └── Voting Keys (ephemeral)
└── Signing Key (permanent)
```

### Permission System

**Roles**:
- `admin`: Full control over group
- `moderator`: Can manage members, events
- `member`: Standard participation
- `read-only`: Can view but not post

**Permission Check**:
```typescript
function canPerformAction(
  action: Action,
  user: User,
  group: Group
): boolean {
  const role = getUserRole(user, group);
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(action);
}
```

## State Management

Using Zustand for global state:

```typescript
// Store structure
{
  auth: {
    currentIdentity: Identity | null,
    identities: Identity[]
  },
  groups: {
    activeGroup: Group | null,
    groups: Group[],
    memberships: Membership[]
  },
  nostr: {
    relays: RelayStatus[],
    connected: boolean
  },
  modules: {
    events: EventsState,
    mutualAid: MutualAidState,
    governance: GovernanceState,
    ...
  }
}
```

## Network Layer

### Relay Selection Strategy

1. **Default Relays**: Public relays for basic connectivity
2. **Community Relays**: Specialized relays for activist groups
3. **Private Relays**: Self-hosted for high-security groups
4. **Tor Relays**: .onion addresses for anonymity

**Relay Health Monitoring**:
- Track connection success rate
- Measure latency
- Detect censorship
- Auto-failover to backup relays

## Performance Optimizations

### Event Caching
- Cache recent events in memory (LRU)
- Persist to IndexedDB for offline access
- Lazy load historical events

### Subscription Management
- Batch filter updates
- Close unused subscriptions
- Pagination for large result sets

### UI Rendering
- Virtual scrolling for long lists
- Debounced search/filter
- Optimistic UI updates
- React.memo for expensive components

## Deployment Architecture

### Client Deployment
- Static hosting (Vercel, Netlify, IPFS)
- Progressive Web App (PWA)
- Electron wrapper for desktop

### Relay Recommendations
- Minimum 3 relays for redundancy
- Geographic distribution
- Mix of public and community relays
- Optional: self-hosted relay

## Testing Strategy

```
src/
├── __tests__/
│   ├── unit/           # Unit tests for functions
│   ├── integration/    # Integration tests
│   └── e2e/            # End-to-end tests
```

**Test Coverage Goals**:
- Core crypto: 100%
- Nostr client: 90%
- Business logic: 80%
- UI components: 60%

## Monitoring & Observability

**Client-Side Metrics**:
- Relay connection success rates
- Message encryption/decryption times
- UI render performance
- Error rates by module

**Privacy-Preserving Analytics**:
- Local-only metrics (no telemetry)
- Optional anonymous usage stats
- User consent required

---

This architecture provides a solid foundation for a privacy-first, decentralized social action platform while maintaining flexibility for future enhancements.