# BuildIt Network - Social Features Strategy & Community Management Analysis

**Date**: 2025-10-05
**Status**: Strategic Recommendation
**Reviewer**: Community Management & Social Media Strategy Expert

---

## Executive Summary

BuildIt Network has built a **solid privacy-first foundation** with strong encryption (NIP-17/44/59), modular architecture, and rich organizing features. However, it currently **lacks a cohesive social experience** that would make it feel like a social action platform rather than a feature-packed tool suite.

### Key Opportunities

1. **Create a unified Activity Feed** to surface content across modules (events, proposals, wiki updates, aid requests)
2. **Add lightweight microblogging/posts** to enable community conversation beyond structured content
3. **Implement social engagement primitives** (reactions, comments, shares, bookmarks) while respecting privacy
4. **Build discovery mechanisms** (trending topics, hashtags, recommended groups) with privacy controls
5. **Add robust moderation tools** (content reporting, review workflows, community guidelines integration)

### Key Risks

1. **Privacy vs. Social Tension**: Social features can leak metadata even with E2E encryption
2. **Decentralized Moderation Challenges**: Nostr relays make network-level moderation difficult
3. **Activist OPSEC Concerns**: Social features could compromise security for high-risk organizing
4. **Feature Overload**: Adding too many social features could dilute focus on organizing tools

---

## Part 1: Community Engagement Analysis

### Current State Assessment

**Strengths:**
- ✅ **Strong social graph foundation** (`/src/stores/contactsStore.ts`) with NIP-02 contact lists
- ✅ **Privacy levels implemented** across modules (public, group, private, direct-action)
- ✅ **Rich content types** already exist: events, aid requests, proposals, wiki pages, documents
- ✅ **@mention autocomplete** system implemented (Epic 12.2)
- ✅ **Contacts management** with follow/block/mute functionality
- ✅ **User profiles** with metadata syncing (NIP-00 kind 0 events)

**Gaps:**
- ❌ **No unified activity feed** to surface cross-module content
- ❌ **No microblogging/posts** for casual community conversation
- ❌ **Limited engagement mechanisms** (no likes, reactions, comments, shares outside messaging)
- ❌ **No content discovery** beyond search (no trending, recommendations, hashtags)
- ❌ **Missing moderation infrastructure** (content reporting, review workflows)
- ❌ **No viral/sharing mechanics** (cross-posting, quote posts, reshares)

### Proposed Activity Feed Structure

**Feed Content Types** (Priority Order):

1. **Microblog Posts** (NEW - highest priority)
   - Short-form updates from followed users and groups
   - Support text, images, videos, links, polls
   - Privacy levels: public, followers-only, group, direct-action (encrypted)
   - Hashtags and topic tagging for discovery

2. **Events** (existing)
   - Upcoming events from groups you're in
   - Public events from followed organizers
   - RSVP status and attendance counts

3. **Mutual Aid Requests/Offers** (existing)
   - Urgent requests from your groups
   - Offers that match your saved preferences
   - Geographic proximity (privacy-respecting)

4. **Governance Proposals** (existing)
   - Active proposals in your groups
   - Voting deadlines approaching
   - Results of closed votes

5. **Wiki Updates** (existing)
   - New pages or major edits in group wikis
   - Collaborative knowledge base activity

6. **Document Shares** (future Epic 16.5)
   - Shared documents, manifestos, reports
   - Press releases, meeting notes

**Feed Algorithm Options:**

**Option 1: Chronological (Default for Activists)**
- Pros: No algorithmic manipulation, transparent, privacy-friendly
- Cons: Can miss important updates, heavy users overwhelm light users
- Recommendation: **Primary default** with smart filtering options

**Option 2: Hybrid Chronological + Importance**
- Pros: Surface urgent items (proposals closing soon, critical aid requests)
- Cons: Requires defining "importance" which can feel opaque
- Recommendation: **Secondary option** with user control

**Option 3: Personalized (Opt-In Only)**
- Pros: Better engagement, discovery of relevant content
- Cons: Privacy concerns, echo chambers, requires tracking
- Recommendation: **Opt-in only**, with clear privacy disclosure

### Engagement Features to Implement

**Tier 1: Essential (MVP+1)**

1. **Reactions** (privacy-respecting)
   - Simple emoji reactions (❤️, ✊, 🔥, 👍, etc.)
   - Anonymous or attributed (user choice)
   - Nostr event kind for reactions (NIP-25 kind 7)
   - Privacy: Public reactions visible to all, group reactions encrypted

2. **Comments/Replies**
   - Threaded conversations under posts, events, proposals
   - Support @mentions, media attachments
   - Privacy inherits from parent content
   - Nostr event kind for comments (NIP-10 kind 1 with reply tags)

3. **Bookmarks/Saves**
   - Private bookmarking (local-only or encrypted sync)
   - Organize into collections
   - No public bookmark counts (privacy)

**Tier 2: Enhanced Engagement (MVP+2)**

4. **Reposts/Shares**
   - Amplify content to your followers
   - Add commentary (quote posts)
   - Privacy-aware: Can't repost private/group content without permission
   - Nostr event kind for reposts (NIP-18 kind 6 or kind 16)

5. **Polls**
   - Lightweight polling in posts (distinct from governance proposals)
   - Multiple choice, single choice, ranked
   - Anonymous or attributed voting
   - Time-limited with results display

6. **Content Warnings & Blur**
   - User-applied content warnings (violence, trauma, NSFW, etc.)
   - Auto-blur images/videos with warnings
   - Already partially implemented in media system (Epic 12.3)

**Tier 3: Advanced Features (Post-MVP)**

7. **Trending Topics**
   - Privacy-respecting hashtag trending (relay-level aggregation)
   - Group-specific trends vs. network-wide
   - User control: Show/hide trending section

8. **Recommendations**
   - Suggest groups to join (based on interests, not surveillance)
   - Recommend contacts from mutual connections
   - Suggest content (wiki pages, events) based on tags user follows
   - Fully opt-in, transparent algorithm

---

## Part 2: Privacy vs. Social Balance

### Privacy Model Assessment

**Current Strong Privacy Protections:**
- ✅ NIP-17 gift-wrapped encryption (DMs, small groups <100)
- ✅ Metadata protection (timestamp randomization, ephemeral keys)
- ✅ Local-first storage (IndexedDB, no cloud)
- ✅ Per-content privacy levels (public, group, private, direct-action)
- ✅ EXIF stripping for images (Epic 12.3)
- ✅ Optional Tor integration (Epic 18.3 - deferred)

**Privacy Risks from Social Features:**

1. **Social Graph Leakage**
   - **Risk**: Following, reposting, reacting reveals social connections
   - **Mitigation**: Allow anonymous reactions, private follow lists (NIP-51 private lists)
   - **User Control**: Option to hide follower/following counts

2. **Activity Pattern Analysis**
   - **Risk**: Posting times, frequency, engagement patterns reveal user behavior
   - **Mitigation**: Batch posting, random delays, Tor usage
   - **User Control**: "Quiet mode" to disable real-time notifications

3. **Content Correlation**
   - **Risk**: Public posts can be correlated with group activity for infiltrators
   - **Mitigation**: Separate identities per context (already supported)
   - **User Control**: Warnings when posting publicly from activist identity

4. **Hashtag Surveillance**
   - **Risk**: Monitoring specific hashtags (#protest, #strike) to identify activists
   - **Mitigation**: Encrypt hashtags in group/private posts, use code words
   - **User Control**: Hashtag privacy settings per post

### Privacy-Preserving Social Patterns

**Pattern 1: Anonymous Engagement**
- Allow reactions/votes without revealing identity
- Use zero-knowledge proofs to verify group membership without revealing who
- Example: "5 members reacted ❤️" instead of "Alice, Bob, Carol reacted"

**Pattern 2: Pseudonymous Identities**
- Support multiple identities per user (already exists)
- Create "public advocate" identity vs. "internal organizer" identity
- Quick identity switching in UI

**Pattern 3: Time-Delayed Visibility**
- Post now, publish later (scheduled posts)
- Reactions visible only after N people react (anonymity set)
- Direct-action events: location reveals only X hours before start

**Pattern 4: Encrypted Social Features**
- Encrypted hashtags for group posts
- Encrypted comments visible only to group members
- Group-internal trending topics (never public)

### Consent & Control Mechanisms

**User Controls to Implement:**

1. **Privacy Dashboard**
   - What data is public vs. encrypted
   - Who can see your profile, posts, activity
   - Opt-out of discovery features (trending, recommendations)

2. **Granular Post Controls**
   - Who can reply (everyone, followers, group members, no one)
   - Who can repost (with permission, never, followers only)
   - Who can react (attributed vs. anonymous reactions only)

3. **Content Visibility Indicators**
   - Clear badges: 🌐 Public, 🔒 Group, 🕵️ Private, ⚡ Direct Action
   - Warning when posting publicly from activist identity
   - Confirmation dialog for cross-context posting

4. **Blocking & Filtering**
   - Already exists: block, mute users (contactsStore.ts)
   - Add: Mute keywords, hashtags, domains
   - Add: Mute all public content (groups-only mode)

---

## Part 3: Onboarding & Growth

### Current Onboarding Assessment

**Existing Onboarding:**
- ✅ Identity creation (generate or import keys)
- ✅ Group templates (union, mutual aid, activist collective)
- ✅ Demo/seed data option when creating groups
- ❌ No guided tour or feature discovery
- ❌ No "Find Friends" or group discovery flow
- ❌ No example content or starter follows

### Proposed Onboarding Improvements

**Phase 1: First-Time User Experience**

1. **Welcome Wizard** (3-step flow)
   - Step 1: Create identity + explain Nostr keys
   - Step 2: Choose interests (tags: labor, climate, housing, mutual aid, etc.)
   - Step 3: Join or create first group

2. **Starter Follows**
   - Suggest official BuildIt Network account
   - Suggest popular activist accounts (opt-in)
   - Suggest contacts from mutual groups

3. **Feature Walkthrough**
   - Interactive tour of modules (events, mutual aid, governance, wiki)
   - "Create your first event" tutorial
   - "Submit your first aid request" tutorial

**Phase 2: Group Discovery**

1. **Public Group Directory**
   - Discoverable groups (opt-in by group admins)
   - Filter by: location, cause, size, activity level
   - Privacy: Hidden groups never appear (default for direct-action groups)

2. **Invite Mechanisms**
   - Share invite links (with expiration, capacity limits)
   - QR codes for in-person organizing (generate invite QR)
   - Cross-group invitations (invite from Group A to Group B)

3. **Cross-Platform Invites**
   - Generate npub/invite link to share via Signal, WhatsApp, email
   - Works even if invitee doesn't have BuildIt Network yet
   - Privacy: No tracking, no email harvesting

**Phase 3: Network Effects & Viral Loops**

1. **Referral System**
   - "Invite 3 friends, unlock premium themes" (non-coercive)
   - Track invites locally, not on relays (privacy)

2. **Cross-Posting**
   - Share to Twitter/Mastodon (public posts only)
   - "Posted from BuildIt Network" attribution
   - Privacy warning: External platforms not encrypted

3. **Event Amplification**
   - Public events shareable on social media
   - Embedded event widgets for websites
   - iCal export already exists (Epic 4.3)

### Retention Mechanisms

**Problem**: Users join for one campaign, then churn after it ends

**Solutions:**

1. **Habit Formation**
   - Daily digest: "3 new proposals in your groups"
   - Weekly summary: "This week in [Group Name]"
   - Smart notifications: Upcoming events, expiring aid requests, vote deadlines

2. **Progressive Disclosure**
   - Start with 2-3 core modules (events, messaging, mutual aid)
   - Unlock advanced modules as user engages (governance, wiki, database)
   - Achievement system (optional): "Organized 10 events", "Fulfilled 5 aid requests"

3. **Community Building**
   - Introduce users to each other (mutual connections)
   - Highlight active contributors (opt-in)
   - Anniversary celebrations (group founded 1 year ago)

---

## Part 4: Community Safety & Moderation

### Existing Moderation Tools

**Current Capabilities:**
- ✅ Block users (contactsStore.ts)
- ✅ Mute users (contactsStore.ts - local only, NIP-51 deferred)
- ✅ Group roles: admin, moderator, member, read-only
- ✅ Permission system (per-module permissions)
- ❌ No content reporting mechanism
- ❌ No moderation queue or workflows
- ❌ No community guidelines integration

### Content Moderation Challenges on Nostr

**Challenge 1: Decentralized Relays**
- **Problem**: No single authority to remove content
- **Solution**: Client-side filtering, relay selection, WoT (Web of Trust)
- **Implementation**: Filter content from untrusted relays, show only from community relays

**Challenge 2: Relay Operator Abuse**
- **Problem**: Malicious relay could censor activist content
- **Solution**: Multi-relay redundancy (already implemented), relay health monitoring
- **Implementation**: Auto-failover to backup relays if censorship detected

**Challenge 3: Immutable Events**
- **Problem**: Nostr events can't be deleted, only marked as deleted
- **Solution**: Client-side deletion, hide deleted events from UI
- **Implementation**: Deletion event (NIP-09 kind 5), client honors deletion requests

### Proposed Moderation System

**Tier 1: User-Level Controls**

1. **Enhanced Blocking/Muting**
   - Block user: Hide all content from user
   - Mute user: Hide posts but still see in group context (e.g., group messages)
   - Mute keywords: Hide posts containing specific words/phrases
   - Mute hashtags: Hide posts with specific tags
   - Block domains: Hide links from specific domains

2. **Personal Content Filters**
   - Hide content with content warnings (user preference)
   - Filter by privacy level (e.g., only show group posts)
   - Age filter: Hide posts older than X days
   - Engagement filter: Hide low-engagement posts (anti-spam)

**Tier 2: Group-Level Moderation**

1. **Moderation Queue**
   - Moderators review flagged content
   - Queue view: Show reported posts, actions taken, reporter info
   - Actions: Approve, Remove, Warn User, Ban User, Escalate

2. **Automated Filters**
   - Spam detection (excessive posting, link spam)
   - Duplicate content detection
   - Known bad actors list (shared across relays)
   - Rate limiting (max posts per hour/day)

3. **Moderation Roles**
   - Admin: Full control, can ban users, delete content
   - Moderator: Can approve/remove content, issue warnings
   - Trusted User: Reports weighted higher, bypass some filters
   - Member: Can report content
   - Restricted: Read-only, can't post until approved

**Tier 3: Network-Level Safety**

1. **Relay Reputation System**
   - Track relay uptime, censorship events, spam levels
   - Community-curated relay lists (activist-friendly relays)
   - Warn users about untrustworthy relays

2. **Web of Trust (WoT)**
   - Trust users vouched for by your trusted contacts
   - Distrust users blocked by multiple trusted contacts
   - Gradual trust: New users start with low trust, earn it over time

3. **Content Reporting Workflow**
   - Report reasons: Spam, Harassment, Violence, Illegal Content, Misinformation
   - Report goes to: Group mods, relay operator, BuildIt Network safety team (opt-in)
   - Reporter anonymity (optional)
   - False report penalties (rate limiting for repeated false reports)

### Content Warning System

**Expand Existing Implementation** (Epic 12.3 added content warnings for media):

1. **User-Applied Warnings**
   - When posting: Select warning type (Violence, Trauma, NSFW, Police, Flashing Lights)
   - Multiple warnings per post
   - Custom warning text

2. **Auto-Blur Controls**
   - User preference: Always show / Always blur / Ask per-content
   - Per-warning type: Blur NSFW but not Violence
   - Group defaults: Direct-action groups auto-blur police-related content

3. **Accessibility**
   - Alt text for images (already in media schema)
   - Transcripts for videos/audio
   - Seizure warnings for flashing content

### Community Guidelines Integration

**What to Build:**

1. **Group Guidelines Editor**
   - Markdown editor for community guidelines
   - Stored in wiki module (already exists)
   - Linked from group settings, visible to all members

2. **Guidelines Acknowledgment**
   - New members must acknowledge guidelines when joining
   - Checkbox: "I've read and agree to [Group Name] Community Guidelines"
   - Logged timestamp (for moderation record)

3. **Report Workflow Integration**
   - When reporting content, reference specific guideline violations
   - Mods see guideline violations in queue
   - Ban reasons cite specific guidelines

---

## Part 5: Activist-Specific Use Cases

### Use Case 1: Union Organizing Campaign

**Scenario**: UFCW local organizing Amazon warehouse workers

**Current Flow:**
1. Create group (union chapter template) ✅
2. Invite workers via QR codes at shift change ✅
3. Create organizing events (meetings, actions) ✅
4. Track support levels in CRM ✅
5. Vote on contract proposals ✅

**Gaps & Improvements:**

- **Need**: Stealth mode (hide union activity from management)
  - **Solution**: Direct-action privacy level for all content
  - **Add**: "Paranoia mode" setting (max privacy, Tor required, no public posts)

- **Need**: Secure 1-on-1 organizing conversations
  - **Solution**: Encrypted DMs already exist (NIP-17)
  - **Add**: "Organizing contact" tag separate from social contacts

- **Need**: Track conversations and follow-ups
  - **Solution**: CRM module with union organizing template ✅
  - **Add**: Activity log per contact (talked to Alice 3 times, signed card on X date)

- **Need**: Share wins and build solidarity
  - **Solution**: Microblog posts in group feed (NEW)
  - **Add**: Celebration posts template ("We signed 10 cards today! 🎉")

### Use Case 2: Mutual Aid Network Coordination

**Scenario**: Disaster relief mutual aid network after hurricane

**Current Flow:**
1. Create mutual aid group ✅
2. Post requests/offers (food, shelter, supplies) ✅
3. Match requests with offers ✅
4. Coordinate via group messages ✅

**Gaps & Improvements:**

- **Need**: Real-time crisis updates
  - **Solution**: Activity feed with urgent filter (NEW)
  - **Add**: Push notifications for critical requests

- **Need**: Geographic coordination (who's where)
  - **Solution**: Map view for aid requests/offers (Epic 15.8 - deferred)
  - **Add**: Privacy-respecting location sharing (approximate zones, not exact addresses)

- **Need**: Resource inventory
  - **Solution**: Database module with resource library view ✅
  - **Add**: Real-time stock tracking (5 cots available, 12 meals left)

- **Need**: Volunteer coordination
  - **Solution**: CRM volunteer management template ✅
  - **Add**: Shift scheduling, skill matching

### Use Case 3: Protest/Action Planning with OPSEC

**Scenario**: Climate activists organizing civil disobedience

**Current Flow:**
1. Create direct-action event (location hidden until reveal time) ✅
2. Encrypted group messages for planning ✅
3. Separate identity per campaign ✅

**Gaps & Improvements:**

- **Need**: Burner identities
  - **Solution**: Multi-identity already exists ✅
  - **Add**: "Burner identity" template (auto-deletes after 30 days)

- **Need**: Compartmentalization (different cells don't know each other)
  - **Solution**: Separate groups per cell ✅
  - **Add**: "Cell structure" group template (isolated groups, central coordination via admin)

- **Need**: Secure file sharing (action plans, legal guides)
  - **Solution**: Files module with encryption (Epic 16.5 - deferred)
  - **Add**: Self-destructing files (auto-delete after N downloads or X hours)

- **Need**: Legal support coordination
  - **Solution**: CRM legal/NLG tracking template ✅
  - **Add**: Arrestee support workflow (bail fund, lawyer contact, court dates)

### Use Case 4: Community Knowledge Sharing

**Scenario**: Tenant union documenting landlord harassment

**Current Flow:**
1. Create wiki pages (Know Your Rights, Document Everything, etc.) ✅
2. Version control for collaborative editing ✅
3. Search knowledge base ✅

**Gaps & Improvements:**

- **Need**: Easy contribution from non-tech members
  - **Solution**: Markdown editor (Epic 7.2) ✅
  - **Add**: WYSIWYG editor (Epic 16.5 - deferred)

- **Need**: Translate guides to multiple languages
  - **Solution**: i18n for UI (Epic 10, 17) ✅
  - **Add**: Per-page translations (wiki page in English, Spanish, Mandarin)

- **Need**: Share knowledge across groups
  - **Solution**: Public wiki pages (NEW - requires Epic 15.5 public pages)
  - **Add**: Wiki syndication (republish pages to other groups, with attribution)

### Use Case 5: Fundraising & Solidarity Campaigns

**Scenario**: Bail fund for arrested protesters

**Current Flow:**
1. Create event for fundraiser ✅
2. Post updates in group messages ✅
3. Track donations manually ❌

**Gaps & Improvements:**

- **Need**: Fundraising page with progress tracking
  - **Solution**: Forms & Fundraising module (Epic 15.5 - deferred)
  - **Add**: Goal thermometer, donation tiers, recurring donations

- **Need**: Accept crypto donations (privacy-respecting)
  - **Solution**: Payment integration (Bitcoin, Monero, Lightning)
  - **Add**: Non-custodial wallet integration (users control funds)

- **Need**: Transparency (how much raised, how spent)
  - **Solution**: Public spending log
  - **Add**: Automatically update from database records

---

## Part 6: Feature Prioritization & Roadmap

### Immediate Priorities (MVP+1 - "Social Feed Release")

**Epic 21: Microblogging & Activity Feed** (4 hours)

1. **Microblog Posts Module** (2h)
   - Create posts module (short-form content, NIP-01 kind 1 events)
   - Post types: text, image, video, link, poll
   - Privacy levels: public, followers-only, group, encrypted
   - Hashtags and @mentions support
   - Create/edit/delete posts

2. **Unified Activity Feed** (1.5h)
   - Aggregate content from posts, events, proposals, aid requests, wiki updates
   - Feed view component (chronological by default)
   - Filter by: content type, privacy level, group, date range
   - Integration with existing modules

3. **Social Engagement** (0.5h)
   - Reactions (NIP-25 kind 7 events) - emoji reactions
   - Comments/replies (NIP-10 kind 1 with reply tags)
   - Repost/quote post (NIP-18 kind 6/16)
   - Bookmarks (local-only or encrypted NIP-51 kind 10003)

**Epic 22: Moderation & Safety** (3 hours)

1. **Content Reporting** (1h)
   - Report button on posts, events, profiles
   - Report reasons (spam, harassment, violence, illegal, misinformation)
   - Reporter anonymity option
   - Store reports locally + optionally publish to group admins

2. **Moderation Queue** (1.5h)
   - Mod-only view of reported content
   - Actions: approve, remove, warn, ban, escalate
   - Moderation log (who did what when)
   - User appeal process

3. **Enhanced Filtering** (0.5h)
   - Mute keywords, hashtags, domains
   - Content warning system (expand Epic 12.3)
   - User preferences for auto-hide content

### Near-Term Enhancements (MVP+2 - "Discovery & Growth")

**Epic 23: Discovery & Recommendations** (3 hours)

1. **Group Discovery** (1h)
   - Public group directory (opt-in)
   - Filter by tags, location, cause, size
   - Invite system (links, QR codes)

2. **Trending & Hashtags** (1h)
   - Hashtag tracking (relay-level aggregation)
   - Trending topics (group-internal or network-wide)
   - Privacy controls (opt-out)

3. **Recommendations** (1h)
   - Suggest contacts from mutual groups
   - Suggest content based on followed tags
   - Suggest groups based on interests

**Epic 24: Enhanced Onboarding** (2 hours)

1. **Welcome Wizard** (1h)
   - 3-step guided setup
   - Choose interests, join/create group
   - Feature walkthrough

2. **Starter Content** (1h)
   - Suggested follows (BuildIt Network account, popular activists)
   - Example posts to demonstrate features
   - Interactive tutorials

### Future Enhancements (Post-MVP)

**Epic 15.5: Forms, Fundraising & Public Pages** (3 hours)
- Already specified in PROMPT.md
- CMS for public-facing content
- Fundraising campaigns with goal tracking
- Form builder for surveys, volunteer sign-ups

**Epic 16.5: Documents & Files** (2.5 hours)
- Already specified in PROMPT.md
- WYSIWYG collaborative editor
- File storage with encryption
- Cross-module attachments

**Epic 25: Advanced Social Features** (4 hours)
- Polls (lightweight voting, distinct from governance)
- Live events / spaces (audio rooms for organizing calls)
- Calendar integration (sync to Google Calendar, iCal)
- Cross-posting to Twitter/Mastodon

---

## Part 7: Metrics & Community Health

### Key Metrics to Track

**Engagement Metrics:**
- Daily Active Users (DAU) / Monthly Active Users (MAU)
- Posts per user per day
- Comments/reactions per post
- Repost amplification rate
- Time spent in app

**Organizing Metrics:**
- Events created per group per month
- RSVP rate (going / total invites)
- Mutual aid requests fulfilled (%)
- Proposals created & voted on
- Wiki pages created/edited

**Community Health Metrics:**
- Retention rate (30-day, 90-day)
- Churn rate (users who stop posting)
- New user activation (% who create content in first week)
- Group growth rate
- Cross-group participation

**Safety Metrics:**
- Content reports per 1000 posts
- Report resolution time (median)
- Ban rate (% users banned)
- Appeal rate (% reports appealed)
- False report rate

### Privacy-Respecting Analytics

**Principles:**
- All analytics local-only by default
- No third-party tracking (no Google Analytics, no telemetry)
- Aggregate data only (no individual tracking)
- Opt-in for network-level metrics
- Transparent methodology

**Implementation:**
1. **Local Analytics** (IndexedDB)
   - Track user's own activity (posts created, groups joined)
   - Provide personal insights ("You've organized 15 events this year!")
   - No external sharing

2. **Group-Level Analytics** (encrypted aggregation)
   - Group admins see aggregate stats (members, posts, events)
   - Individual activity private unless user opts in
   - Stored encrypted in group settings

3. **Network-Level Metrics** (opt-in)
   - Privacy-preserving aggregation (differential privacy)
   - Relay-level metrics (event counts, relay health)
   - Published as public statistics (monthly reports)

---

## Part 8: Implementation Recommendations

### Prioritized Feature List

**Phase 1: Social Feed Basics** (Epic 21 - 4 hours)
1. ✅ Microblog posts module (text, media, privacy levels)
2. ✅ Unified activity feed (posts + events + proposals + aid)
3. ✅ Reactions (emoji reactions on any content)
4. ✅ Comments/replies (threaded conversations)
5. ✅ Bookmarks (save for later)

**Phase 2: Safety & Moderation** (Epic 22 - 3 hours)
6. ✅ Content reporting system
7. ✅ Moderation queue & workflows
8. ✅ Enhanced filtering (keywords, hashtags, domains)
9. ✅ Community guidelines integration

**Phase 3: Discovery & Growth** (Epic 23 - 3 hours)
10. ✅ Group discovery directory
11. ✅ Hashtag tracking & trending
12. ✅ Recommendations (contacts, groups, content)

**Phase 4: Onboarding** (Epic 24 - 2 hours)
13. ✅ Welcome wizard
14. ✅ Starter content & tutorials

**Phase 5: Advanced Features** (Epic 25+ - ongoing)
15. ⏳ Polls (lightweight voting)
16. ⏳ Enhanced public pages & fundraising (Epic 15.5)
17. ⏳ Documents & files (Epic 16.5)
18. ⏳ Live audio spaces
19. ⏳ Cross-posting to other platforms

### Technical Considerations

**Database Schema Additions:**

```typescript
// Microblog posts
interface Post {
  id: string;
  content: string;
  privacy: 'public' | 'followers' | 'group' | 'encrypted';
  authorPubkey: string;
  createdAt: number;
  updatedAt: number;

  // Media
  media: MediaAttachment[];

  // Engagement
  replyTo?: string; // Parent post ID
  quotedPost?: string; // Quote post ID

  // Tags
  hashtags: string[];
  mentions: string[]; // npubs

  // Encryption
  groupId?: string;
  encryptedFor?: string[]; // npubs (for followers-only)
}

// Reactions (NIP-25)
interface Reaction {
  eventId: string; // Post/event/proposal ID
  userPubkey: string;
  emoji: string;
  timestamp: number;
  anonymous: boolean; // If true, don't show userPubkey
}

// Content reports
interface Report {
  id: string;
  reportedEventId: string;
  reportedPubkey: string;
  reporterPubkey: string;
  reporterAnonymous: boolean;
  reason: 'spam' | 'harassment' | 'violence' | 'illegal' | 'misinformation';
  description: string;
  timestamp: number;
  groupId?: string; // If reporting group content
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  resolution?: string;
  resolvedBy?: string; // Mod pubkey
  resolvedAt?: number;
}
```

**Nostr Event Kinds:**

- **Posts**: kind 1 (short text notes) - already in NIP-01
- **Reactions**: kind 7 (reactions) - NIP-25
- **Reposts**: kind 6 (repost), kind 16 (generic repost) - NIP-18
- **Reports**: kind 1984 (reporting) - NIP-56
- **Bookmarks**: kind 10003 (bookmarks) - NIP-51
- **Mute List**: kind 10000 (mute list) - NIP-51

**UI Components to Build:**

1. **PostComposer**: Create new posts (text, media, privacy, hashtags)
2. **PostCard**: Display post with author, content, media, engagement
3. **ActivityFeed**: Unified feed view with filters
4. **ReactionPicker**: Emoji picker for reactions
5. **CommentThread**: Threaded comment view
6. **ReportDialog**: Report content form
7. **ModerationQueue**: Mod view for reviewing reports
8. **TrendingPanel**: Show trending hashtags/topics
9. **GroupDirectory**: Browse and join public groups
10. **WelcomeWizard**: Onboarding flow

---

## Part 9: User Stories & Scenarios

### User Story 1: Casual Member Engagement

**Persona**: Maria, tenant union member, moderate tech literacy

**Scenario**: Maria wants to stay connected with her tenant union between meetings

**Current Experience:**
- Maria checks events for next meeting ✅
- She posts update in group messages ✅
- She doesn't engage much otherwise ❌

**Improved Experience (with social feed):**
- Maria opens app, sees activity feed
- Scrolls through: Neighbor posted photo of new repairs, organizer shared know-your-rights guide, upcoming protest event
- She reacts ❤️ to the photo, bookmarks the guide
- She posts: "Just filed a harassment complaint against my landlord. This guide helped so much!"
- Other members react and comment with support
- Maria feels connected daily, not just at meetings

### User Story 2: Organizer Amplifying Content

**Persona**: James, labor organizer, high tech literacy

**Scenario**: James wants to amplify mutual aid requests to his network

**Current Experience:**
- James sees urgent aid request in his union's mutual aid module ✅
- He can't easily share it to his followers ❌
- He manually copies and reposts in another app ❌

**Improved Experience (with reposts):**
- James sees urgent request: "Single mom needs childcare for picket shift"
- He hits "Repost" button, adds quote: "Our solidarity extends to childcare. Can anyone help?"
- His followers in other groups see the repost
- 3 people offer to help
- Request fulfilled in 2 hours

### User Story 3: New Member Onboarding

**Persona**: Tasha, first-time activist, low tech literacy

**Scenario**: Tasha just joined a climate action group via QR code at a rally

**Current Experience:**
- Tasha scans QR code, creates account ✅
- She's dumped into an empty app with no guidance ❌
- She doesn't know what to do next ❌
- She doesn't open the app again ❌

**Improved Experience (with onboarding wizard):**
- Tasha scans QR code, creates account
- Welcome wizard: "Hi Tasha! Let's set up your BuildIt Network account."
- Step 1: Choose interests (climate, indigenous rights, mutual aid)
- Step 2: Join your first group (already joined via QR link)
- Step 3: Interactive tour: "Here's how to RSVP for events, post updates, and find resources"
- Feed shows example content: Recent posts from group, upcoming events, wiki starter page
- Tasha posts her first update: "Just joined! Excited to organize with you all!"
- She gets 5 reactions and 2 welcome comments
- Tasha opens the app daily

### User Story 4: Moderator Handling Reports

**Persona**: Keisha, group admin, high tech literacy

**Scenario**: Keisha moderates a large mutual aid network with 500 members

**Current Experience:**
- Members message Keisha directly about spam/bad actors ❌
- Keisha manually blocks users one by one ❌
- No log of moderation decisions ❌
- Other mods don't know what's been addressed ❌

**Improved Experience (with moderation queue):**
- Member reports spam post as "Spam"
- Keisha sees notification: "1 new report in moderation queue"
- Opens queue, sees:
  - Reported post: "Buy cheap followers! DM me!"
  - Reporter: Anonymous
  - Reason: Spam
  - Previous reports: User reported 3 times in past week
- Keisha clicks "Ban user and remove content"
- Action logged: "Keisha banned @spammer for spam (3 reports)"
- Other mods see log, know it's handled
- Community feels safe

### User Story 5: High-Risk Organizing

**Persona**: Alex, direct-action organizer, very high tech literacy

**Scenario**: Alex is organizing civil disobedience against pipeline construction

**Current Experience:**
- Alex creates separate group for each affinity group ✅
- Uses direct-action privacy for all events ✅
- Manually reminds members to use Tor ❌
- Worried about metadata leakage ❌

**Improved Experience (with paranoia mode):**
- Alex enables "Paranoia Mode" in group settings
- All members warned: "This group requires Tor. Install Tor Browser or use Orbot."
- App checks Tor status, shows warning if not connected
- All posts auto-set to "direct-action" privacy
- Location data stripped from all uploads
- Reactions anonymous by default
- No trending topics, no recommendations (anti-correlation)
- Event location reveals only 2 hours before start
- Alex feels confident organizing high-risk action

---

## Part 10: Conclusion & Next Steps

### Summary of Recommendations

**Must-Have (MVP+1):**
1. ✅ Implement microblogging/posts module for casual conversation
2. ✅ Build unified activity feed aggregating all content types
3. ✅ Add social engagement primitives (reactions, comments, reposts)
4. ✅ Create content reporting and moderation queue
5. ✅ Enhance filtering (keywords, hashtags, content warnings)

**Should-Have (MVP+2):**
6. ✅ Build group discovery directory
7. ✅ Implement hashtag tracking and trending (privacy-aware)
8. ✅ Create welcome wizard for new users
9. ✅ Add recommendations (contacts, groups, content)
10. ✅ Develop privacy dashboard (control what's visible)

**Nice-to-Have (Post-MVP):**
11. ⏳ Lightweight polls (distinct from governance proposals)
12. ⏳ Public pages & fundraising (Epic 15.5)
13. ⏳ Documents & files with collaboration (Epic 16.5)
14. ⏳ Live audio spaces for organizing calls
15. ⏳ Cross-posting to Twitter/Mastodon

### Risk Mitigation Strategies

**Risk 1: Privacy Compromise**
- **Mitigation**: Default to private, make public opt-in
- **Implementation**: Warnings when posting publicly, clear privacy indicators
- **Testing**: Red team testing for metadata leaks

**Risk 2: Feature Overload**
- **Mitigation**: Progressive disclosure, module-based architecture
- **Implementation**: Start with core modules, unlock advanced as users engage
- **Testing**: User testing with non-technical activists

**Risk 3: Moderation Burnout**
- **Mitigation**: Automated filters, distributed moderation, AI assistance (privacy-safe)
- **Implementation**: Keyword filters, spam detection, mod rotation system
- **Testing**: Stress test with high report volume

**Risk 4: Churn After Campaign Ends**
- **Mitigation**: Long-term community building, cross-campaign connections
- **Implementation**: Recommend related groups, celebrate milestones, habit loops
- **Testing**: Track 90-day retention, survey churned users

### Success Criteria

**Engagement:**
- 70%+ of new users post within first week
- Average 5+ posts per active user per week
- 80%+ of posts receive at least 1 reaction/comment
- 40%+ of users open app 3+ times per week

**Community Health:**
- 60%+ 30-day retention
- <5% content report rate
- <24 hour median report resolution time
- <1% false report rate

**Organizing Impact:**
- 50%+ of events have 5+ RSVPs
- 70%+ of aid requests matched within 48 hours
- 60%+ of proposals reach quorum
- Groups create 2+ wiki pages per month on average

### Timeline Estimate

**Phase 1: Social Feed MVP+1** (2 weeks)
- Epic 21: Microblogging & Activity Feed (4 hours)
- Epic 22: Moderation & Safety (3 hours)
- Testing & iteration (1 week)

**Phase 2: Discovery & Growth MVP+2** (1 week)
- Epic 23: Discovery & Recommendations (3 hours)
- Epic 24: Enhanced Onboarding (2 hours)
- Testing & iteration (3 days)

**Phase 3: Advanced Features** (ongoing)
- Epic 15.5: Forms & Fundraising (3 hours)
- Epic 16.5: Documents & Files (2.5 hours)
- Epic 25: Advanced Social (4 hours)
- Continuous iteration based on user feedback

---

## Appendices

### Appendix A: Competitive Analysis

**Similar Platforms:**
- **Mobilize**: Event organizing (not social, no encryption)
- **Signal**: Encrypted messaging (no organizing tools)
- **Mastodon**: Decentralized microblogging (no encryption, no organizing)
- **Keybase**: Encrypted social (discontinued, team features exist)

**BuildIt Network Differentiators:**
1. ✅ Activist-specific organizing tools (events, mutual aid, governance)
2. ✅ E2E encryption with metadata protection (NIP-17)
3. ✅ Decentralized (Nostr protocol, censorship-resistant)
4. ✅ Privacy-first (local-first storage, optional Tor)
5. ✅ Modular architecture (enable only needed features)

### Appendix B: Technical Architecture Recommendations

**Feed Aggregation Strategy:**

```typescript
interface FeedItem {
  id: string;
  type: 'post' | 'event' | 'proposal' | 'aid' | 'wiki';
  content: Post | Event | Proposal | AidItem | WikiPage;
  timestamp: number;
  privacy: 'public' | 'group' | 'private' | 'encrypted';
  groupId?: string;
  authorPubkey: string;

  // Engagement
  reactions: Reaction[];
  comments: Comment[];
  reposts: number;

  // Feed ranking (for hybrid algorithm)
  score?: number;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}

// Feed query builder
class FeedBuilder {
  // Filter by content types
  filterTypes(types: FeedItem['type'][]): this;

  // Filter by privacy level
  filterPrivacy(levels: PrivacyLevel[]): this;

  // Filter by groups
  filterGroups(groupIds: string[]): this;

  // Filter by time range
  filterTimeRange(start: number, end: number): this;

  // Sort algorithm
  sort(algorithm: 'chronological' | 'hybrid' | 'personalized'): this;

  // Pagination
  paginate(limit: number, offset: number): this;

  // Execute query
  async execute(): Promise<FeedItem[]>;
}
```

**Moderation Queue Implementation:**

```typescript
interface ModerationAction {
  id: string;
  reportId: string;
  action: 'approve' | 'remove' | 'warn' | 'ban' | 'escalate';
  moderatorPubkey: string;
  timestamp: number;
  reason?: string;
  notes?: string;
}

interface ModerationQueue {
  pending: Report[];
  reviewing: Report[];
  resolved: Report[];

  // Actions
  async assignToMod(reportId: string, modPubkey: string): Promise<void>;
  async takeAction(reportId: string, action: ModerationAction): Promise<void>;
  async appeal(reportId: string, appealText: string): Promise<void>;

  // Queries
  async getPendingReports(groupId?: string): Promise<Report[]>;
  async getReportsByUser(pubkey: string): Promise<Report[]>;
  async getModerationLog(groupId: string): Promise<ModerationAction[]>;
}
```

### Appendix C: Privacy Policy Recommendations

**Key Disclosures:**

1. **What Data is Collected:**
   - ✅ Nostr events (posts, reactions, etc.) - stored on public relays
   - ✅ Encrypted content (stored encrypted on relays, decryption keys local)
   - ✅ Local data (contacts, preferences) - stored only on your device
   - ❌ No analytics, no tracking, no telemetry (unless opted in)

2. **What's Public vs. Private:**
   - Public posts: Visible to anyone on Nostr network
   - Followers-only: Visible only to your followers (encrypted)
   - Group posts: Visible only to group members (encrypted)
   - Private/Direct-action: Maximum encryption, limited visibility

3. **Third-Party Data Sharing:**
   - ❌ No data sold to third parties
   - ❌ No advertising, no trackers
   - ✅ Relay operators see encrypted events (but can't decrypt)
   - ✅ Media servers store encrypted media (with decryption keys local)

4. **Data Retention:**
   - Nostr events: Stored on relays indefinitely (immutable)
   - Deletion: Client can request deletion (NIP-09), but relays may not comply
   - Local data: Stored until you clear browser storage
   - Encrypted data: Relays may store forever, but unusable without keys

### Appendix D: Accessibility Considerations

**WCAG 2.1 AA Compliance:**

1. **Keyboard Navigation:**
   - All features accessible via keyboard
   - Tab order logical
   - Focus indicators visible

2. **Screen Reader Support:**
   - Alt text for all images (already in media schema)
   - ARIA labels for interactive elements
   - Semantic HTML

3. **Color Contrast:**
   - 4.5:1 minimum contrast for text
   - 3:1 for UI components
   - Test with color blindness simulators

4. **Responsive Design:**
   - Already implemented (Epic 9.3)
   - Zoom up to 200% without breaking layout
   - Mobile-first design

5. **Captions & Transcripts:**
   - Video captions (user-uploaded or auto-generated)
   - Audio transcripts
   - Image descriptions (alt text + detailed descriptions for complex images)

---

**End of Report**

**Prepared by**: AI Community Management Expert
**Date**: 2025-10-05
**For**: BuildIt Network Development Team
**Next Steps**: Review recommendations, prioritize features, implement Epic 21 (Social Feed MVP+1)
