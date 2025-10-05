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

### 3. Storage Layer

**Purpose**: Local-first data persistence with IndexedDB

**Schema**:
```typescript
// Dexie database schema
{
  identities: 'pubkey, name, created',
  groups: 'id, name, adminPubkey, created',
  groupMembers: '[groupId+pubkey], groupId, pubkey, role',
  messages: 'id, groupId, authorPubkey, timestamp',
  events: 'id, groupId, title, startTime',
  rsvps: '[eventId+pubkey], eventId, pubkey, status',
  proposals: 'id, groupId, status, created',
  votes: '[proposalId+voterPubkey], proposalId, voterPubkey',
  contacts: 'id, groupId, name, email',
  wikiPages: 'id, groupId, title, updated'
}
```

**Files**:
```
src/core/storage/
├── db.ts               # Dexie database definition
├── cache.ts            # Event caching strategy
├── sync.ts             # Sync with Nostr relays
└── migrations.ts       # Schema version migrations
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
  enabledModules: ModuleConfig[];
  groupKey?: string;       // Encrypted group key
}

interface ModuleConfig {
  module: 'events' | 'mutual-aid' | 'governance' | 'wiki' | 'crm';
  enabled: boolean;
  settings: Record;
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
    ["admin", "admin-pubkey-2"]
  ]
}
```

### Module System

Each module follows a consistent pattern:

**Module Interface**:
```typescript
interface Module {
  id: string;
  name: string;
  initialize(group: Group): Promise;
  getEventKinds(): number[];
  handleEvent(event: NostrEvent): Promise;
  renderUI(): React.ComponentType;
}
```

**Event Module Example**:
```
src/modules/events/
├── types.ts            # TypeScript interfaces
├── EventManager.ts     # Business logic
├── nostr.ts            # Nostr event handling
├── components/
│   ├── EventList.tsx
│   ├── EventDetail.tsx
│   ├── CreateEvent.tsx
│   └── RSVPButton.tsx
└── hooks/
    ├── useEvents.ts
    └── useRSVPs.ts
```

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