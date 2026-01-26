# Schema Parity Audit Report

> Cross-client schema comparison for BuildIt Network
> **Date**: 2026-01-26

## Executive Summary

This audit reveals **significant schema drift** between the protocol specifications and client implementations. The web client has evolved independently with manual types that diverge from generated types, while iOS and Android have incomplete implementations missing critical features.

### Overall Status

| Module | Web Manual | Web Generated | iOS | Android | Cross-Client Risk |
|--------|-----------|---------------|-----|---------|-------------------|
| **Events** | ❌ CRITICAL | ✅ | ✅ | ✅ | HIGH |
| **Messaging** | ✅ | ✅ | ❌ CRITICAL | ✅ | HIGH |
| **Mutual Aid** | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial | MEDIUM |
| **Governance** | ✅ | ✅ | ⚠️ Partial | ⚠️ Partial | MEDIUM |
| **Wiki** | ❌ CRITICAL | ✅ | ⚠️ Partial | ⚠️ Partial | HIGH |

---

## Critical Issues (Must Fix)

### 1. Web Events Module - Complete Mismatch

**Location**: `clients/web/src/modules/events/types.ts`

| Protocol Field | Web Manual | Issue |
|----------------|-----------|-------|
| `startAt` | `startTime` | Field rename breaks wire format |
| `endAt` | `endTime` | Field rename breaks wire format |
| `maxAttendees` | `capacity` | Breaking change |
| `visibility` | `privacy` + `direct-action` | Extra enum value not in protocol |
| `location` | `string` | Should be structured object |
| `_v` | Missing | No schema version tracking |
| `pubkey` (RSVP) | `userPubkey` | Field rename |
| `not_going` | `not-going` | Underscore vs hyphen |

**Impact**: Events created on web cannot sync to iOS/Android properly.

**Fix**: Replace manual types with generated types from `src/generated/schemas/events.ts`

---

### 2. iOS Messaging - Missing Codable

**Location**: `clients/ios/Sources/Generated/Schemas/messaging.swift`

**Issue**: Generated structs are NOT `Codable` but MessagingService.swift tries to encode them.

```swift
// This will crash at runtime:
let message = DirectMessage(...)
let messageData = try encoder.encode(message)  // ❌ DirectMessage not Codable!
```

**Impact**: iOS cannot send or receive any messages.

**Fix**: Add `Codable` conformance to all messaging types or update quicktype config.

---

### 3. Web Wiki Module - Custom Types Incompatible

**Location**: `clients/web/src/modules/wiki/types.ts`

| Protocol (24 fields) | Web Manual (8 fields) | Missing |
|---------------------|----------------------|---------|
| `_v`, `slug`, `status`, `visibility` | Not present | 16 fields |
| `categoryId` | `category` | Renamed |
| `createdAt` | `created` | Renamed |
| `lastEditedBy` | `updatedBy` | Renamed |
| Visibility enum | `isPublic` boolean | Loses information |

**Impact**: Wiki data cannot properly sync between clients.

**Fix**: Use generated types from `src/generated/schemas/wiki.ts`

---

### 4. Missing Schema Version (`_v`) Everywhere

**Issue**: iOS and Android implementations don't include `_v` field required by protocol.

**Impact**: Cannot track schema evolution or handle graceful degradation.

**Fix**: Add `_v: String` field to all iOS/Android models.

---

## High Priority Issues

### 5. Android Time Format (Governance, Events)

**Issue**: Android uses milliseconds, protocol uses seconds.

```kotlin
// Android: System.currentTimeMillis() → milliseconds
// Protocol: Unix timestamp → seconds
```

**Impact**: Times will be off by 1000x when syncing.

**Fix**: Convert ms to seconds when serializing to protocol format.

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

| Task | Module | Effort | Files |
|------|--------|--------|-------|
| Replace web events manual types | Events | 4h | `types.ts`, `eventManager.ts`, `eventsStore.ts` |
| Add iOS Codable conformance | Messaging | 2h | `messaging.swift` or codegen |
| Replace web wiki manual types | Wiki | 3h | `types.ts`, store, components |
| Add `_v` to iOS/Android models | All | 2h | All model files |

### Phase 2: High Priority (Next Sprint)

| Task | Module | Effort | Files |
|------|--------|--------|-------|
| Fix Android time format | Governance, Events | 2h | Entity files |
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

### 1. `direct-action` Privacy Level

**Current state**: Only in web events module, not in protocol.

**Options**:
- A) Add to protocol schema → regenerate all clients
- B) Remove from web → use `private` + customFields for direct-action features

**Recommendation**: Option A if direct-action is a core feature, Option B if experimental.

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

- [ ] Web events can be created and synced to iOS/Android
- [ ] iOS can send/receive messages without crashes
- [ ] Wiki pages sync correctly between all clients
- [ ] Timestamps are correct (not off by 1000x)
- [ ] Schema version `_v` is included in all serialized data
- [ ] All enum values serialize with correct format (underscore vs hyphen)
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
