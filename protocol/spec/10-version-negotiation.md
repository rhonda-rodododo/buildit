# 10. Version Negotiation Protocol

## Overview

This specification defines how BuildIt clients negotiate schema versions during communication, ensuring interoperability while maximizing feature usage.

## Version Metadata

### Message-Level Version

Every module message includes version metadata:

```typescript
interface VersionedMessage {
  // Schema version that created this message
  _v: string;

  // Optional: Minimum version required to fully parse
  _minReader?: string;

  // Module identifier
  _module: string;

  // Actual content
  [key: string]: unknown;
}
```

### Device-Level Version

Devices advertise capabilities during discovery:

```typescript
interface DeviceVersionInfo {
  // Client version (e.g., "0.73.0")
  clientVersion: string;

  // Schema bundle version (e.g., "1.2.0")
  schemaBundleVersion: string;

  // Schema bundle creation timestamp
  schemaBundleCreatedAt: number;

  // Supported module versions
  moduleVersions: {
    [moduleId: string]: {
      current: string;    // Currently installed version
      supported: string[]; // All versions this client can read
    };
  };
}
```

## Negotiation Flow

### 1. Device Discovery

During BLE or Nostr discovery, devices exchange version info:

```
Device A (v0.73.0)                    Device B (v0.71.0)
      │                                      │
      │ ─────── DeviceInfo ────────────────► │
      │         clientVersion: "0.73.0"      │
      │         schemaBundleVersion: "1.2.0" │
      │         moduleVersions: {...}        │
      │                                      │
      │ ◄────── DeviceInfo ─────────────────  │
      │         clientVersion: "0.71.0"      │
      │         schemaBundleVersion: "1.0.0" │
      │         moduleVersions: {...}        │
      │                                      │
```

### 2. Schema Bundle Sync (If Needed)

If Device A has a newer schema bundle, it can offer to sync:

```
Device A                               Device B
      │                                      │
      │ ◄────── SCHEMA_REQUEST ─────────────  │
      │         "Your bundle is newer"       │
      │                                      │
      │ ─────── SCHEMA_BUNDLE_CHUNK ───────► │
      │         (chunk 1/3)                  │
      │                                      │
      │ ─────── SCHEMA_BUNDLE_CHUNK ───────► │
      │         (chunk 2/3)                  │
      │                                      │
      │ ─────── SCHEMA_BUNDLE_COMPLETE ────► │
      │         (chunk 3/3 + signature)      │
      │                                      │
      │ ◄────── SCHEMA_BUNDLE_ACK ──────────  │
      │         (verified and applied)       │
      │                                      │
```

### 3. Message Exchange

When sending messages, the sender decides:

```typescript
function prepareMessage(
  content: ModuleContent,
  moduleId: string,
  recipientVersionInfo?: DeviceVersionInfo
): VersionedMessage {
  const myVersion = getModuleVersion(moduleId);

  // If we know recipient's version, check compatibility
  if (recipientVersionInfo) {
    const recipientVersion = recipientVersionInfo.moduleVersions[moduleId]?.current;

    if (recipientVersion && semver.lt(recipientVersion, myVersion)) {
      // Recipient is older - consider using compatible format
      const compatibleVersion = findCompatibleVersion(myVersion, recipientVersion);
      if (compatibleVersion) {
        return serializeForVersion(content, compatibleVersion);
      }
    }
  }

  // Default: use current version
  return {
    _v: myVersion,
    _module: moduleId,
    ...content,
  };
}
```

### 4. Message Reception

When receiving messages, the recipient parses with graceful degradation:

```typescript
function receiveMessage(
  message: VersionedMessage
): ReceiveResult {
  const writerVersion = message._v;
  const minReaderVersion = message._minReader ?? writerVersion;
  const myVersion = getModuleVersion(message._module);

  // Check if we can fully parse
  const canFullyParse = semver.gte(myVersion, minReaderVersion);

  // Parse known fields
  const parsed = parseKnownFields(message);

  // Preserve unknown fields for relay
  const unknownFields = extractUnknownFields(message);

  return {
    parsed,
    unknownFields,
    meta: {
      writerVersion,
      minReaderVersion,
      myVersion,
      canFullyParse,
      displayMode: determineDisplayMode(canFullyParse, parsed),
    },
  };
}
```

## Compatibility Levels

### Level 1: Full Compatibility

```
Reader version >= Writer minReaderVersion
```

- All fields parsed correctly
- Full UI experience
- No warnings

### Level 2: Partial Compatibility

```
Reader version < Writer minReaderVersion
Reader version >= Writer schemaVersion.major (same major version)
```

- Known fields parsed
- Unknown fields preserved
- UI shows available content with "Some features require update" hint

### Level 3: Major Version Mismatch

```
Reader version.major < Writer version.major
```

- Attempt graceful degradation
- Show placeholder if critical fields missing
- Preserve raw message for relay

### Level 4: Unknown Module

```
Module not installed on reader
```

- Show "Unknown module" placeholder
- Preserve entire message for relay
- Offer to "Learn more" about the module

## Decision Tree

```
┌─────────────────────────────────────────────────────────────────┐
│ Receive message with _v and _module                             │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ Is _module installed?                                           │
└───────────────────────────┬─────────────────────────────────────┘
            │                               │
           YES                             NO
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────────┐
│ Get my module version │       │ LEVEL 4: Unknown Module       │
└───────────────────────┘       │ - Show placeholder            │
            │                   │ - Preserve for relay          │
            ▼                   └───────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Is myVersion >= _minReader?                                     │
└───────────────────────────┬─────────────────────────────────────┘
            │                               │
           YES                             NO
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────────────┐
│ LEVEL 1: Full Parse   │       │ Is same major version?        │
│ - Parse all fields    │       └───────────────────────────────┘
│ - Full UI             │                   │
└───────────────────────┘          │                   │
                                  YES                 NO
                                   │                   │
                                   ▼                   ▼
                        ┌──────────────────┐ ┌──────────────────┐
                        │ LEVEL 2: Partial │ │ LEVEL 3: Major   │
                        │ - Parse known    │ │ - Attempt parse  │
                        │ - Preserve rest  │ │ - Placeholder if │
                        │ - Hint to update │ │   critical miss  │
                        └──────────────────┘ └──────────────────┘
```

## UI Guidelines

### Level 1: Full Compatibility

```
┌────────────────────────────────────────────────────────────────┐
│ 📅 Community Meeting                                           │
│ Tomorrow at 6:00 PM                                            │
│ 📍 Community Center, 123 Main St                               │
│ 👥 15 attending, 5 spots left                                  │
│                                                                │
│ [RSVP Going] [Maybe] [Can't Make It]                          │
└────────────────────────────────────────────────────────────────┘
```

### Level 2: Partial Compatibility

```
┌────────────────────────────────────────────────────────────────┐
│ 📅 Community Meeting                                           │
│ Tomorrow at 6:00 PM                                            │
│ 📍 Community Center, 123 Main St                               │
│                                                                │
│ ℹ️ Some event details require a newer app version              │
│    [Update App] [View Anyway]                                  │
│                                                                │
│ [RSVP Going] [Maybe] [Can't Make It]                          │
└────────────────────────────────────────────────────────────────┘
```

### Level 3: Major Version Mismatch

```
┌────────────────────────────────────────────────────────────────┐
│ 📅 Community Meeting                                           │
│ Tomorrow at 6:00 PM                                            │
│                                                                │
│ ⚠️ This event uses a newer format                              │
│    Update your app to see all details                          │
│                                                                │
│ [Update App] [View Basic Info]                                 │
└────────────────────────────────────────────────────────────────┘
```

### Level 4: Unknown Module

```
┌────────────────────────────────────────────────────────────────┐
│ 📦 New Feature: "Volunteer Shifts"                             │
│                                                                │
│ This group uses a feature that requires an app update.         │
│                                                                │
│ [Update App] [Learn More] [Remind Later]                       │
└────────────────────────────────────────────────────────────────┘
```

## Relay Behavior

### Critical Rule: Relay First, Parse Later

Mesh nodes MUST relay messages before attempting to parse:

```typescript
async function handleIncomingMessage(message: RawMessage): Promise<void> {
  // 1. ALWAYS attempt relay first (even if we can't parse)
  if (shouldRelay(message)) {
    await relayToMesh(message);
  }

  // 2. Then attempt local processing
  try {
    const parsed = parseMessage(message);
    await processLocally(parsed);
  } catch (error) {
    // Log but don't fail - relay already succeeded
    console.warn('Could not process message locally:', error);
    await storeForLaterProcessing(message);
  }
}

function shouldRelay(message: RawMessage): boolean {
  // Basic envelope validation only
  // Do NOT reject based on content parsing
  return (
    message.ttl > 0 &&
    message.hopCount < message.ttl &&
    !isDuplicate(message.id)
  );
}
```

### Store for Later

Messages that can't be parsed should be stored for later:

```typescript
interface DeferredMessage {
  id: string;
  raw: RawMessage;
  receivedAt: number;
  moduleId: string;
  writerVersion: string;
  minReaderVersion: string;
  parseAttempts: number;
  lastAttempt: number;
}

// After schema update, re-process deferred messages
async function onSchemaUpdate(moduleId: string): Promise<void> {
  const deferred = await getDeferredMessages(moduleId);

  for (const msg of deferred) {
    try {
      const parsed = parseMessage(msg.raw);
      await processLocally(parsed);
      await removeDeferredMessage(msg.id);
    } catch {
      // Still can't parse - keep deferred
      await updateDeferredMessage(msg.id, {
        parseAttempts: msg.parseAttempts + 1,
        lastAttempt: Date.now(),
      });
    }
  }
}
```

## BLE Schema Sync Protocol

### Message Types

```typescript
enum SchemaSyncMessageType {
  // Request peer's schema bundle info
  INFO_REQUEST = 0x10,

  // Response with bundle info
  INFO_RESPONSE = 0x11,

  // Request full bundle transfer
  BUNDLE_REQUEST = 0x12,

  // Bundle data chunk
  BUNDLE_CHUNK = 0x13,

  // Final chunk with signature
  BUNDLE_COMPLETE = 0x14,

  // Acknowledgment (success or error)
  ACK = 0x15,
}
```

### Sync Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INFO_REQUEST                                                 │
│    Request peer's schema bundle info                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. INFO_RESPONSE                                                │
│    {                                                            │
│      bundleVersion: "1.2.0",                                    │
│      createdAt: 1706198400,                                     │
│      size: 45678,                                               │
│      checksum: "sha256:abc123..."                               │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Compare versions                                             │
│    If peer has newer bundle AND I want it:                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. BUNDLE_REQUEST                                               │
│    "Send me your bundle"                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. BUNDLE_CHUNK (×N)                                            │
│    {                                                            │
│      chunkIndex: 0,                                             │
│      totalChunks: 10,                                           │
│      data: <base64>                                             │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. BUNDLE_COMPLETE                                              │
│    {                                                            │
│      signature: "ed25519:...",                                  │
│      signedBy: "pubkey..."                                      │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Verify signature against trusted keys                        │
│    If valid: apply bundle, send ACK(success)                    │
│    If invalid: discard, send ACK(error: invalid_signature)      │
└─────────────────────────────────────────────────────────────────┘
```

## Test Vectors

### Version Comparison

```json
{
  "testCases": [
    {
      "name": "exact_match",
      "writerVersion": "1.0.0",
      "minReaderVersion": "1.0.0",
      "readerVersion": "1.0.0",
      "expected": {
        "level": 1,
        "canFullyParse": true
      }
    },
    {
      "name": "reader_newer",
      "writerVersion": "1.0.0",
      "minReaderVersion": "1.0.0",
      "readerVersion": "1.2.0",
      "expected": {
        "level": 1,
        "canFullyParse": true
      }
    },
    {
      "name": "reader_older_within_minor",
      "writerVersion": "1.2.0",
      "minReaderVersion": "1.0.0",
      "readerVersion": "1.0.0",
      "expected": {
        "level": 1,
        "canFullyParse": true
      }
    },
    {
      "name": "reader_older_below_minReader",
      "writerVersion": "1.5.0",
      "minReaderVersion": "1.3.0",
      "readerVersion": "1.2.0",
      "expected": {
        "level": 2,
        "canFullyParse": false
      }
    },
    {
      "name": "major_version_mismatch",
      "writerVersion": "2.0.0",
      "minReaderVersion": "2.0.0",
      "readerVersion": "1.5.0",
      "expected": {
        "level": 3,
        "canFullyParse": false
      }
    }
  ]
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-25 | Initial specification |
