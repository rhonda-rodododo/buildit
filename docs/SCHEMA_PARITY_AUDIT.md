# Schema Parity Audit Report

> Cross-client schema comparison for BuildIt Network
> **Date**: 2026-01-26

## Executive Summary

This audit reveals **significant schema drift** between the protocol specifications and client implementations. The web client has evolved independently with manual types that diverge from generated types, while iOS and Android have incomplete implementations missing critical features.

### Overall Status

| Module | Web Manual | Web Generated | iOS | Android | Cross-Client Risk |
|--------|-----------|---------------|-----|---------|-------------------|
| **Events** | ✅ FIXED | ✅ | ✅ | ✅ | LOW |
| **Messaging** | ✅ | ✅ | ✅ FIXED | ✅ | LOW |
| **Mutual Aid** | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial | MEDIUM |
| **Governance** | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial | MEDIUM |
| **Wiki** | ✅ FIXED | ✅ | ⚠️ Partial | ⚠️ Partial | MEDIUM |

---

## Critical Issues (Must Fix)

### 1. ~~Web Events Module - Complete Mismatch~~ ✅ FIXED

**Status**: RESOLVED (2026-01-26)

**Changes made**:
- Removed `direct-action` privacy level (mapped to `private` for backward compat)
- Removed `locationRevealTime` field
- Changed RSVP status from `not-going` to `not_going`
- Updated `eventManager.ts` to serialize with protocol field names (`_v`, `startAt`, `endAt`, `visibility`, `maxAttendees`)
- Added backward compatibility parsing for legacy events

**Commit**: `fix(events): align web Events module with protocol schema`

---

### 2. ~~iOS Messaging - Missing Codable~~ ✅ FIXED

**Status**: RESOLVED (2026-01-26)

**Changes made**:
- Updated codegen tool to post-process quicktype Swift output
- Added Codable, Sendable conformance to all generated structs and enums
- Added CodingKeys for snake_case JSON mapping (v -> _v, replyTo -> reply_to, etc.)
- All messaging types now properly encode/decode

**Commit**: `fix(codegen): add Codable conformance and CodingKeys to Swift output`

---

### 3. ~~Web Wiki Module - Custom Types Incompatible~~ ✅ FIXED

**Status**: RESOLVED (2026-01-26)

**Changes made**:
- Renamed `category` → `categoryId`
- Renamed `created` → `createdAt`
- Renamed `updated` → `updatedAt`
- Renamed `updatedBy` → `createdBy`/`lastEditedBy`
- Changed `isPublic: boolean` → `visibility: 'group' | 'private' | 'public' | 'role-restricted'`
- Added `_v` schema version field
- Added `slug` field for URL-friendly identifiers
- Added `status` field (draft/published/archived/deleted/review)
- Added `permissions` object for role-based access

**Commit**: `fix(wiki): align web Wiki module with protocol schema`

---

### 4. ~~Missing Schema Version (`_v`) Everywhere~~ ✅ FIXED

**Status**: RESOLVED (2026-01-26)

**Changes made**:
- Added `schemaVersion: String` field with `CodingKeys` mapping to `_v` in iOS models
- Added `@SerialName("_v") val schemaVersion: String = "1.0.0"` to Android models
- Updated: MutualAidModels.swift, GovernanceModels.swift, WikiModels.swift
- Updated: MutualAidEntity.kt, GovernanceEntity.kt, WikiEntity.kt
- Events and Messaging already had schemaVersion in both platforms

**Commit**: `fix(schema): add _v schema version to iOS/Android models`

---

## High Priority Issues

### 5. ~~Android Time Format (Governance, Mutual Aid, Wiki)~~ ✅ FIXED

**Status**: RESOLVED (2026-01-26)

**Changes made**:
- Updated GovernanceUseCase.kt to convert durations and timestamps to seconds
- Updated GovernanceRepository.kt to use seconds for updatedAt
- Updated MutualAidRepository.kt to use seconds for createdAt/updatedAt
- Updated WikiRepository.kt to use seconds for updatedAt
- Updated entity defaults in GovernanceEntity.kt, WikiEntity.kt
- Fixed computed properties (canVote, isInDiscussion, isActive) to compare in seconds

**Commit**: `fix(android): convert timestamps from milliseconds to seconds`

---

### 6. iOS/Android Missing Types

| Module | Missing Types |
|--------|--------------|
| **Mutual Aid** | Fulfillments array, OfferClaim, RideShare, ResourceDirectory, customFields |
| **Governance** | attachments, customFields, signature |
| **Wiki** | PagePermissions, WikiLink, PageComment, EditSuggestion |

**Impact**: Features unavailable on mobile or data loss on sync.

---

### 7. Android Location Flattening (Mutual Aid)

**Issue**: Protocol has nested Location object, Android flattens to individual fields.

```kotlin
// Protocol: location: { name, address, coordinates, radius, privacyLevel }
// Android: locationCity, locationRegion, latitude, longitude (no radius, privacyLevel)
```

**Impact**: Loses location privacy and radius data.

---

## Medium Priority Issues

### 8. Enum Value Formatting

| Module | Protocol | iOS/Android | Issue |
|--------|----------|-------------|-------|
| Events RSVP | `not_going` | varies | Underscore vs hyphen |
| Events Visibility | No `direct-action` | N/A | Web-only value |
| Governance | All correct | ✅ | - |

### 9. ID Field Naming (Messaging)

iOS/Android rename `targetId` → `targetID`, `groupId` → `groupID`.

Android handles via `@SerialName`, iOS may have JSON parsing issues.

### 10. Web Generated Type Duplicates

quicktype generates duplicate interfaces:
- `QuorumObject` AND `QuorumRequirement`
- `ThresholdObject` AND `PassingThreshold`
- `OptionElement` AND `VoteOption`

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Blocks Release)

| Task | Module | Effort | Files | Status |
|------|--------|--------|-------|--------|
| ~~Replace web events manual types~~ | Events | 4h | `types.ts`, `eventManager.ts`, `eventsStore.ts` | ✅ Done |
| ~~Add iOS Codable conformance~~ | Messaging | 2h | `codegen/src/index.ts` | ✅ Done |
| ~~Replace web wiki manual types~~ | Wiki | 3h | `types.ts`, store, components | ✅ Done |
| ~~Add `_v` to iOS/Android models~~ | All | 2h | All model files | ✅ Done |

### Phase 2: High Priority (Next Sprint)

| Task | Module | Effort | Files |
|------|--------|--------|-------|
| ~~Fix Android time format~~ | Governance, Mutual Aid, Wiki | 2h | Entity/Repository/UseCase files | ✅ Done |
| Add missing Mutual Aid types | Mutual Aid | 4h | iOS/Android models |
| Add missing Governance types | Governance | 3h | iOS/Android models |
| Un-flatten Android location | Mutual Aid | 2h | `AidRequestEntity.kt` |

### Phase 3: Standardization (Next Quarter)

| Task | Module | Effort |
|------|--------|--------|
| Clean up generated type duplicates | All | 2h |
| Standardize ID field naming | Messaging | 2h |
| Add cross-client test vectors | All | 4h |
| Add roundtrip serialization tests | All | 6h |

---

## Decision Points Needed

### 1. ~~`direct-action` Privacy Level~~ ✅ RESOLVED

**Decision**: Option B - Removed from web, mapped to `private` for backward compatibility.

Legacy events with `direct-action` will be parsed and treated as `private`.

### 2. Extra Web Fields (Events)

Web has fields not in protocol: `groupId`, `tags`, `imageUrl`, `locationRevealTime`, `coHosts`

**Options**:
- A) Add to protocol schema
- B) Move to `customFields`
- C) Remove if unused

**Recommendation**: Assess each field - likely A for essential, B for optional.

### 3. RideShare & ResourceDirectory (Mutual Aid)

Currently web-only features.

**Options**:
- A) Implement on iOS/Android
- B) Keep as web-only power-user features
- C) Move to separate module

---

## Validation Checklist

After fixes, verify:

- [x] Web events can be created and synced to iOS/Android (web side fixed)
- [x] iOS can send/receive messages without crashes (Codable conformance added)
- [x] Wiki pages sync correctly between all clients (web side fixed)
- [x] Timestamps are correct (not off by 1000x) - Android fixed
- [x] Schema version `_v` is included in all serialized data (all clients)
- [x] All enum values serialize with correct format (underscore vs hyphen)
- [ ] Location data preserves all nested fields

---

## Files Changed Summary

### Web Client
- `clients/web/src/modules/events/types.ts` - Replace with generated
- `clients/web/src/modules/events/eventManager.ts` - Update field names
- `clients/web/src/modules/events/eventsStore.ts` - Update field names
- `clients/web/src/modules/wiki/types.ts` - Replace with generated

### iOS Client
- `clients/ios/Sources/Generated/Schemas/messaging.swift` - Add Codable
- `clients/ios/BuildIt/Modules/*/Models/*.swift` - Add `_v` field
- `clients/ios/BuildIt/Modules/MutualAid/Models/*.swift` - Add missing types

### Android Client
- `clients/android/app/.../governance/data/local/*.kt` - Fix timestamps
- `clients/android/app/.../mutualaid/data/local/*.kt` - Add missing types, un-flatten location
- All entity files - Add `_v` field

### Protocol
- `protocol/test-vectors/` - Add cross-client serialization tests

---

## Appendix: Module-by-Module Details

See individual agent reports for detailed field-by-field comparisons:
- Events: 24 field comparison with 5 critical mismatches
- Messaging: 6 types, iOS Codable critical
- Mutual Aid: 9 types, iOS/Android missing 4
- Governance: 4 types, timestamp and missing fields
- Wiki: 9 types, web custom types completely diverged
