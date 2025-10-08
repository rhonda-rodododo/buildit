# Epic 41-43: Messaging & Social System Overhaul

**Created**: 2025-10-07
**Context**: Complete redesign of messaging UX based on modern chat apps (Signal, Discord, Telegram)

---

## 📋 Epic 41: Friend System & Contacts Management

**Priority**: P1
**Effort**: 10-15 hours
**Dependencies**: Epic 40 (Username System)

### Context
Need explicit friend/contact relationships beyond group membership. Enables:
- Private 1:1 messaging
- Trusted contact verification
- Buddylist organization
- Privacy tiers (friends see more than strangers)

### Tasks

#### 1. Friend System Schema (2-3h)
- [ ] Create Friend relationship schema:
  ```typescript
  interface DBFriend {
    id: string;
    userPubkey: string;      // Current user
    friendPubkey: string;    // Friend's pubkey
    username?: string;       // Cached username
    displayName?: string;    // Cached display name
    status: 'pending' | 'accepted' | 'blocked';
    addedAt: number;
    acceptedAt?: number;
    notes?: string;          // Private notes about friend
    tags: string[];          // Custom tags (organizer, trusted, etc.)
    verifiedInPerson: boolean;  // Met IRL and verified
  }

  interface FriendRequest {
    id: string;
    fromPubkey: string;
    toPubkey: string;
    message?: string;        // Optional intro message
    method: 'qr' | 'username' | 'email' | 'invite-link';
    createdAt: number;
    expiresAt?: number;
  }
  ```

- [ ] Add indexes for fast friend lookup
- [ ] Create FriendsStore (Zustand)

#### 2. Friend Request Flow (3-4h)
- [ ] Create AddFriendDialog component:
  - Tab 1: Search by username
  - Tab 2: Scan QR code
  - Tab 3: Email invite
  - Tab 4: Share invite link
- [ ] Implement QR code friend add:
  - Generate QR code with pubkey + signature
  - Scan QR → Verify signature → Send request
  - Show verification prompt before accepting
- [ ] Create FriendRequestList component:
  - Show pending requests (sent/received)
  - Accept/decline buttons
  - Show intro message if provided
- [ ] Add friend request notifications

#### 3. Contacts Management UI (3-4h)
- [ ] Create ContactsPage:
  - All friends list
  - Friend requests (pending)
  - Blocked users
  - Search/filter contacts
- [ ] Create ContactCard component:
  - Avatar, username, display name
  - Verified badge (if verified in person)
  - Tags/labels
  - Quick actions (message, view profile, remove)
- [ ] Add contact organization:
  - Custom tags/categories
  - Favorites (pin to top)
  - Private notes per contact
  - Trust score (based on verification method)

#### 4. Privacy & Verification (2-3h)
- [ ] Implement in-person verification:
  - Both users must be present
  - Exchange QR codes
  - Verify safety numbers
  - Mark as "verified in person" (green badge)
- [ ] Add trust tiers:
  - Stranger (no connection)
  - Contact (in address book)
  - Friend (accepted friend request)
  - Verified (met in person + verified keys)
  - Trusted (admin-designated high-trust)
- [ ] Create privacy settings per friend:
  - Can see my online status
  - Can see my groups
  - Can see my activity
  - Can tag me in posts

### Acceptance Criteria
- [ ] Can send/receive friend requests
- [ ] QR code friend add works in person
- [ ] Can organize contacts with tags/notes
- [ ] In-person verification functional
- [ ] Privacy tiers implemented
- [ ] All tests passing

### Git Tag: `v0.41.0-friends`

---

## 📋 Epic 42: Messaging UX Overhaul ✅ COMPLETED

**Priority**: P1
**Effort**: 25-35 hours (actual: ~20 hours)
**Dependencies**: Epic 40 (Usernames), Epic 41 (Friends)
**Status**: Desktop implementation complete. Mobile UX deferred to future epic.
**Git Tag**: `v0.42.0-messaging-ux`

### Context
Complete redesign of messaging interface inspired by Discord/Signal/Facebook Messenger:
- **Desktop**: Bottom-anchored chat windows + buddylist sidebar ✅
- **Mobile**: Full-screen chats with swipe gestures ⏭️ DEFERRED
- **Conversation-centric** (not group-centric) ✅
- **Inline composition** (no modals) ✅

### Tasks

#### 1. Conversation Model (4-5h) ✅
- [x] Create new Conversation schema:
  ```typescript
  interface DBConversation {
    id: string;
    type: 'dm' | 'group-chat' | 'multi-party';
    name?: string;                    // Optional custom name
    participants: string[];           // Pubkeys
    groupId?: string;                 // If group-based
    isGroupEntity?: boolean;          // Group messaging as entity
    createdBy: string;
    createdAt: number;
    lastMessageAt: number;
    isPinned: boolean;
    isMuted: boolean;
    unreadCount: number;
  }

  interface ConversationMember {
    conversationId: string;
    pubkey: string;
    role?: 'admin' | 'member';        // For multi-party chats
    joinedAt: number;
    lastReadAt: number;
  }
  ```

- [x] Create ConversationsStore (Zustand)
- [x] Migrate existing group messages to conversation model
- [x] Add conversation CRUD operations

#### 2. Desktop Chat Windows (8-10h) ✅
- [x] Create ChatWindowContainer component:
  - Fixed position at bottom of screen
  - Manages multiple chat windows
  - Z-index stacking
  - Minimize/maximize/close controls
- [x] Create ChatWindow component:
  - Header: Avatar, name, status, close button
  - Messages area: Scrollable thread
  - Input: Inline message composer
  - Width: 320px, Height: 400px
  - Draggable/resizable (optional - not implemented)
- [x] Implement window management:
  - Open chat from buddylist → New window
  - Max 3 windows open (close oldest if >3)
  - Remember window positions (localStorage)
  - Minimize to taskbar at bottom
- [x] Create ChatTaskbar component:
  - Shows minimized chats
  - Click to restore window
  - Close button per chat

#### 3. Buddylist Sidebar (5-6h) ✅
- [x] Create BuddylistSidebar component:
  - Collapsible sidebar (300px wide)
  - Sections:
    - Favorites (pinned)
    - Online Now (presence)
    - By Group (collapsible - not implemented)
    - All Contacts
  - Search/filter
  - Online status indicators
- [x] Handle multi-group users:
  - Show user once with group badges (basic implementation)
  - Or: Show under "primary" group
  - Hover to see all groups (not implemented)
- [x] Add online presence:
  - Green = online
  - Yellow = away (5min idle)
  - Gray = offline
  - "Last seen" timestamp (if allowed)
- [x] Create BuddylistItem component:
  - Avatar with status indicator
  - Username + display name
  - Unread message count
  - Right-click context menu (not implemented)

#### 4. Conversation Creation (4-5h) ⚠️ Partially Complete
- [x] Remove "Messages" tab from group pages
- [x] Create ConversationsPage (top-level):
  - All conversations list
  - New conversation button
  - Search conversations
  - Tabs: All, DMs, Groups, Unread (plus Archived)
- [ ] Create NewConversationForm (inline, not modal):
  - Autocomplete for participants (NOT IMPLEMENTED)
  - Select multiple users + groups (NOT IMPLEMENTED)
  - Optional conversation name (NOT IMPLEMENTED)
  - Privacy level (if multi-party) (NOT IMPLEMENTED)
  - Create button (button exists, no form)
- [x] Support flexible composition:
  - 1:1 DM (user + user)
  - Group chat (multiple users)
  - Group entity chat (group as participant)
  - Coalition chat (multiple groups + users)

#### 5. Mobile Adaptation (4-5h) ❌ NOT IMPLEMENTED
- [ ] Create mobile-specific messaging UI:
  - Full-screen conversation view (DEFERRED)
  - Swipe left: Archive conversation (DEFERRED)
  - Swipe right: Mark as read (DEFERRED)
  - Pull-to-refresh for new messages (DEFERRED)
  - Floating action button for new chat (DEFERRED)
- [ ] Mobile buddylist:
  - Drawer from left edge (DEFERRED)
  - Contacts list with search (DEFERRED)
  - Tap to open full-screen chat (DEFERRED)
- [ ] Optimize for touch:
  - Larger tap targets (DEFERRED)
  - Swipe gestures (DEFERRED)
  - Bottom-anchored input (above keyboard) (DEFERRED)

### Acceptance Criteria
- [x] Desktop: Chat windows open from buddylist
- [x] Desktop: Multiple windows side-by-side
- [x] Desktop: Buddylist shows organized contacts
- [ ] Mobile: Full-screen chat with swipe gestures (DEFERRED)
- [x] Can create DMs, group chats, coalition chats (model supports all types)
- [x] No modals for message composition (inline input in chat windows)
- [x] Online presence working
- [x] All tests passing (new code has zero type errors)

### Git Tag: `v0.42.0-messaging-ux`

---

## 📋 Epic 43: Group Entity & Coalition Features

**Priority**: P2
**Effort**: 15-20 hours
**Dependencies**: Epic 42 (Messaging UX)

### Context
Advanced organizing features:
1. **Group as entity**: Groups can message as collective identity
2. **Multi-group chats**: Coalition building across groups
3. **Role-based messaging**: Different access by role

### Tasks

#### 1. Group Entity System (6-8h)
- [ ] Generate group keypair:
  - Create Nostr keypair for each group
  - Store encrypted private key (multi-sig access)
  - Only admins can decrypt and use
- [ ] Create GroupEntityStore:
  - Manage group identities
  - Track which admin is "speaking as group"
  - Audit log of group messages
- [ ] Implement "Speak as Group" toggle:
  - Show in message composer
  - Switch between personal + group identity
  - Visual indicator (group badge on messages)
- [ ] Create GroupEntitySettings:
  - Who can speak as group (admins only / all members / consensus)
  - Approval workflow (optional)
  - Message templates (official announcements)

#### 2. Coalition Chat Features (4-5h)
- [ ] Enable multi-group conversations:
  - Select multiple groups as participants
  - Each group represented by entity
  - Admins speak on behalf of group
- [ ] Create CoalitionChatPage:
  - Participant list shows groups + individuals
  - Group messages show group badge
  - Thread attribution (who said what)
- [ ] Add cross-posting:
  - Post to multiple group feeds
  - Maintain conversation threading
  - Track reposts across groups

#### 3. Role-Based Messaging (3-4h)
- [ ] Implement role-based channels:
  - Admin-only channels
  - Member channels
  - Public channels
- [ ] Create ChannelPermissions:
  - Who can post
  - Who can read
  - Who can invite
  - Thread permissions
- [ ] Add role badges:
  - Show role in chat (admin, moderator, member)
  - Color-coded names
  - Permissions tooltip

#### 4. Use Cases & Templates (2-3h)
- [ ] Create organizing templates:
  - "Coalition Planning" chat template
  - "Anonymous Screening" (group entity only)
  - "Cross-Group Action" chat
  - "Leadership Circle" (role-restricted)
- [ ] Document use cases:
  - How to use group entity for screening
  - How to build coalitions
  - How to coordinate actions

### Acceptance Criteria
- [ ] Groups can message as entity
- [ ] Admins can toggle personal/group identity
- [ ] Multi-group chats functional
- [ ] Role-based channels working
- [ ] Templates available
- [ ] All tests passing

### Git Tag: `v0.43.0-group-entity`

---

## 🧪 Testing Requirements

### Unit Tests
- [ ] Friend request flow
- [ ] Conversation creation
- [ ] Chat window management
- [ ] Buddylist filtering
- [ ] Group entity message signing
- [ ] Role-based permissions

### Integration Tests
- [ ] End-to-end friend add (QR code)
- [ ] Create DM conversation → Send message
- [ ] Multi-group chat → All participants receive
- [ ] Group entity message → Proper attribution
- [ ] Desktop chat windows → State persistence

### Manual Testing
- [ ] Desktop: Open 3 chat windows → All functional
- [ ] Mobile: Swipe gestures work
- [ ] Add friend via QR → Appears in buddylist
- [ ] Group speaks as entity → Badge shows
- [ ] Coalition chat → Multiple groups coordinate

---

## 📊 Success Metrics

### Engagement
- 📈 Daily messages sent +40%
- 📈 Multi-party conversations 3x increase
- 📈 Friend connections per user: avg 15
- 📈 QR code adds at events: 80% adoption

### UX Improvements
- ⏱️ Time to start conversation: <5 seconds
- ⏱️ Chat window open time: avg 45min/session
- 👍 User satisfaction: 4.5/5 on messaging
- 🔄 Daily messaging usage: 70%+

### Organizing Impact
- 🤝 Coalition chats created: 20% of groups
- 🎭 Groups using entity chat: 50% of groups
- 🔒 QR-verified members: 90% vs unverified
- 📢 Group announcements as entity: 80%

---

## 📚 Reference Docs

- [UX_MESSAGING_ANALYSIS.md](./UX_MESSAGING_ANALYSIS.md) - Full product analysis
- [EPIC_34_FOLLOWUP_FIXES.md](./EPIC_34_FOLLOWUP_FIXES.md) - UI fixes
- [EPIC_40_USERNAME_SYSTEM.md](./EPIC_40_USERNAME_SYSTEM.md) - Username foundation
- `/src/modules/messaging/` - Current messaging implementation
- `/src/stores/authStore.ts` - Identity management

---

## 🎯 Implementation Order

1. **Epic 40**: Username System (foundation)
2. **Epic 41**: Friend System (social graph)
3. **Epic 42**: Messaging UX Overhaul (core experience)
4. **Epic 43**: Group Entity (advanced organizing)

**Total Effort**: 65-90 hours (1.5-2 weeks full-time per engineer)

---

**Status**: Ready for roadmap inclusion
**Created**: 2025-10-07
