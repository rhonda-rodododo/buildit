# Epic 75: Android Feature Completeness

**Status**: Not Started
**Priority**: P1 - Feature Parity Gap
**Effort**: 30-40 hours
**Platforms**: Android
**Dependencies**: None

---

## Context

The Android client has 12+ TODO items across social features, forms, crypto, sync, and publishing. Many features have UI built but backend wiring is missing - buttons exist but don't function. This epic addresses all Android-specific feature gaps to bring it to parity.

---

## Tasks

### Social Features (8-10h)

#### Repost Functionality
- [ ] Implement post repost (re-share) as Nostr kind:6 event
- [ ] Add repost count display and user list
- [ ] Handle unrepost
- **File**: `clients/android/app/src/main/java/network/buildit/features/social/FeedScreen.kt:286`

#### Post Image Attachment
- [ ] Implement image picker for post composer
- [ ] Compress and encrypt images before upload
- [ ] Display image previews in composer
- [ ] Handle multiple image selection
- **File**: `clients/android/app/src/main/java/network/buildit/features/social/PostComposerScreen.kt:205`

#### Avatar Resolution
- [ ] Resolve avatar URLs from Nostr profile metadata (kind:0)
- [ ] Implement avatar caching
- [ ] Fallback to generated identicon
- **File**: `clients/android/app/src/main/java/network/buildit/features/share/ShareViewModel.kt:100`

### Forms Module - Nostr Publishing (6-8h)

#### Form Creation Publishing
- [ ] Publish form definitions as Nostr events
- [ ] Include form schema, fields, and validation rules
- [ ] Handle form versioning
- **File**: `clients/android/app/src/main/java/network/buildit/modules/forms/domain/FormsUseCase.kt:445`

#### Form Deletion Events
- [ ] Publish NIP-09 deletion events for forms
- [ ] Handle deletion propagation to subscribers
- **File**: `clients/android/app/src/main/java/network/buildit/modules/forms/domain/FormsUseCase.kt:453`

#### Form Response Publishing
- [ ] Publish form responses as encrypted Nostr events
- [ ] Route through NIP-17 for privacy
- [ ] Handle offline queue for response submission
- **File**: `clients/android/app/src/main/java/network/buildit/modules/forms/domain/FormsUseCase.kt:458`

### Crypto & Security (4-6h)

#### Standalone Signature Verification
- [ ] Implement actual Ed25519 signature verification (currently returns `true` as stub)
- [ ] Use native library or pure Kotlin implementation
- [ ] Add verification for bundle signatures, message signatures
- [ ] Remove hardcoded `true` return
- **File**: `clients/android/app/src/main/java/network/buildit/core/crypto/CryptoManager.kt:405`

### Sync & Navigation (6-8h)

#### TransportRouter Integration
- [ ] Route messages through `TransportRouter` for proper transport selection (BLE vs relay)
- [ ] Respect transport priority and availability
- **File**: `clients/android/app/src/main/java/network/buildit/core/sync/SyncManager.kt:470`

#### Deep Link Conversation Launch
- [ ] Navigate to conversation with selected pubkey from deep link
- [ ] Create conversation if it doesn't exist
- **File**: `clients/android/app/src/main/java/network/buildit/MainActivity.kt:351`

#### Deep Link Authentication Check
- [ ] Replace hardcoded `true` with actual authentication check
- [ ] Redirect unauthenticated deep links to login flow
- **File**: `clients/android/app/src/main/java/network/buildit/MainActivity.kt:387`

### Publishing & Wiki (4-6h)

#### Wiki Search
- [ ] Implement wiki search functionality (text search across wiki pages)
- [ ] Add search result highlighting
- **File**: `clients/android/app/src/main/java/network/buildit/modules/wiki/presentation/WikiScreen.kt:58`

#### Publishing Image Picker
- [ ] Implement image selection for published content
- [ ] Support cover images and inline images
- **File**: `clients/android/app/src/main/java/network/buildit/modules/publishing/presentation/PublishingScreen.kt:543`

#### Publishing Share
- [ ] Implement content sharing (Android share sheet integration)
- [ ] Generate shareable links or Nostr event references
- **File**: `clients/android/app/src/main/java/network/buildit/modules/publishing/presentation/PublishingScreen.kt:893`

---

## Acceptance Criteria

- [ ] All social features functional (repost, image attach, avatar display)
- [ ] Forms publish to Nostr (create, delete, respond)
- [ ] Ed25519 signatures actually verified (no stub)
- [ ] Messages route through TransportRouter
- [ ] Deep links work with real auth checks
- [ ] Wiki search returns results
- [ ] Publishing supports images and sharing
- [ ] All features work offline-first

---

**Git Commit Format**: `feat(android): complete feature parity (Epic 75)`
**Git Tag**: `v0.75.0-android-complete`
