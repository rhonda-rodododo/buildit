# BuildIt Network - Spectrum of Support Feature Recommendations

**Date**: 2025-10-05
**Based On**: Spectrum of Support methodology (Training for Change)
**Testing Results**: labor-organizing-testing-results.md
**Current Status**: v1.0.0-mvp (41% spectrum coverage)
**Goal**: 75%+ coverage across all engagement levels

---

## Executive Summary

BuildIt Network has a **strong foundation** for core organizers (65% coverage) but **weak support** for passive supporters (45%), neutrals (30%), and public transparency (15%). To fully implement the Spectrum of Support methodology, we need to:

1. **Add social layer** (activity feed, reactions, microblogging) → Serve passive/active supporters
2. **Add public layer** (landing pages, FAQs, contact forms) → Reach neutrals
3. **Add power tools** (analytics, bulk ops, task management) → Scale core organizing
4. **Add security layer** (infiltration defenses, verification) → Protect high-risk campaigns

**Investment**: ~20 hours of development across 4 epics
**Impact**: Increase spectrum coverage from 41% → 75%+
**Priority**: Tier 1 features unlock 60% more of the spectrum

---

## Tier 1: Critical Features (Implement First)

### Epic 21: Activity Feed & Social Engagement (4 hours)

**Problem**: Users can't see what's happening at a glance. Marcus (volunteer) has to check Events, then Governance, then Wiki, then Messages separately. He misses important updates and feels disconnected.

**Solution**: Unified activity feed + social engagement primitives

#### 21.1 Microblogging Posts Module (1.5h)

**What**: Short-form posts for casual conversation, updates, celebrations

**Features**:
- Post types: Text, image, video, link, poll
- Privacy levels: Public, followers-only, group, encrypted
- Hashtags and @mentions (already exists)
- Create/edit/delete posts
- Nostr event kind 1 (NIP-01)

**Components**:
```typescript
// src/modules/microblogging/
├── index.ts              // Module registration
├── schema.ts             // DBPost table
├── types.ts              // Post, PostPrivacy, PostType
├── postsStore.ts         // Zustand store
├── postsManager.ts       // CRUD operations
└── components/
    ├── PostComposer.tsx  // Create new post (with privacy picker)
    ├── PostCard.tsx      // Display post (author, content, media, engagement)
    └── PostThread.tsx    // Threaded view for replies
```

**Schema**:
```typescript
interface DBPost {
  id: string;
  content: string;
  authorPubkey: string;
  privacy: 'public' | 'followers' | 'group' | 'encrypted';
  groupId?: string;
  createdAt: number;
  updatedAt: number;

  // Media
  media: MediaAttachment[];

  // Engagement
  replyTo?: string;       // Parent post ID
  quotedPost?: string;    // Quote post ID

  // Tags
  hashtags: string[];
  mentions: string[];     // npubs

  // Encryption
  encryptedFor?: string[]; // For followers-only
}
```

**Use Cases**:
- Marcus posts: "Just talked to 3 people on my shift, 2 said they're interested!"
- Keisha posts: "We're at 60% card signatures! 30 more to go! 🎉"
- Group celebrates: "WE WON! Amazon backs down on overtime policy! 🔥✊"

#### 21.2 Unified Activity Feed (1.5h)

**What**: Aggregate content from posts, events, proposals, aid requests, wiki updates

**Features**:
- Feed aggregation from all modules
- Filter by: content type, privacy level, group, date range
- Sort by: chronological (default), hybrid (urgent items first), personalized (opt-in)
- Pagination and infinite scroll
- Mark as read/unread

**Components**:
```typescript
// src/lib/feed/
├── feedBuilder.ts        // Query builder for feed
├── feedAggregator.ts     // Aggregate from multiple modules
└── components/
    ├── ActivityFeed.tsx  // Main feed component
    ├── FeedFilters.tsx   // Filter UI (type, privacy, group)
    └── FeedItem.tsx      // Generic feed item (adapts to type)
```

**Feed Item Types**:
```typescript
type FeedItemType =
  | 'post'           // Microblog post
  | 'event'          // Event creation, RSVP update
  | 'proposal'       // Governance proposal, vote
  | 'aid'            // Mutual aid request/offer
  | 'wiki'           // Wiki page created/edited
  | 'document'       // Document shared (future)
  | 'file';          // File uploaded (future)

interface FeedItem {
  id: string;
  type: FeedItemType;
  content: Post | Event | Proposal | AidItem | WikiPage;
  timestamp: number;
  privacy: PrivacyLevel;
  groupId?: string;
  authorPubkey: string;

  // Engagement (aggregated)
  reactions: Reaction[];
  comments: number;
  reposts: number;

  // Feed ranking
  score?: number;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}
```

**Feed Algorithms**:
1. **Chronological** (default for activists)
   - Sort by timestamp DESC
   - No filtering except user preferences
   - Transparent, no manipulation

2. **Hybrid** (optional)
   - Chronological base
   - Boost urgent items (proposals closing soon, critical aid requests)
   - Boost unread items
   - User control over boosts

3. **Personalized** (opt-in only)
   - Machine learning based on engagement
   - Clearly disclosed algorithm
   - Full opt-out

**Use Cases**:
- Marcus opens app, sees: Rally photo → Proposal vote → Aid request → Wiki update
- Aisha lurks, sees: 5 new posts today → Campaign is active and real
- Tyler visits, sees: 50 members, 10 posts this week → Movement has momentum

#### 21.3 Reactions & Comments (0.5h)

**What**: Low-effort social engagement (reactions, threaded comments, reposts, bookmarks)

**Features**:

**Reactions** (NIP-25 kind 7):
- Emoji reactions (❤️, ✊, 🔥, 👍, 😂, 😢, 😡, 🎉)
- Anonymous or attributed (user choice)
- Privacy: Public reactions visible to all, group reactions encrypted
- Show reaction counts and who reacted (if not anonymous)

**Comments/Replies** (NIP-10 kind 1):
- Threaded conversations under posts, events, proposals
- Support @mentions, media attachments
- Privacy inherits from parent content
- Nested replies (up to 3 levels deep)

**Reposts/Shares** (NIP-18 kind 6/16):
- Amplify content to your followers
- Add commentary (quote posts)
- Privacy-aware: Can't repost private/group content without permission
- Show repost count

**Bookmarks** (NIP-51 kind 10003):
- Private bookmarking (local-only or encrypted sync)
- Organize into collections
- No public bookmark counts (privacy)

**Components**:
```typescript
// src/components/engagement/
├── ReactionPicker.tsx    // Emoji picker for reactions
├── ReactionList.tsx      // Display who reacted
├── CommentThread.tsx     // Threaded comment view
├── CommentComposer.tsx   // Write a comment
├── RepostButton.tsx      // Repost/quote post
└── BookmarkButton.tsx    // Save for later
```

**Schema**:
```typescript
// Reactions
interface Reaction {
  eventId: string;       // Post/event/proposal ID
  userPubkey: string;
  emoji: string;
  timestamp: number;
  anonymous: boolean;    // If true, don't show userPubkey
}

// Comments (same as Post, but with replyTo)
interface Comment extends Post {
  replyTo: string;       // Parent event ID
  depth: number;         // Nesting level (0-3)
}

// Bookmarks
interface Bookmark {
  eventId: string;
  userId: string;
  collection?: string;   // Folder/tag
  createdAt: number;
}
```

**Use Cases**:
- Marcus reacts ❤️ to Keisha's celebration post (low-effort engagement)
- Aisha reacts anonymously to solidarity post (safe engagement)
- Tyler sees "84 people reacted to this" → Social proof
- Keisha comments: "Great work! Can you bring 2 friends to the next meeting?"

#### 21.4 Integration with Existing Modules (0.5h)

**What**: Enable reactions/comments on existing content types

**Changes**:
- Add reaction/comment support to Event, Proposal, AidRequest, WikiPage
- Update UI components to show engagement counts
- Add engagement to feed items

**UI Updates**:
```typescript
// Before: EventCard shows title, time, RSVP count
// After: EventCard shows title, time, RSVP count, reactions, comments

<EventCard event={event}>
  <EventHeader />
  <EventContent />
  <EventActions>
    <RSVPButton />
    <ReactionPicker />    // NEW
    <CommentButton />     // NEW
    <ShareButton />       // NEW
  </EventActions>
  <EngagementSummary>    // NEW
    {event.reactions.length} reactions, {event.comments} comments
  </EngagementSummary>
</EventCard>
```

**Impact**:
- Marcus can react to events, proposals, wiki pages (not just messages)
- Aisha can engage without full commitment (anonymous reactions)
- Feed becomes social (not just informational)

**Validation**:
- [ ] Can create microblog posts with privacy levels
- [ ] Activity feed shows posts, events, proposals, aid
- [ ] Can filter feed by type, privacy, group
- [ ] Can react to any content type (posts, events, proposals)
- [ ] Can comment on any content type (threaded)
- [ ] Can repost/quote post with attribution
- [ ] Can bookmark content for later
- [ ] Anonymous reactions work (identity hidden)

---

### Epic 21B: Public Pages Foundation (2 hours)

**Problem**: Tyler (neutral) can't learn about the campaign without joining. Elena (researcher) can't follow public updates without membership. Aisha (passive support) can't see if the movement is real.

**Solution**: Public-facing pages, contact forms, transparency controls

#### 21B.1 Public Campaign Pages (1h)

**What**: Public landing pages for campaigns (no login required)

**Features**:
- Campaign landing page (customizable)
- About page (mission, values, demands)
- Events calendar (public events only)
- News/updates feed (public posts only)
- SEO controls (meta tags, Open Graph, Twitter cards)
- Custom domain support (CNAME configuration)

**Components**:
```typescript
// src/modules/public-pages/
├── index.ts              // Module registration
├── schema.ts             // DBPublicPage, DBPageSettings
├── types.ts              // PublicPage, PageTemplate, SEOConfig
├── publicPagesStore.ts   // Zustand store
└── components/
    ├── PublicCampaignPage.tsx    // Main landing page
    ├── PublicAboutPage.tsx       // About the campaign
    ├── PublicEventsPage.tsx      // Public events calendar
    ├── PublicNewsFeed.tsx        // Public updates feed
    ├── PageBuilder.tsx           // Drag-drop page editor
    └── SEOControls.tsx           // Meta tags, OG, Twitter cards
```

**Page Templates**:
```typescript
type PageTemplate =
  | 'campaign'       // Main campaign page (hero, demands, join CTA)
  | 'about'          // About the campaign (mission, values, team)
  | 'events'         // Event calendar (public events only)
  | 'news'           // News feed (public posts, press releases)
  | 'contact'        // Contact form
  | 'resources'      // Public wiki pages, downloads
  | 'custom';        // Custom layout

interface PublicPage {
  id: string;
  groupId: string;
  slug: string;         // URL path (/campaigns/amazon-union)
  template: PageTemplate;
  title: string;
  description: string;
  content: string;      // Markdown or structured content
  published: boolean;
  customDomain?: string;

  // SEO
  metaTags: Record<string, string>;
  ogImage?: string;

  // Analytics (privacy-respecting)
  viewCount?: number;
  lastUpdated: number;
}
```

**Visibility Controls**:
```typescript
interface GroupPublicSettings {
  groupId: string;
  hasPublicPage: boolean;
  publicSlug: string;        // URL slug
  customDomain?: string;

  // What to show publicly
  showMemberCount: boolean;
  showRecentActivity: boolean;
  showUpcomingEvents: boolean;
  showPublicPosts: boolean;
  showWins: boolean;

  // Contact
  contactEmail?: string;
  contactForm: boolean;
}
```

**URL Structure**:
```
// Public pages (no login)
buildit.network/campaigns/amazon-union
buildit.network/campaigns/amazon-union/about
buildit.network/campaigns/amazon-union/events
buildit.network/campaigns/amazon-union/news

// Or custom domain
amazonworkers.org
amazonworkers.org/about
amazonworkers.org/events
```

**Use Cases**:
- Tyler Googles "Amazon union Seattle", finds campaign page, reads demands
- Elena subscribes to public news feed, follows campaign without joining
- Keisha shares campaign page on Twitter to recruit neutrals

#### 21B.2 Public Wiki & FAQ (0.5h)

**What**: Make select wiki pages public (no login required)

**Features**:
- Wiki pages can be marked "public" (group admins choose)
- Public wiki accessible at /campaigns/[slug]/wiki/[page-name]
- FAQ pages for common questions
- "Know Your Rights" guides
- Public resources library

**Changes to Wiki Module**:
```typescript
// Add to WikiPage type
interface WikiPage {
  // ... existing fields
  isPublic: boolean;     // NEW
  publicSlug?: string;   // NEW: URL-friendly name
}
```

**Public Wiki Pages** (suggested for campaigns):
1. "Why We're Organizing" (campaign overview)
2. "What's in It for Me?" (benefits, wage calculator)
3. "Frequently Asked Questions" (common objections)
4. "Know Your Rights" (legal protections)
5. "How to Get Involved" (engagement ladder)

**Use Cases**:
- Tyler reads "What's in It for Me?" wiki page → Sees $5/hr wage increase estimate
- Aisha bookmarks "Know Your Rights" page → Feels safer about organizing
- Elena includes public wiki links in her article

#### 21B.3 Contact Forms (0.5h)

**What**: Allow external inquiries without joining group

**Features**:
- Contact form on public pages
- Form submissions → DM to group admins
- Anti-spam (rate limiting, honeypot, optional CAPTCHA)
- Anonymous submissions or require email

**Components**:
```typescript
// src/modules/public-pages/components/
├── ContactForm.tsx       // Public contact form
├── ContactSubmissions.tsx // Admin view of submissions
└── AntiSpam.tsx          // Rate limiting, honeypot
```

**Schema**:
```typescript
interface ContactSubmission {
  id: string;
  groupId: string;
  name?: string;
  email?: string;
  message: string;
  createdAt: number;
  ipHash?: string;       // Hashed for spam prevention
  status: 'unread' | 'read' | 'replied' | 'spam';
}
```

**Use Cases**:
- Elena fills out contact form: "I'm a researcher studying labor organizing, can we talk?"
- Keisha sees submission in admin panel, replies via DM
- Tyler asks: "How do I join?" → Auto-response with invite link

**Validation**:
- [ ] Can create public campaign page (no login required to view)
- [ ] Can mark wiki pages as public
- [ ] Public page shows member count (if enabled)
- [ ] Public page shows recent activity (if enabled)
- [ ] Contact form works, submissions go to admins
- [ ] Anti-spam works (rate limiting, honeypot)
- [ ] SEO tags work (meta, OG, Twitter cards)
- [ ] Custom domain support (CNAME)

---

## Tier 2: Power Tools for Core Organizers (Next Sprint)

### Epic 22: Analytics & Reporting Dashboard (2 hours)

**Problem**: Keisha (core organizer) can't make data-driven decisions. She manually counts contacts, remembers who she talked to, and guesses at support levels.

**Solution**: Analytics dashboard with campaign metrics

#### 22.1 CRM Analytics (1h)

**What**: Reports and visualizations for contact database

**Metrics**:
- **Support Level Distribution**: How many in each level (neutral, passive, active)
- **Contact Rate**: Conversations per week, per organizer
- **Pipeline Movement**: Flow from neutral → passive → active
- **Organizer Performance**: Who's talking to the most people
- **Department/Shift Analysis**: Which areas are strongest

**Components**:
```typescript
// src/modules/crm/components/analytics/
├── AnalyticsDashboard.tsx    // Main dashboard
├── SupportLevelChart.tsx     // Pie chart of support levels
├── ContactRateChart.tsx      // Line chart of contact rate over time
├── PipelineFlowChart.tsx     // Sankey diagram of movement
├── OrganizerLeaderboard.tsx  // Who's most active
└── DepartmentHeatmap.tsx     // Geographic/department breakdown
```

**Queries**:
```typescript
// Support level distribution
SELECT supportLevel, COUNT(*) as count
FROM contacts
WHERE groupId = ?
GROUP BY supportLevel;

// Contact rate (last 30 days)
SELECT DATE(lastContactDate) as date, COUNT(*) as contacts
FROM contacts
WHERE groupId = ? AND lastContactDate > DATE('now', '-30 days')
GROUP BY DATE(lastContactDate);

// Pipeline movement (this month)
SELECT
  previousSupportLevel,
  currentSupportLevel,
  COUNT(*) as count
FROM contactHistory
WHERE groupId = ? AND changedAt > DATE('now', 'start of month')
GROUP BY previousSupportLevel, currentSupportLevel;
```

**Use Cases**:
- Keisha sees: 150 contacts, 30% neutral, 45% passive support, 25% active support
- Keisha sees: Contact rate dropped last week → Need to re-energize team
- Keisha sees: Night shift has low engagement → Assign organizer to that shift

#### 22.2 Campaign Analytics (1h)

**What**: Track campaign progress over time

**Metrics**:
- **Membership Growth**: New members per week
- **Event Attendance**: RSVP rate, actual attendance
- **Governance Participation**: Vote turnout, proposal pass rate
- **Engagement Trends**: Posts, reactions, comments over time
- **Win Tracking**: Victories, losses, ongoing fights

**Components**:
```typescript
// src/lib/analytics/
├── CampaignDashboard.tsx     // Overall campaign metrics
├── MembershipGrowth.tsx      // Line chart of growth
├── EventMetrics.tsx          // RSVP vs. attendance
├── EngagementMetrics.tsx     // Social engagement over time
└── WinTracker.tsx            // Track victories
```

**Metrics Schema**:
```typescript
interface CampaignMetrics {
  groupId: string;
  date: string;          // YYYY-MM-DD

  // Membership
  totalMembers: number;
  newMembers: number;
  activeMembers: number; // Posted/reacted in last 7 days

  // Engagement
  posts: number;
  reactions: number;
  comments: number;

  // Events
  eventsCreated: number;
  totalRSVPs: number;
  attendanceRate: number; // %

  // Governance
  proposalsCreated: number;
  votesCast: number;
  voterTurnout: number;  // %
}
```

**Use Cases**:
- Keisha sees: Membership growth +15% this month
- Keisha sees: Event attendance rate dropped from 80% → 60% → Investigate why
- Keisha sees: 5 wins in the last 3 months → Use for fundraising pitch

**Validation**:
- [ ] CRM analytics show support level distribution
- [ ] CRM analytics show contact rate over time
- [ ] CRM analytics show pipeline movement (spectrum shifts)
- [ ] Campaign dashboard shows membership growth
- [ ] Campaign dashboard shows event metrics
- [ ] Campaign dashboard shows engagement trends
- [ ] Can export reports as CSV or PDF

---

### Epic 23: Bulk Operations & Scaling Tools (2 hours)

**Problem**: Keisha (core organizer) can't scale operations. Sending 50 messages takes 30 minutes of one-by-one clicking.

**Solution**: Bulk operations for contacts, messages, and tasks

#### 23.1 Bulk Selection & Actions (1h)

**What**: Select multiple contacts, perform actions on all at once

**Features**:
- Multi-select in CRM table view (checkboxes)
- Select all (with filters)
- Select by criteria (e.g., all in Department X with Support Level Y)
- Bulk actions: Send message, update field, assign task, add tag, export

**Components**:
```typescript
// src/modules/crm/components/
├── BulkSelector.tsx      // Multi-select UI
├── BulkActions.tsx       // Action menu
└── BulkProgress.tsx      // Progress indicator for long operations
```

**Bulk Actions**:
```typescript
interface BulkAction {
  type: 'message' | 'update_field' | 'assign_task' | 'add_tag' | 'export';
  contactIds: string[];

  // Message
  messageContent?: string;

  // Update field
  fieldId?: string;
  newValue?: any;

  // Assign task
  taskDescription?: string;
  assignedTo?: string;
  dueDate?: number;

  // Add tag
  tag?: string;
}

// Execute bulk action
async function executeBulkAction(action: BulkAction): Promise<void> {
  // Show progress indicator
  const total = action.contactIds.length;
  let completed = 0;

  for (const contactId of action.contactIds) {
    switch (action.type) {
      case 'message':
        await sendMessage(contactId, action.messageContent);
        break;
      case 'update_field':
        await updateContact(contactId, { [action.fieldId]: action.newValue });
        break;
      // ...
    }
    completed++;
    updateProgress(completed / total);
  }

  showNotification(`Bulk action completed: ${total} contacts`);
}
```

**Use Cases**:
- Keisha selects 50 contacts with "Passive Support" + "Night Shift"
- Keisha sends bulk message: "Hey, we're having a night shift meeting next Tuesday. Can you make it?"
- Keisha updates all 50 contacts: Last Contact Date → Today

#### 23.2 Automated Follow-Ups (1h)

**What**: Set reminders and automated task generation

**Features**:
- Follow-up reminders (e.g., "Contact again in 1 week")
- Automated task creation (e.g., "If no response in 3 days, assign follow-up")
- Task assignment to organizers
- Task queue and tracking

**Components**:
```typescript
// src/modules/tasks/
├── index.ts              // Module registration
├── schema.ts             // DBTask table
├── types.ts              // Task, TaskStatus, TaskPriority
├── tasksStore.ts         // Zustand store
└── components/
    ├── TaskQueue.tsx     // List of tasks
    ├── TaskCard.tsx      // Individual task
    ├── CreateTask.tsx    // Assign task to organizer
    └── TaskFilters.tsx   // Filter by status, priority, assignee
```

**Schema**:
```typescript
interface DBTask {
  id: string;
  groupId: string;
  description: string;
  contactId?: string;    // Related contact (optional)

  // Assignment
  createdBy: string;     // pubkey
  assignedTo: string;    // pubkey
  dueDate?: number;

  // Status
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Tracking
  createdAt: number;
  completedAt?: number;
  notes?: string;
}
```

**Automation Rules**:
```typescript
interface AutomationRule {
  id: string;
  groupId: string;
  name: string;
  enabled: boolean;

  // Trigger
  trigger: 'new_contact' | 'support_level_change' | 'no_contact_in_x_days';
  triggerConfig: any;

  // Action
  action: 'create_task' | 'send_message' | 'update_field';
  actionConfig: any;
}

// Example: Auto-create follow-up task
{
  trigger: 'no_contact_in_x_days',
  triggerConfig: { days: 7 },
  action: 'create_task',
  actionConfig: {
    description: 'Follow up with {{contact.name}}',
    priority: 'medium',
    assignedTo: '{{contact.organizer}}'
  }
}
```

**Use Cases**:
- Keisha creates rule: "If contact hasn't been reached in 7 days, create follow-up task"
- Marcus gets notification: "You have 5 tasks due this week"
- Marcus completes task: "Follow up with Sarah" → Task marked complete

**Validation**:
- [ ] Can multi-select contacts in CRM
- [ ] Can send bulk messages (with progress indicator)
- [ ] Can bulk update fields
- [ ] Can bulk assign tasks
- [ ] Can export selected contacts to CSV
- [ ] Tasks appear in task queue
- [ ] Can complete tasks and track progress
- [ ] Automated tasks created based on rules

---

### Epic 24: Activity Logging & Contact History (2 hours)

**Problem**: Keisha (core organizer) doesn't have conversation history. She can't remember what she said to Sarah 2 weeks ago, or if anyone else talked to Sarah recently.

**Solution**: Automatic activity logging per contact

#### 24.1 Contact Activity Log (1h)

**What**: Auto-track all interactions with a contact

**Features**:
- Auto-log messages sent/received
- Auto-log event RSVPs and attendance
- Auto-log field updates (e.g., support level changed)
- Manual notes (organizer-added)
- Timeline view per contact

**Components**:
```typescript
// src/modules/crm/components/
├── ContactDetail.tsx         // Contact profile page
├── ActivityTimeline.tsx      // Timeline of all interactions
├── ActivityLogEntry.tsx      // Single log entry
└── AddNote.tsx               // Manual note entry
```

**Schema**:
```typescript
interface DBContactActivity {
  id: string;
  contactId: string;
  groupId: string;

  // Activity type
  type: 'message' | 'event_rsvp' | 'event_attendance' | 'field_update' | 'note' | 'task_completed';

  // Details (varies by type)
  details: {
    // Message
    messageId?: string;
    messagePreview?: string;

    // Event
    eventId?: string;
    eventName?: string;
    rsvpStatus?: 'going' | 'maybe' | 'not_going';
    attended?: boolean;

    // Field update
    field?: string;
    oldValue?: any;
    newValue?: any;

    // Note
    note?: string;

    // Task
    taskId?: string;
    taskDescription?: string;
  };

  // Metadata
  timestamp: number;
  performedBy: string;   // pubkey (who did this action)
}
```

**Auto-Logging Triggers**:
```typescript
// When message sent
messageManager.on('messageSent', async (message) => {
  if (message.recipientPubkey) {
    await contactActivityManager.log({
      contactId: findContactByPubkey(message.recipientPubkey),
      type: 'message',
      details: {
        messageId: message.id,
        messagePreview: message.content.substring(0, 100)
      },
      performedBy: message.authorPubkey
    });
  }
});

// When RSVP created
eventManager.on('rsvpCreated', async (rsvp) => {
  await contactActivityManager.log({
    contactId: findContactByPubkey(rsvp.userPubkey),
    type: 'event_rsvp',
    details: {
      eventId: rsvp.eventId,
      eventName: rsvp.event.title,
      rsvpStatus: rsvp.status
    },
    performedBy: rsvp.userPubkey
  });
});

// When field updated
crmManager.on('contactUpdated', async (contact, changes) => {
  for (const [field, { oldValue, newValue }] of Object.entries(changes)) {
    await contactActivityManager.log({
      contactId: contact.id,
      type: 'field_update',
      details: { field, oldValue, newValue },
      performedBy: getCurrentUserPubkey()
    });
  }
});
```

**Timeline View**:
```tsx
<ActivityTimeline contactId={contact.id}>
  {activities.map(activity => (
    <ActivityLogEntry key={activity.id}>
      <Timestamp>{formatDate(activity.timestamp)}</Timestamp>
      <Actor>{getUserName(activity.performedBy)}</Actor>
      <Description>
        {activity.type === 'message' && (
          <>Sent message: "{activity.details.messagePreview}"</>
        )}
        {activity.type === 'event_rsvp' && (
          <>RSVPed "{activity.details.rsvpStatus}" to {activity.details.eventName}</>
        )}
        {activity.type === 'field_update' && (
          <>Updated {activity.details.field} from {activity.details.oldValue} → {activity.details.newValue}</>
        )}
        {activity.type === 'note' && (
          <>Added note: "{activity.details.note}"</>
        )}
      </Description>
    </ActivityLogEntry>
  ))}
</ActivityTimeline>
```

**Use Cases**:
- Keisha opens Sarah's contact page → Sees timeline:
  - 2 weeks ago: Marcus sent message "Hey, want to join the union?"
  - 1 week ago: Sarah RSVPed "going" to house meeting
  - 3 days ago: Keisha updated Support Level from "Neutral" → "Passive Support"
  - Today: Keisha adds note: "Sarah is worried about retaliation. Follow up after next meeting."

#### 24.2 Conversation History View (1h)

**What**: See all messages with a contact in one place

**Features**:
- Message thread view (DMs with this contact)
- Group messages where contact was mentioned
- Integrated with activity timeline
- Search within conversation

**Components**:
```typescript
// src/modules/crm/components/
├── ConversationHistory.tsx   // All messages with contact
├── MessageSearchBar.tsx      // Search within conversation
└── MentionedMessages.tsx     // Group messages where contact mentioned
```

**Queries**:
```typescript
// Get all DMs with contact
const dms = await db.messages
  .where('[authorPubkey+recipientPubkey]')
  .equals([currentUserPubkey, contactPubkey])
  .or('[authorPubkey+recipientPubkey]')
  .equals([contactPubkey, currentUserPubkey])
  .sortBy('timestamp');

// Get group messages where contact mentioned
const mentions = await db.messages
  .where('groupId')
  .equals(groupId)
  .filter(msg => msg.mentions?.includes(contactPubkey))
  .sortBy('timestamp');
```

**Use Cases**:
- Keisha opens Sarah's profile → Clicks "Conversation History"
- Sees all DMs exchanged with Sarah (last 3 months)
- Searches for "retaliation" → Finds conversation where Sarah expressed concerns
- Adds note based on conversation context

**Validation**:
- [ ] Activity log auto-populates when messages sent
- [ ] Activity log auto-populates when events RSVPed
- [ ] Activity log auto-populates when fields updated
- [ ] Can manually add notes to activity log
- [ ] Timeline view shows chronological activity
- [ ] Conversation history shows all DMs with contact
- [ ] Can search within conversation history
- [ ] Group mentions appear in conversation history

---

## Tier 3: Engagement & Activation Features (Post-MVP+1)

### Epic 25: Engagement Ladder & Onboarding (3 hours)

**Problem**: Aisha (passive support) doesn't know what her "next step" should be. Tyler (neutral) joined but doesn't know what to do.

**Solution**: Guided pathways based on engagement level

#### 25.1 Engagement Ladder UI (1.5h)

**What**: Show users their current engagement level and suggest next steps

**Features**:
- Engagement level detection (neutral, passive, active, core)
- Personalized next-step suggestions
- Progress visualization
- Milestone celebrations

**Components**:
```typescript
// src/lib/engagement/
├── EngagementLadder.tsx      // Main ladder UI
├── EngagementLevel.tsx       // Current level indicator
├── NextSteps.tsx             // Suggested actions
├── MilestoneCelebration.tsx  // Celebrate achievements
└── ProgressBar.tsx           // Visual progress
```

**Engagement Levels**:
```typescript
type EngagementLevel =
  | 'observer'        // Just joined, read-only
  | 'participant'     // Reacted, commented, voted
  | 'contributor'     // Posted, attended event, helped someone
  | 'organizer'       // Recruited people, led meeting, ran event
  | 'leader';         // Campaign director, multi-event organizer

interface UserEngagement {
  userId: string;
  groupId: string;
  level: EngagementLevel;

  // Activity metrics
  joinedAt: number;
  lastActiveAt: number;
  postsCreated: number;
  reactionsGiven: number;
  commentsPosted: number;
  eventsAttended: number;
  eventsCreated: number;
  peopleRecruited: number;
  tasksCompleted: number;

  // Milestones
  milestonesAchieved: string[];
  nextMilestone: string;
}

// Detect engagement level
function detectEngagementLevel(metrics: UserEngagement): EngagementLevel {
  if (metrics.eventsCreated >= 3 && metrics.peopleRecruited >= 5) return 'leader';
  if (metrics.eventsCreated >= 1 || metrics.peopleRecruited >= 3) return 'organizer';
  if (metrics.postsCreated >= 5 || metrics.eventsAttended >= 2) return 'contributor';
  if (metrics.reactionsGiven >= 5 || metrics.commentsPosted >= 3) return 'participant';
  return 'observer';
}
```

**Next-Step Suggestions**:
```typescript
const nextSteps: Record<EngagementLevel, string[]> = {
  observer: [
    'React to a post to show your support',
    'Attend a public event (no commitment required)',
    'Vote in a poll (anonymous)',
    'Read our FAQ wiki page'
  ],
  participant: [
    'Post an update in the group chat',
    'RSVP to an organizing meeting',
    'Share your story (why you joined)',
    'Invite a friend to join'
  ],
  contributor: [
    'Talk to 3 coworkers about the campaign',
    'Attend a training (organizing skills)',
    'Lead a committee (specific issue or area)',
    'Create an event for your department'
  ],
  organizer: [
    'Recruit 5 new members',
    'Run a house meeting',
    'Lead a subcommittee',
    'Mentor a new organizer'
  ],
  leader: [
    'Scale to new departments or locations',
    'Represent campaign in coalition',
    'Train other organizers',
    'Run campaign strategy meetings'
  ]
};
```

**Milestone Celebrations**:
```typescript
const milestones = [
  { id: 'first_post', name: 'First Post', action: 'Create your first post' },
  { id: 'first_event', name: 'First Event', action: 'RSVP to an event' },
  { id: 'first_meeting', name: 'First Meeting', action: 'Attend an organizing meeting' },
  { id: 'first_recruit', name: 'Recruited Someone', action: 'Invite a friend who joins' },
  { id: 'ten_conversations', name: '10 Conversations', action: 'Talk to 10 people about the campaign' },
  { id: 'led_event', name: 'Event Leader', action: 'Create and run your own event' },
  { id: 'committee_member', name: 'Committee Member', action: 'Join an organizing committee' }
];

// When milestone achieved
engagementManager.on('milestoneAchieved', async (userId, milestone) => {
  showCelebration({
    title: `🎉 ${milestone.name}!`,
    message: `You just ${milestone.action}. Keep up the great work!`,
    sharePrompt: 'Share your achievement with the group?'
  });
});
```

**UI Examples**:
```tsx
<EngagementLadder user={currentUser}>
  <CurrentLevel>
    <Badge color="blue">Participant</Badge>
    <Description>You're engaging with the campaign! Ready to take the next step?</Description>
  </CurrentLevel>

  <ProgressBar>
    <Step completed>Observer</Step>
    <Step current>Participant</Step>
    <Step>Contributor</Step>
    <Step>Organizer</Step>
    <Step>Leader</Step>
  </ProgressBar>

  <NextSteps>
    <Suggestion priority="high">
      Post an update in the group chat
      <ActionButton>Create Post</ActionButton>
    </Suggestion>
    <Suggestion priority="medium">
      RSVP to the organizing meeting on Tuesday
      <ActionButton>RSVP</ActionButton>
    </Suggestion>
  </NextSteps>

  <Milestones>
    <Achieved>✅ First Post</Achieved>
    <Achieved>✅ First Event</Achieved>
    <Next>📌 Next: Recruit Someone</Next>
  </Milestones>
</EngagementLadder>
```

**Use Cases**:
- Aisha joins group → Sees "Observer" level → Suggested next step: "React to a post"
- Aisha reacts to 5 posts → Moves to "Participant" → Celebration: "🎉 You're now a Participant!"
- Aisha sees next step: "RSVP to an event" → RSVPs → Moves toward "Contributor"
- Marcus sees: "You're an Organizer! Next step: Recruit 5 people to become a Leader"

#### 25.2 Personalized Onboarding by Level (1h)

**What**: Different onboarding flows for different entry points

**Flows**:

**Neutral (Public Visitor)**:
1. Land on public campaign page
2. Watch 2-minute explainer video
3. Read FAQ wiki page
4. Vote in anonymous poll: "What's your biggest issue at work?"
5. See results + social proof: "84 workers have joined"
6. Call-to-action: "Join us" → Creates account

**Passive Support (New Member)**:
1. Create account (via QR code or invite link)
2. Welcome message: "Hi! We're glad you're here. Let's get you started."
3. Choose interests: [X] Better wages, [X] Safer conditions, [ ] Healthcare, [X] Respect
4. Join group automatically (from invite link)
5. See activity feed: Recent posts, upcoming events, resources
6. Suggested first action: "React ❤️ to a post to show your support"

**Active Support (Engaged Member)**:
1. Member for 2+ weeks, attended 2+ events
2. Onboarding: "You're ready to organize! Here's how:"
3. Tutorial: How to have an organizing conversation
4. Tutorial: How to use the CRM to track contacts
5. Suggested action: "Talk to 3 coworkers and add them to CRM"

**Components**:
```typescript
// src/lib/onboarding/
├── OnboardingWizard.tsx      // Multi-step wizard
├── WelcomeScreen.tsx         // Welcome message
├── InterestSelector.tsx      // Choose campaign issues
├── FirstStepSuggestion.tsx   // Personalized first action
└── TutorialOverlay.tsx       // Interactive feature walkthrough
```

**Use Cases**:
- Tyler visits public page → Completes onboarding → Joins as "Observer"
- Aisha joins via QR code → Completes onboarding → Joins as "Participant" (skips observer)
- Marcus becomes active → Sees organizing tutorial → Becomes "Contributor"

#### 25.3 Smart Notifications & Reminders (0.5h)

**What**: Context-aware notifications to move people up the ladder

**Notification Types**:

**For Observers**:
- "5 people posted today. See what's happening →"
- "Public event tomorrow: Pizza & Q&A (no RSVP required)"
- "Poll: What's your biggest concern? (anonymous)"

**For Participants**:
- "You haven't posted in 2 weeks. Share an update?"
- "3 upcoming events you might like →"
- "Proposal vote closing tomorrow - make your voice heard"

**For Contributors**:
- "You've attended 3 events! Ready to lead one?"
- "5 tasks need volunteers this week →"
- "Training available: How to Have Organizing Conversations"

**For Organizers**:
- "You have 5 follow-up tasks due this week"
- "Contact rate is down 20% - let's re-energize"
- "New members joined - welcome them?"

**Components**:
```typescript
// src/lib/notifications/
├── SmartNotifications.tsx    // Context-aware notification system
├── NotificationScheduler.ts  // Schedule notifications based on engagement
└── NotificationPreferences.tsx // User control over notification types
```

**Scheduling Logic**:
```typescript
// For passive supporters who haven't engaged in 7 days
if (user.level === 'participant' && daysSinceLastAction > 7) {
  scheduleNotification({
    userId: user.id,
    type: 'engagement_reminder',
    message: "We miss you! Here's what's been happening:",
    actions: [
      { label: 'See Recent Posts', link: '/feed' },
      { label: 'Upcoming Events', link: '/events' }
    ],
    sendAt: tomorrow9am
  });
}
```

**Use Cases**:
- Aisha gets notification: "5 people reacted to a post about wages. Check it out?"
- Aisha clicks, reacts, feels connected
- Marcus gets reminder: "You have 2 tasks due tomorrow"
- Marcus completes tasks, feels accomplished

**Validation**:
- [ ] Engagement level auto-detects based on activity
- [ ] Next-step suggestions appear based on level
- [ ] Progress bar visualizes ladder position
- [ ] Milestone celebrations trigger when achieved
- [ ] Onboarding flow adapts to entry point (neutral vs. member)
- [ ] Smart notifications send context-aware reminders
- [ ] Users can customize notification preferences

---

### Epic 26: Anonymous Engagement & Privacy Controls (2 hours)

**Problem**: Aisha (passive support) wants to engage but fears retaliation. She needs anonymous participation options.

**Solution**: Anonymous reactions, polls, and covert supporter role

#### 26.1 Anonymous Reactions & Voting (1h)

**What**: Allow reactions and votes without revealing identity

**Features**:
- Anonymous reactions (reaction count visible, but not who reacted)
- Anonymous poll responses
- Anonymous governance votes (already exists in governance module, expand to polls)
- Privacy controls: User chooses anonymous vs. attributed per action

**Implementation**:
```typescript
// Update Reaction type
interface Reaction {
  eventId: string;
  userPubkey: string;   // For storage, not displayed
  emoji: string;
  timestamp: number;
  anonymous: boolean;   // NEW
}

// Display logic
function displayReactions(reactions: Reaction[]): JSX.Element {
  const grouped = groupBy(reactions, r => r.emoji);

  return (
    <ReactionList>
      {Object.entries(grouped).map(([emoji, emojiReactions]) => (
        <ReactionBubble emoji={emoji} count={emojiReactions.length}>
          {/* If all anonymous, don't show names */}
          {emojiReactions.every(r => r.anonymous) ? (
            <Tooltip>{emojiReactions.length} people reacted</Tooltip>
          ) : (
            <Tooltip>
              {emojiReactions
                .filter(r => !r.anonymous)
                .map(r => getUserName(r.userPubkey))
                .join(', ')}
              {emojiReactions.some(r => r.anonymous) && ' and others'}
            </Tooltip>
          )}
        </ReactionBubble>
      ))}
    </ReactionList>
  );
}
```

**Anonymous Polls**:
```typescript
interface Poll {
  id: string;
  question: string;
  options: string[];
  allowAnonymous: boolean;  // Creator decides
  allowMultiple: boolean;
  closesAt?: number;
}

interface PollVote {
  pollId: string;
  userId: string;
  optionIndex: number;
  anonymous: boolean;       // Voter decides (if allowed)
  timestamp: number;
}

// Display results
function displayPollResults(poll: Poll, votes: PollVote[]): JSX.Element {
  const results = poll.options.map((option, idx) => ({
    option,
    count: votes.filter(v => v.optionIndex === idx).length,
    voters: votes
      .filter(v => v.optionIndex === idx && !v.anonymous)
      .map(v => getUserName(v.userId))
  }));

  return (
    <PollResults>
      {results.map(r => (
        <PollOption>
          <OptionText>{r.option}</OptionText>
          <VoteCount>{r.count} votes</VoteCount>
          {r.voters.length > 0 && (
            <VoterList>{r.voters.join(', ')} {r.count > r.voters.length && 'and others'}</VoterList>
          )}
          <ProgressBar width={(r.count / votes.length) * 100} />
        </PollOption>
      ))}
    </PollResults>
  );
}
```

**Use Cases**:
- Aisha sees post about wages → Reacts ❤️ anonymously
- Post shows "5 people reacted ❤️" (doesn't show Aisha's name)
- Aisha votes in poll: "Do you support the strike?" → "Yes" (anonymous)
- Results show: "15 Yes, 3 No, 2 Unsure" (no names)

#### 26.2 Covert Supporter Role (0.5h)

**What**: Participate internally without appearing on public lists

**Features**:
- "Covert supporter" role (group admins can assign)
- Hidden from public member lists
- Can participate in group (messages, events, votes)
- Can't be @mentioned publicly
- Profile visibility: Group-only (not public)

**Implementation**:
```typescript
interface GroupMembership {
  // ... existing fields
  role: 'admin' | 'moderator' | 'member' | 'read-only' | 'covert';  // NEW
  visibleToPublic: boolean;   // NEW: False for covert supporters
}

// When displaying member list
function getMemberList(groupId: string, includeCovert: boolean = false): GroupMembership[] {
  const members = await db.groupMembers.where('groupId').equals(groupId).toArray();

  if (!includeCovert) {
    return members.filter(m => m.role !== 'covert');
  }

  return members;
}

// Public member count
function getPublicMemberCount(groupId: string): number {
  return getMemberList(groupId, false).length;
}

// Internal member count (admins only)
function getTotalMemberCount(groupId: string): number {
  return getMemberList(groupId, true).length;
}
```

**Use Cases**:
- Aisha expresses concern about retaliation
- Keisha assigns "Covert Supporter" role
- Aisha can participate in group, but doesn't appear on public member list
- If campaign page shows "84 members", Aisha isn't counted publicly

#### 26.3 Privacy Dashboard (0.5h)

**What**: Show users what's public vs. private, give granular controls

**Features**:
- Privacy audit: What data is public, what's encrypted
- Visibility controls: Who can see profile, posts, activity
- Opt-out of discovery features (trending, recommendations)
- Download my data (GDPR-style export)

**Components**:
```typescript
// src/components/privacy/
├── PrivacyDashboard.tsx      // Main privacy settings
├── DataAudit.tsx             // What's public vs. private
├── VisibilityControls.tsx    // Granular privacy settings
└── DataExport.tsx            // Download my data
```

**Privacy Audit Display**:
```tsx
<PrivacyDashboard>
  <Section title="Public Data">
    <Item icon="🌐">Your profile (name, bio, avatar)</Item>
    <Item icon="🌐">Public posts (15 posts)</Item>
    <Item icon="🌐">Public events you created (2 events)</Item>
  </Section>

  <Section title="Group Data (Encrypted)">
    <Item icon="🔒">Group messages (248 messages)</Item>
    <Item icon="🔒">Group events you RSVPed to (12 events)</Item>
    <Item icon="🔒">CRM contact records (only admins see this)</Item>
  </Section>

  <Section title="Private Data (Local Only)">
    <Item icon="🕵️">Bookmarks (23 saved posts)</Item>
    <Item icon="🕵️">Read/unread status</Item>
    <Item icon="🕵️">Notification preferences</Item>
  </Section>

  <Section title="Visibility Controls">
    <Toggle enabled={profile.showFollowerCount}>Show follower count on profile</Toggle>
    <Toggle enabled={profile.showActivityStatus}>Show when I'm online</Toggle>
    <Toggle enabled={profile.allowPublicMentions}>Allow public @mentions</Toggle>
  </Section>

  <Section title="Discovery">
    <Toggle enabled={!privacy.optOutOfRecommendations}>Include me in recommendations</Toggle>
    <Toggle enabled={!privacy.optOutOfTrending}>Include my posts in trending</Toggle>
  </Section>

  <DataExport>
    <Button>Download My Data (JSON)</Button>
  </DataExport>
</PrivacyDashboard>
```

**Use Cases**:
- Aisha opens privacy dashboard → Sees exactly what's public
- Aisha disables "Allow public @mentions" → Can't be mentioned in public posts
- Aisha opts out of recommendations → Won't appear in "Suggested Contacts"

**Validation**:
- [ ] Can react anonymously (identity hidden)
- [ ] Anonymous poll voting works
- [ ] Covert supporter role hides user from public lists
- [ ] Privacy dashboard shows what's public vs. private
- [ ] Can opt out of discovery features
- [ ] Can download personal data export

---

## Tier 4: Security & OpSec Features (Ongoing)

### Epic 27: Infiltration Countermeasures (3 hours)

**Problem**: David (opposition researcher) can infiltrate groups undetected. No verification, no warnings, no anomaly detection.

**Solution**: Multi-layered defense against infiltration

#### 27.1 Member Verification System (1h)

**What**: Verify new members are who they say they are

**Features**:
- In-person verification (QR code scan at meeting)
- Verified badge (shows member was verified in person)
- Vouching system (existing members vouch for new members)
- Trust score (based on vouches, activity, time in group)
- Unverified member warnings

**Implementation**:
```typescript
interface GroupMembership {
  // ... existing fields
  verified: boolean;        // NEW: Verified in person
  verifiedBy?: string;      // Who verified (pubkey)
  verifiedAt?: number;      // When verified
  vouchesReceived: Vouch[]; // NEW: Vouches from other members
  trustScore: number;       // NEW: 0-100 trust score
}

interface Vouch {
  voucherPubkey: string;    // Who vouched
  timestamp: number;
  relationship: 'coworker' | 'friend' | 'met_at_event' | 'other';
  note?: string;
}

// Verification flow
async function verifyMember(
  groupId: string,
  memberPubkey: string,
  verifierPubkey: string
): Promise<void> {
  // Generate verification QR code
  const verificationCode = generateCode();

  // Verifier scans QR code at in-person meeting
  // Member shows QR code from their app

  // Match codes
  if (verificationCode === scannedCode) {
    await db.groupMembers
      .where('[groupId+pubkey]')
      .equals([groupId, memberPubkey])
      .modify({
        verified: true,
        verifiedBy: verifierPubkey,
        verifiedAt: Date.now()
      });

    showNotification('Member verified! ✅');
  }
}

// Calculate trust score
function calculateTrustScore(member: GroupMembership): number {
  let score = 0;

  // Verified in person: +40 points
  if (member.verified) score += 40;

  // Vouches from trusted members: +10 each (max 30)
  const trustedVouches = member.vouchesReceived.filter(v =>
    isTrustedMember(v.voucherPubkey)
  );
  score += Math.min(trustedVouches.length * 10, 30);

  // Time in group: +1 per week (max 15)
  const weeksSinceJoined = Math.floor((Date.now() - member.joinedAt) / (7 * 24 * 60 * 60 * 1000));
  score += Math.min(weeksSinceJoined, 15);

  // Activity level: +1 per 5 posts (max 15)
  score += Math.min(Math.floor(member.postsCreated / 5), 15);

  return Math.min(score, 100);
}
```

**UI Components**:
```tsx
<MemberList>
  {members.map(member => (
    <MemberCard key={member.pubkey}>
      <Avatar src={member.avatar} />
      <Name>{member.name}</Name>
      {member.verified && <Badge color="green">✓ Verified</Badge>}
      {!member.verified && member.trustScore < 30 && (
        <Badge color="yellow">⚠️ Unverified</Badge>
      )}
      <TrustScore score={member.trustScore} />
    </MemberCard>
  ))}
</MemberList>

<VerificationDialog>
  <Title>Verify New Member</Title>
  <Instructions>
    1. Meet {memberName} in person
    2. Ask them to show their verification QR code
    3. Scan it with your camera
  </Instructions>
  <QRScanner onScan={handleScan} />
</VerificationDialog>
```

**Use Cases**:
- Marcus joins via QR code at shift change
- Keisha sees notification: "New member: Marcus (unverified)"
- At next meeting, Keisha verifies Marcus in person (scans QR)
- Marcus gets verified badge ✓
- If someone joins online without in-person meeting, they stay unverified

#### 27.2 Anomaly Detection & Warnings (1.5h)

**What**: Detect suspicious behavior and warn admins

**Anomalies to Detect**:
1. **Mass data access** (viewing 50+ contact records in 10 minutes)
2. **Unusual posting patterns** (10+ posts in 1 hour, bot-like)
3. **Rapid friending** (following 50+ people in 1 day)
4. **Profile inconsistencies** (claims to work night shift, posts during day)
5. **Honeypot triggers** (accessing decoy content)
6. **Multiple accounts from same IP** (possible infiltrator with multiple identities)

**Implementation**:
```typescript
interface AnomalyDetector {
  // Track user activity
  trackActivity(userId: string, activity: Activity): void;

  // Detect anomalies
  detectAnomalies(userId: string): Anomaly[];

  // Notify admins
  notifyAdmins(groupId: string, anomaly: Anomaly): void;
}

interface Anomaly {
  type: 'mass_data_access' | 'unusual_posting' | 'rapid_following' | 'honeypot_trigger' | 'multiple_accounts';
  userId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any;
  detectedAt: number;
}

// Example: Mass data access detection
class MassDataAccessDetector {
  private recentAccess: Map<string, number[]> = new Map();

  trackAccess(userId: string, resourceId: string): void {
    const timestamps = this.recentAccess.get(userId) || [];
    timestamps.push(Date.now());

    // Keep only last 10 minutes
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const recentTimestamps = timestamps.filter(t => t > tenMinutesAgo);
    this.recentAccess.set(userId, recentTimestamps);

    // Check threshold
    if (recentTimestamps.length > 50) {
      this.raiseAnomaly({
        type: 'mass_data_access',
        userId,
        severity: 'high',
        description: `User accessed ${recentTimestamps.length} records in 10 minutes`,
        evidence: { accessCount: recentTimestamps.length },
        detectedAt: Date.now()
      });
    }
  }
}

// Example: Honeypot detection
class HoneypotDetector {
  // Create decoy content
  createHoneypot(groupId: string): string {
    const honeypot = {
      id: generateId(),
      type: 'decoy_contact',
      data: {
        name: 'Test Contact - Do Not Use',
        isHoneypot: true
      }
    };

    db.contacts.add(honeypot);
    return honeypot.id;
  }

  // Detect access
  onContactAccessed(userId: string, contactId: string): void {
    const contact = await db.contacts.get(contactId);
    if (contact.isHoneypot) {
      this.raiseAnomaly({
        type: 'honeypot_trigger',
        userId,
        severity: 'critical',
        description: 'User accessed honeypot content (possible data scraper)',
        evidence: { contactId },
        detectedAt: Date.now()
      });
    }
  }
}
```

**Admin Notifications**:
```tsx
<AnomalyAlert anomaly={anomaly}>
  <Severity color={anomaly.severity === 'critical' ? 'red' : 'yellow'}>
    {anomaly.severity.toUpperCase()}
  </Severity>
  <Description>{anomaly.description}</Description>
  <Member>
    <Avatar src={getUserAvatar(anomaly.userId)} />
    <Name>{getUserName(anomaly.userId)}</Name>
    <TrustScore score={getTrustScore(anomaly.userId)} />
  </Member>
  <Actions>
    <Button onClick={() => viewUserActivity(anomaly.userId)}>View Activity</Button>
    <Button onClick={() => restrictUser(anomaly.userId)}>Restrict Access</Button>
    <Button onClick={() => banUser(anomaly.userId)} color="red">Ban User</Button>
    <Button onClick={() => dismissAnomaly(anomaly.id)}>Dismiss</Button>
  </Actions>
</AnomalyAlert>
```

**Use Cases**:
- David (opposition) joins group, immediately views 100 contact records
- Anomaly detector triggers: "Mass data access detected"
- Keisha gets notification: "User 'John Smith' accessed 100 records in 5 minutes (⚠️ High Risk)"
- Keisha investigates, sees suspicious pattern, bans user

#### 27.3 Audit Logs & Activity Monitoring (0.5h)

**What**: Track who did what, when (for security review)

**Features**:
- Audit log (all sensitive actions logged)
- Admin-only view
- Filter by: user, action type, date range
- Export for investigation

**Logged Actions**:
- User joined group
- User role changed
- Content deleted
- User banned/unbanned
- Settings changed
- Data exported
- Sensitive content accessed (CRM, proposals)

**Schema**:
```typescript
interface AuditLog {
  id: string;
  groupId: string;
  userId: string;
  action: 'user_joined' | 'role_changed' | 'content_deleted' | 'user_banned' | 'settings_changed' | 'data_exported' | 'sensitive_access';
  details: any;
  ipHash?: string;       // Hashed for privacy
  timestamp: number;
}
```

**Use Cases**:
- Keisha reviews audit log after David was banned
- Sees: David accessed 150 contact records, 50 proposals, 30 wiki pages
- Keisha exports log for review by legal team

**Validation**:
- [ ] Can verify members in person (QR code scan)
- [ ] Verified badge appears on profiles
- [ ] Unverified members show warning
- [ ] Trust score calculates correctly
- [ ] Anomaly detection triggers on mass data access
- [ ] Anomaly detection triggers on unusual posting
- [ ] Honeypot content triggers alerts when accessed
- [ ] Audit log records all sensitive actions
- [ ] Admins can review and export audit logs

---

## Implementation Roadmap

### Sprint 1: Social Foundation (1 week)

**Goals**: Enable activity feed and social engagement (50% → 60% coverage)

**Epic 21: Activity Feed & Social Engagement** (4 hours)
- 21.1 Microblogging Posts Module (1.5h)
- 21.2 Unified Activity Feed (1.5h)
- 21.3 Reactions & Comments (0.5h)
- 21.4 Integration with Existing Modules (0.5h)

**Testing**: (4 hours)
- Unit tests for posts, reactions, comments
- Integration tests for feed aggregation
- E2E tests for user flows

**Outcome**: Users can post updates, react, comment, see unified feed

---

### Sprint 2: Public Pages & Reach (1 week)

**Goals**: Reach neutrals and passive supporters (60% → 70% coverage)

**Epic 21B: Public Pages Foundation** (2 hours)
- 21B.1 Public Campaign Pages (1h)
- 21B.2 Public Wiki & FAQ (0.5h)
- 21B.3 Contact Forms (0.5h)

**Testing**: (2 hours)
- Public page rendering tests
- Contact form submission tests
- SEO validation

**Outcome**: Neutrals can learn about campaign without joining

---

### Sprint 3: Power Tools for Organizers (1 week)

**Goals**: Enable core organizers to scale (70% → 75% coverage)

**Epic 22: Analytics Dashboard** (2 hours)
**Epic 23: Bulk Operations** (2 hours)
**Epic 24: Activity Logging** (2 hours)

**Testing**: (2 hours)
- Analytics calculation tests
- Bulk operation tests
- Activity log accuracy tests

**Outcome**: Organizers have data-driven tools to scale campaigns

---

### Sprint 4: Engagement & Activation (1 week)

**Goals**: Move people up the spectrum (75% → 80% coverage)

**Epic 25: Engagement Ladder** (3 hours)
**Epic 26: Anonymous Engagement** (2 hours)

**Testing**: (2 hours)
- Engagement level detection tests
- Anonymous reaction tests
- Privacy control tests

**Outcome**: Passive supporters have clear pathway to activation

---

### Sprint 5: Security Hardening (Ongoing)

**Goals**: Protect high-risk campaigns

**Epic 27: Infiltration Countermeasures** (3 hours)

**Testing**: (3 hours)
- Anomaly detection tests
- Honeypot trigger tests
- Verification flow tests

**Outcome**: Groups can detect and defend against infiltration

---

## Success Metrics

### Coverage Metrics (by Persona)

| Persona | Current | After Tier 1 | After Tier 2 | After Tier 3 |
|---------|---------|--------------|--------------|--------------|
| **Keisha** (Core Organizer) | 65% | 70% | 85% | 90% |
| **Marcus** (Volunteer) | 50% | 75% | 80% | 85% |
| **Aisha** (Passive Support) | 45% | 65% | 70% | 80% |
| **Tyler** (Neutral) | 30% | 60% | 65% | 70% |
| **Elena** (Researcher) | 15% | 55% | 60% | 65% |
| **David** (Opposition) | 40% defense | 45% | 50% | 70% |
| **Overall** | **41%** | **62%** | **68%** | **77%** |

### Engagement Metrics (Target)

**After Tier 1 Implementation**:
- 70%+ of new users post/react within first week
- 50%+ of passive supporters become active within 30 days
- 80%+ of posts receive at least 1 reaction/comment
- 40%+ of users open app 3+ times per week

**After Tier 2 Implementation**:
- 60%+ 30-day retention
- 50%+ of neutrals join after visiting public page
- 80%+ of active supporters use CRM
- 40%+ of core organizers use analytics weekly

**After Tier 3 Implementation**:
- 70%+ 30-day retention
- 60%+ of passive supporters move to active within 60 days
- 50%+ of users complete engagement ladder milestones
- 90%+ of users understand their next step

---

## Conclusion

BuildIt Network currently serves **core organizers well (65% coverage)** but **fails to reach the full spectrum** of support (41% overall). By implementing these features across 4 tiers, we can:

1. **Tier 1**: Add social layer (activity feed, reactions, public pages) → **62% coverage**
2. **Tier 2**: Add power tools (analytics, bulk ops, activity logs) → **68% coverage**
3. **Tier 3**: Add engagement features (ladder, anonymous, storytelling) → **77% coverage**
4. **Tier 4**: Add security (infiltration defenses) → **Protect high-risk campaigns**

**Investment**: ~20 hours of development across 5 sprints
**Impact**: Enable full Spectrum of Support methodology
**Outcome**: BuildIt Network becomes the only tool that serves organizers from neutrals to leaders

---

**Next Steps**:
1. Review recommendations with team
2. Prioritize Tier 1 features (Epic 21 + 21B)
3. Implement in Sprint 1-2
4. User test with real campaigns
5. Iterate based on feedback

**End of Recommendations**

**Prepared by**: BuildIt Network Development Team
**Date**: 2025-10-05
**Contact**: See labor-organizing.md and labor-organizing-testing-results.md for full context
