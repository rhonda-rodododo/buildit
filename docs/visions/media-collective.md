# Media Collective Vision

**Status**: Planning
**Last Updated**: 2026-01-18
**Related Epics**: 52 (Publishing), 53A (Newsletters), 71 (Collective Publishing)

---

## Executive Summary

Reimagine Indymedia for the modern era: a network of self-governing media collectives in each city, with content syndicating up through regional coalitions to a global wire service. Each collective governs itself democratically while producing community journalism.

**Core Proposition**: Enable local media collectives to produce independent journalism with full editorial autonomy, while building a federated network that can amplify stories across regions and globally.

---

## Part 1: The Indymedia Model

### Historical Context

Indymedia (Independent Media Center) emerged in 1999 as a network of local, autonomous media collectives. At its peak, over 150 local IMCs operated worldwide, covering protests, community issues, and stories mainstream media ignored.

### How It Worked

```
                         GLOBAL INDYMEDIA WIRE
                            (indymedia.org)
     ┌─────────────────────────────────────────────────────────┐
     │  Aggregates top stories from all regional/local IMCs   │
     │  Editorial collective curates global-interest content  │
     └─────────────────────────────────────────────────────────┘
                                  ▲
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
   │  REGIONAL IMC   │   │  REGIONAL IMC   │   │  REGIONAL IMC   │
   │   (US/PNW)      │   │   (Europe)      │   │  (Latin America)│
   ├─────────────────┤   ├─────────────────┤   ├─────────────────┤
   │  Aggregates     │   │  Aggregates     │   │  Aggregates     │
   │  local stories  │   │  local stories  │   │  local stories  │
   └─────────────────┘   └─────────────────┘   └─────────────────┘
            ▲                     ▲                     ▲
      ┌─────┴─────┐         ┌─────┴─────┐         ┌─────┴─────┐
      │           │         │           │         │           │
  ┌───────┐   ┌───────┐ ┌───────┐   ┌───────┐ ┌───────┐   ┌───────┐
  │Portland│  │Seattle│ │Berlin │   │Paris  │ │CDMX   │   │Buenos │
  │ IMC    │  │ IMC   │ │ IMC   │   │ IMC   │ │ IMC   │   │Aires  │
  └───────┘   └───────┘ └───────┘   └───────┘ └───────┘   └───────┘
      │           │         │           │         │           │
    Local      Local      Local       Local     Local       Local
    Writers    Writers    Writers    Writers   Writers     Writers
```

### Key Principles

| Principle | Description |
|-----------|-------------|
| **Local Autonomy** | Each city's collective self-governs with its own editorial policy |
| **Open Publishing** | Anyone can submit articles (with moderation) |
| **Syndication Upward** | Stories flow: Local → Regional → Global |
| **Democratic Governance** | Consensus-based collective decision-making |
| **No Corporate Control** | Community-owned infrastructure |
| **Transparency** | Open editorial processes and clear policies |

### Why It Declined

1. **Infrastructure burden** - Each IMC ran its own servers
2. **No sustainable funding** - Relied on volunteer labor
3. **Spam and moderation overload** - Open publishing attracted bad actors
4. **No mobile-first design** - Failed to adapt to smartphone era
5. **Centralization pressures** - Social media absorbed attention

---

## Part 2: BuildIt Implementation

### Mapping Indymedia to BuildIt

| Indymedia Concept | BuildIt Feature | Status |
|-------------------|-----------------|--------|
| Local IMC | Media Collective Group (template) | Planned |
| Regional Network | Coalition | ✅ Epic 43 |
| Global Wire | Coalition of Coalitions | ✅ Infrastructure exists |
| Open Publishing | Editorial Workflow | Planned (Epic 71) |
| Collective Governance | Governance Module | ✅ Exists |
| Content Syndication | Coalition Cross-posting | ✅ Needs enhancement |
| Newsletter Distribution | Newsletters Module | ✅ Epic 53A |
| Public Pages | Public Module | ✅ Exists |

### Advantages Over Original Indymedia

1. **No server maintenance** - Nostr relays + local-first storage
2. **E2E encryption** - Private editorial discussions
3. **Built-in governance** - Consensus voting for collective decisions
4. **Mobile-first** - Modern responsive design
5. **Spam resistance** - Reputation systems + moderation tools
6. **Sustainable** - Can integrate with funding/membership

---

## Part 3: Architecture

### Content Flow

```
                    ┌──────────────────────────────────────────┐
                    │           GLOBAL WIRE SERVICE            │
                    │     (Coalition of Regional Coalitions)   │
                    │                                          │
                    │  • Curates top stories globally          │
                    │  • Editorial board from regions          │
                    │  • Publishes to global feed              │
                    └──────────────────────────────────────────┘
                                        ▲
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │  PNW COALITION   │ │ EUROPE COALITION │ │ LATAM COALITION  │
         │                  │ │                  │ │                  │
         │ syndicationMode: │ │ syndicationMode: │ │ syndicationMode: │
         │   regional       │ │   regional       │ │   regional       │
         │                  │ │                  │ │                  │
         │ acceptFrom:      │ │ acceptFrom:      │ │ acceptFrom:      │
         │ - portland-imc   │ │ - berlin-imc     │ │ - cdmx-imc       │
         │ - seattle-imc    │ │ - paris-imc      │ │ - buenosaires-imc│
         │ - vancouver-imc  │ │ - london-imc     │ │ - santiago-imc   │
         └──────────────────┘ └──────────────────┘ └──────────────────┘
                    ▲                   ▲                   ▲
         ┌──────────┴──────────┐       ...                 ...
         │                     │
    ┌─────────────┐      ┌─────────────┐
    │ PORTLAND    │      │ SEATTLE     │
    │ MEDIA       │      │ MEDIA       │
    │ COLLECTIVE  │      │ COLLECTIVE  │
    │             │      │             │
    │ modules:    │      │ modules:    │
    │ - publishing│      │ - publishing│
    │ - governance│      │ - governance│
    │ - documents │      │ - documents │
    │ - wiki      │      │ - wiki      │
    │ - messaging │      │ - messaging │
    └─────────────┘      └─────────────┘
          │                    │
    ┌─────┴─────┐        ┌─────┴─────┐
    │           │        │           │
  Writers    Editors   Writers    Editors
```

### Editorial Workflow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   DRAFT     │────▶│   REVIEW    │────▶│  APPROVED   │────▶│  PUBLISHED  │
│             │     │             │     │             │     │             │
│ Author      │     │ Editors     │     │ Publisher   │     │ Public      │
│ creates     │     │ review &    │     │ schedules   │     │ visible     │
│ article     │     │ comment     │     │ or publishes│     │ on feeds    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  REJECTED   │
                    │  with notes │
                    └─────────────┘
```

### Syndication Mechanism

```typescript
// Article published locally
article.syndicateSettings = {
  enabled: true,
  delay: 24,  // Hours before syndication (local exclusivity)
  targetCoalitions: ['coalition-pnw-media'],
  syndicationLevel: 'regional',  // 'local' | 'regional' | 'global'
};

// Regional coalition settings
coalition.syndicationConfig = {
  mode: 'editorial-review',  // 'auto-approve' | 'editorial-review' | 'member-vote'
  approvedSources: ['portland-imc', 'seattle-imc'],
  autoPublishAfterApproval: true,
  attributionRequired: true,
};

// Global wire aggregation
globalWire.aggregationConfig = {
  memberCoalitions: ['pnw-coalition', 'europe-coalition', 'latam-coalition'],
  curationMode: 'editorial-board',  // Representatives from each region
  publishingFrequency: 'continuous',
};
```

---

## Part 4: Governance Integration

The Governance module handles ALL collective decisions, not just editorial:

### Editorial Governance

- **Story approval** (optional, for controversial content)
- **Editorial policy changes**
- **Style guide updates**
- **Coverage priorities**
- **Source verification standards**

### Collective Operations

- **Membership decisions** (who can join the collective)
- **Role assignments** (who becomes editor, who gets publish rights)
- **Resource allocation** (if collective has funds)
- **Partnerships** (joining coalitions, collaborating with other collectives)
- **Conflict resolution**

### Proposal Templates

```typescript
const MEDIA_COLLECTIVE_PROPOSAL_TEMPLATES = [
  {
    id: 'editorial-policy-change',
    title: 'Editorial Policy Change',
    description: 'Propose changes to editorial guidelines or standards',
    votingMethod: 'consensus',
    quorum: 66,
    discussionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  {
    id: 'coverage-priority',
    title: 'Coverage Priority',
    description: 'Set or change coverage priorities for the collective',
    votingMethod: 'ranked-choice',
    quorum: 50,
    discussionPeriod: 3 * 24 * 60 * 60 * 1000, // 3 days
  },
  {
    id: 'new-member-approval',
    title: 'New Member Approval',
    description: 'Vote on accepting a new member to the collective',
    votingMethod: 'simple',
    threshold: 66,
    quorum: 50,
  },
  {
    id: 'join-coalition',
    title: 'Join Coalition',
    description: 'Vote on joining a regional or global coalition',
    votingMethod: 'consensus',
    quorum: 75,
  },
  {
    id: 'elect-editorial-board',
    title: 'Elect Editorial Board',
    description: 'Elect members to the editorial board',
    votingMethod: 'ranked-choice',
    quorum: 66,
  },
  {
    id: 'content-dispute',
    title: 'Content Dispute Resolution',
    description: 'Resolve disputes about published or pending content',
    votingMethod: 'consensus',
    quorum: 50,
  },
];
```

---

## Part 5: Template Specification

See [media-collective-template.md](./media-collective-template.md) for detailed template specification.

### Template Overview

| Aspect | Configuration |
|--------|---------------|
| **ID** | `media-collective` |
| **Complexity** | 5 (Comprehensive) |
| **Category** | `civic` |
| **Privacy** | `private` (internal operations) |

### Required Modules

| Module | Purpose |
|--------|---------|
| `publishing` | Article creation, editorial workflow, syndication |
| `newsletters` | Subscriber communication |
| `governance` | Collective decision-making |
| `documents` | Collaborative drafting |
| `public` | Public-facing pages |
| `messaging` | Internal coordination |

### Optional Enhancements

| Enhancement | What It Adds |
|-------------|--------------|
| `open-newsroom` | Accept public submissions |
| `wire-service` | Aggregate from other collectives |
| `events` | Events & press conferences |
| `mutual-aid` | Community resources |
| `microblogging` | Breaking news updates |

---

## Part 6: User Stories

### As a Local Writer
- I can submit articles to my local collective
- I can see editorial feedback on my drafts
- I can track my article through the review process
- I can see when my article is published locally and syndicated

### As an Editor
- I can review submitted articles
- I can leave comments and suggestions
- I can approve articles for publication
- I can schedule articles for specific times
- I can mark articles for syndication

### As a Collective Member
- I can vote on editorial policy changes
- I can participate in membership decisions
- I can view collective finances (if applicable)
- I can participate in coalition decisions

### As a Regional Coalition Editor
- I can see articles from member collectives
- I can curate top stories for regional distribution
- I can manage source approval
- I can set syndication policies

### As a Reader
- I can subscribe to local collective newsletters
- I can browse regional and global feeds
- I can see clear attribution of sources
- I can submit tips or feedback

---

## Part 7: Implementation Phases

### Phase 1: Media Collective Template (Epic 72 - Proposed)
**Scope**: Create the group template with all module configurations

- [ ] Create `mediaCollective.ts` template file
- [ ] Add governance proposal templates
- [ ] Configure default channels and roles
- [ ] Add i18n translations
- [ ] Create demo seed data
- [ ] Write E2E tests

### Phase 2: Collective Publishing Features (Epic 71)
**Scope**: Publishing module enhancements for collective workflows

- [ ] Multi-author attribution
- [ ] Editorial workflow engine
- [ ] Syndication service
- [ ] PM board integration
- [ ] Wire service dashboard

### Phase 3: Coalition Syndication (Epic 73 - Proposed)
**Scope**: Enhance coalitions for content syndication

- [ ] Syndication settings in Coalition type
- [ ] Cross-coalition aggregation
- [ ] Syndication delay configuration
- [ ] Source approval workflow
- [ ] Attribution tracking

### Phase 4: Global Wire Service (Epic 74 - Proposed)
**Scope**: Coalition of coalitions for global distribution

- [ ] Nested coalition support
- [ ] Global editorial board tools
- [ ] Multi-region curation
- [ ] Unified feed generation

---

## Part 8: Success Metrics

### Adoption
- Number of media collectives created
- Geographic distribution of collectives
- Active writers per collective

### Engagement
- Articles published per collective per month
- Syndication rate (local → regional → global)
- Newsletter subscriber growth
- Reader engagement (comments, shares)

### Governance Health
- Proposal participation rates
- Consensus achievement rates
- Member retention

### Network Effects
- Coalition membership growth
- Cross-collective collaborations
- Story amplification (views at each level)

---

## Part 9: Future Possibilities

### Funding Integration
- Membership dues collection
- Tip jar for articles
- Grant tracking

### Advanced Collaboration
- Cross-collective investigations
- Shared resources (photographers, translators)
- Training programs

### Technology Extensions
- AI-assisted translation for global distribution
- Fact-checking workflows
- Archive and preservation tools
- Print-ready PDF generation

---

## Appendix: Related Documents

- [media-collective-template.md](./media-collective-template.md) - Detailed template specification
- [Epic 52: Publishing Module](../../clients/web/COMPLETED_ROADMAP.md) - Publishing infrastructure
- [Epic 53A: Newsletters Module](../../clients/web/COMPLETED_ROADMAP.md) - Newsletter infrastructure
- [Epic 43: Group Entity & Coalitions](../../clients/web/COMPLETED_ROADMAP.md) - Coalition infrastructure
- [NEXT_ROADMAP.md](../../clients/web/NEXT_ROADMAP.md) - Active development roadmap
