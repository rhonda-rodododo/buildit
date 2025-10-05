# Epic 21: Social Feed & Microblogging - User Stories

**Epic**: Social Feed & Microblogging
**Priority**: P0 (Must Have for v2.0.0-social)
**Estimated Duration**: 4 weeks
**Dependencies**: Messaging module (complete), Contacts (complete), Media encryption (complete)

---

## Overview

Transform BuildIt Network from an organizing toolkit into a **privacy-preserving social action network** by adding:
1. Microblogging (Twitter-like posts)
2. Activity feed (unified timeline)
3. Comments & reactions (threaded discussions)
4. Social discovery (hashtags, trending)

---

## Epic 21.1: Microblogging Module (1.5 weeks)

### User Story 1.1: Create Text Post
**As a** union organizer
**I want to** post text updates about our campaign
**So that** my followers and group members can stay informed

**Acceptance Criteria**:
- [ ] Post creation dialog with textarea (max 5000 characters)
- [ ] Character counter showing remaining characters
- [ ] Privacy selector: Public, Followers, Group, Private
- [ ] Preview before posting
- [ ] Post button publishes to Nostr relays
- [ ] Success notification with link to post
- [ ] Error handling for network failures

**Technical Notes**:
- Nostr event kind: 1 (public post) or NIP-17 (private post)
- Store in `posts` table (create in schema)
- Encrypt content if privacy != "Public"
- Include group tags if Group privacy

**UI Mockup**:
```
┌─ Create Post ────────────────────────────┐
│ What's happening in your organizing?     │
│                                           │
│ ┌─────────────────────────────────────┐ │
│ │ [Textarea for post content]         │ │
│ │                                      │ │
│ │                                      │ │
│ │                                      │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ 📷 Add media   🔒 Public ▼   [Cancel] [Post] │
│                                 4999/5000  │
└───────────────────────────────────────────┘
```

---

### User Story 1.2: Add Media to Post
**As an** activist
**I want to** attach images and videos to my posts
**So that** I can share visual documentation of actions

**Acceptance Criteria**:
- [ ] Upload button opens file picker
- [ ] Support images (JPEG, PNG, GIF, WebP)
- [ ] Support videos (MP4, WebM, max 100MB)
- [ ] Drag-and-drop to upload
- [ ] Image preview with remove button
- [ ] EXIF stripping (privacy)
- [ ] Optional content warning checkbox
- [ ] Blur sensitive images by default (with toggle)

**Technical Notes**:
- Reuse MediaUploader component (already built in Epic 12.3)
- Encrypt media if post is private
- Upload to NIP-96 server or IPFS
- Store media URL/hash in post event

---

### User Story 1.3: Set Post Privacy Level
**As a** group admin
**I want to** control who can see my posts
**So that** I can share sensitive info only with trusted members

**Acceptance Criteria**:
- [ ] Privacy dropdown with 4 options:
  - Public: Anyone can see (Nostr kind 1)
  - Followers: Only people who follow me (NIP-17)
  - Group: Only my group members (NIP-17 + group tag)
  - Private: Only mentioned users (NIP-17)
- [ ] Icon showing current privacy level
- [ ] Warning if posting publicly with Tor disabled
- [ ] Remember last used privacy setting per context

**Privacy Implementations**:
- **Public**: Standard Nostr kind 1 event (plaintext)
- **Followers**: NIP-17 gift-wrapped, recipients = follower list
- **Group**: NIP-17 gift-wrapped, recipients = group members
- **Private**: NIP-17 gift-wrapped, recipients = @mentioned users only

---

### User Story 1.4: View Post Feed Card
**As a** user
**I want to** see posts in my feed with author info and actions
**So that** I can engage with content

**Acceptance Criteria**:
- [ ] Post card shows:
  - Author avatar, name, timestamp
  - Post text (with @mention highlights)
  - Media (if attached)
  - Privacy indicator (🌍 Public, 🔒 Private, 👥 Group)
  - Action buttons: Like, Comment, Share
  - Like count, comment count
- [ ] Click post to view full detail page
- [ ] Click author to view profile
- [ ] Click @mention to view mentioned user
- [ ] Long posts truncated with "Show more" button

**UI Mockup**:
```
┌─ Post Card ──────────────────────────────┐
│ 👤 Sarah (Union Organizer)  · 2h ago · 🔒│
│                                           │
│ We just won our first contract! 💪      │
│ After 6 months of organizing, 87% of     │
│ workers voted YES. Solidarity works!      │
│                                           │
│ [Image: Workers celebrating]              │
│                                           │
│ 👍 24   💬 8   🔄 Share                   │
└───────────────────────────────────────────┘
```

---

### User Story 1.5: Edit/Delete Own Post
**As a** user
**I want to** edit or delete my posts
**So that** I can fix mistakes or remove outdated info

**Acceptance Criteria**:
- [ ] "..." menu on own posts shows Edit, Delete
- [ ] Edit opens dialog with current content
- [ ] Edited posts show "Edited" timestamp
- [ ] Delete shows confirmation dialog
- [ ] Deleted posts removed from feed and Nostr relays
- [ ] Cannot edit if already has comments (show warning)

**Technical Notes**:
- Nostr kind 5 (deletion) event to delete
- Store edit history in `postEdits` table
- Show edit indicator on card

---

### User Story 1.6: Content Warnings
**As a** user posting sensitive content
**I want to** add content warnings
**So that** others can choose whether to view it

**Acceptance Criteria**:
- [ ] "Add content warning" checkbox in composer
- [ ] Text input for warning label (e.g., "Violence", "NSFW")
- [ ] Posts with CW show blurred content + warning label
- [ ] "Show anyway" button to reveal
- [ ] User preference: "Always show content warnings" (auto-reveal)

---

## Epic 21.2: Activity Feed System (1 week)

### User Story 2.1: Following Feed
**As a** user
**I want to** see posts from people I follow in chronological order
**So that** I can stay updated on their organizing work

**Acceptance Criteria**:
- [ ] Feed shows posts from followed users (NIP-02 contact list)
- [ ] Real-time updates (new posts appear with "X new posts" banner)
- [ ] Chronological order (newest first)
- [ ] Infinite scroll (load 50 posts at a time)
- [ ] Pull-to-refresh on mobile
- [ ] Empty state: "Follow users to see their posts here"

**Technical Notes**:
- Nostr REQ filter: authors = [followed pubkeys]
- Subscribe to live updates (WebSocket)
- Use @tanstack/react-virtual for virtualization
- Cache last 500 posts in IndexedDB

---

### User Story 2.2: Public Feed
**As a** user
**I want to** explore public posts from the wider community
**So that** I can discover new organizers and movements

**Acceptance Criteria**:
- [ ] Public feed shows all public posts (kind 1)
- [ ] Filter by hashtag (e.g., #Strike, #MutualAid)
- [ ] Sort by: Recent, Popular (most reactions in 24h)
- [ ] No personalization (privacy-preserving)
- [ ] Opt-in only (not default feed)

**Technical Notes**:
- Nostr REQ: kind 1, limit 100
- No tracking of user preferences
- Popularity = count reactions in last 24h

---

### User Story 2.3: Group Feed
**As a** group member
**I want to** see activity from my group (posts, events, proposals)
**So that** I can stay informed about group work

**Acceptance Criteria**:
- [ ] Aggregates:
  - Posts from group members
  - New events created
  - New proposals
  - Mutual aid requests/offers
  - Wiki page updates
- [ ] Filter by content type (All, Posts, Events, Proposals, etc.)
- [ ] Group selector dropdown (if member of multiple groups)
- [ ] Notification badge on new activity

**Technical Notes**:
- Query multiple tables: posts, events, proposals, aidRequests, wikiPages
- Unified activity type with discriminated union
- Sort by timestamp descending

---

### User Story 2.4: Real-Time Feed Updates
**As a** user
**I want to** see new posts appear in real-time
**So that** I can engage with fresh content immediately

**Acceptance Criteria**:
- [ ] New posts arrive via Nostr subscriptions (no polling)
- [ ] "X new posts" banner at top of feed
- [ ] Click banner to scroll to top and load new posts
- [ ] Auto-load if already at top (user preference)
- [ ] Smooth animations for new posts appearing

**Technical Notes**:
- WebSocket Nostr subscription (REQ)
- Optimistic UI updates (show immediately, confirm later)
- Deduplicate events (same ID from multiple relays)

---

### User Story 2.5: Feed Virtualization (Performance)
**As a** user
**I want to** scroll through thousands of posts smoothly
**So that** the app doesn't slow down or crash

**Acceptance Criteria**:
- [ ] Only render visible posts (~20 DOM nodes)
- [ ] Smooth scroll (60fps)
- [ ] Dynamic row heights (posts vary in length)
- [ ] Load more on scroll to bottom
- [ ] No jank when scrolling fast

**Technical Notes**:
- Use @tanstack/react-virtual (already installed)
- Overscan: 10 posts above/below viewport
- Measure post heights dynamically
- Estimated height: 200px per post

---

## Epic 21.3: Comments & Reactions (1 week)

### User Story 3.1: Comment on Post
**As a** user
**I want to** comment on posts
**So that** I can participate in discussions

**Acceptance Criteria**:
- [ ] Comment button on post card opens comment composer
- [ ] Composer supports:
  - Text (max 2000 chars)
  - @mentions (autocomplete)
  - Emoji picker
  - Content warning toggle
- [ ] Post comment button publishes to Nostr
- [ ] Comment appears immediately (optimistic UI)
- [ ] Comment inherits privacy level of parent post

**Technical Notes**:
- Nostr kind: 1 (public comment) or NIP-17 (private)
- Tag parent post with `["e", postId, "", "root"]`
- Store in `comments` table
- Encrypt if parent post is encrypted

---

### User Story 3.2: View Threaded Comments
**As a** user
**I want to** see threaded comments on posts
**So that** I can follow conversations

**Acceptance Criteria**:
- [ ] Comments shown below post
- [ ] Threading up to 5 levels deep
- [ ] Indent each level (visual hierarchy)
- [ ] "Reply" button on each comment
- [ ] Collapse/expand threads
- [ ] Load more comments (pagination)
- [ ] Sort by: Recent, Popular (most reactions)

**UI Mockup**:
```
┌─ Post ───────────────────────────────────┐
│ 👤 Sarah: We won our first contract!     │
│ ...                                       │
│                                           │
│ 💬 8 Comments                             │
│                                           │
│ 👤 Alex · 1h ago                          │
│    Congratulations! What was your key    │
│    tactic?                                │
│    👍 3  💬 Reply                         │
│                                           │
│    ├─ 👤 Sarah · 45m ago                 │
│    │     1-on-1 conversations were key.  │
│    │     We talked to 150+ workers.      │
│    │     👍 5  💬 Reply                   │
│    │                                      │
│    └─ 👤 Jamal · 30m ago                 │
│          We should try this approach!    │
│          👍 2  💬 Reply                   │
│                                           │
│ [Show 4 more comments]                    │
└───────────────────────────────────────────┘
```

---

### User Story 3.3: React to Posts
**As a** user
**I want to** react to posts with emoji
**So that** I can express support without writing a comment

**Acceptance Criteria**:
- [ ] Reaction button shows picker with:
  - 👍 Like
  - ❤️ Love
  - 🔥 Fire
  - 💪 Solidarity
  - ✊ Resistance
  - 🏴 Anarchist (optional, user preference)
- [ ] Click reaction to add/remove
- [ ] Show reaction counts (no user list for privacy)
- [ ] Animate reaction when added
- [ ] My reactions highlighted

**Technical Notes**:
- Nostr kind: 7 (reaction)
- Tag post with `["e", postId]`
- Content: emoji character
- Don't show who reacted (privacy)

---

### User Story 3.4: Edit/Delete Comments
**As a** user
**I want to** edit or delete my comments
**So that** I can fix mistakes

**Acceptance Criteria**:
- [ ] "..." menu on own comments
- [ ] Edit updates comment in-place
- [ ] Delete removes from feed
- [ ] Deleted comments show "[Deleted]" if has replies
- [ ] Cannot edit if >1 hour old (prevent abuse)

---

### User Story 3.5: Comment Notifications
**As a** user
**I want to** be notified when someone comments on my post
**So that** I can respond to engagement

**Acceptance Criteria**:
- [ ] Browser notification: "@User commented on your post"
- [ ] In-app notification badge
- [ ] Notification center shows comment preview
- [ ] Click notification navigates to post
- [ ] Mark as read on view
- [ ] User preference: disable comment notifications

**Technical Notes**:
- Listen for Nostr kind 1 events tagging my posts
- Store in `notifications` table
- Deduplicate (one notification per post, update count)

---

### User Story 3.6: Report Spam/Abuse
**As a** user
**I want to** report spam or abusive comments
**So that** moderators can take action

**Acceptance Criteria**:
- [ ] "Report" option in comment menu
- [ ] Report dialog with categories:
  - Spam
  - Harassment
  - Misinformation
  - Violence/Threats
  - Other (text input)
- [ ] Submit sends report to:
  - Group admins (if group post)
  - Relay operators (if public post)
- [ ] User can block author (hide all their content)

**Technical Notes**:
- Nostr kind: 1984 (reporting)
- Tag reported event and author
- Store in `reports` table
- Admins see report queue in group settings

---

## Epic 21.4: Social Discovery (0.5 weeks, Optional)

### User Story 4.1: Hashtag Posts
**As a** user
**I want to** add hashtags to my posts
**So that** others can discover content by topic

**Acceptance Criteria**:
- [ ] Type # in post composer shows autocomplete
- [ ] Suggest popular hashtags (#Strike, #MutualAid, #Housing, etc.)
- [ ] Hashtags clickable in feed (navigate to tag page)
- [ ] Tag page shows all posts with that hashtag
- [ ] Posts can have multiple hashtags (max 10)

**Technical Notes**:
- Nostr tag: `["t", "hashtag"]`
- Query: filter by tag
- Popular hashtags: most used in last 7 days (per group)

---

### User Story 4.2: Trending Topics
**As a** user
**I want to** see trending hashtags in my community
**So that** I can discover important discussions

**Acceptance Criteria**:
- [ ] Trending sidebar shows top 5 hashtags (last 24h)
- [ ] Only from followed users + group (no global tracking)
- [ ] Trend count: number of posts with tag
- [ ] Click to view tag page
- [ ] Refresh every 15 minutes

**Privacy Note**:
- No global trending (metadata leak)
- Only calculate from user's network (following + group)
- No tracking of individual views

---

### User Story 4.3: Suggested Follows
**As a** new user
**I want to** discover organizers to follow
**So that** my feed isn't empty

**Acceptance Criteria**:
- [ ] Suggestions based on:
  - Group members (if in a group)
  - Popular users in hashtags I view
  - Mutual follows (friends of friends)
- [ ] No algorithmic recommendations (privacy)
- [ ] "Discover" page with user cards
- [ ] Follow button on each card
- [ ] Skip/dismiss suggestions

**Privacy Note**:
- No tracking of user interests
- Suggestions only from user's explicit actions (joined group, viewed hashtag)

---

## Technical Architecture

### Database Schema (New Tables)

```typescript
// posts table
interface DBPost {
  id: string;                    // Nostr event ID
  authorPubkey: string;
  content: string;               // Plaintext or encrypted
  media: MediaAttachment[];      // Images, videos
  privacy: 'public' | 'followers' | 'group' | 'private';
  groupId?: string;              // If group post
  contentWarning?: string;
  hashtags: string[];
  created: number;
  edited?: number;
  nostrEvent: NostrEvent;        // Full event for re-publishing
}

// comments table
interface DBComment {
  id: string;                    // Nostr event ID
  postId: string;                // Parent post
  parentCommentId?: string;      // For threading
  authorPubkey: string;
  content: string;
  depth: number;                 // 0-5 (max 5 levels)
  created: number;
  edited?: number;
  nostrEvent: NostrEvent;
}

// reactions table
interface DBReaction {
  id: string;                    // Nostr event ID
  targetId: string;              // Post or comment ID
  targetType: 'post' | 'comment';
  authorPubkey: string;
  emoji: string;                 // 👍 ❤️ 🔥 💪 ✊
  created: number;
}

// activity table (unified feed)
interface DBActivity {
  id: string;
  type: 'post' | 'event' | 'proposal' | 'aidRequest' | 'wikiUpdate';
  entityId: string;              // ID of post, event, etc.
  groupId?: string;
  authorPubkey: string;
  timestamp: number;
  content: string;               // Preview text
  metadata: Record<string, any>; // Type-specific data
}
```

### Nostr Event Kinds

- **Kind 1**: Public post (short note)
- **Kind 5**: Deletion event
- **Kind 7**: Reaction
- **Kind 1984**: Reporting (NIP-56)
- **NIP-17**: Private post/comment (gift-wrapped)

### Component Structure

```
src/modules/microblogging/
├── index.ts                     # Module registration
├── schema.ts                    # DB tables
├── types.ts                     # TypeScript interfaces
├── microblogStore.ts           # Zustand store
├── components/
│   ├── PostComposer.tsx        # Create post dialog
│   ├── PostCard.tsx            # Feed item
│   ├── PostDetail.tsx          # Full post view
│   ├── CommentList.tsx         # Threaded comments
│   ├── CommentComposer.tsx     # Write comment
│   ├── ReactionPicker.tsx      # Emoji reactions
│   ├── PrivacySelector.tsx     # Privacy dropdown
│   └── ContentWarning.tsx      # CW overlay
├── hooks/
│   ├── usePosts.ts             # Post CRUD
│   ├── useComments.ts          # Comment CRUD
│   └── useReactions.ts         # Reaction CRUD
└── i18n/
    └── en.json                  # Translations

src/modules/feed/
├── index.ts
├── components/
│   ├── ActivityFeed.tsx        # Main feed component
│   ├── FeedFilters.tsx         # Type/sort filters
│   ├── FeedItem.tsx            # Polymorphic feed item
│   └── EmptyFeed.tsx           # Empty state
└── hooks/
    └── useActivityFeed.ts      # Fetch and subscribe
```

### State Management (Zustand)

```typescript
interface MicroblogStore {
  // Posts
  posts: Map<string, DBPost>;
  createPost: (content: string, media: MediaAttachment[], privacy: Privacy) => Promise<void>;
  editPost: (postId: string, content: string) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;

  // Comments
  comments: Map<string, DBComment>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;

  // Reactions
  reactions: Map<string, DBReaction[]>;
  addReaction: (targetId: string, emoji: string) => Promise<void>;
  removeReaction: (targetId: string, emoji: string) => Promise<void>;

  // Feed
  feedItems: ActivityItem[];
  loadFeed: (feedType: 'following' | 'public' | 'group', groupId?: string) => Promise<void>;
  subscribeToFeed: () => () => void;  // Returns unsubscribe function
}
```

---

## Testing Plan

### Unit Tests

**Epic 21.1: Microblogging**
- [ ] Post creation (public, private, group)
- [ ] Privacy level encryption logic
- [ ] Media attachment handling
- [ ] Content warning validation
- [ ] Hashtag extraction

**Epic 21.2: Feed**
- [ ] Feed aggregation (multiple content types)
- [ ] Real-time subscription
- [ ] Virtualization (render only visible)
- [ ] Filter by content type
- [ ] Sort by timestamp

**Epic 21.3: Comments**
- [ ] Threaded comment creation
- [ ] Reply depth limiting (max 5)
- [ ] Comment reactions
- [ ] Notification generation
- [ ] Report submission

### Integration Tests

- [ ] Post → Nostr relay → IndexedDB → Feed display
- [ ] Comment → Notification → Mark read
- [ ] Reaction → Count update → UI refresh
- [ ] Delete post → Remove from all feeds

### E2E Tests (Playwright)

**Scenario 1: Create and View Post**
1. User creates public post with image
2. Post appears in Following feed
3. Other user sees post in Public feed
4. Click post to view detail page

**Scenario 2: Threaded Discussion**
1. User A posts question
2. User B comments with answer
3. User A replies to comment (thread level 2)
4. User C comments on reply (thread level 3)
5. All see threaded conversation

**Scenario 3: Privacy Levels**
1. Create group post (only members see)
2. Create follower-only post
3. Create public post
4. Verify visibility per privacy level

---

## Success Metrics

### Engagement KPIs
- **Posts per user per day**: Target 0.5 (1 post every 2 days)
- **Comments per post**: Target 3+ average
- **Reaction rate**: Target 30% of posts get reactions
- **Thread depth**: Average 2-3 levels (good discussions)

### Technical KPIs
- **Feed load time**: <1 second for 50 posts
- **Real-time latency**: New posts appear within 3 seconds
- **Scroll performance**: 60fps on mobile (virtualization)
- **Encryption overhead**: <100ms per post (NIP-17)

### Privacy KPIs
- **Encrypted posts**: 80%+ use Private/Group/Followers privacy
- **Tor usage**: 20%+ of users post via Tor
- **Metadata protection**: Timestamps randomized (±2 days) for private posts

---

## Open Questions

1. **Post Length Limit**: 5000 chars enough? (Twitter = 280, Mastodon = 500, Nostr common = 5000)
2. **Media Size Limits**: 100MB video ok? (Could be slow on mobile)
3. **Reaction Customization**: Allow groups to define custom emoji reactions?
4. **Comment Pagination**: Load all comments or paginate? (Could be 100+ comments)
5. **Public Timeline**: Opt-in or default? (Privacy vs. discovery tradeoff)
6. **Hashtag Moderation**: Who can create hashtags? (Open vs. curated)

---

## Dependencies & Blockers

### External Dependencies
- ✅ Nostr relays (already configured)
- ✅ Media encryption (Epic 12.3 complete)
- ✅ User contacts/following (Epic 12.1 complete)
- ✅ @mention autocomplete (Epic 12.2 complete)

### Internal Dependencies
- ⏳ TipTap or Lexical editor (for rich text posts) - **Need to choose**
- ⏳ Link preview service (privacy-safe) - **Need to build or find**
- ⏳ Hashtag extraction logic - **Build from scratch**

### Potential Blockers
- **Relay Performance**: If relays are slow, real-time feed will lag
  - Mitigation: Use 5+ relays, cache aggressively
- **Encryption Overhead**: NIP-17 is slow for large groups
  - Mitigation: Encrypt in web worker (non-blocking)
- **Storage Limits**: IndexedDB quotas could be hit with media
  - Mitigation: Compress images, archive old posts

---

## Launch Checklist (Epic 21 Complete)

### Feature Completeness
- [ ] All user stories implemented and tested
- [ ] Edge cases handled (offline, slow network, empty states)
- [ ] Error messages user-friendly
- [ ] Loading states smooth (skeleton screens)

### Performance
- [ ] Lighthouse score >90
- [ ] Feed loads in <1 second
- [ ] Scroll at 60fps on mobile
- [ ] Bundle size <500KB initial load

### Privacy & Security
- [ ] NIP-17 encryption working for private posts
- [ ] Metadata randomization for timestamps
- [ ] Content warnings enforced
- [ ] Report/block tools functional

### UX & Accessibility
- [ ] Responsive on mobile/tablet/desktop
- [ ] Keyboard navigation works
- [ ] Screen reader compatible (ARIA labels)
- [ ] Dark mode support

### Documentation
- [ ] User guide: "How to post and engage"
- [ ] Privacy guide: "Understanding post privacy levels"
- [ ] Troubleshooting: Common issues and fixes

---

*Epic 21 User Stories - Ready for Implementation*
*Created: 2025-10-05*
*Owner: Product Management*
*Target: v2.0.0-social Launch*
