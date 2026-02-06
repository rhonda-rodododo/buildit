# Epic 76: iOS Feature Completeness

**Status**: Not Started
**Priority**: P1 - Feature Parity Gap
**Effort**: 20-28 hours
**Platforms**: iOS
**Dependencies**: None

---

## Context

The iOS client has 8+ TODOs across training, notifications, and background sync. Training lessons lack navigation and PDF viewing. Notification actions (RSVP, vote, help offer) are logged but not wired to their respective modules. Background sync only covers messaging, missing events, wiki, governance, and mutual aid.

---

## Tasks

### Training Module - Lesson Navigation (6-8h)

#### Previous Lesson Navigation
- [ ] Implement backward navigation through lesson sequence
- [ ] Handle boundary condition (first lesson)
- [ ] Persist lesson progress
- **File**: `clients/ios/BuildIt/Modules/Training/Views/LessonPlayerView.swift:144`

#### Next Lesson Navigation
- [ ] Implement forward navigation through lesson sequence
- [ ] Handle boundary condition (last lesson) with completion screen
- [ ] Mark lessons as completed on navigation
- **File**: `clients/ios/BuildIt/Modules/Training/Views/LessonPlayerView.swift:153`

#### PDF Viewer for Lessons
- [ ] Integrate `PDFKit` for displaying PDF lesson materials
- [ ] Support zoom, scroll, and page navigation
- [ ] Handle PDF loading states and errors
- **File**: `clients/ios/BuildIt/Modules/Training/Views/LessonPlayerView.swift:218`

### Notification Action Wiring (6-8h)

#### RSVP from Notification
- [ ] Wire notification RSVP action to `EventsModule`
- [ ] Process RSVP through events store
- [ ] Send confirmation back to user
- [ ] Handle capacity limits
- **File**: `clients/ios/BuildIt/Core/Notifications/NotificationHandler.swift:383`

#### Vote from Notification
- [ ] Wire notification vote action to `GovernanceModule`
- [ ] Process vote through governance store
- [ ] Validate voting eligibility and deadline
- [ ] Send vote confirmation
- **File**: `clients/ios/BuildIt/Core/Notifications/NotificationHandler.swift:391`

#### Help Offer from Notification
- [ ] Wire notification help offer action to `MutualAidModule`
- [ ] Process offer through mutual aid store
- [ ] Match with existing requests
- [ ] Send confirmation to requester
- **File**: `clients/ios/BuildIt/Core/Notifications/NotificationHandler.swift:399`

### Background Sync Expansion (6-8h)

#### Events Background Sync
- [ ] Query `EventsStore` for new events during background fetch
- [ ] Schedule local notifications for upcoming events
- [ ] Sync RSVP status changes
- **File**: `clients/ios/BuildIt/Core/Background/BackgroundFetchManager.swift:396`

#### Multi-Module Background Sync
- [ ] Add wiki content sync to background refresh
- [ ] Add governance proposal sync (new proposals, vote deadlines)
- [ ] Add mutual aid request sync (new requests in area)
- [ ] Respect battery and data usage constraints
- **File**: `clients/ios/BuildIt/Core/Background/BackgroundFetchManager.swift:420`

### Desktop Tray Notification Badge (2-4h)
- [ ] Implement tray icon switching for notification badge
- [ ] Create badge icon assets (with/without dot)
- [ ] Update tray icon on new message/notification
- [ ] Clear badge when app is focused
- **File**: `clients/desktop/src/tray.rs:153`

---

## Acceptance Criteria

- [ ] Training lessons navigate forward and backward with progress tracking
- [ ] PDF lesson materials render in native PDF viewer
- [ ] Notification RSVP actions process through EventsModule
- [ ] Notification vote actions process through GovernanceModule
- [ ] Notification help offer actions process through MutualAidModule
- [ ] Background sync fetches events, wiki, governance, and mutual aid content
- [ ] Desktop tray shows notification badge
- [ ] All features work offline-first where applicable

---

**Git Commit Format**: `feat(ios): complete feature parity (Epic 76)`
**Git Tag**: `v0.76.0-ios-complete`
