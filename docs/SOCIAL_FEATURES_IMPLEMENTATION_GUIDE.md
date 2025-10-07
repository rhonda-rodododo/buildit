# BuildIt Network - Social Features Implementation Checklist

**Quick Reference**: Feature-by-feature implementation guide
**Full Strategy**: [SOCIAL_FEATURES_STRATEGY.md](./SOCIAL_FEATURES_STRATEGY.md)
**Executive Summary**: [SOCIAL_FEATURES_EXECUTIVE_SUMMARY.md](./SOCIAL_FEATURES_EXECUTIVE_SUMMARY.md)

---

## Epic 21: Microblogging & Activity Feed (4 hours) - **MVP+1 PRIORITY**

### 21.1: Posts Module (2h)

**Database Schema:**
- [ ] Create `posts` table in database schema
  - id, content, privacy, authorPubkey, createdAt, updatedAt
  - media (array of MediaAttachment), replyTo, quotedPost
  - hashtags (array), mentions (array of npubs)
  - groupId, encryptedFor (for followers-only)

**Store & Manager:**
- [ ] Create `postsStore.ts` (Zustand)
  - posts: Map<string, Post>
  - createPost, updatePost, deletePost
  - getPost, getPosts, getPostsByAuthor, getPostsByHashtag
  - publishPost (Nostr kind 1 event)
  - syncPosts (fetch from relays)

**Nostr Integration:**
- [ ] Implement Post events (NIP-01 kind 1)
- [ ] Publish posts to relays
- [ ] Subscribe to posts (author feed, hashtag feed, mentions)
- [ ] Handle encrypted posts (followers-only, group, direct-action)

**UI Components:**
- [ ] `PostComposer.tsx` (create new posts)
  - Text input with @mention autocomplete (already exists)
  - Privacy selector (public, followers, group, encrypted)
  - Hashtag input
  - Media upload (MediaUploader already exists)
  - Character count, post button
- [ ] `PostCard.tsx` (display post)
  - Author profile (avatar, name, pubkey)
  - Post content (text, media gallery)
  - Timestamp (relative time)
  - Engagement counts (reactions, comments, reposts)
  - Action buttons (react, comment, repost, bookmark, menu)
- [ ] `PostThread.tsx` (post with replies)
  - Parent post + all replies (threaded)
  - Reply composer
- [ ] `HashtagFeed.tsx` (posts by hashtag)
  - Filter posts by hashtag
  - Trending hashtags sidebar

**Tests:**
- [ ] Unit tests for postsStore (CRUD operations)
- [ ] Unit tests for Nostr post publishing
- [ ] Integration tests for encrypted posts
- [ ] E2E tests for post creation flow

**Git Commit:**
- [ ] `git commit -m "feat: implement Posts module (Epic 21.1)"`

---

### 21.2: Unified Activity Feed (1.5h)

**Feed Aggregation:**
- [ ] Create `feedStore.ts` (Zustand)
  - feedItems: FeedItem[] (posts, events, proposals, aid, wiki)
  - loadFeed, refreshFeed, loadMoreFeed
  - filterByType, filterByGroup, filterByPrivacy
  - sortAlgorithm (chronological, hybrid, personalized)

**Feed Builder:**
- [ ] Create `FeedBuilder` class
  - Aggregate from multiple modules (posts, events, proposals, mutual-aid, wiki)
  - Apply filters (type, privacy, group, date range)
  - Sort by timestamp (chronological default)
  - Pagination (lazy loading)

**UI Components:**
- [ ] `ActivityFeed.tsx` (main feed view)
  - Infinite scroll (lazy load more)
  - Filter toolbar (content types, groups, date range)
  - Sort selector (chronological, hybrid)
  - Pull-to-refresh
- [ ] `FeedItem.tsx` (polymorphic renderer)
  - Detect item type (post, event, proposal, aid, wiki)
  - Render appropriate card (PostCard, EventCard, ProposalCard, etc.)
  - Handle engagement (reactions, comments)
- [ ] `FeedFilters.tsx` (filter sidebar)
  - Checkboxes for content types
  - Group selector
  - Date range picker

**Integration:**
- [ ] Add feed to main navigation (home tab)
- [ ] Add feed to group dashboards (group-specific feed)
- [ ] Add feed to user profiles (user's posts)

**Tests:**
- [ ] Unit tests for FeedBuilder (aggregation, filtering, sorting)
- [ ] Integration tests for multi-module feed
- [ ] E2E tests for feed interaction

**Git Commit:**
- [ ] `git commit -m "feat: implement unified activity feed (Epic 21.2)"`

---

### 21.3: Social Engagement (0.5h)

**Reactions (NIP-25):**
- [ ] Create `reactionsStore.ts` (Zustand)
  - reactions: Map<eventId, Reaction[]>
  - addReaction, removeReaction
  - getReactions, getReactionCounts
  - publishReaction (Nostr kind 7 event)

**UI Components:**
- [ ] `ReactionPicker.tsx` (emoji picker)
  - Use Frimousse emoji picker (already installed)
  - Frequent reactions, all emojis
  - Anonymous toggle
- [ ] `ReactionButton.tsx` (show reactions, add new)
  - Emoji + count (e.g., "❤️ 5")
  - Click to add/remove reaction
  - Hover to see who reacted

**Comments/Replies (NIP-10):**
- [ ] Extend `postsStore` for replies
  - createReply (post with replyTo field)
  - getComments (get all replies to post)
  - Threading (nested replies)

**UI Components:**
- [ ] `CommentThread.tsx` (threaded comments)
  - Parent post + replies
  - Nested threads (up to 3 levels)
  - Reply button on each comment
- [ ] `CommentComposer.tsx` (write reply)
  - Text input, media upload
  - Cancel / Post buttons

**Reposts (NIP-18):**
- [ ] Extend `postsStore` for reposts
  - createRepost (Nostr kind 6 event)
  - createQuotePost (post with quotedPost field)
  - getReposts (who reposted)

**UI Components:**
- [ ] `RepostButton.tsx` (repost menu)
  - Repost (simple boost)
  - Quote Post (add commentary)
  - Privacy check (can't repost private content)

**Bookmarks (NIP-51):**
- [ ] Create `bookmarksStore.ts` (Zustand)
  - bookmarks: Set<eventId>
  - addBookmark, removeBookmark
  - getBookmarks
  - Sync bookmarks (encrypted NIP-51 kind 10003)

**UI Components:**
- [ ] `BookmarkButton.tsx` (bookmark toggle)
  - Bookmark icon (filled if bookmarked)
  - Click to add/remove
- [ ] `BookmarksView.tsx` (view all bookmarks)
  - List of bookmarked items
  - Filter by type, group

**Tests:**
- [ ] Unit tests for reactions, comments, reposts, bookmarks
- [ ] E2E tests for engagement flows

**Git Commit:**
- [ ] `git commit -m "feat: add social engagement primitives (Epic 21.3)"`

**Epic Validation:**
- [ ] All tests passing
- [ ] Feed shows posts + events + proposals + aid + wiki
- [ ] Users can create posts with privacy levels
- [ ] Users can react, comment, repost, bookmark
- [ ] Build successful
- [ ] Git tag: `v0.21.0-social-feed`

---

## Epic 22: Moderation & Safety (3 hours) - **MVP+1 PRIORITY**

### 22.1: Content Reporting (1h)

**Database Schema:**
- [ ] Create `reports` table
  - id, reportedEventId, reportedPubkey, reporterPubkey
  - reporterAnonymous, reason, description, timestamp
  - groupId, status, resolution, resolvedBy, resolvedAt

**Store & Manager:**
- [ ] Create `reportsStore.ts` (Zustand)
  - reports: Map<string, Report>
  - createReport, updateReport, resolveReport
  - getReports, getPendingReports, getReportsByUser
  - publishReport (Nostr kind 1984 - NIP-56)

**Nostr Integration:**
- [ ] Implement Report events (NIP-56 kind 1984)
- [ ] Publish reports to relays (or group-only)
- [ ] Subscribe to reports (group mods only)

**UI Components:**
- [ ] `ReportButton.tsx` (report content)
  - Report icon/menu item
  - Opens report dialog
- [ ] `ReportDialog.tsx` (report form)
  - Reason selector (spam, harassment, violence, illegal, misinformation)
  - Description text area
  - Anonymous toggle
  - Submit button
- [ ] `ReportConfirmation.tsx` (thank you message)
  - "Thank you for reporting. A moderator will review this."
  - Link to community guidelines

**Tests:**
- [ ] Unit tests for reportsStore
- [ ] E2E tests for reporting flow

**Git Commit:**
- [ ] `git commit -m "feat: implement content reporting (Epic 22.1)"`

---

### 22.2: Moderation Queue (1.5h)

**Store & Manager:**
- [ ] Create `moderationStore.ts` (Zustand)
  - queue: { pending, reviewing, resolved }
  - assignReport, takeAction, appeal
  - getModerationLog
  - notifyModerators

**Moderation Actions:**
- [ ] Implement action handlers
  - approve (dismiss report, no action)
  - remove (hide content, mark deleted)
  - warn (send warning DM to user)
  - ban (block user from group, revoke permissions)
  - escalate (forward to admins or BuildIt Network safety team)

**UI Components:**
- [ ] `ModerationQueue.tsx` (main queue view)
  - Tabs: Pending, Reviewing, Resolved
  - Report cards with actions
  - Filter/sort controls
- [ ] `ReportCard.tsx` (single report)
  - Reported content preview
  - Reporter info (or "Anonymous")
  - Report reason and description
  - Previous reports on user (repeat offender?)
  - Action buttons (approve, remove, warn, ban, escalate)
- [ ] `ModerationLog.tsx` (audit log)
  - List of all actions taken
  - Who, what, when, why
  - Filter by mod, action type, date

**Workflows:**
- [ ] Assign report to mod (claim report)
- [ ] Take action (with confirmation dialog)
- [ ] Appeal process (user appeals ban/removal)
- [ ] Escalation (forward to higher authority)

**Permissions:**
- [ ] Only mods can access queue
- [ ] Only admins can ban users
- [ ] Log all actions (audit trail)

**Tests:**
- [ ] Unit tests for moderation actions
- [ ] E2E tests for moderation workflows

**Git Commit:**
- [ ] `git commit -m "feat: implement moderation queue (Epic 22.2)"`

---

### 22.3: Enhanced Filtering (0.5h)

**User Filters:**
- [ ] Extend `contactsStore` for muting
  - muteKeyword, unmuteKeyword (word/phrase blacklist)
  - muteHashtag, unmuteHashtag (hide posts with hashtag)
  - muteDomain, unmuteDomain (hide links from domain)
  - Sync mute lists (NIP-51 kind 10000)

**Content Warning System:**
- [ ] Extend existing media content warnings (Epic 12.3)
- [ ] Add content warnings to posts
  - Apply warning to post (violence, trauma, NSFW, police, flashing)
  - Multiple warnings per post
  - Custom warning text

**UI Components:**
- [ ] `FilterSettings.tsx` (user preferences)
  - Muted keywords (list, add/remove)
  - Muted hashtags (list, add/remove)
  - Muted domains (list, add/remove)
  - Content warning preferences (always show, blur, hide)
- [ ] `ContentWarningOverlay.tsx` (blur overlay)
  - Warning text
  - "Show content" button
  - User preference remembered

**Auto-Hide Logic:**
- [ ] Filter feed items by user preferences
  - Hide posts from blocked users
  - Hide posts from muted users
  - Hide posts with muted keywords/hashtags/domains
  - Hide posts with content warnings (if user preference)

**Tests:**
- [ ] Unit tests for filtering logic
- [ ] E2E tests for mute/hide flows

**Git Commit:**
- [ ] `git commit -m "feat: add enhanced filtering and content warnings (Epic 22.3)"`

**Epic Validation:**
- [ ] Users can report content
- [ ] Mods see moderation queue
- [ ] Mods can take actions (approve, remove, warn, ban)
- [ ] Users can mute keywords, hashtags, domains
- [ ] Content warnings work correctly
- [ ] Build successful
- [ ] Git tag: `v0.22.0-moderation`

---

## Epic 23: Discovery & Recommendations (3 hours) - **MVP+2**

### 23.1: Group Discovery (1h)

**Database Schema:**
- [ ] Add `discoverable` field to groups table
  - Boolean (default false for privacy)
  - Opt-in per group (admin setting)

**Store & Manager:**
- [ ] Extend `groupsStore` for discovery
  - getPublicGroups (fetch discoverable groups)
  - searchGroups (by name, tags, location, cause)
  - filterGroups (by size, activity level)

**Nostr Integration:**
- [ ] Publish discoverable groups (Nostr kind 39000 with public tag)
- [ ] Subscribe to public groups (relay query)

**UI Components:**
- [ ] `GroupDirectory.tsx` (browse groups)
  - Search bar
  - Filter controls (cause, location, size, activity)
  - Group cards (name, description, members, tags, join button)
  - Pagination
- [ ] `GroupCard.tsx` (group preview)
  - Group name, avatar, description
  - Member count, recent activity
  - Join button (opens invite flow)

**Invite System:**
- [ ] Generate invite links (shareable URL)
  - Expiration time
  - Capacity limit
  - Single-use vs. multi-use
- [ ] Generate QR codes (for in-person organizing)
  - QR code contains invite link
  - Scan to join group

**Tests:**
- [ ] Unit tests for group discovery
- [ ] E2E tests for joining groups

**Git Commit:**
- [ ] `git commit -m "feat: implement group discovery directory (Epic 23.1)"`

---

### 23.2: Trending & Hashtags (1h)

**Trending Logic:**
- [ ] Create `trendingStore.ts` (Zustand)
  - trendingHashtags: { hashtag, count, change }
  - trendingPosts: Post[] (most engaged)
  - getTrending (fetch from relays, aggregate locally)
  - Privacy: Group-internal trending (not network-wide for direct-action groups)

**Hashtag Tracking:**
- [ ] Index hashtags from posts
  - Extract hashtags from post content
  - Store hashtag -> postIds mapping
  - Count hashtag usage (time-windowed)

**Relay Aggregation:**
- [ ] Fetch popular hashtags from relays
  - Query relays for hashtag counts
  - Merge results from multiple relays
  - Rank by count, recency, velocity

**UI Components:**
- [ ] `TrendingPanel.tsx` (sidebar or tab)
  - Trending hashtags (top 10)
  - Trending posts (most engaged today)
  - Refresh button
- [ ] `HashtagCard.tsx` (hashtag preview)
  - #hashtag, post count
  - Click to see hashtag feed

**Privacy Controls:**
- [ ] User preference: Show/hide trending
- [ ] Group preference: Enable/disable trending (off for direct-action groups)

**Tests:**
- [ ] Unit tests for trending logic
- [ ] E2E tests for hashtag feeds

**Git Commit:**
- [ ] `git commit -m "feat: add hashtag tracking and trending (Epic 23.2)"`

---

### 23.3: Recommendations (1h)

**Recommendation Logic:**
- [ ] Create `recommendationsStore.ts` (Zustand)
  - recommendedContacts (from mutual connections)
  - recommendedGroups (based on interests)
  - recommendedContent (posts, events, wiki pages)
  - getRecommendations (privacy-safe algorithm)

**Contact Recommendations:**
- [ ] Find mutual connections (friends of friends)
  - Query contacts of contacts
  - Filter by privacy (public profiles only)
  - Rank by mutual connections count

**Group Recommendations:**
- [ ] Find groups matching user interests
  - User tags (from onboarding or profile)
  - Group tags (from group metadata)
  - Match by tag overlap
  - Rank by relevance, activity level

**Content Recommendations:**
- [ ] Find content matching user interests
  - User follows hashtags
  - Recommend posts/events/wiki pages with those hashtags
  - Rank by engagement, recency

**UI Components:**
- [ ] `RecommendationsPanel.tsx` (sidebar or tab)
  - Recommended contacts (3-5)
  - Recommended groups (3-5)
  - Recommended content (5-10)
- [ ] `RecommendationCard.tsx` (generic card)
  - Polymorphic (contact, group, or content)
  - Preview info, action button (follow, join, view)

**Privacy & Transparency:**
- [ ] User preference: Enable/disable recommendations
- [ ] Explanation: "Why am I seeing this?" (show algorithm reason)
- [ ] No tracking: All recommendations local-only

**Tests:**
- [ ] Unit tests for recommendation algorithm
- [ ] E2E tests for recommendation UI

**Git Commit:**
- [ ] `git commit -m "feat: add recommendations (Epic 23.3)"`

**Epic Validation:**
- [ ] Users can browse public groups
- [ ] Users can see trending hashtags
- [ ] Users see recommendations (contacts, groups, content)
- [ ] Privacy controls work (opt-out)
- [ ] Build successful
- [ ] Git tag: `v0.23.0-discovery`

---

## Epic 24: Enhanced Onboarding (2 hours) - **MVP+2**

### 24.1: Welcome Wizard (1h)

**3-Step Wizard:**
- [ ] Step 1: Identity Setup
  - Generate or import keys (already exists)
  - Explain Nostr protocol, keys, relays
  - Set profile (name, avatar, bio)
- [ ] Step 2: Choose Interests
  - Select tags (labor, climate, housing, mutual aid, etc.)
  - Explain how tags are used (recommendations, discovery)
  - Store tags in profile metadata
- [ ] Step 3: Join or Create Group
  - Option A: Join existing group (browse directory or use invite link)
  - Option B: Create new group (use template)
  - Explain groups, modules, privacy

**UI Components:**
- [ ] `WelcomeWizard.tsx` (modal or full-screen)
  - Step indicator (1 of 3, 2 of 3, 3 of 3)
  - Back/Next buttons
  - Skip wizard (advanced users)
- [ ] `IdentitySetup.tsx` (step 1)
  - Generate/import UI (already exists)
  - Profile editor (name, avatar, bio)
  - Explanation text
- [ ] `InterestSelector.tsx` (step 2)
  - Tag cloud or checkbox list
  - Search tags
  - Selected tags preview
- [ ] `GroupSetup.tsx` (step 3)
  - Join group (directory browser or paste invite link)
  - Create group (template selector)
  - Skip (create group later)

**Onboarding Flow:**
- [ ] Trigger wizard on first launch (check localStorage)
- [ ] Allow re-triggering from settings (if user wants tour again)
- [ ] Skip wizard option (for experienced users)

**Tests:**
- [ ] E2E tests for wizard flow (complete all steps)

**Git Commit:**
- [ ] `git commit -m "feat: implement welcome wizard (Epic 24.1)"`

---

### 24.2: Starter Content & Tutorials (1h)

**Starter Follows:**
- [ ] Create official BuildIt Network account
  - Post welcome message, tips, updates
  - Publish to relays
- [ ] Suggest starter follows
  - BuildIt Network account
  - Popular activist accounts (curated list, opt-in)
  - Contacts from joined groups

**Example Content:**
- [ ] Seed feed with example posts (if feed empty)
  - "Welcome to BuildIt Network! Here's how to create an event..."
  - "Tip: Use hashtags to discover content, like #mutualaid or #organizing"
  - "Did you know? You can switch identities for different contexts"
- [ ] Interactive tutorials
  - "Create your first event" walkthrough
  - "Submit your first aid request" tutorial
  - "Vote on a proposal" demo

**UI Components:**
- [ ] `StarterFollowsPanel.tsx` (onboarding step or suggestion)
  - List of suggested accounts
  - Follow buttons
  - Skip option
- [ ] `TutorialOverlay.tsx` (interactive tour)
  - Spotlight UI elements
  - Step-by-step instructions
  - Progress indicator

**Feature Discovery:**
- [ ] Tooltips on first use (e.g., "Click here to create a post")
- [ ] Achievement system (optional)
  - "Created first event!"
  - "Fulfilled first aid request!"
  - Non-coercive, just celebratory

**Tests:**
- [ ] E2E tests for starter content display

**Git Commit:**
- [ ] `git commit -m "feat: add starter content and tutorials (Epic 24.2)"`

**Epic Validation:**
- [ ] New users see welcome wizard
- [ ] Users can choose interests, join/create group
- [ ] Users see starter follows and example content
- [ ] Tutorials guide users through first actions
- [ ] Build successful
- [ ] Git tag: `v0.24.0-onboarding`

---

## Epic 25: Advanced Social Features (4 hours) - **POST-MVP**

### 25.1: Lightweight Polls (1h)

**Database Schema:**
- [ ] Create `polls` table
  - id, question, options (array), privacy, groupId
  - authorPubkey, createdAt, expiresAt
  - votingType (single, multiple, ranked)
  - anonymous (boolean)

**Store & Manager:**
- [ ] Create `pollsStore.ts` (Zustand)
  - createPoll, vote, getPoll, getResults
  - publishPoll (Nostr kind 6969 - NIP-69)

**UI Components:**
- [ ] `PollComposer.tsx` (create poll)
  - Question input
  - Options (add/remove)
  - Settings (voting type, duration, anonymous)
- [ ] `PollCard.tsx` (display poll)
  - Question, options, vote buttons
  - Results (after voting or expiration)
  - Progress bars

**Git Commit:**
- [ ] `git commit -m "feat: add lightweight polls (Epic 25.1)"`

---

### 25.2: Live Audio Spaces (1.5h)

**WebRTC Integration:**
- [ ] Install WebRTC library (e.g., simple-peer, peerjs)
- [ ] Create audio room infrastructure
  - Room creation, joining, leaving
  - Speaker/listener roles
  - Mute/unmute

**UI Components:**
- [ ] `AudioSpace.tsx` (live audio room)
  - Room info (title, host, participants)
  - Speaker tiles (who's speaking)
  - Controls (mute, leave, request to speak)

**Privacy:**
- [ ] E2E encrypted audio (WebRTC encryption)
- [ ] No recording (ephemeral)
- [ ] Privacy levels (public, group, invite-only)

**Git Commit:**
- [ ] `git commit -m "feat: add live audio spaces (Epic 25.2)"`

---

### 25.3: Calendar Integration (0.5h)

**Google Calendar Sync:**
- [ ] Export events to Google Calendar (OAuth, iCal feed)
- [ ] Import events from Google Calendar (optional)

**iCal Improvements:**
- [ ] Already exists (Epic 4.3) ✅
- [ ] Add: Bulk export (all events to .ics file)
- [ ] Add: Subscribe to group calendar (iCal feed URL)

**Git Commit:**
- [ ] `git commit -m "feat: enhance calendar integration (Epic 25.3)"`

---

### 25.4: Cross-Posting (1h)

**Twitter/Mastodon Integration:**
- [ ] OAuth login (Twitter, Mastodon)
- [ ] Post to BuildIt Network, auto-post to Twitter/Mastodon
- [ ] Privacy warning: "External platforms not encrypted"
- [ ] Attribution: "Posted from BuildIt Network"

**UI Components:**
- [ ] `CrossPostSettings.tsx` (connect accounts)
  - Twitter OAuth button
  - Mastodon instance + OAuth
  - Connected accounts list (disconnect)
- [ ] `CrossPostToggle.tsx` (in post composer)
  - Checkbox: "Also post to Twitter"
  - Warning if privacy not public

**Git Commit:**
- [ ] `git commit -m "feat: add cross-posting to Twitter/Mastodon (Epic 25.4)"`

**Epic Validation:**
- [ ] Polls work correctly
- [ ] Audio spaces functional (if implemented)
- [ ] Calendar sync working
- [ ] Cross-posting working
- [ ] Git tag: `v0.25.0-advanced-social`

---

## Testing & Quality Checklist

### Unit Tests
- [ ] Posts module tests (create, edit, delete, privacy)
- [ ] Feed builder tests (aggregation, filtering, sorting)
- [ ] Reactions tests (add, remove, anonymous)
- [ ] Reports tests (create, resolve, appeal)
- [ ] Moderation tests (actions, permissions, logging)
- [ ] Discovery tests (search, filter, recommendations)

### Integration Tests
- [ ] Multi-module feed (posts + events + proposals + aid + wiki)
- [ ] Encrypted posts (publish, sync, decrypt)
- [ ] Moderation workflows (report → queue → action → log)
- [ ] Recommendation algorithm (contacts, groups, content)

### E2E Tests
- [ ] User creates post, another user reacts/comments
- [ ] User reports content, mod resolves report
- [ ] User discovers and joins group
- [ ] User completes onboarding wizard
- [ ] User creates poll, others vote
- [ ] User filters feed (by type, group, hashtag)

### Accessibility Tests
- [ ] Keyboard navigation (all features)
- [ ] Screen reader support (ARIA labels)
- [ ] Color contrast (WCAG 2.1 AA)
- [ ] Mobile responsiveness

### Performance Tests
- [ ] Feed load time (<2s for 50 items)
- [ ] Infinite scroll performance (smooth scrolling)
- [ ] Image loading (lazy loading, progressive)
- [ ] Database queries (indexed lookups)

---

## Deployment Checklist

### Pre-Launch
- [ ] All tests passing (unit, integration, E2E)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Performance audit (Lighthouse >90)
- [ ] Security audit (XSS, CSRF, encryption)
- [ ] Privacy review (data disclosure, consent)
- [ ] Community guidelines published
- [ ] Moderation policies documented
- [ ] User documentation (help center, tutorials)

### Beta Testing
- [ ] Recruit beta testers (activist groups)
- [ ] Collect feedback (surveys, interviews)
- [ ] Iterate on UX issues
- [ ] Fix critical bugs
- [ ] Monitor performance, errors

### Public Launch
- [ ] Announce on social media
- [ ] Press outreach (activist media, tech press)
- [ ] Monitor for issues (crash reports, slow queries)
- [ ] Respond to feedback quickly
- [ ] Iterate based on usage patterns

---

## Success Metrics Dashboard

### Track Weekly:
- [ ] Daily Active Users (DAU)
- [ ] Posts created (total, per user)
- [ ] Engagement rate (reactions + comments per post)
- [ ] New user signups
- [ ] 7-day retention rate

### Track Monthly:
- [ ] Monthly Active Users (MAU)
- [ ] Groups created
- [ ] Events created, RSVP rate
- [ ] Aid requests fulfilled (%)
- [ ] Proposals voted on
- [ ] 30-day retention rate

### Track Quarterly:
- [ ] User growth rate
- [ ] Churn rate
- [ ] Content moderation metrics (reports, resolution time)
- [ ] Feature adoption (% users using each module)
- [ ] Community health score (engagement, safety, growth)

---

## Documentation Checklist

### User Documentation
- [ ] Getting started guide
- [ ] How to create posts
- [ ] How to use privacy levels
- [ ] How to report content
- [ ] How to use moderation queue (for mods)
- [ ] Community guidelines
- [ ] FAQ

### Developer Documentation
- [ ] Posts module API
- [ ] Feed aggregation system
- [ ] Nostr event kinds reference
- [ ] Privacy architecture overview
- [ ] Moderation system guide
- [ ] Contributing guide

---

## Priority Summary

**Week 1-2: Epic 21 (Social Feed MVP+1)**
- Microblog posts, unified feed, reactions, comments, bookmarks

**Week 3: Epic 22 (Moderation)**
- Content reporting, moderation queue, enhanced filtering

**Week 4: Epic 23 (Discovery)**
- Group directory, trending hashtags, recommendations

**Week 5: Epic 24 (Onboarding)**
- Welcome wizard, starter content, tutorials

**Week 6+: Epic 25 (Advanced)**
- Polls, audio spaces, calendar sync, cross-posting

**Week 10+: Epic 15.5, 16.5 (CMS & Docs)**
- Forms, fundraising, public pages, documents, files

---

**Total Estimated Time**: 12 hours core implementation + 2-4 weeks testing/iteration
**Target Launch**: 6-8 weeks from start

**Next Steps**:
1. ✅ Review strategy documents
2. ✅ Get stakeholder approval
3. ✅ Begin Epic 21.1 (Posts Module)
4. ✅ Test with activist beta testers
5. ✅ Iterate and launch

---

**Full Strategy**: See [SOCIAL_FEATURES_STRATEGY.md](./SOCIAL_FEATURES_STRATEGY.md) for detailed analysis and recommendations.
