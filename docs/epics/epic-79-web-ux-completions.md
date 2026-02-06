# Epic 79: Web UI/UX Completions

**Status**: Not Started
**Priority**: P2 - Polish & Feature Gaps
**Effort**: 25-35 hours
**Platforms**: Web (Tauri UI)
**Dependencies**: None

---

## Context

The web UI has ~17 deferred UI/UX items tracked in TECH_DEBT.md plus device transfer and backup restore integration gaps. These are individually small but collectively represent significant missing functionality across wiki, forms, bookmarks, newsletters, groups, and multi-device workflows.

**Source**: `clients/web/docs/TECH_DEBT.md` - UI/UX Improvements section (17 items)

---

## Tasks

### Multi-Device Workflow (4-6h)

#### Device Transfer Nostr Relay
- [ ] Implement actual Nostr relay publishing for device transfer payloads
- [ ] Replace simulated send with real NIP-17 encrypted transfer
- [ ] Handle transfer timeout and retry
- [ ] Verify payload integrity on receiving device
- **File**: `clients/web/src/components/settings/MultiDevice/DeviceTransferPanel.tsx:215`

#### Backup Restore Auth Integration
- [ ] Add restored identity to auth store after backup recovery
- [ ] Handle key conflicts (existing vs restored identity)
- [ ] Trigger re-sync after identity restore
- **File**: `clients/web/src/components/settings/MultiDevice/BackupRestorePanel.tsx:421`

### Wiki & Knowledge Base (3-4h)

#### Wiki Page Creation
- [ ] Complete wiki page creation via wikiStore (partially implemented)
- [ ] Support page templates
- [ ] Handle page slug generation and collision
- **File**: `clients/web/src/modules/wiki/CreatePageDialog.tsx`

### Bookmarks & Collections (2-3h)

#### Collection Creation
- [ ] Implement bookmark collection creation logic
- [ ] Support collection naming and organization
- [ ] Handle adding/removing bookmarks from collections
- **File**: `clients/web/src/modules/microblogging/BookmarksView.tsx`

### Forms & Database (4-6h)

#### Form-Database Linking
- [ ] Link forms to actual database tables
- [ ] Map form fields to database columns
- [ ] Auto-populate database from form submissions
- **File**: `clients/web/src/modules/forms/FormsPage.tsx`

#### CSV Export for Forms
- [ ] Implement CSV export for form submissions
- [ ] Handle special characters and encoding
- [ ] Support filtered exports
- **File**: `clients/web/src/modules/forms/FormsPage.tsx`

#### Submission Detail View
- [ ] Implement individual submission detail dialog
- [ ] Display all field values with proper formatting
- [ ] Support submission editing (if permitted)
- **File**: `clients/web/src/modules/forms/FormsPage.tsx`

### Newsletter & Publishing (2-3h)

#### Newsletter Preview
- [ ] Implement newsletter preview (markdown → rendered HTML)
- [ ] Support template preview
- [ ] Mobile preview mode
- **File**: `clients/web/src/modules/newsletters/NewslettersPage.tsx`

### Social & Messaging (3-4h)

#### Open Message Dialog with Friend
- [ ] Implement direct message launch from contacts page
- [ ] Create conversation if doesn't exist
- **File**: `clients/web/src/modules/friends/ContactsPage.tsx`

#### Profile View for Friend
- [ ] Implement friend profile view dialog
- [ ] Display profile metadata, shared groups, mutual contacts
- **File**: `clients/web/src/modules/friends/ContactsPage.tsx`

### Groups (3-4h)

#### Group General Settings
- [ ] Implement general settings tab in GroupSettingsDialog
- [ ] Support group name, description, avatar editing
- [ ] Handle privacy level changes
- **File**: `clients/web/src/components/groups/GroupSettingsDialog.tsx`

#### Group Member Management
- [ ] Implement member management tab
- [ ] Support role assignment, removal, invitation
- [ ] Handle permission changes
- **File**: `clients/web/src/components/groups/GroupSettingsDialog.tsx`

### Database & Records (2-3h)

#### Record Detail Dialog
- [ ] Open record detail dialog from database dashboard
- [ ] Display all fields with proper type rendering
- [ ] Support inline editing
- **File**: `clients/web/src/modules/database/DatabaseDashboard.tsx`

### Security & Audit (2-3h)

#### CSV Export for Audit Logs
- [ ] Implement CSV export for security audit logs
- [ ] Include timestamps, actions, actors
- [ ] Support date range filtering
- **File**: `clients/web/src/components/security/AuditLogs.tsx`

### Editor Enhancements (1-2h)

#### Document Comment Navigation
- [ ] Navigate to comment position in editor when comment is clicked
- [ ] Scroll and highlight commented text
- **File**: `clients/web/src/modules/documents/DocumentsPage.tsx`

#### Auto-numbering Footnotes
- [ ] Implement automatic footnote numbering in document editor
- [ ] Handle footnote reordering
- **File**: `clients/web/src/modules/documents/Footnote.tsx`

---

## Acceptance Criteria

- [ ] Device transfer works over real Nostr relays
- [ ] Backup restore integrates with auth store
- [ ] Wiki pages can be created from UI
- [ ] Bookmark collections functional
- [ ] Forms export to CSV and link to database tables
- [ ] Newsletter preview renders correctly
- [ ] Group settings fully functional
- [ ] All dialogs open and function as expected
- [ ] No remaining non-functional buttons in UI

---

**Git Commit Format**: `feat(web): complete UI/UX gaps (Epic 79)`
**Git Tag**: `v0.79.0-web-ux-complete`
