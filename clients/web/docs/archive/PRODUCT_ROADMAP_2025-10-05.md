# BuildIt Network - Product Roadmap & Feature Prioritization
## Social Action Network Product Strategy

**Date**: 2025-10-05
**Version**: v1.0.0-mvp → v2.0.0-social
**Status**: MVP Complete, Planning Social Transformation

---

## Executive Summary

BuildIt Network has successfully completed its MVP with 9 functional modules, 88 passing tests, PWA support, and production-ready deployment. The platform currently serves as a **privacy-first organizing toolkit** with encrypted messaging, event coordination, mutual aid, governance, and data management.

**Strategic Recommendation**: Transform BuildIt Network into a **privacy-preserving social action network** by adding microblogging, activity feeds, and threaded comments. This positions the platform as a **decentralized alternative to Twitter/Mastodon for activists** while maintaining best-in-class privacy and organizing tools.

### Key Insights

1. **Market Gap**: No existing platform combines social networking with organizing tools and strong privacy
2. **User Value**: Activists need both communication (feed, posts, comments) AND coordination (events, governance, mutual aid)
3. **Competitive Advantage**: Nostr protocol + NIP-17 encryption provides better privacy than Signal/Telegram with social features
4. **Network Effects**: Social features drive adoption, organizing tools drive retention

---

## Current State Assessment

### ✅ What's Built (MVP v1.0.0)

**Core Infrastructure (100% Complete)**
- ✅ Nostr protocol integration (NIP-01, 17, 44, 59)
- ✅ E2E encryption with NIP-17 gift-wrapping
- ✅ Local-first storage with Dexie (IndexedDB)
- ✅ Multi-identity management
- ✅ Dynamic module system with per-group configuration
- ✅ PWA with offline support (476KB gzipped)
- ✅ React Router navigation (responsive, breadcrumbs, keyboard shortcuts)
- ✅ Theming system (7 color themes, dark mode)
- ✅ i18n infrastructure (English complete, 3 languages stubbed)

**Messaging & Communication (100% Complete)**
- ✅ Encrypted DMs (NIP-17)
- ✅ Group messaging (encrypted threads)
- ✅ Notifications system (in-app, browser)
- ✅ @mentions with user autocomplete
- ✅ Contacts & social graph (NIP-02)
- ✅ Rich media support (images, video, audio with encryption)
- ✅ EXIF stripping, emoji picker (privacy-safe)

**Organizing Modules (100% Complete)**
- ✅ **Events**: RSVP, calendar, iCal export, 4 privacy levels
- ✅ **Mutual Aid**: Requests/offers, ride share, resource directory
- ✅ **Governance**: Proposals, 5 voting methods (simple, ranked-choice, quadratic, D'Hondt, consensus)
- ✅ **Wiki**: Markdown editor, version control, search
- ✅ **Custom Fields**: 11 field types, dynamic forms, templates
- ✅ **Database**: Airtable-like tables, 4 view types, virtualization
- ✅ **CRM**: 5 pre-built templates (union, fundraising, legal, volunteer, civil defense)

**Security & Privacy (Partial - 2/4)**
- ✅ WebAuthn key protection with biometrics
- ✅ Device management (fingerprinting, session tracking, remote revocation)
- ⏳ Key rotation and re-encryption (18.1 complete, needs testing)
- ⏳ Login notifications for new devices (partially implemented)
- ❌ Tor integration (DEFERRED - Epic 18.3)
- ❌ Security audit (DEFERRED - Epic 18.4)

### ⚠️ What's Missing

**Placeholder Modules (Schema Only)**
- ⚠️ **Documents**: WYSIWYG editor, collaboration, real-time editing (Epic 16.5.1 planned)
- ⚠️ **Files**: Encrypted storage, folders, preview, sharing (Epic 16.5.2 planned)

**Incomplete Features**
- ⚠️ **Forms & Fundraising**: Public pages, form builder, donation tracking (Epic 15.5 planned)
- ⚠️ **Translations**: Only English complete, ES/FR/AR stubbed (Epic 17 planned)
- ⚠️ **Testing**: Unit tests passing (88/88), integration/E2E tests stubbed but not running (Epic 19.2-19.3)

**Not Started (Critical for Social App)**
- ❌ **Microblogging**: Post creation, rich text, media, privacy levels
- ❌ **Activity Feed**: Aggregated timeline from all modules
- ❌ **Comments System**: Threaded comments, reactions, notifications
- ❌ **Social Discovery**: Hashtags, trending topics, public timeline
- ❌ **Content Moderation**: Reporting, blocking, muting

---

## Feature Prioritization Matrix

### P0: Must Have (Critical for Social Launch)

| Feature | Impact | Effort | Dependencies | Target Epic |
|---------|--------|--------|--------------|-------------|
| **Microblogging Module** | 🔥 High | Medium | Messaging | Epic 21.1 |
| **Activity Feed System** | 🔥 High | Medium | All modules | Epic 21.2 |
| **Comments & Reactions** | 🔥 High | Low | Microblogging | Epic 21.3 |
| **Feed Navigation** | 🔥 High | Low | Activity Feed | Epic 23 |
| **Content Privacy Controls** | 🔥 High | Low | Microblogging | Epic 21.1 |

**Rationale**: These features transform BuildIt from an organizing toolkit into a social platform. Without them, users must use separate apps for discussion (Twitter) and coordination (BuildIt), creating friction and security risks.

### P1: Should Have (Important for Launch)

| Feature | Impact | Effort | Dependencies | Target Epic |
|---------|--------|--------|--------------|-------------|
| **Documents Module** | 🟡 Medium | High | Files (optional) | Epic 16.5.1 |
| **Files Module** | 🟡 Medium | High | Media encryption (done) | Epic 16.5.2 |
| **Hashtags & Discovery** | 🟡 Medium | Low | Microblogging | Epic 21.4 |
| **Threaded Conversations** | 🟡 Medium | Medium | Comments | Epic 21.5 |
| **Public Profiles** | 🟡 Medium | Low | Microblogging | Epic 21.6 |

**Rationale**: Enhances social experience but not blocking. Documents/Files complete the content suite. Discovery features improve engagement.

### P2: Nice to Have (Future Enhancements)

| Feature | Impact | Effort | Dependencies | Target Post-v2.0 |
|---------|--------|--------|--------------|------------------|
| **Forms & Fundraising** | 🟢 Low | Medium | Database | Epic 15.5 |
| **Translation Completion** | 🟢 Low | High | i18n infra (done) | Epic 17 |
| **Tor Integration** | 🟢 Low | Medium | None | Epic 18.3 |
| **Voice/Video Calls** | 🟢 Low | Very High | WebRTC | Future |
| **Mobile Apps** | 🟢 Low | Very High | React Native | Future |

**Rationale**: Valuable but not critical for launch. Can be added post-v2.0 based on user feedback.

### P3: Won't Have (Out of Scope)

| Feature | Reason |
|---------|--------|
| **Algorithmic Feed** | Against privacy principles (no tracking) |
| **Read Receipts** | Metadata leak, privacy risk |
| **Last Seen Status** | Metadata leak, OPSEC risk |
| **Centralized Search** | Privacy risk, use per-group search only |
| **User Analytics** | No tracking, privacy-first |

---

## Recommended Product Roadmap

### Phase 1: Social Core (Epics 21-23) - 6-8 weeks

**Goal**: Launch BuildIt Network as a privacy-preserving social action network

#### Epic 21: Social Feed & Microblogging (4 weeks)

**Epic 21.1: Microblogging Module (1.5 weeks)**
- **Deliverable**: Twitter-like posting with privacy controls
- Post creation with rich text (Markdown or TipTap)
- Media attachments (images, video, audio)
- Privacy levels: Public, Followers-Only, Group-Only, Private
- Post editing and deletion
- Nostr events (kind: 1 for public, NIP-17 for private)
- Character limits and content warnings
- Link previews (privacy-safe, no tracking)
- Draft saving and scheduling (optional)

**User Stories**:
- "As an organizer, I want to post updates about campaign progress to my followers"
- "As a member, I want to share photos from our action with only group members"
- "As an activist, I want to write public posts to raise awareness without revealing my identity"

**Epic 21.2: Activity Feed System (1 week)**
- **Deliverable**: Unified timeline aggregating all content
- Feed types: Following, Public, Group
- Aggregation from: Posts, Events, Proposals, Wiki updates, Aid requests
- Real-time updates (Nostr subscriptions)
- Infinite scroll with virtualization
- Read/unread tracking
- Filter by content type (posts, events, proposals, etc.)
- Sort by: Recent, Popular (within group), Relevant

**User Stories**:
- "As a user, I want to see all activity from people I follow in one place"
- "As a group admin, I want to see all recent activity in my group"
- "As an organizer, I want to filter the feed to see only events and proposals"

**Epic 21.3: Comments & Reactions System (1 week)**
- **Deliverable**: Threaded discussions on all content
- Threaded comments (up to 5 levels deep)
- Rich text in comments (Markdown)
- @mentions in comments
- Reactions (👍 ❤️ 🔥 💪 ✊ 🏴 - activist-themed)
- Reaction counts (privacy-aware, no tracking who reacted)
- Comment notifications
- Edit/delete comments
- Content warnings for sensitive replies
- Spam/abuse reporting

**User Stories**:
- "As a member, I want to discuss a proposal in threaded comments"
- "As an activist, I want to react to a post without writing a comment"
- "As a user, I want to see all comments on an event announcement"

**Epic 21.4: Social Discovery (Optional - 0.5 weeks)**
- **Deliverable**: Find content and people without tracking
- Hashtags (#Organizing #MutualAid #Strike)
- Trending topics (per-group, no global tracking)
- Suggested follows (based on group membership, not algorithms)
- Public timeline (opt-in, no personalization)
- Search within feed (local only)

**User Stories**:
- "As a new user, I want to find organizers working on similar issues"
- "As an activist, I want to follow hashtags related to my campaigns"
- "As a member, I want to discover public posts from my community"

#### Epic 22: Content Modules (3 weeks)

**Epic 22.1: Documents Module - WYSIWYG (1.5 weeks)**
- **Deliverable**: Collaborative document editing
- Rich text editor (TipTap recommended)
- Document types: Article, Report, Manifesto, Press Release, Meeting Notes
- Real-time collaboration (OT or CRDTs)
- Version history and rollback
- Comments and suggestions
- Templates with variables
- Export: PDF, HTML, Markdown, DOCX
- Encryption for sensitive docs
- Integration with social feed (share documents as posts)

**Epic 22.2: Files Module - Storage (1 week)**
- **Deliverable**: Encrypted file management
- Encrypted upload with progress
- Folder structure (drag-and-drop)
- File preview (images, PDFs, text, video)
- Sharing with expiring links
- Versioning
- Storage backends: NIP-96, Blossom, IPFS (optional), IndexedDB cache
- Search and tagging
- Bulk operations
- Storage quotas per group
- Integration with posts (attach files to posts)

**Epic 22.3: Cross-Module Integration (0.5 weeks)**
- Attach files to posts, events, proposals
- Link documents in feed
- Media library for reusable assets
- Activity logs

#### Epic 23: Navigation Overhaul (1 week)

**Epic 23.1: Feed as Home (0.5 weeks)**
- **Deliverable**: Social feed becomes the landing page
- New route structure: `/feed` (home), `/messages`, `/groups`, `/settings`
- Feed prominent in navigation (top-level)
- Quick post composer in header
- Notification badges on feed icon
- Mobile: Bottom nav with Feed, Messages, Groups, Profile

**Epic 23.2: Content Discovery UI (0.5 weeks)**
- Explore page (`/explore`) with trending topics
- Hashtag pages (`/tag/:hashtag`)
- User profiles (`/@username`)
- Post permalink pages (`/post/:id`)
- Group public pages (`/group/:id`)

**Success Metrics (Phase 1)**:
- Daily Active Users (DAU): 1000+ within 3 months
- Posts per day: 500+ (average 0.5 posts/user)
- Comments per post: 3+ average engagement
- Content creation: 60% of users post at least once per week
- Privacy compliance: 90%+ of posts use encryption
- Retention: 40% 7-day retention, 25% 30-day retention

---

### Phase 2: Rich Content & Collaboration (Epics 16.5, 22) - 4 weeks

**Goal**: Complete content creation suite and collaborative features

**Completed in Epic 22 (see Phase 1)**
- Documents module with collaboration
- Files module with encryption
- Cross-module content integration

**Additional Features**:
- Document templates library (meeting notes, action plans, press releases)
- Collaborative editing conflict resolution
- File versioning and rollback
- Advanced search across documents and files

**Success Metrics (Phase 2)**:
- Documents created: 100+ per week
- Files uploaded: 500+ per week
- Collaboration sessions: 50+ concurrent editors
- Storage usage: <10GB per group average

---

### Phase 3: Growth & Scale (Epics 15.5, 17, 19) - 6 weeks

**Goal**: Expand reach, complete i18n, improve quality

#### Epic 15.5: Forms, Fundraising & Public Pages (2 weeks)

**Forms Builder**:
- Visual form builder (drag-and-drop)
- Form types: Contact, Survey, RSVP, Registration, Volunteer
- Conditional logic
- Anonymous submissions
- Anti-spam (rate limiting, honeypot)

**Fundraising**:
- Campaign builder with goal tracking
- Donation tiers and recurring gifts
- Payment integration planning (crypto, Stripe)
- Donor privacy controls

**Public Pages**:
- Mini-CMS for group websites
- Page templates (About, Events, Contact, Resources)
- SEO controls, custom domains
- Form embedding in pages
- Public/private visibility

**Success Metrics**:
- Forms created: 50+ per month
- Form submissions: 1000+ per month
- Fundraising campaigns: 20+ active
- Funds raised: Track total volume (privacy-preserving)

#### Epic 17: Translation & Advanced i18n (2 weeks)

**Complete Translations**:
- Finish Spanish, French, Arabic
- Add German, Portuguese, Mandarin, Hindi
- Module-specific namespaces
- Translation contribution workflow

**Advanced i18n**:
- Date/time localization (date-fns)
- Number/currency formatting
- RTL layout fixes for Arabic
- Pluralization rules
- Content localization (multilingual wiki pages)

**Success Metrics**:
- Languages supported: 7+ complete
- Non-English usage: 30%+ of users
- Translation coverage: 95%+ for top 4 languages
- RTL usability: No reported issues for Arabic

#### Epic 19: Testing & Quality (2 weeks)

**Integration Tests**:
- Nostr ↔ Storage sync
- Encryption ↔ Storage persistence
- Module system integration
- Error recovery scenarios

**E2E Tests (Playwright)**:
- Critical user flows (18 scenarios defined)
- Auth, groups, messaging, events
- Multi-device sync
- Offline/online transitions

**Performance Testing**:
- Lighthouse audit (target: >90)
- Bundle size monitoring
- Real-user monitoring (privacy-safe)

**Success Metrics**:
- Test coverage: >80% overall, >90% for core
- E2E tests: All 18 scenarios passing
- Lighthouse score: >90 all categories
- Performance budget: <500KB initial load maintained

---

## User Personas & Value Mapping

### Persona 1: Union Organizer (Sarah)

**Needs**:
- Communicate with workers privately
- Coordinate actions and events
- Track 1-on-1 conversations and card drives
- Share campaign updates publicly

**Value from Social Features**:
- **Posts**: Share campaign wins, build momentum
- **Feed**: See worker engagement, trending concerns
- **Comments**: Facilitate discussion on proposals
- **Events**: Announce rallies, RSVP tracking
- **CRM**: Track support levels, card signatures

**User Journey**:
1. Post about contract negotiations → Workers react and comment
2. Create event for rally → Workers RSVP via feed
3. Share proposal in group → Threaded discussion in comments
4. DM workers individually → Track conversations in CRM
5. Post victory announcement → Public feed, build solidarity

### Persona 2: Mutual Aid Coordinator (Jamal)

**Needs**:
- Match aid requests with offers
- Coordinate volunteers
- Share resources publicly
- Build community relationships

**Value from Social Features**:
- **Posts**: Announce available resources, urgent needs
- **Feed**: See community activity, identify patterns
- **Comments**: Clarify aid requests, coordinate logistics
- **Database**: Track resources, volunteer hours
- **Public Pages**: Share mutual aid directory

**User Journey**:
1. Post urgent need (food, housing) → Community responds
2. Create aid request → Offers appear in feed
3. Coordinate ride share → Comments thread for logistics
4. Share success story → Build community, inspire giving
5. Update resource directory → Public page for access

### Persona 3: Activist Collective Member (Alex)

**Needs**:
- Discuss strategies privately
- Plan direct actions securely
- Share analysis and education
- Coordinate across groups

**Value from Social Features**:
- **Posts**: Share analysis, news, tactical updates
- **Feed**: Follow allied organizers, cross-pollinate ideas
- **Comments**: Debate tactics, refine proposals
- **Governance**: Vote on actions, consensus decision-making
- **Wiki**: Document know-your-rights, security culture

**User Journey**:
1. Post analysis of political situation → Comrades discuss
2. Propose direct action in governance → Vote with comments
3. Create private event (action) → Location revealed 24h before
4. Share post-action report → Encrypted for group only
5. Update security wiki → Comment thread refines protocols

### Persona 4: Community Organizer (Maria)

**Needs**:
- Engage neighborhood residents
- Organize meetings and events
- Track volunteer engagement
- Build solidarity across issues

**Value from Social Features**:
- **Posts**: Share neighborhood news, calls to action
- **Feed**: See resident concerns, identify leaders
- **Comments**: Facilitate community discussion
- **Events**: Town halls, block parties, tenant meetings
- **Forms**: Collect concerns, RSVP for events

**User Journey**:
1. Post about housing issue → Neighbors comment, share stories
2. Create form to collect concerns → Feed drives submissions
3. Announce tenant meeting → RSVP via feed, comments coordinate
4. Share meeting notes (wiki) → Comments continue discussion
5. Launch fundraiser → Public page, donor tracking

---

## Competitive Analysis

### vs. Twitter/X
**BuildIt Advantages**:
- ✅ E2E encryption (Twitter has none)
- ✅ Decentralized (Nostr vs. centralized)
- ✅ No ads, no algorithms, no tracking
- ✅ Organizing tools (events, governance, CRM)
- ✅ Privacy-first (metadata protection)

**Twitter Advantages**:
- ❌ Larger network effects (440M users)
- ❌ Real-time breaking news
- ❌ Verified accounts, journalists
- ❌ Trending topics (global scale)

**Strategy**: Target activists who prioritize privacy and need organizing tools. Not competing for mainstream news consumption.

### vs. Mastodon/Fediverse
**BuildIt Advantages**:
- ✅ Better encryption (NIP-17 vs. ActivityPub plaintext)
- ✅ Organizing modules (Mastodon is just social)
- ✅ Mobile-first PWA (Mastodon clients vary)
- ✅ Integrated CRM, events, governance

**Mastodon Advantages**:
- ❌ Larger fediverse (10M+ users)
- ❌ More mature (8+ years)
- ❌ Server federation (vs. Nostr relays)

**Strategy**: Position as "Mastodon for organizers" with better privacy and built-in tools.

### vs. Signal/Telegram
**BuildIt Advantages**:
- ✅ Public feed + private messaging
- ✅ Organizing tools (events, governance, wiki)
- ✅ Decentralized (Signal is centralized)
- ✅ No phone number required (Nostr keys)

**Signal/Telegram Advantages**:
- ❌ Simpler UX (just messaging)
- ❌ Larger user base (Signal 40M, Telegram 700M)
- ❌ Voice/video calls (BuildIt doesn't have)

**Strategy**: Complement Signal/Telegram for 1-on-1, but use BuildIt for group coordination and public communication.

### vs. Discord
**BuildIt Advantages**:
- ✅ Privacy (Discord logs everything)
- ✅ Organizing focus (Discord is for gaming/communities)
- ✅ Decentralized (Discord is centralized)
- ✅ Mobile PWA (Discord mobile is limited)

**Discord Advantages**:
- ❌ Voice channels (BuildIt doesn't have)
- ❌ Rich bots and integrations
- ❌ Screen sharing
- ❌ Larger communities (150M users)

**Strategy**: Target groups leaving Discord for privacy reasons. Offer migration path.

### Unique Value Proposition

**BuildIt Network is the only platform that combines:**
1. **Privacy-First Social Networking** (encrypted posts, feeds, comments)
2. **Professional Organizing Tools** (events, governance, CRM, mutual aid)
3. **Decentralized Architecture** (Nostr protocol, no central servers)
4. **Activist-Centric Design** (privacy levels, metadata protection, OPSEC features)

**Tagline Options**:
- "Social Action Network: Organize, Connect, Resist"
- "Privacy-First Platform for Movements"
- "Twitter for Organizers, Built for Privacy"
- "Where Organizing Meets Social, With Privacy"

---

## Risk Assessment & Mitigation

### Technical Risks

**Risk 1: Real-Time Feed Performance**
- **Impact**: High (core feature)
- **Likelihood**: Medium (Nostr relays can be slow)
- **Mitigation**:
  - Implement aggressive caching (IndexedDB)
  - Use multiple relays with failover
  - Paginate feed (50 posts per load)
  - Prefetch content during scroll
  - Optimize Nostr subscriptions (REQ filters)

**Risk 2: Encryption Overhead**
- **Impact**: Medium (UX degradation)
- **Likelihood**: Low (NIP-17 is optimized)
- **Mitigation**:
  - Encrypt in web worker (non-blocking)
  - Cache decrypted content
  - Lazy decrypt (only visible posts)
  - Use NIP-44 batch operations

**Risk 3: Browser Storage Limits**
- **Impact**: High (data loss)
- **Likelihood**: Medium (IndexedDB quotas)
- **Mitigation**:
  - Implement storage quotas per group
  - Auto-archive old posts (move to relays only)
  - Warn users at 80% capacity
  - Provide export/backup tools

**Risk 4: Relay Censorship**
- **Impact**: High (availability)
- **Likelihood**: Medium (relays can block)
- **Mitigation**:
  - Use 5+ diverse relays
  - Support .onion relays (Tor)
  - Implement relay rotation
  - Allow user-specified relays

### Privacy & Security Risks

**Risk 5: Metadata Leaks in Public Feed**
- **Impact**: High (OPSEC failure)
- **Likelihood**: Medium (Nostr metadata is visible)
- **Mitigation**:
  - Clear warnings on public posts (IP, timestamp visible)
  - Recommend Tor for public posting
  - Randomize timestamps (±2 days for private)
  - Educate users on metadata risks

**Risk 6: Social Engineering via Comments**
- **Impact**: High (infiltration)
- **Likelihood**: Medium (bad actors will try)
- **Mitigation**:
  - Verified badges for group admins
  - Report/block/mute tools
  - Content warnings for external links
  - User education (security culture)

**Risk 7: Device Seizure with Local Data**
- **Impact**: Critical (arrests, prosecution)
- **Likelihood**: Low (but high-stakes)
- **Mitigation**:
  - WebAuthn-protected encryption keys
  - Remote wipe capability (via Nostr event)
  - Auto-lock after inactivity
  - Plausible deniability (hidden identities)

### Community & Moderation Risks

**Risk 8: Spam and Abuse**
- **Impact**: Medium (UX degradation)
- **Likelihood**: High (open platform)
- **Mitigation**:
  - Rate limiting per identity
  - Proof-of-work for public posts (NIP-13)
  - Per-group moderation (admins can ban)
  - User-controlled muting/blocking

**Risk 9: Harmful Content**
- **Impact**: High (legal, moral)
- **Likelihood**: Medium (inevitable at scale)
- **Mitigation**:
  - Content warnings required for sensitive media
  - Report tools with relay-level enforcement
  - Age verification for adult content (optional)
  - Clear community guidelines

**Risk 10: Centralization Pressure**
- **Impact**: Medium (loss of privacy benefits)
- **Likelihood**: Low (architecture prevents it)
- **Mitigation**:
  - Educate users on relay diversity
  - Showcase .onion and self-hosted relays
  - Prevent "default relay" concentration
  - Community governance for relay recommendations

### Adoption & Growth Risks

**Risk 11: UX Complexity (Privacy Features)**
- **Impact**: High (adoption barrier)
- **Likelihood**: High (crypto UX is hard)
- **Mitigation**:
  - Progressive disclosure (simple first, advanced later)
  - Sane defaults (encrypt by default)
  - Onboarding wizard with templates
  - Video tutorials and tooltips

**Risk 12: Network Effects (Cold Start Problem)**
- **Impact**: High (empty feeds → churn)
- **Likelihood**: High (new platform)
- **Mitigation**:
  - Seed with high-value content (organizing guides, news)
  - Partner with existing activist groups for launch
  - Cross-post to Twitter/Mastodon (bridge)
  - Highlight public timeline (show activity)

**Risk 13: Funding & Sustainability**
- **Impact**: Critical (project death)
- **Likelihood**: Medium (activist tech is hard to fund)
- **Mitigation**:
  - Grants (Open Technology Fund, Mozilla, etc.)
  - Donations (Bitcoin/Lightning via NIP-57)
  - Paid hosting/support for large groups
  - Community contributions (keep FOSS)

---

## Go-to-Market Strategy

### Launch Plan (v2.0.0-social)

**Pre-Launch (Weeks -4 to -1)**
1. **Beta Testing**:
   - Recruit 50 beta users from activist networks
   - Run closed beta for 2 weeks
   - Collect feedback on social features
   - Fix critical bugs, refine UX

2. **Content Seeding**:
   - Populate public feed with organizing guides
   - Create sample groups (Labor, Housing, Climate, Mutual Aid)
   - Demo data with realistic posts, events, proposals
   - Video tutorials for key features

3. **Partner Outreach**:
   - Contact unions, tenant unions, climate groups
   - Offer early access for organizations
   - Co-marketing with aligned projects (Mastodon, Signal)

4. **Documentation**:
   - User guides (Getting Started, Privacy, OPSEC)
   - Developer docs (Module creation, API)
   - Security whitepaper (encryption model, threat analysis)

**Launch Week (Week 0)**
1. **Announcement**:
   - Press release to tech/activist media (Wired, Vice, The Intercept, Jacobin)
   - Launch on Hacker News, Reddit (r/privacy, r/opensource, r/labor)
   - Twitter/Mastodon storm (partners amplify)
   - Demo video (3 min) showcasing social + organizing features

2. **Onboarding Blitz**:
   - Live demos and AMAs (Ask Me Anything)
   - Onboarding support (Discord/Matrix for questions)
   - Quick start templates (activist, union, mutual aid)
   - 24/7 monitoring for issues

3. **Community Building**:
   - Create official BuildIt group on platform
   - Weekly virtual meetups for users
   - Feature request board
   - Contributor guide for developers

**Post-Launch (Weeks 1-12)**
1. **Iterate Rapidly**:
   - Weekly releases based on feedback
   - A/B test onboarding flows
   - Monitor metrics (DAU, retention, engagement)
   - Fix bugs within 48 hours

2. **Expand Partnerships**:
   - Integrate with Nostr ecosystem (other clients)
   - Cross-promote with privacy tools (Tor, VPN providers)
   - Conference talks (HOPE, CCC, LibrePlanet)

3. **Scale Infrastructure**:
   - Add recommended relays (diversity + performance)
   - Optimize for 10K+ users
   - CDN for static assets
   - Monitoring and alerting

### Marketing Channels

**Organic**
- Social media (Twitter, Mastodon, Bluesky)
- Activist networks (DSA, IWW, Sunrise, XR)
- Tech communities (Hacker News, Lobsters, /r/privacy)
- Conferences and meetups

**Partnerships**
- Labor unions (tech workers, teachers, nurses)
- Tenant unions and housing groups
- Climate justice organizations
- Digital rights groups (EFF, Access Now, Fight for the Future)

**Content Marketing**
- Blog posts (privacy, organizing tactics)
- Tutorials and how-tos
- Case studies (successful campaigns using BuildIt)
- Open-source contributions

**Paid** (if funded)
- Sponsored posts on Reddit, Twitter
- Ads in activist publications (Jacobin, In These Times)
- Conference sponsorships

### Success Metrics (12-Month Goals)

**Adoption**
- Users: 10,000+ registered identities
- Groups: 500+ active groups
- DAU: 2,000+ (20% of users)
- MAU: 5,000+ (50% of users)

**Engagement**
- Posts per day: 1,000+ (0.1 posts/user/day)
- Comments per post: 5+ average
- Events created: 200+ per month
- Proposals voted on: 100+ per month

**Retention**
- 7-day retention: 50%
- 30-day retention: 30%
- 90-day retention: 20%

**Privacy**
- Encrypted content: 95%+ of private posts
- Tor usage: 20%+ of active users
- Relay diversity: No single relay >30% of traffic

**Quality**
- Lighthouse score: >90
- Crash-free rate: 99.5%
- Support response time: <24 hours
- Bug resolution: <72 hours for critical

---

## Implementation Timeline

### Gantt Chart (26 Weeks Total)

```
Phase 1: Social Core (Weeks 1-8)
├── Epic 21.1: Microblogging       [===========] Weeks 1-2
├── Epic 21.2: Activity Feed       [=======]     Weeks 3-3.5
├── Epic 21.3: Comments & Reactions[=======]     Weeks 4-4.5
├── Epic 21.4: Discovery (optional)[====]        Week 5
├── Epic 22.1: Documents WYSIWYG   [===========] Weeks 5-6.5
├── Epic 22.2: Files Module        [=======]     Weeks 7-7.5
├── Epic 22.3: Integration         [====]        Week 8
└── Epic 23: Navigation            [=======]     Week 8

Phase 2: Rich Content (Weeks 9-12) [Already in Phase 1]
└── (Completed in Epic 22)

Phase 3: Growth & Scale (Weeks 13-20)
├── Epic 15.5: Forms & Fundraising [==============] Weeks 13-14
├── Epic 17: Translation           [==============] Weeks 15-16
├── Epic 19: Testing & Quality     [==============] Weeks 17-18
└── Buffer & Polish                [==============] Weeks 19-20

Launch Prep (Weeks 21-24)
├── Beta Testing                   [=======]        Weeks 21-22
├── Documentation                  [=======]        Week 23
├── Partner Outreach              [=======]        Week 24
└── Content Seeding               [=======]        Week 24

Launch & Iterate (Weeks 25-26)
├── Launch Week                    [====]           Week 25
└── Rapid Iteration               [====]           Week 26+

Total: 26 weeks (6 months) from start to public launch
```

### Milestone Deliverables

**Month 1-2 (Weeks 1-8): Social Core MVP**
- ✅ Microblogging with privacy controls
- ✅ Activity feed (Following, Public, Group)
- ✅ Threaded comments and reactions
- ✅ Documents and Files modules
- ✅ Feed-first navigation

**Month 3-4 (Weeks 9-16): Content & i18n**
- ✅ Forms builder and fundraising
- ✅ Complete translations (7 languages)
- ✅ Advanced date/time localization
- ✅ Public pages and SEO

**Month 5 (Weeks 17-20): Quality & Testing**
- ✅ Integration and E2E tests passing
- ✅ Performance optimization (bundle <500KB)
- ✅ Lighthouse score >90
- ✅ Security audit

**Month 6 (Weeks 21-26): Launch**
- ✅ Beta testing with 50+ users
- ✅ Documentation complete
- ✅ Partner integrations
- ✅ Public launch v2.0.0-social
- ✅ Rapid iteration based on feedback

---

## Resource Requirements

### Team Composition

**Core Team (Minimum)**
- 1 Full-Stack Engineer (React/TypeScript/Nostr)
- 1 UX/UI Designer (Social features, onboarding)
- 1 Product Manager (You!)
- 1 DevOps/Infrastructure (Relay management, deployment)

**Extended Team (If Funded)**
- +1 Frontend Engineer (Performance, animations)
- +1 Security Engineer (Audit, encryption)
- +1 Community Manager (Support, moderation)
- +1 Content Strategist (Documentation, tutorials)

### Technology Stack (Additional Dependencies)

**For Social Features**:
- TipTap or Lexical (WYSIWYG editor for documents/posts)
- @tanstack/react-virtual (already installed, for feed virtualization)
- Markdown renderer (already have @uiw/react-md-editor)
- Link preview service (privacy-safe, self-hosted)

**For Testing**:
- Playwright (already installed, needs config)
- fake-indexeddb (for integration tests)
- MSW (Mock Service Worker for API testing)

**For i18n**:
- Crowdin or Weblate (translation management)
- date-fns (already installed, needs expansion)

### Infrastructure Needs

**Development**:
- GitHub repo (already have)
- CI/CD (GitHub Actions)
- Staging environment (Vercel preview)

**Production**:
- Static hosting (Vercel or Netlify)
- CDN for assets (Cloudflare)
- Multiple Nostr relays (5+ diverse)
- Monitoring (Sentry for errors, Plausible for analytics)

**Estimated Costs** (Monthly):
- Hosting: $50-100 (Vercel Pro)
- Relays: $100-300 (VPS for self-hosted)
- CDN: $20-50 (Cloudflare Pro)
- Monitoring: $50 (Sentry, Plausible)
- **Total**: $220-500/month

---

## Conclusion & Recommendations

### Strategic Recommendations

1. **Prioritize Social Core (Epic 21-23)** - This is the make-or-break feature set. Without it, BuildIt remains a toolkit, not a platform. Invest 60% of resources here.

2. **Launch Lean, Iterate Fast** - Ship v2.0.0-social with microblogging, feed, comments. Don't wait for documents/files/forms. Get user feedback early.

3. **Privacy as Brand** - Emphasize "Twitter for Activists, Built for Privacy" positioning. Differentiate on encryption + organizing tools, not just open source.

4. **Community-First Growth** - Partner with 3-5 activist organizations for launch. Their endorsement > paid ads. Seed groups with their content.

5. **Mobile PWA Excellence** - Most activists use mobile. Ensure PWA install flow is seamless, offline works perfectly, and UX rivals native apps.

### Next Steps (Immediate Actions)

**Week 1-2: Planning & Setup**
1. Review this roadmap with team, refine priorities
2. Set up project tracking (Linear, GitHub Projects)
3. Design mockups for microblogging and feed UI
4. Write technical specs for Epic 21.1 (Microblogging)
5. Identify beta testing partners (reach out to 10 groups)

**Week 3-4: Epic 21.1 Kickoff**
1. Implement post creation UI (rich text, media, privacy)
2. Create Nostr event publishing for posts (kind 1 + NIP-17)
3. Build post display component (cards, media, metadata)
4. Add post actions (like, share, comment button)
5. Write unit tests for post logic

**Week 5-6: Epic 21.2 - Activity Feed**
1. Design feed layout (infinite scroll, filters)
2. Implement Nostr subscriptions for feed (REQ filters)
3. Aggregate content from multiple sources (posts, events, etc.)
4. Add real-time updates (new post notifications)
5. Optimize with virtualization and caching

**By End of Month 1**: Ship alpha version with posts + feed to internal team. Dogfood it. Fix UX issues.

### Key Success Factors

✅ **Ship Social Features First** - Everything else can wait. Feed + posts + comments = MVP.

✅ **Nail the Onboarding** - First 5 minutes determine retention. Make it magical.

✅ **Maintain Privacy Standards** - Don't compromise encryption for UX. Find better UX.

✅ **Build in Public** - Share progress weekly, involve community in decisions.

✅ **Measure Everything** - DAU, retention, engagement. Let data guide iterations.

---

**BuildIt Network has the foundation to become the go-to platform for privacy-conscious organizing. The addition of social features transforms it from a toolkit into a movement.**

**Let's build the future of activism. Together. Encrypted.**

---

*Document prepared by: Product Management (Claude Code)*
*Date: 2025-10-05*
*Version: 1.0*
*Next Review: After Epic 21 completion*
