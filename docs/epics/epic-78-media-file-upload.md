# Epic 78: Media & File Upload System

**Status**: Not Started
**Priority**: P1 - Core Feature Gap
**Effort**: 20-25 hours
**Platforms**: Web (primary), iOS, Android
**Dependencies**: None

---

## Context

Media upload is referenced across multiple modules (post composer, publishing, file manager) but the actual upload pipeline is incomplete. Image and video attachments in posts are non-functional, PDF text extraction is missing, and the offline queue doesn't handle file uploads. This epic builds the complete media pipeline from selection to encrypted upload to display.

**Source**: `clients/web/docs/TECH_DEBT.md` - Media & File Features section (4 items)

---

## Tasks

### Core Upload Pipeline (8-10h)

#### Image Upload with Files Module
- [ ] Implement image picker and preview in post composer
- [ ] Compress images client-side (WebP/JPEG, configurable quality)
- [ ] Encrypt images with NIP-44 before upload
- [ ] Upload to configured storage (Nostr media servers / blossom)
- [ ] Return encrypted URL reference for embedding in posts
- [ ] Support multiple images per post
- **File**: `clients/web/src/modules/microblogging/PostComposer.tsx`

#### Video Upload
- [ ] Implement video picker in post composer
- [ ] Client-side video compression (WebCodecs or ffmpeg.wasm)
- [ ] Chunked upload for large files
- [ ] Encrypt video before upload
- [ ] Generate thumbnail for preview
- [ ] Support video playback in feed
- **File**: `clients/web/src/modules/microblogging/PostComposer.tsx`

#### File Upload Offline Queue
- [ ] Integrate file uploads with offline queue processor
- [ ] Queue uploads when offline, retry on reconnect
- [ ] Track upload progress and status
- [ ] Handle partial upload resume
- [ ] Clean up incomplete uploads
- **File**: `clients/web/src/core/offline/queueProcessor.ts`

### Document Processing (4-6h)

#### PDF Text Extraction
- [ ] Integrate pdf.js for client-side PDF text extraction
- [ ] Index extracted text for search
- [ ] Support PDF preview/thumbnails
- [ ] Handle encrypted PDFs
- **File**: `clients/web/src/modules/files/fileAnalytics.ts`

### Cross-Platform Media (6-8h)

#### Android Image/Video Support
- [ ] Wire Android post composer image picker to actual upload
- [ ] Wire Android publishing image picker to upload pipeline
- [ ] Support Android share sheet for media
- **Files**: `PostComposerScreen.kt:205`, `PublishingScreen.kt:543`

#### iOS Media Support
- [ ] Ensure iOS media uploads use same encrypted pipeline
- [ ] Support PHPickerViewController for image/video selection
- [ ] Handle iOS-specific media formats (HEIC, Live Photos)

---

## Acceptance Criteria

- [ ] Images can be selected, compressed, encrypted, and uploaded from post composer
- [ ] Videos can be uploaded with compression and encryption
- [ ] File uploads queue when offline and complete on reconnect
- [ ] PDFs are indexed for text search
- [ ] Media upload works on all three platforms
- [ ] All media is encrypted before leaving the device
- [ ] Upload progress is visible to user

---

## Privacy Considerations

- All media must be encrypted before upload (NIP-44)
- Image EXIF data must be stripped before upload (GPS, camera info)
- Video metadata must be stripped (location, device info)
- Consider using Nostr media servers that don't require authentication
- File names should not leak metadata

---

**Git Commit Format**: `feat(media): implement media upload pipeline (Epic 78)`
**Git Tag**: `v0.78.0-media-upload`
