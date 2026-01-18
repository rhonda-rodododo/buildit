# Technical Debt & Deferred Features

This document tracks all known technical debt and deferred feature implementations. Items are categorized by feature area and linked to relevant roadmap epics where applicable.

**Last Updated**: 2026-01-18

---

## 📡 Nostr Protocol Features

Features requiring full Nostr protocol implementation:

| Item | Location | Related Epic | Priority |
|------|----------|--------------|----------|
| Broadcast username to Nostr relays (NIP-01 kind:0 metadata) | `core/username/usernameManager.ts` | Phase 2 | Medium |
| Broadcast updated metadata to Nostr relays | `core/username/usernameManager.ts` | Phase 2 | Medium |
| Send Nostr event to notify friend request recipient | `modules/friends/friendsStore.ts` | Phase 2 | Medium |
| Send Nostr event to notify friend request sender (acceptance) | `modules/friends/friendsStore.ts` | Phase 2 | Medium |
| Load campaign data from Nostr public events | `pages/public/CampaignPage.tsx` | Epic 53A | Low |
| Load public wiki pages from Nostr | `pages/public/PublicWikiPage.tsx` | Epic 53A | Low |
| Broadcast presence update via Nostr | `core/messaging/conversationsStore.ts` | Phase 2 | Low |
| Query presence from Nostr | `core/messaging/conversationsStore.ts` | Phase 2 | Low |
| Implement Nostr publish retry separately | `core/offline/queueProcessor.ts` | Epic 60 | Medium |
| Search for user by username via Nostr NIP-05 | `modules/friends/AddFriendDialog.tsx` | Phase 2 | Medium |

---

## 🔐 Backend-Required Features (Phase 3)

Features that require server-side infrastructure:

| Item | Location | Related Epic | Notes |
|------|----------|--------------|-------|
| Email invite via backend service | `modules/friends/AddFriendDialog.tsx` | Epic 62+ | Requires SMTP backend |

---

## 📁 Media & File Features

Media upload and processing features:

| Item | Location | Related Epic | Priority |
|------|----------|--------------|----------|
| Implement image upload with Files module | `modules/microblogging/PostComposer.tsx` | Epic 55 | High |
| Implement video upload | `modules/microblogging/PostComposer.tsx` | Epic 55 | Medium |
| Add PDF text extraction with pdf.js | `modules/files/fileAnalytics.ts` | Epic 58 | Low |
| Implement actual file upload logic (offline queue) | `core/offline/queueProcessor.ts` | Epic 60 | Medium |

---

## 🎨 UI/UX Improvements

User interface enhancements:

| Item | Location | Priority | Notes |
|------|----------|----------|-------|
| Wiki page creation via wikiStore | `modules/wiki/CreatePageDialog.tsx` | High | Partially implemented |
| Collection creation logic (bookmarks) | `modules/microblogging/BookmarksView.tsx` | Medium | |
| Link forms to actual database table | `modules/forms/FormsPage.tsx` | Medium | Template linkage |
| CSV export for form submissions | `modules/forms/FormsPage.tsx` | Low | |
| Submission detail view | `modules/forms/FormsPage.tsx` | Low | |
| Newsletter preview | `modules/newsletters/NewslettersPage.tsx` | Medium | |
| Open a record detail dialog | `modules/database/DatabaseDashboard.tsx` | Medium | |
| Open message dialog with friend | `modules/friends/ContactsPage.tsx` | Medium | |
| Open profile view for friend | `modules/friends/ContactsPage.tsx` | Low | |
| Track analytics event | `modules/public/PublicPageRenderer.tsx` | Low | Privacy considerations |
| Show toast notifications (multiple locations) | Various | Low | UX polish |
| Navigate to comment position in editor | `modules/documents/DocumentsPage.tsx` | Low | |
| Implement general settings (groups) | `components/groups/GroupSettingsDialog.tsx` | Medium | |
| CSV export for audit logs | `components/security/AuditLogs.tsx` | Low | |

---

## 🔏 Cryptographic Features

Security and signature features:

| Item | Location | Related Epic | Notes |
|------|----------|--------------|-------|
| Sign QR data with private key | `modules/friends/AddFriendDialog.tsx` | Phase 2 | Prevents QR spoofing |
| Verify QR signature | `modules/friends/AddFriendDialog.tsx` | Phase 2 | Required for above |

---

## 🚀 Advanced Features

Complex features for future phases:

| Item | Location | Related Epic | Notes |
|------|----------|--------------|-------|
| Implement location tagging | `modules/microblogging/PostComposer.tsx` | Epic 55+ | Privacy implications |
| Link post composer to Events module | `modules/microblogging/PostComposer.tsx` | Epic 55 | Cross-module integration |
| Link post composer to Documents module | `modules/microblogging/PostComposer.tsx` | Epic 55 | Cross-module integration |
| Filter activity by user's groups | `components/feed/ActivityFeed.tsx` | Phase 2 | Group membership tracking |
| Filter activity by mentions | `components/feed/ActivityFeed.tsx` | Phase 2 | Mention tracking |
| Queue messages for later decryption | `core/messaging/messageReceiver.ts` | Epic 60 | When vault locked |
| Conversation discovery from incoming messages | `core/messaging/messageReceiver.ts` | Phase 2 | Auto-create threads |
| Implement invitation list for events | `modules/events/useEvents.ts` | Phase 2 | Explicit invitations |
| Add to offline queue for later retry | `core/messaging/conversationsStore.ts` | Epic 60 | Message retry logic |
| BLE peripheral support | `core/ble/BLEMeshAdapter.ts` | Phase 4+ | Waiting on Web Bluetooth API |
| Negentropy sync protocol | `core/ble/BLEMeshAdapter.ts` | Phase 4+ | BLE mesh feature |
| Geolocation distance matching | `modules/mutual-aid/matching.ts` | Phase 2 | Requires location services |
| Auto-numbering footnotes | `modules/documents/Footnote.tsx` | Low | Editor enhancement |
| Implement proper semver comparison | `stores/moduleStore.ts` | Low | Module versioning |
| Donation flow with Bitcoin/Lightning | `modules/fundraising/FundraisingPage.tsx` | Epic 49A | Crypto payments |
| Group buddylist by primary group | `core/messaging/BuddylistSidebar.tsx` | Low | UX enhancement |
| Document seeds implementation | `modules/documents/seeds.ts` | Phase 2 | Example documents |

---

## 📋 Resolution Guidelines

When resolving items from this list:

1. **Check related epic** - Item may already be planned in NEXT_ROADMAP.md
2. **Create GitHub issue** - For items not in roadmap that should be tracked
3. **Implement directly** - For quick wins that don't need tracking
4. **Remove from list** - Update this doc when item is resolved

## 🏷️ Priority Definitions

- **High**: Blocks user workflows or causes confusion
- **Medium**: Enhances user experience significantly
- **Low**: Nice to have, polish items
