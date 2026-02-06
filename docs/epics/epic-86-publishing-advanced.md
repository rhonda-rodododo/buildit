# Epic 86: Advanced Publishing Features

**Status**: Not Started
**Priority**: P3 - Feature Enhancement
**Effort**: 20-30 hours
**Platforms**: Web (primary), Desktop
**Dependencies**: Epic 52 (Publishing Module - completed)

---

## Context

Epic 52 (Long-Form Publishing) was completed with core features, but several subtasks were explicitly deferred: custom domain support, navigation menu editor, archive/category pages, author profile pages, preview mode, and link tracking. Epic 53A (Newsletter - Nostr DMs) was completed but deferred preview rendering and link tracking. This epic collects all deferred publishing and newsletter features.

**Sources**:
- `clients/web/COMPLETED_ROADMAP.md` (Epic 52, 53A deferred subtasks)
- `clients/web/NEXT_ROADMAP.md` (lines 220-260, 310-325)

---

## Tasks

### Custom Domain Support (6-8h)

#### CNAME Configuration
- [ ] Implement custom domain settings UI in publication settings
- [ ] Generate CNAME instructions for user's DNS provider
- [ ] Validate domain ownership via DNS TXT record
- [ ] Configure Cloudflare Workers for custom domain routing
- [ ] Handle SSL certificate provisioning (Cloudflare automatic)
- [ ] Support subdomain and apex domain

### Navigation & Structure (4-6h)

#### Navigation Menu Editor
- [ ] Drag-and-drop menu item ordering
- [ ] Support nested menu items (dropdown)
- [ ] Link to internal pages, categories, or external URLs
- [ ] Preview navigation in publication theme

#### Archive & Category Pages
- [ ] Auto-generate archive pages (by month/year)
- [ ] Category/tag landing pages
- [ ] Pagination for large archives
- [ ] SEO-friendly URLs (`/archive/2026/01`, `/category/organizing`)

#### Author Profile Pages
- [ ] Author bio page with avatar, name, description
- [ ] List of articles by author
- [ ] Social links (Nostr pubkey, other platforms)
- [ ] Author-specific RSS feed

### Content Preview (3-4h)

#### Newsletter Preview
- [ ] Markdown → rendered HTML preview before sending
- [ ] Mobile preview mode (narrow viewport simulation)
- [ ] Template preview with different content lengths
- **File**: `clients/web/src/modules/newsletters/NewslettersPage.tsx`

#### Article Preview Mode
- [ ] Preview article as it will appear to readers
- [ ] Preview in publication theme context
- [ ] Preview social sharing cards (Open Graph)

### Analytics & Tracking (4-6h)

#### Link Tracking
- [ ] Track link clicks in newsletters via Nostr event references
- [ ] Privacy-preserving: aggregate counts only, no per-user tracking
- [ ] Display click-through rates on newsletter analytics dashboard
- [ ] No external tracking pixels (privacy violation)

#### SEO Enhancements
- [ ] Generate `robots.txt` for publication domains
- [ ] Generate `sitemap.xml` for published content
- [ ] Schema.org structured data (Article, Person, Organization)
- [ ] Open Graph and Twitter Card meta tags
- **Reference**: `clients/web/NEXT_ROADMAP.md` - Backlog Item 5

### E2E Tests (3-4h)

#### Publishing Flow Tests
- [ ] Article creation → publish → verify on public page
- [ ] Newsletter creation → send → verify delivery
- [ ] Subscription flow (subscribe → receive → unsubscribe)
- [ ] Custom domain configuration flow

---

## Acceptance Criteria

- [ ] Publications accessible via custom domains with SSL
- [ ] Navigation menus editable via drag-and-drop
- [ ] Archive and category pages auto-generated
- [ ] Author profiles display with article lists
- [ ] Newsletter preview renders correctly before send
- [ ] Link tracking shows aggregate click-through rates
- [ ] SEO meta tags and structured data on all public pages
- [ ] E2E tests cover full publishing workflow

---

## Privacy Considerations

- Link tracking must be aggregate only (no per-user click tracking)
- No tracking pixels in newsletters
- Custom domain DNS records are public (user should be informed)
- Author profiles are intentionally public (opt-in per author)

---

**Git Commit Format**: `feat(publishing): add advanced publishing features (Epic 86)`
**Git Tag**: `v0.86.0-publishing-advanced`
