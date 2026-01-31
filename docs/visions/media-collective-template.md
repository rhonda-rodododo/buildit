# Media Collective Template Specification

**Status**: Implementation Ready
**Last Updated**: 2026-01-18
**Template ID**: `media-collective`

---

## Overview

The Media Collective template pre-configures a group for community journalism with democratic self-governance. It bundles publishing, newsletters, governance, and collaboration tools into a cohesive package.

**Primary Use Case**: Local independent media organizations operating as democratic collectives.

---

## Template Definition

```typescript
export const MEDIA_COLLECTIVE_TEMPLATE: GroupTemplate = {
  id: 'media-collective',
  name: 'Media Collective',
  description: 'Community journalism with democratic self-governance. Publish articles, syndicate to networks, and make decisions together.',
  icon: '📰',
  category: 'civic',
  complexity: 5,
  tags: ['journalism', 'media', 'publishing', 'collective', 'democracy', 'news'],
  defaultPrivacy: 'private',

  modules: [
    // Publishing - Core editorial workflow
    {
      moduleId: 'publishing',
      enabled: true,
      required: true,
      config: {
        editorialStyle: 'editorial-collective',
        editorialWorkflow: {
          enabled: true,
          requireApproval: true,
          approvalRoles: ['editor', 'admin'],
          allowSelfPublish: false,
        },
        syndication: {
          enabled: true,
          acceptSyndication: true,
          defaultDelay: 24, // hours
        },
        attribution: {
          multiAuthor: true,
          requireByline: true,
          showCollective: true,
        },
      },
    },

    // Newsletters - Subscriber communication
    {
      moduleId: 'newsletters',
      enabled: true,
      required: true,
      config: {
        defaultFrequency: 'weekly',
        allowPublicSubscription: true,
        doubleOptIn: true,
      },
    },

    // Governance - Collective decision-making
    {
      moduleId: 'governance',
      enabled: true,
      required: true,
      config: {
        defaultVotingSystem: 'consensus',
        quorumRequired: true,
        defaultQuorum: 66,
        proposalTemplates: 'media-collective',
        enableAnonymousVoting: false,
      },
    },

    // Documents - Collaborative drafting
    {
      moduleId: 'documents',
      enabled: true,
      required: true,
      config: {
        enableVersionHistory: true,
        enableComments: true,
        enableSuggestions: true,
      },
    },

    // Wiki - Style guides, policies, resources
    {
      moduleId: 'wiki',
      enabled: true,
      config: {
        categories: ['Style Guide', 'Policies', 'Resources', 'Contacts'],
      },
    },

    // Database - Editorial calendar, story tracking
    {
      moduleId: 'database',
      enabled: true,
      config: {
        defaultViews: ['board', 'calendar'],
        enablePMIntegration: true,
      },
    },

    // Public - Public-facing pages
    {
      moduleId: 'public',
      enabled: true,
      required: true,
      config: {
        enablePublicFeed: true,
        enableAboutPage: true,
        enableContactForm: true,
      },
    },

    // Messaging - Internal coordination
    {
      moduleId: 'messaging',
      enabled: true,
      required: true,
    },
  ],

  enhancements: [
    {
      id: 'open-newsroom',
      name: 'Open Newsroom',
      description: 'Accept public story submissions from the community',
      icon: '📥',
      modules: [
        {
          moduleId: 'forms',
          enabled: true,
          config: {
            templates: ['story-pitch', 'news-tip', 'letter-to-editor'],
          },
        },
      ],
    },
    {
      id: 'wire-service',
      name: 'Wire Service Mode',
      description: 'Aggregate and republish stories from other collectives',
      icon: '📡',
      modules: [
        {
          moduleId: 'publishing',
          enabled: true,
          config: {
            wireServiceMode: true,
            aggregateSources: [],
            curateIncoming: true,
          },
        },
      ],
    },
    {
      id: 'events',
      name: 'Events & Press Conferences',
      description: 'Organize press events, community meetings, and coverage coordination',
      icon: '📅',
      modules: [
        {
          moduleId: 'events',
          enabled: true,
          config: {
            allowPublicEvents: true,
            enableRSVP: true,
            categories: ['Press Conference', 'Community Meeting', 'Coverage', 'Training'],
          },
        },
      ],
    },
    {
      id: 'mutual-aid',
      name: 'Community Resources',
      description: 'Connect readers with community resources and mutual aid',
      icon: '🤝',
      modules: [
        {
          moduleId: 'mutual-aid',
          enabled: true,
        },
      ],
    },
    {
      id: 'microblogging',
      name: 'Breaking News Updates',
      description: 'Post quick updates, breaking news, and social media-style content',
      icon: '⚡',
      modules: [
        {
          moduleId: 'microblogging',
          enabled: true,
          config: {
            enableThreads: true,
            enableCrossPosting: true,
          },
        },
      ],
    },
    {
      id: 'fundraising',
      name: 'Fundraising & Membership',
      description: 'Accept donations and manage memberships',
      icon: '💰',
      modules: [
        {
          moduleId: 'fundraising',
          enabled: true,
          config: {
            enableMemberships: true,
            enableOneTimeDonations: true,
            enableArticleTips: true,
          },
        },
      ],
    },
  ],

  defaultChannels: [
    {
      name: 'general',
      description: 'General collective discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'editorial',
      description: 'Editorial planning and article discussion',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'pitches',
      description: 'Story pitches and ideas',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'governance',
      description: 'Collective decisions and proposals',
      type: 'chat',
      privacy: 'members',
    },
    {
      name: 'announcements',
      description: 'Public announcements',
      type: 'announcement',
      privacy: 'public',
    },
  ],

  defaultRoles: [
    {
      name: 'Editor',
      description: 'Reviews and approves articles for publication',
      color: '#10B981',
      permissions: [
        'review_articles',
        'approve_articles',
        'edit_articles',
        'create_proposals',
        'manage_events',
      ],
    },
    {
      name: 'Writer',
      description: 'Creates articles and submits for review',
      color: '#3B82F6',
      permissions: [
        'create_articles',
        'submit_for_review',
        'post_messages',
      ],
    },
    {
      name: 'Copy Editor',
      description: 'Edits articles for style, grammar, and clarity',
      color: '#8B5CF6',
      permissions: [
        'edit_articles',
        'add_comments',
      ],
    },
    {
      name: 'Publisher',
      description: 'Publishes approved articles and manages scheduling',
      color: '#F59E0B',
      permissions: [
        'publish_articles',
        'schedule_articles',
        'manage_syndication',
      ],
    },
    {
      name: 'Newsletter Editor',
      description: 'Curates and sends newsletters',
      color: '#EC4899',
      permissions: [
        'edit_newsletters',
        'send_newsletters',
        'manage_subscribers',
      ],
    },
  ],

  demoData: {
    available: true,
    enabledByDefault: false,
    description: 'Includes sample articles, a draft in review, newsletter template, governance proposals, and style guide wiki',
    seeds: [
      'publishing-demo',
      'newsletters-demo',
      'governance-media-demo',
      'wiki-styleguide-demo',
      'database-editorial-calendar-demo',
    ],
  },

  defaultSettings: {
    discoverable: true,
    requireApproval: true,
    allowInvites: true,
  },

  i18nKey: 'templates.mediaCollective',
};
```

---

## Default Channels

| Channel | Type | Privacy | Purpose |
|---------|------|---------|---------|
| `general` | chat | members | Day-to-day collective discussion |
| `editorial` | chat | members | Article planning, assignment, feedback |
| `pitches` | chat | members | Story ideas and pitches |
| `governance` | chat | members | Proposals and collective decisions |
| `announcements` | announcement | public | Public-facing announcements |

---

## Default Roles

### Editor
**Color**: `#10B981` (Green)
**Purpose**: Reviews submitted articles, provides feedback, approves for publication

**Permissions**:
- `review_articles` - View articles pending review
- `approve_articles` - Approve articles for publication
- `edit_articles` - Make edits to any article
- `create_proposals` - Create governance proposals
- `manage_events` - Manage events

### Writer
**Color**: `#3B82F6` (Blue)
**Purpose**: Creates content and submits for editorial review

**Permissions**:
- `create_articles` - Create new articles
- `submit_for_review` - Submit articles for editorial review
- `post_messages` - Post in channels

### Copy Editor
**Color**: `#8B5CF6` (Purple)
**Purpose**: Focuses on style, grammar, and clarity improvements

**Permissions**:
- `edit_articles` - Edit article content
- `add_comments` - Add editorial comments

### Publisher
**Color**: `#F59E0B` (Amber)
**Purpose**: Final publication and scheduling, manages syndication

**Permissions**:
- `publish_articles` - Publish approved articles
- `schedule_articles` - Schedule future publication
- `manage_syndication` - Configure syndication settings

### Newsletter Editor
**Color**: `#EC4899` (Pink)
**Purpose**: Curates newsletter content and manages subscribers

**Permissions**:
- `edit_newsletters` - Edit newsletter content
- `send_newsletters` - Send newsletters to subscribers
- `manage_subscribers` - Manage subscriber list

---

## Module Configurations

### Publishing Module

```typescript
{
  editorialStyle: 'editorial-collective',
  editorialWorkflow: {
    enabled: true,
    requireApproval: true,
    approvalRoles: ['editor', 'admin'],
    allowSelfPublish: false,
    stages: ['draft', 'review', 'approved', 'published'],
  },
  syndication: {
    enabled: true,
    acceptSyndication: true,
    defaultDelay: 24, // hours before syndication
    requireApproval: true,
  },
  attribution: {
    multiAuthor: true,
    requireByline: true,
    showCollective: true,
    showContributors: true,
  },
}
```

### Governance Module

```typescript
{
  defaultVotingSystem: 'consensus',
  quorumRequired: true,
  defaultQuorum: 66,
  proposalTemplates: 'media-collective',
  enableAnonymousVoting: false,
  discussionPeriodDays: 3,
  votingPeriodDays: 5,
}
```

### Newsletters Module

```typescript
{
  defaultFrequency: 'weekly',
  allowPublicSubscription: true,
  doubleOptIn: true,
  templates: ['weekly-digest', 'breaking-news', 'special-edition'],
}
```

---

## Governance Proposal Templates

The Media Collective template includes specialized proposal templates for journalism-specific decisions:

### Editorial Policy Change
- **Voting Method**: Consensus
- **Quorum**: 66%
- **Discussion Period**: 7 days
- **Use Case**: Changes to editorial guidelines, style guide, or standards

### Coverage Priority
- **Voting Method**: Ranked-choice
- **Quorum**: 50%
- **Discussion Period**: 3 days
- **Use Case**: Setting or changing coverage priorities

### New Member Approval
- **Voting Method**: Simple majority
- **Threshold**: 66%
- **Quorum**: 50%
- **Use Case**: Voting on new collective members

### Join Coalition
- **Voting Method**: Consensus
- **Quorum**: 75%
- **Use Case**: Joining regional or global coalitions

### Elect Editorial Board
- **Voting Method**: Ranked-choice
- **Quorum**: 66%
- **Use Case**: Periodic election of editorial board members

### Content Dispute
- **Voting Method**: Consensus
- **Quorum**: 50%
- **Use Case**: Resolving disputes about published or pending content

---

## Demo Data Seeds

When demo data is enabled, the following seeds are loaded:

### `publishing-demo`
- 3 published articles with varied topics
- 1 article in draft status
- 1 article pending review with editor comments

### `newsletters-demo`
- Newsletter template for weekly digest
- Sample subscriber list (fake emails)
- 1 sent newsletter in archive

### `governance-media-demo`
- 1 active proposal (coverage priority vote)
- 1 completed proposal (editorial policy change - passed)
- 1 archived proposal (new member approval)

### `wiki-styleguide-demo`
- Style guide document
- Editorial policies page
- Source verification guidelines
- Contact list template

### `database-editorial-calendar-demo`
- Editorial calendar board with sample stories
- Story tracking database with status columns

---

## Enhancements Detail

### Open Newsroom
**Purpose**: Accept public submissions

**Added Modules**:
- `forms` - Story pitch and news tip forms

**Forms Templates**:
| Form | Fields | Purpose |
|------|--------|---------|
| story-pitch | headline, summary, angle, sources | Writers pitching stories |
| news-tip | tip, location, time, contact | Public news tips |
| letter-to-editor | subject, letter, author | Letters to the editor |

### Wire Service Mode
**Purpose**: Aggregate content from other collectives

**Configuration Additions**:
```typescript
publishing.config.wireServiceMode = true;
publishing.config.aggregateSources = []; // Configured per collective
publishing.config.curateIncoming = true; // Editorial review of incoming
```

**UI Additions**:
- Wire service dashboard showing incoming stories
- Source management interface
- Syndication approval queue

### Events & Press Conferences
**Purpose**: Organize collective activities

**Added Modules**:
- `events` - Event creation and RSVP

**Event Categories**:
- Press Conference
- Community Meeting
- Coverage Coordination
- Training/Workshop

### Community Resources
**Purpose**: Connect readers with mutual aid

**Added Modules**:
- `mutual-aid` - Resource requests and offers

### Breaking News Updates
**Purpose**: Quick social updates

**Added Modules**:
- `microblogging` - Short-form posts

**Configuration**:
```typescript
microblogging.config.enableThreads = true;
microblogging.config.enableCrossPosting = true;
```

### Fundraising & Membership
**Purpose**: Financial sustainability

**Added Modules**:
- `fundraising` - Donations and memberships

**Configuration**:
```typescript
fundraising.config.enableMemberships = true;
fundraising.config.enableOneTimeDonations = true;
fundraising.config.enableArticleTips = true;
```

---

## Implementation Files

### New Files to Create

| File | Purpose |
|------|---------|
| `src/core/groupTemplates/templates/mediaCollective.ts` | Template definition |
| `src/modules/governance/templates/mediaCollectiveProposals.ts` | Proposal templates |

### Files to Modify

| File | Changes |
|------|---------|
| `src/core/groupTemplates/templates/index.ts` | Export new template |
| `src/core/groupEntity/types.ts` | Add syndication config to Coalition |
| `src/i18n/locales/en/translation.json` | Add template translations |

---

## i18n Keys

```json
{
  "templates": {
    "mediaCollective": {
      "name": "Media Collective",
      "description": "Community journalism with democratic self-governance",
      "channels": {
        "general": "General",
        "editorial": "Editorial",
        "pitches": "Story Pitches",
        "governance": "Governance",
        "announcements": "Announcements"
      },
      "roles": {
        "editor": "Editor",
        "writer": "Writer",
        "copyEditor": "Copy Editor",
        "publisher": "Publisher",
        "newsletterEditor": "Newsletter Editor"
      },
      "enhancements": {
        "openNewsroom": {
          "name": "Open Newsroom",
          "description": "Accept public story submissions"
        },
        "wireService": {
          "name": "Wire Service Mode",
          "description": "Aggregate from other collectives"
        },
        "events": {
          "name": "Events & Press Conferences",
          "description": "Organize press events and coverage coordination"
        },
        "mutualAid": {
          "name": "Community Resources",
          "description": "Connect readers with community resources"
        },
        "microblogging": {
          "name": "Breaking News Updates",
          "description": "Quick updates and breaking news"
        },
        "fundraising": {
          "name": "Fundraising & Membership",
          "description": "Accept donations and manage memberships"
        }
      }
    }
  }
}
```

---

## Related Documents

- [media-collective.md](./media-collective.md) - Full vision document
- [groupTemplates/types.ts](../../clients/web/src/core/groupTemplates/types.ts) - Template type definitions
- [governance/types.ts](../../clients/web/src/modules/governance/types.ts) - Governance types
