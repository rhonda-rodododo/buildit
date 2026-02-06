# Epic 87: Content Curation & Cooperative Marketplace

**Status**: Not Started
**Priority**: P4 - Future Vision
**Effort**: 100+ hours
**Platforms**: All
**Dependencies**: Epics 49B (Stripe/PayPal), 52 (Publishing), 54 (ActivityPub - optional)

---

## Context

The long-term vision includes a cooperative marketplace serving the full "Spectrum of Support" - from worker co-ops to independent businesses to creative initiatives. This goes beyond organizing tools into economic infrastructure for community self-sufficiency. This is a major initiative that should only begin after core platform features are stable.

**Source**: `clients/web/NEXT_ROADMAP.md` (lines 833-839)

---

## Tasks

### Marketplace Foundation (20-25h)

#### Listing System
- [ ] Create marketplace listing schema in `protocol/schemas/`
- [ ] Support listing types: product, service, co-op, initiative, resource
- [ ] Listing fields: title, description, price, location, availability
- [ ] Image gallery for listings
- [ ] Listing expiration and renewal

#### Discovery & Search
- [ ] Full-text search across listings
- [ ] Category/tag filtering
- [ ] Geographic proximity filtering (reuse Epic 85 location infrastructure)
- [ ] Recommendation algorithm (privacy-preserving, local computation)

#### Seller/Provider Profiles
- [ ] Cooperative profile pages
- [ ] Business verification (self-attested, community-vouched)
- [ ] Review/reputation system (Nostr-based, portable)
- [ ] Profile federation (visible to other BuildIt instances)

### Cooperative Tools (20-25h)

#### Worker Co-op Directory
- [ ] Register co-ops with structure info (membership, governance model)
- [ ] Co-op discovery by industry, location, values
- [ ] Inter-co-op networking (federation between BuildIt groups)

#### Resource Sharing Economy
- [ ] Tool library (borrow/lend physical tools)
- [ ] Skill exchange (time banking model)
- [ ] Space sharing (meeting rooms, kitchens, workshops)
- [ ] Vehicle sharing

#### Creative Initiatives Registry
- [ ] Project listings with goals, timeline, team
- [ ] Fundraising integration (link to Epic 49A/49B campaigns)
- [ ] Progress updates and milestones
- [ ] Volunteer recruitment integration

### Payment Integration (15-20h)

#### Multi-Payment Support
- [ ] Bitcoin/Lightning payments (from Epic 49A)
- [ ] Stripe/PayPal integration (from Epic 49B)
- [ ] Escrow system for marketplace transactions
- [ ] Dispute resolution flow
- [ ] Commission/fee structure (configurable per-marketplace)

#### Cooperative Finance
- [ ] Shared treasury management
- [ ] Member equity tracking
- [ ] Revenue distribution
- [ ] Financial reporting (privacy-preserving)

### Event Promotion (10-15h)

#### Event Marketplace
- [ ] Promote events to wider network (beyond own groups)
- [ ] Ticket sales integration
- [ ] Event sponsorship matching
- [ ] Cross-promotion between organizations

### Federation & Syndication (15-20h)

#### Cross-Instance Marketplace
- [ ] Federate listings across BuildIt instances
- [ ] Marketplace sync protocol (extension of relay protocol)
- [ ] Trust/reputation portability
- [ ] Content moderation across instances

---

## Acceptance Criteria

- [ ] Marketplace listings can be created, searched, and filtered
- [ ] Worker co-ops can register and be discovered
- [ ] Resource sharing enables tool libraries and skill exchange
- [ ] Payments work through Bitcoin/Lightning and fiat options
- [ ] Events can be promoted to wider network
- [ ] Listings federate across BuildIt instances
- [ ] All marketplace data is encrypted where appropriate
- [ ] Cooperative governance model respected in marketplace decisions

---

## Privacy Considerations

- Public listings are intentionally public (but seller identity can be pseudonymous)
- Transaction history should be private (only parties involved can see)
- Location data follows same privacy controls as Epic 85
- Reputation system must resist Sybil attacks while preserving privacy
- Financial data encrypted at rest and in transit

---

## Alignment with Vision

This epic directly serves the BuildIt vision of empowering:
- **Worker co-ops** with discovery, networking, and financial tools
- **Independent businesses** with marketplace presence
- **Community organizers** with resource sharing infrastructure
- **Creative collectives** with project funding and promotion

Reference: `docs/VISION.md`, `docs/visions/media-collective.md`

---

**Git Commit Format**: `feat(marketplace): implement cooperative marketplace (Epic 87)`
**Git Tag**: `v0.87.0-marketplace`
