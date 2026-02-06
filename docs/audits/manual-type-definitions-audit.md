# Manual Type Definitions Audit

> **Date**: 2026-02-06
> **Status**: FINDINGS DOCUMENTED - Awaiting remediation
> **Severity**: CRITICAL - Blocks cross-platform type consistency

This audit identifies every case across all platforms where types are manually defined
in client/worker code that should instead come from protocol schemas via codegen.

---

## Executive Summary

| Category | Count |
|----------|-------|
| **New schemas needed** | 13 modules |
| **Existing schemas not used by clients** | 12+ modules across 3 platforms |
| **Total manually defined protocol types** | ~350+ types |
| **Platforms affected** | Web, iOS, Android, Desktop/Rust, Workers |

---

## PART 1: NEW SCHEMAS NEEDED

These are cross-platform business/protocol types that have NO schema definition at all.
They exist as manual definitions on one or more platforms.

### 1.1 `groups` (CRITICAL - Core Module)

**No schema exists. Types defined manually in web client.**

| Type | File | Platform |
|------|------|----------|
| `Group` | `clients/web/src/types/group.ts:23-44` | Web |
| `GroupMember` | `clients/web/src/types/group.ts:15-21` | Web |
| `GroupPrivacyLevel` | `clients/web/src/types/group.ts:1` | Web |
| `GroupRole` | `clients/web/src/types/group.ts:3` | Web |
| `GroupPermission` | `clients/web/src/types/group.ts:5-13` | Web |
| `GroupModule` | `clients/web/src/types/group.ts:46-64` | Web |
| `GroupInvitation` | `clients/web/src/types/group.ts:65-74` | Web |
| `GroupSettings` | `clients/web/src/types/group.ts:76-93` | Web |
| `GROUP_EVENT_KINDS` | `clients/web/src/types/group.ts:96-112` | Web |
| `GroupThread` | `clients/web/src/types/group.ts:150-160` | Web |
| `GroupMessage` | `clients/web/src/types/group.ts:162-174` | Web |

**Action**: Create `protocol/schemas/modules/groups/v1.json`

---

### 1.2 `identity` (CRITICAL - Core Module)

**No schema exists. Types defined manually in web client and Rust crypto.**

| Type | File | Platform |
|------|------|----------|
| `Identity` | `clients/web/src/types/identity.ts:1-12` | Web |
| `KeyPair` | `clients/web/src/types/identity.ts:14-17` | Web |
| `EncryptedIdentity` | `clients/web/src/types/identity.ts:19-25` | Web |
| `KeyPair` (Rust) | `packages/crypto/src/keys.rs:22-26` | Rust |

**Action**: Create `protocol/schemas/core/identity/v1.json`

---

### 1.3 `contacts` (HIGH - Cross-Platform)

**No schema exists. Types defined manually on web and Android.**

| Type | File | Platform |
|------|------|----------|
| `Contact` | `clients/web/src/types/contacts.ts:21-26` | Web |
| `ContactMetadata` | `clients/web/src/types/contacts.ts:7-16` | Web |
| `RelationshipType` | `clients/web/src/types/contacts.ts:4` | Web |
| `ProfileMetadata` | `clients/web/src/types/contacts.ts:55-64` | Web |
| `NoteCategory` | `clients/android/.../contacts/data/local/ContactNotesEntity.kt:10-17` | Android |
| `ContactNoteEntity` | `clients/android/.../contacts/data/local/ContactNotesEntity.kt:30-38` | Android |
| `ContactTagEntity` | `clients/android/.../contacts/data/local/ContactNotesEntity.kt:50-57` | Android |
| `PredefinedTag` | `clients/android/.../contacts/data/local/ContactNotesEntity.kt:79-99` | Android |

**Action**: Create `protocol/schemas/modules/contacts/v1.json`

---

### 1.4 `training` (HIGH - Cross-Platform, ~550 lines on Android alone)

**No schema exists. Massive manual definitions on Android and iOS.**

| Type | File | Platform |
|------|------|----------|
| `Course` | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `TrainingModule` | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `Lesson` | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `LessonContent` (sealed) | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `QuizQuestion` | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `CourseProgress` | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `Certification` | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `CourseCategory` enum | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `CourseDifficulty` enum | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `CourseStatus` enum | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `LessonType` enum | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `QuizQuestionType` enum | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| `ProgressStatus` enum | Android: `modules/training/domain/model/TrainingModels.kt` | Android |
| (same types) | iOS: `Modules/Training/Models/TrainingModels.swift` | iOS |
| (same types) | Web: `modules/training/types.ts` (lines 71-634) | Web |

**Action**: Create `protocol/schemas/modules/training/v1.json`, register in `_registry.json`

---

### 1.5 `polls` (HIGH - Cross-Platform)

**No schema exists. Types defined on Android.**

| Type | File | Platform |
|------|------|----------|
| `PollType` enum | `clients/android/.../polls/data/local/PollEntity.kt:10-14` | Android |
| `PollStatus` enum | `clients/android/.../polls/data/local/PollEntity.kt:19-24` | Android |
| `PollEntity` | `clients/android/.../polls/data/local/PollEntity.kt:29-55` | Android |
| `PollVoteEntity` | `clients/android/.../polls/data/local/PollEntity.kt:60-77` | Android |
| `Poll` | `clients/web/src/modules/microblogging/types.ts:344-384` | Web |
| `PollVote` | `clients/web/src/modules/microblogging/types.ts` | Web |

**Action**: Create `protocol/schemas/modules/polls/v1.json`, register in `_registry.json`

---

### 1.6 `microblogging` (HIGH - Cross-Platform)

**No schema exists. Types defined on web client.**

| Type | File | Platform |
|------|------|----------|
| `Post` | `clients/web/src/modules/microblogging/types.ts:32-92` | Web |
| `Reaction` | `clients/web/src/modules/microblogging/types.ts:102-111` | Web |
| `Comment` | `clients/web/src/modules/microblogging/types.ts:116-138` | Web |
| `Repost` | `clients/web/src/modules/microblogging/types.ts:143-157` | Web |

**Action**: Create `protocol/schemas/modules/microblogging/v1.json`, register in `_registry.json`

---

### 1.7 `nostr-core` (CRITICAL - Used Everywhere)

**No schema exists. Core Nostr types duplicated across relay, federation, and crypto.**

| Type | File | Platform |
|------|------|----------|
| `NostrEvent` | `packages/crypto/src/nostr.rs:18-28` | Rust |
| `UnsignedEvent` | `packages/crypto/src/nostr.rs:9-16` | Rust |
| `NostrEvent` | `workers/relay/src/types.ts:7-15` | Workers |
| `NostrFilter` | `workers/relay/src/types.ts:17-36` | Workers |
| `NostrMessage` | `workers/relay/src/types.ts:39-49` | Workers |
| `RelayInfo` (NIP-11) | `workers/relay/src/types.ts:52-79` | Workers |
| `NostrEvent` (dup) | `workers/federation/src/types.ts:22-30` | Workers |
| `Rumor` | `clients/web/src/types/nostr.ts:35-40` | Web |
| `Seal` | `clients/web/src/types/nostr.ts:42-50` | Web |
| `GiftWrap` | `clients/web/src/types/nostr.ts:52-60` | Web |
| `RelayConfig` | `clients/web/src/types/nostr.ts:5-9` | Web |
| `RelayStatus` | `clients/web/src/types/nostr.ts:11-19` | Web |

**Action**: Create `protocol/schemas/core/nostr/v1.json`

---

### 1.8 `security` / `duress` (HIGH - Security Critical)

**No schema exists. Types in Rust crypto library.**

| Type | File | Platform |
|------|------|----------|
| `DecoyIdentity` | `packages/crypto/src/duress.rs:51-62` | Rust |
| `DuressCheckResult` | `packages/crypto/src/duress.rs:64-71` | Rust |
| `DuressAlertConfig` | `packages/crypto/src/duress.rs:73-82` | Rust |
| `DecoyContact` | `packages/crypto/src/duress.rs:84-91` | Rust |

**Action**: Create `protocol/schemas/core/security/v1.json`

---

### 1.9 `multisig` (HIGH - Security Critical)

**No schema exists. Types in Rust crypto library.**

| Type | File | Platform |
|------|------|----------|
| `KeyShare` | `packages/crypto/src/multisig.rs:23-37` | Rust |
| `ThresholdConfig` | `packages/crypto/src/multisig.rs:40-48` | Rust |
| `ThresholdKeyGroup` | `packages/crypto/src/multisig.rs:51-63` | Rust |
| `PartialSignature` | `packages/crypto/src/multisig.rs:65-74` | Rust |
| `AggregatedSignature` | `packages/crypto/src/multisig.rs:76-85` | Rust |
| `KeyRotationProposal` | `packages/crypto/src/multisig.rs:87-100+` | Rust |

**Action**: Create `protocol/schemas/core/multisig/v1.json`

---

### 1.10 `crypto-primitives` (MEDIUM)

**No schema exists. Wire-format types in Rust crypto.**

| Type | File | Platform |
|------|------|----------|
| `EncryptedData` | `packages/crypto/src/aes.rs:11-16` | Rust |
| `MessageHeader` | `packages/crypto/src/ratchet.rs:56-65` | Rust |
| `UnwrapResult` | `packages/crypto/src/nip17.rs:14-20` | Rust |
| `SecretType` | `clients/desktop/src/crypto/keyring.rs:34-47` | Desktop |
| `StoredSecret` | `clients/desktop/src/crypto/keyring.rs:62-75` | Desktop |

**Action**: Create `protocol/schemas/core/crypto/v1.json`

---

### 1.11 `ble-transport` (MEDIUM - Cross-Platform Desktop+Android)

**No schema exists. Types in desktop Tauri BLE code.**

| Type | File | Platform |
|------|------|----------|
| `IdentityCommitment` | `clients/desktop/src/ble/manager.rs:149-157` | Desktop |
| `DiscoveredDevice` | `clients/desktop/src/ble/manager.rs:194-211` | Desktop |
| `ConnectionStatus` | `clients/desktop/src/ble/manager.rs:213-224` | Desktop |
| `ConnectedDevice` | `clients/desktop/src/ble/manager.rs:227-239` | Desktop |
| `BleEvent` | `clients/desktop/src/ble/manager.rs:242+` | Desktop |
| `ChunkHeader` | `clients/desktop/src/ble/chunk.rs:57-64` | Desktop |
| `Chunk` | `clients/desktop/src/ble/chunk.rs:129-133` | Desktop |

**Action**: Create `protocol/schemas/transport/ble/v1.json`

---

### 1.12 `federation-extensions` (MEDIUM)

**Schema exists but is incomplete. Additional types in federation worker.**

| Type | File | Platform |
|------|------|----------|
| `FederationIdentity` | `workers/federation/src/types.ts:33-45` | Workers |
| `APFollower` | `workers/federation/src/types.ts:48-55` | Workers |
| `FederatedPost` | `workers/federation/src/types.ts:58-65` | Workers |
| `APActivity` | `workers/federation/src/activitypub/outbox.ts:12-44` | Workers |
| `APObject`, `APTag` | `workers/federation/src/activitypub/outbox.ts` | Workers |
| `BSkyPost`, `BSkyFacet`, etc. | `workers/federation/src/atproto/publisher.ts:13-51` | Workers |
| `WebFingerResponse` | `workers/federation/src/identity/webfinger.ts` | Workers |
| `ATSession`, `ATRecordRef` | `workers/federation/src/atproto/client.ts` | Workers |

**Action**: Extend `protocol/schemas/modules/federation/v1.json` + create `protocol/schemas/protocols/activitypub.json` and `protocol/schemas/protocols/atproto.json`

---

### 1.13 Event Sub-Types (MEDIUM)

**Events schema exists but is missing these types used on Android/Web.**

| Type | File | Platform |
|------|------|----------|
| `EventVirtualConfig` | Android events module | Android |
| `EventVolunteerRole` | Android events module | Android |
| `ShiftConfig` | Android events module | Android |
| `EventVolunteerSignup` | Android events module | Android |

**Action**: Extend `protocol/schemas/modules/events/v1.json`

---

## PART 2: EXISTING SCHEMAS NOT USED BY CLIENTS

These modules HAVE protocol schemas and generated code, but client code defines
types manually instead of importing from codegen output.

### 2.1 Web Client (`clients/web/src/modules/`)

| Module | types.ts File | Schema Exists | Generated Exists | Using Generated? |
|--------|--------------|---------------|-----------------|-----------------|
| calling | `calling/types.ts` | Yes | Yes | PARTIAL - imports some, defines many locally |
| crm | `crm/types.ts` | Yes | Yes | NO |
| database | `database/types.ts` | Yes | Yes | NO |
| documents | `documents/types.ts` | Yes | Yes | NO |
| events | `events/types.ts` | Yes | Yes | NO - duplicates EventSchema, RSVPSchema |
| files | `files/types.ts` | Yes | Yes | NO |
| forms | `forms/types.ts` | Yes | Yes | NO |
| fundraising | `fundraising/types.ts` | Yes | Yes | NO |
| marketplace | `marketplace/types.ts` | Yes | Yes | NO |
| mutual-aid | `mutual-aid/types.ts` | Yes | Yes | NO |
| newsletters | `newsletters/types.ts` | Yes | Yes | NO |
| publishing | `publishing/types.ts` | Yes | Yes | NO |

**Correctly following pattern**: `governance/types.ts` (re-exports from `@/generated/validation/governance.zod`)

---

### 2.2 iOS Client (`clients/ios/BuildIt/Modules/`)

Every module below has BOTH a generated schema file in `clients/ios/Sources/Generated/Schemas/`
AND a manual Models file that completely duplicates the generated types.

| Module | Manual File | Generated File | Approx Manual LOC |
|--------|------------|----------------|-------------------|
| Fundraising | `Modules/Fundraising/Models/FundraisingModels.swift` | `Sources/Generated/Schemas/fundraising.swift` | ~200 |
| Wiki | `Modules/Wiki/Models/WikiModels.swift` | `Sources/Generated/Schemas/wiki.swift` | ~250 |
| Newsletters | `Modules/Newsletters/Models/NewsletterModels.swift` | `Sources/Generated/Schemas/newsletters.swift` | ~300 |
| Mutual Aid | `Modules/MutualAid/Models/MutualAidModels.swift` | `Sources/Generated/Schemas/mutual-aid.swift` | ~250 |
| Forms | `Modules/Forms/Models/FormsModels.swift` | `Sources/Generated/Schemas/forms.swift` | ~350 |
| Governance | `Modules/Governance/Models/GovernanceModels.swift` | `Sources/Generated/Schemas/governance.swift` | ~300 |
| Publishing | `Modules/Publishing/Models/PublishingModels.swift` | `Sources/Generated/Schemas/publishing.swift` | ~200 |
| CRM | `Modules/CRM/Models/CRMModels.swift` | `Sources/Generated/Schemas/crm.swift` | ~200 |
| Marketplace | `Modules/Marketplace/Models/MarketplaceModels.swift` | `Sources/Generated/Schemas/marketplace.swift` | ~200 |
| Search | `Modules/Search/Models/SearchModels.swift` | `Sources/Generated/Schemas/search.swift` | ~350 |
| Training | `Modules/Training/Models/TrainingModels.swift` | NO GENERATED FILE | ~400 |

**Total estimated duplicated iOS LOC**: ~3,000+

---

### 2.3 Android Client (`clients/android/.../modules/`)

| Module | Manual File | Using Generated? |
|--------|------------|-----------------|
| Search | `modules/search/models/SearchModels.kt` | NO - all 20+ types manual |
| Events | `modules/events/` | PARTIAL - uses generated for core, manual for sub-types |
| Calling | `modules/calling/` | YES - uses generated types |

---

### 2.4 Workers (NO codegen pipeline exists)

| Worker | File | Protocol Types Defined Manually |
|--------|------|-------------------------------|
| relay | `workers/relay/src/types.ts` | `NostrEvent`, `NostrFilter`, `NostrMessage`, `RelayInfo` |
| federation | `workers/federation/src/types.ts` | `NostrEvent`, `FederationIdentity`, `APFollower`, `FederatedPost` |
| federation | AP/AT source files | `APActivity`, `APObject`, `BSkyPost`, etc. |
| api | `workers/api/src/` | OK - only uses external standards (OpenGraph, oEmbed) |
| ssr | `workers/ssr/src/` | OK - only rendering types |

**Root cause**: `tools/codegen/src/index.ts` does NOT generate to `workers/` directories.

---

## PART 3: REMEDIATION PLAN

### Phase 1: Create Missing Schemas (13 new schemas)

Priority order:

1. **groups** - Core module, blocks all group functionality consistency
2. **identity** - Core module, fundamental to all clients
3. **nostr-core** - Used by relay, federation, crypto, and all clients
4. **training** - ~550+ lines duplicated across 3 platforms
5. **polls** - Cross-platform, no schema at all
6. **microblogging** - Cross-platform, no schema
7. **contacts** - Cross-platform, no schema
8. **security/duress** - Security critical
9. **multisig** - Security critical
10. **crypto-primitives** - Wire format consistency
11. **ble-transport** - Desktop + Android consistency
12. **federation-extensions** - Extend existing schema
13. **events extensions** - Extend existing schema

### Phase 2: Update Web Client (12 modules)

For each module in `clients/web/src/modules/{module}/types.ts`:
1. Replace manual type definitions with re-exports from `@/generated/validation/{module}.zod`
2. Keep only UI-only types (form inputs, display types) locally
3. Follow the pattern in `governance/types.ts`

### Phase 3: Update iOS Client (11 modules)

For each module in `clients/ios/BuildIt/Modules/{Module}/Models/`:
1. Delete manual model files
2. Import from `Sources/Generated/Schemas/{module}.swift`
3. Create typealiases or thin wrappers for SwiftData persistence if needed

### Phase 4: Update Android Client (3 modules)

1. Search module - replace manual definitions with generated imports
2. Training module - import from generated after schema creation
3. Polls module - import from generated after schema creation

### Phase 5: Add Workers to Codegen Pipeline

1. Update `tools/codegen/src/index.ts` to output to `workers/*/src/generated/`
2. Update relay worker to import generated Nostr types
3. Update federation worker to import generated federation types

### Phase 6: Validation

1. Run `bun run codegen` after all schema changes
2. Run `bun run typecheck` on all platforms
3. Verify `bun run test:all` passes
4. Add test vectors for new schemas to `protocol/test-vectors/`

---

## Appendix: Type Count by Platform

| Platform | Manual Protocol Types | Should Be Generated |
|----------|----------------------|-------------------|
| Web | ~120 types across 15 modules | Yes |
| iOS | ~150 types across 12 modules | Yes |
| Android | ~80 types across 5 modules | Yes |
| Rust/Desktop | ~30 types across 10 files | Yes |
| Workers | ~25 types across 6 files | Yes |
| **TOTAL** | **~350+ manual protocol types** | |
