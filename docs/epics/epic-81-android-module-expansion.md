# Epic 81: Android Module System Expansion

**Status**: Not Started
**Priority**: P2 - Platform Feature Depth
**Effort**: 40-55 hours
**Platforms**: Android
**Dependencies**: Epic 75 (Android Feature Completeness) recommended first

---

## Context

The Android `MODULE_SYSTEM.md` documents extensive planned features that haven't been implemented yet: full Compose UI for events and messaging, voice/video messages, calendar export, message search/threading, and four entirely new modules (Tasks, Files, Polls, Wiki). This represents the next level of Android feature depth beyond the basic feature parity in Epic 75.

**Source**: `clients/android/MODULE_SYSTEM.md` (lines 456-484)

---

## Tasks

### Events Module UI (8-10h)

#### Event Calendar View
- [ ] Implement Compose calendar view for events
- [ ] Support month/week/day views
- [ ] Highlight dates with events
- [ ] Tap to see event details

#### RSVP Attendee List
- [ ] Display attendee list for events
- [ ] Show RSVP status (going/maybe/not going)
- [ ] Support capacity indicators

#### Event Reminders & Notifications
- [ ] Schedule local notifications for upcoming events
- [ ] Configurable reminder times (15m, 1h, 1d before)
- [ ] Handle notification permissions

#### Event Search & Filtering
- [ ] Search events by title, description, location
- [ ] Filter by date range, group, category
- [ ] Sort by date, relevance, proximity

#### Calendar Export
- [ ] Export events to device calendar (iCal format)
- [ ] Support recurring events
- [ ] Handle timezone conversions

### Messaging Enhancements (8-10h)

#### Message Search
- [ ] Full-text search across conversations
- [ ] Search within specific conversation
- [ ] Result highlighting and navigation

#### Message Threading UI
- [ ] Display message threads/replies
- [ ] Thread navigation (jump to parent, see all replies)
- [ ] Thread indicators in conversation view

#### Message Reaction Picker
- [ ] Implement emoji reaction picker
- [ ] Display reaction counts on messages
- [ ] Handle reaction sync across devices

#### Voice Messages
- [ ] Record voice messages with Android MediaRecorder
- [ ] Compress and encrypt audio
- [ ] Playback with waveform visualization
- [ ] Support background playback

#### Video Messages
- [ ] Record short video messages
- [ ] Compress and encrypt video
- [ ] Thumbnail generation
- [ ] Inline playback in conversation

### New Modules (20-25h)

#### Tasks Module
- [ ] Create Compose screens for task lists
- [ ] Task creation with title, description, assignee, due date
- [ ] Task status tracking (todo, in progress, done)
- [ ] Task assignment to group members
- [ ] Task notifications and reminders

#### Files Module
- [ ] Create Compose screens for shared files
- [ ] File upload with encryption
- [ ] Folder organization (group or private)
- [ ] File sharing with permission controls
- [ ] File preview (images, PDFs, documents)

#### Polls Module
- [ ] Create Compose screens for polls/surveys
- [ ] Multiple poll types (single choice, multiple choice, ranked)
- [ ] Anonymous voting option
- [ ] Results visualization (bar charts, pie charts)
- [ ] Poll deadline and auto-close

#### Wiki Module (Compose)
- [ ] Create Compose screens for collaborative wiki
- [ ] Markdown editor
- [ ] Page versioning and history
- [ ] Category/tag organization
- [ ] Cross-linking between pages

### Navigation Integration (4-6h)
- [ ] Wire all new modules into Android navigation graph
- [ ] Add module icons and labels to navigation drawer/bottom bar
- [ ] Handle deep links for all new modules
- [ ] Module enable/disable per group in settings

---

## Acceptance Criteria

- [ ] Events module has calendar view, attendee lists, search, and calendar export
- [ ] Messaging supports search, threading, reactions, voice, and video
- [ ] Tasks module fully functional with assignments and notifications
- [ ] Files module supports encrypted upload, folders, and sharing
- [ ] Polls module supports multiple voting types with results visualization
- [ ] Wiki module has markdown editor with versioning
- [ ] All modules accessible via navigation
- [ ] All modules respect group-level enable/disable
- [ ] Offline-first for all new features

---

## Technical Notes

- Use existing module registration pattern from `MODULE_SYSTEM.md`
- Voice/video recording should use `MediaRecorder` API
- File encryption must use the same NIP-44 pipeline as other clients
- Wiki markdown should be compatible with web client's editor format
- Polls should use same Nostr event kinds as governance module where applicable

---

**Git Commit Format**: `feat(android): expand module system (Epic 81)`
**Git Tag**: `v0.81.0-android-modules`
