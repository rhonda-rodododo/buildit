# Epic 77: Nostr Protocol Integration (Phase 2)

**Status**: Not Started
**Priority**: P1 - Protocol Foundation
**Effort**: 30-40 hours
**Platforms**: Web (primary), propagate to iOS/Android
**Dependencies**: None

---

## Context

Many features currently operate in local-only mode with Nostr integration deferred to "Phase 2." This epic implements the full Nostr protocol layer: broadcasting metadata, friend request notifications, presence, username search (NIP-05), publish retry, and loading public data from relays. These are foundational for the platform to function as a real decentralized social network.

**Source**: `clients/web/docs/TECH_DEBT.md` - Nostr Protocol Features section (10 items)

---

## Tasks

### Identity & Metadata Broadcasting (6-8h)

#### NIP-01 Metadata Broadcast
- [ ] Broadcast username/display name to Nostr relays as kind:0 event
- [ ] Broadcast updated metadata on profile changes
- [ ] Handle relay confirmation and retry on failure
- [ ] Respect user's relay list (NIP-65)
- **Files**: `clients/web/src/core/username/usernameManager.ts`

#### NIP-05 Username Search
- [ ] Implement NIP-05 identifier lookup (user@domain.com → pubkey)
- [ ] Add search UI in Add Friend dialog
- [ ] Cache NIP-05 results
- [ ] Handle verification failures gracefully
- **File**: `clients/web/src/modules/friends/AddFriendDialog.tsx`

### Social Protocol (8-10h)

#### Friend Request Notifications
- [ ] Send Nostr event to notify friend request recipient
- [ ] Send Nostr event to notify friend request sender on acceptance
- [ ] Handle friend request via NIP-17 (encrypted DM)
- [ ] Support friend request rejection/blocking
- **File**: `clients/web/src/modules/friends/friendsStore.ts`

#### Presence Updates
- [ ] Broadcast presence status via Nostr (online/away/offline)
- [ ] Query presence from Nostr for contacts
- [ ] Implement reasonable polling interval with backoff
- [ ] Respect privacy settings (opt-in presence)
- **File**: `clients/web/src/core/messaging/conversationsStore.ts`

#### Conversation Discovery
- [ ] Auto-create conversation threads from incoming NIP-17 messages
- [ ] Handle first-contact scenarios (new DM from unknown pubkey)
- [ ] Respect spam/block lists
- **File**: `clients/web/src/core/messaging/messageReceiver.ts`

### Public Content Loading (6-8h)

#### Campaign Data from Nostr
- [ ] Load campaign/fundraising data from Nostr public events
- [ ] Render on public campaign pages
- [ ] Cache with appropriate TTL
- **File**: `clients/web/src/pages/public/CampaignPage.tsx`

#### Public Wiki from Nostr
- [ ] Load public wiki pages from Nostr long-form events (kind:30023)
- [ ] Replace demo data with real relay queries
- [ ] Support wiki page versioning via Nostr replaceable events
- **File**: `clients/web/src/pages/public/PublicWikiPage.tsx`

### Reliability (4-6h)

#### Nostr Publish Retry
- [ ] Implement retry logic for failed Nostr publishes (separate from offline queue)
- [ ] Exponential backoff with jitter
- [ ] Track failed events for manual retry
- [ ] Alert user on persistent failures
- **File**: `clients/web/src/core/offline/queueProcessor.ts`

#### Event Invitation System
- [ ] Implement explicit event invitations via Nostr
- [ ] Send invitation events to specific pubkeys
- [ ] Handle RSVP responses
- **File**: `clients/web/src/modules/events/useEvents.ts`

### Cross-Platform Propagation (6-8h)
- [ ] Implement NIP-01 metadata broadcast on iOS
- [ ] Implement NIP-01 metadata broadcast on Android
- [ ] Implement friend request notifications on iOS/Android
- [ ] Implement presence on iOS/Android
- [ ] Ensure consistent behavior across all clients

---

## Acceptance Criteria

- [ ] User profile metadata broadcasts to configured relays on change
- [ ] NIP-05 username search resolves identifiers to pubkeys
- [ ] Friend requests send and receive encrypted notifications
- [ ] Presence status visible for contacts (opt-in)
- [ ] Public campaign and wiki pages load from Nostr relays
- [ ] Failed publishes retry automatically with backoff
- [ ] Event invitations send to specific pubkeys
- [ ] All features work consistently across web, iOS, and Android

---

## Privacy Considerations

- Presence updates reveal online status - must be opt-in per user
- NIP-05 lookup reveals interest in specific users - consider Tor routing
- Public content loading reveals which campaigns/wikis user views - relay logs
- Friend request metadata (who friends whom) visible to relays - NIP-17 mitigates

---

**Git Commit Format**: `feat(protocol): implement Nostr protocol integration (Epic 77)`
**Git Tag**: `v0.77.0-nostr-integration`
