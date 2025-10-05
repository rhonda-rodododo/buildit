# BuildIt Network - Current vs. Proposed: Visual Comparison

**Quick Visual Guide**: What exists now vs. what we're adding

---

## Current State (v1.0.0-mvp) - "Organizing Tool Suite"

### User Experience Flow

```
Login → Pick a module → Complete task → Close app → Return only when needed

┌─────────────────────────────────────────────────────────────┐
│                   Tab-Based Navigation                       │
│  Messages | Events | Mutual Aid | Governance | Wiki | CRM   │
└─────────────────────────────────────────────────────────────┘
           ↓
    Siloed Content
   (Must navigate to each tab to see updates)
```

### What Exists ✅

**Strong Foundation:**
- ✅ E2E Encryption (NIP-17/44/59)
- ✅ 9 Functional Modules
- ✅ Privacy Levels (public/group/private/direct-action)
- ✅ Social Graph (contacts, following, blocking)
- ✅ Rich Media Support
- ✅ WebAuthn Security
- ✅ Device Management

**Organizing Tools:**
- ✅ **Events**: Create, RSVP, calendar, iCal export
- ✅ **Mutual Aid**: Requests, offers, ride share, matching
- ✅ **Governance**: Proposals, 5 voting methods, anonymous ballots
- ✅ **Wiki**: Knowledge base, markdown, version control
- ✅ **CRM/Database**: Contacts, templates, multiple views
- ✅ **Messaging**: Encrypted DMs, group chats

### What's Missing ❌

**Social Layer:**
- ❌ No unified activity feed
- ❌ No microblogging/posts (casual conversation)
- ❌ No reactions (likes, emoji responses)
- ❌ No comments (outside messaging)
- ❌ No reposts/amplification
- ❌ No bookmarks

**Discovery & Growth:**
- ❌ No group discovery (invite-only)
- ❌ No trending topics/hashtags
- ❌ No recommendations
- ❌ Weak onboarding (high churn)

**Safety & Moderation:**
- ❌ No content reporting
- ❌ No moderation queue
- ❌ Limited filtering (users only, not keywords)

---

## Proposed State (v0.21.0+) - "Social Action Network"

### User Experience Flow

```
Login → See unified feed → Scroll (posts + events + proposals + aid + wiki)
     → React, comment, repost → Stay engaged daily

┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED ACTIVITY FEED                     │
│     Home | Trending | Bookmarks | Groups | Profile          │
└─────────────────────────────────────────────────────────────┘
           ↓
  Aggregated Content
(Everything in one chronological stream)
```

### New Features ✅

**Social Engagement:**
- ✅ **Microblog Posts**: Short updates (text, images, videos, polls)
- ✅ **Activity Feed**: Unified stream (posts + events + proposals + aid + wiki)
- ✅ **Reactions**: Emoji responses (❤️, ✊, 🔥, 👍, etc.)
- ✅ **Comments**: Threaded conversations on any content
- ✅ **Reposts**: Amplify content to followers (boost or quote)
- ✅ **Bookmarks**: Save for later (private)

**Discovery:**
- ✅ **Group Directory**: Browse and join public groups
- ✅ **Trending**: Popular hashtags and posts (privacy-aware)
- ✅ **Recommendations**: Suggested contacts, groups, content

**Safety:**
- ✅ **Content Reporting**: Flag spam, harassment, violence, etc.
- ✅ **Moderation Queue**: Review, approve, remove, ban, log
- ✅ **Enhanced Filtering**: Mute keywords, hashtags, domains
- ✅ **Community Guidelines**: Clear standards, enforcement

**Onboarding:**
- ✅ **Welcome Wizard**: 3-step guided setup
- ✅ **Starter Content**: Example posts, tutorials
- ✅ **Feature Discovery**: Interactive tours

---

## Side-by-Side Comparison

| Category | Current (v1.0) | Proposed (v0.21+) |
|----------|----------------|-------------------|
| **Daily Engagement** | Task-driven (2-3 opens/week) | Social + organizing (10-12 opens/week) |
| **Content Types** | Structured only (events, proposals, aid) | Structured + casual (posts, reactions) |
| **Feed** | Siloed modules (navigate to each) | Unified feed (see all in one place) |
| **Engagement** | DMs only | Reactions, comments, reposts everywhere |
| **Discovery** | Invite links only | Directory, trending, recommendations |
| **Moderation** | Manual blocking | Reporting, queue, systematic workflows |
| **Retention** | 40% at 30 days | Projected 70% at 30 days |

---

## Content Flow: Before & After

### Before (Siloed)
```
User wants to check for updates:

Step 1: Navigate to Events tab → Check for new events
Step 2: Navigate to Mutual Aid tab → Check for requests
Step 3: Navigate to Governance tab → Check for proposals
Step 4: Navigate to Wiki tab → Check for edits
Step 5: Navigate to Messages tab → Check for DMs

Result: 5 separate navigations, easy to miss updates
Time: 2-3 minutes per check (high friction)
```

### After (Unified Feed)
```
User wants to check for updates:

Step 1: Open app → See unified feed
        - Alice posted: "We signed 10 cards today! 🎉"
        - Upcoming event: Climate strike rally tomorrow
        - Urgent aid request: Need childcare for picket shift
        - Active proposal: Endorse candidate (voting closes in 2 days)
        - Wiki updated: "Know Your Rights at Protests"

Result: Everything in one place, nothing missed
Time: 30 seconds (low friction)
```

---

## Engagement Mechanics: New Features

### 1. Microblog Posts (NEW)
```
┌────────────────────────────────────────────────────────┐
│ 📝 Alice posted in Union Chapter:                     │
│                                                        │
│ "We just signed 10 cards today! Momentum building!    │
│  Tomorrow we're targeting the night shift. Who's in?" │
│                                                        │
│ #UnionStrong #Organizing #Solidarity                  │
│                                                        │
│ 🏠 Group • 2 hours ago                                │
│                                                        │
│ ❤️ 12  💬 5  🔄 3  🔖                                  │
└────────────────────────────────────────────────────────┘
```

### 2. Reactions (NEW)
```
❤️ Like (12)
✊ Solidarity (8)
🔥 Fire (5)
👍 Agree (3)
🎉 Celebrate (2)

Click to add your reaction (anonymous option available)
```

### 3. Comments (ENHANCED)
```
💬 5 comments

Bob: "Congrats! This is huge progress! ✊"
  ❤️ 3  ↩️ Reply

Carol: "I can help with night shift outreach"
  ❤️ 1  ↩️ Reply
    Alice: "Perfect! I'll DM you the details"
    ❤️ 2

Dave: "How do we get started in our warehouse?"
  ❤️ 1  ↩️ Reply
```

### 4. Reposts (NEW)
```
🔄 James reposted (with comment):
   "Signal boost: Our comrades in Union Chapter are killing it!
    Let's show them some solidarity ✊"

   [Original post from Alice shown below]
```

---

## Privacy Levels: Posts vs. Other Content

```
Public:          Visible to anyone on Nostr network
                 ⚠️ Warning shown when posting from activist identity

Followers-Only:  Visible only to your followers
                 ✅ Encrypted, metadata protected

Group:           Visible only to group members
                 ✅ Encrypted with group key

Encrypted:       Maximum privacy (direct-action)
                 ✅ NIP-17 gift-wrapped, metadata randomized
```

---

## Moderation Workflow: Before & After

### Before (Manual, Slow)
```
Problem appears:
1. User DMs admin: "There's spam in the group"
2. Admin manually searches for post
3. Admin manually blocks user via contactsStore
4. No record, other mods don't know
```

### After (Systematic, Fast)
```
Problem appears:
1. User clicks "Report" → Selects "Spam" → Submits
2. Report added to queue, mods notified
3. Mod reviews queue:
   - Sees reported content + context
   - Sees user history (previous reports)
   - Takes action: Approve / Remove / Warn / Ban / Escalate
4. Action logged (audit trail)
5. User can appeal if false positive
```

---

## Discovery Features: New Additions

### 1. Group Directory
```
┌────────────────────────────────────────────────────────┐
│ Browse Groups                                          │
│                                                        │
│ Filters: 🏷️ Cause | 📍 Location | 👥 Size | 📊 Activity│
│                                                        │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Bay Area Mutual Aid                              │  │
│ │ 124 members • Very active                        │  │
│ │ "Supporting our community through mutual aid..."  │  │
│ │ #MutualAid #BayArea #Community                   │  │
│ │ [Join Group]                                     │  │
│ └──────────────────────────────────────────────────┘  │
│                                                        │
│ ┌──────────────────────────────────────────────────┐  │
│ │ Climate Action Coalition                         │  │
│ │ 89 members • Active                              │  │
│ │ "Direct action for climate justice..."           │  │
│ │ #Climate #DirectAction #Solidarity               │  │
│ │ [Join Group]                                     │  │
│ └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 2. Trending Topics
```
🔥 Trending Now

#MutualAid         245 posts today
#ClimateStrike     189 posts today
#UnionStrong       156 posts today
#HousingJustice    134 posts today
#Solidarity        98 posts today

(Privacy note: Trending based on relay aggregation, not user tracking)
```

### 3. Recommendations
```
👥 People to Follow
   Maria (3 mutual connections) - Union organizer
   [Follow]

🏠 Groups to Join
   "Bay Area Mutual Aid" - 124 members, very active
   [Join]

📄 Content You Might Like
   "Guide to Organizing 101" - Wiki page
   [View]

(Based on your interests: #labor #climate #mutual-aid)
```

---

## Onboarding: Before & After

### Before (Minimal)
```
1. Create account (generate or import keys)
2. Choose group or create new
3. [User dropped into empty app]
4. User doesn't know what to do next
5. User doesn't return
```

### After (Guided)
```
1. Create account (generate or import keys)

2. Welcome Wizard:
   Step 1: Choose interests (#labor, #climate, etc.)
   Step 2: Join or create first group
   Step 3: Interactive tour (create event, post, vote)

3. Starter Content:
   - Example posts showing what to do
   - Suggested follows (BuildIt Network account, popular activists)
   - Tutorials: "Create your first event", "Submit aid request"

4. First Action Prompts:
   - "Post your first update!"
   - "RSVP to an upcoming event"
   - "Vote on a proposal"

5. User engaged, habit formed, retention high
```

---

## Metrics: Current vs. Projected

| Metric | Current (v1.0) | Projected (v0.21+) | Change |
|--------|----------------|---------------------|--------|
| Daily Active Users | 20% | 50% | +150% |
| Sessions per week | 2-3 | 10-12 | +300% |
| Avg session duration | 5 min | 10 min | +100% |
| Posts per user/week | 0 | 5-7 | NEW |
| Engagement rate | N/A | 80% | NEW |
| 30-day retention | 40% | 70% | +75% |

---

## Privacy Impact Assessment

### Does Adding Social Features Reduce Privacy?

**Answer: No, if done correctly**

**New Privacy Controls Added:**
- ✅ Privacy level per post (not just per module)
- ✅ Anonymous reactions (optional)
- ✅ Encrypted hashtags (group/private posts)
- ✅ Followers-only visibility (encrypted for followers)
- ✅ Privacy warnings (when posting publicly)
- ✅ Paranoia mode (max privacy for direct-action)
- ✅ Private bookmarks (local-only or encrypted)
- ✅ Enhanced filtering (keywords, hashtags, domains)

**Existing Privacy Features (Unchanged):**
- ✅ E2E encryption (NIP-17/44/59)
- ✅ Metadata protection
- ✅ Local-first storage
- ✅ Multiple identities
- ✅ EXIF stripping
- ✅ WebAuthn key protection
- ✅ Device management

---

## Implementation Timeline

```
Week 1-2:   Epic 21 - Microblogging & Activity Feed
            ✅ Posts module
            ✅ Unified feed
            ✅ Reactions, comments, reposts, bookmarks

Week 3:     Epic 22 - Moderation & Safety
            ✅ Content reporting
            ✅ Moderation queue
            ✅ Enhanced filtering

Week 4:     Epic 23 - Discovery & Recommendations
            ✅ Group directory
            ✅ Trending topics
            ✅ Recommendations

Week 5:     Epic 24 - Enhanced Onboarding
            ✅ Welcome wizard
            ✅ Starter content

Week 6+:    Epic 25 - Advanced Features
            ✅ Polls, audio spaces, calendar sync, cross-posting

Week 10+:   Epic 15.5, 16.5 - CMS, Docs, Files
            ✅ Forms, fundraising, documents, file storage
```

---

## Key Insights

### 1. Social Glue Builds Community
**Problem**: Strong organizing tools, but users only engage when there's a task
**Solution**: Casual conversation (posts, reactions, comments) keeps users connected daily

### 2. Unified Feed Reduces Friction
**Problem**: Content siloed across modules (navigate to 5 tabs to check updates)
**Solution**: Everything in one chronological feed (see all updates in one place)

### 3. Discovery Enables Growth
**Problem**: New users don't know where to start, can't find relevant groups
**Solution**: Directory, trending, recommendations (with privacy controls)

### 4. Moderation Ensures Safety
**Problem**: No systematic way to handle spam/harassment
**Solution**: Reporting, queue, filtering (with audit trails and appeals)

### 5. Privacy First, Social Second
**Problem**: Social features can leak metadata
**Solution**: Privacy controls on every post, anonymous options, encrypted defaults

---

## Competitive Advantage

**vs. Mobilize**: Has organizing tools, no encryption, no social
**vs. Signal**: Has encryption, no organizing tools, no feed
**vs. Mastodon**: Has social feed, no encryption, no organizing
**vs. Keybase**: Had encrypted social, discontinued

**BuildIt Network Wins:**
1. Organizing tools (events, mutual aid, governance, wiki, CRM)
2. E2E encryption (NIP-17/44/59, metadata protection)
3. Social features (feed, posts, reactions, discovery)
4. Decentralized (Nostr protocol, censorship-resistant)
5. Privacy-first (local storage, optional Tor, no tracking)

---

## Conclusion

### Transformation: Tool → Platform

**Current State**: Powerful organizing tools, but feels like a feature-packed app, not a social platform

**Proposed State**: Same powerful tools + social layer = daily habit, community building, high retention

**Key Addition**: Microblogging + Unified Feed + Social Engagement + Discovery

**Result**: Users stay engaged between campaigns, build solidarity daily, grow community organically

---

**Next Steps**:
1. ✅ Review [Full Strategy Report](./SOCIAL_FEATURES_STRATEGY.md) (31,000 words)
2. ✅ Approve [Implementation Roadmap](./SOCIAL_FEATURES_CHECKLIST.md)
3. ✅ Implement Epic 21: Microblogging & Activity Feed (2 weeks)
4. ✅ Beta test with activist groups
5. ✅ Launch social features (6-8 weeks total)

**See Also**:
- [SOCIAL_FEATURES_STRATEGY.md](./SOCIAL_FEATURES_STRATEGY.md) - Full 31,000-word analysis
- [SOCIAL_FEATURES_EXECUTIVE_SUMMARY.md](./SOCIAL_FEATURES_EXECUTIVE_SUMMARY.md) - Quick overview
- [SOCIAL_FEATURES_CHECKLIST.md](./SOCIAL_FEATURES_CHECKLIST.md) - Implementation checklist
