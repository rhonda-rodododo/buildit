# 08. Schema Versioning & Cross-Client Compatibility

## Overview

BuildIt is designed for crisis scenarios where internet access may be limited or unavailable. This specification defines how schema versioning works to ensure:

1. **Interoperability** - All clients can communicate regardless of version differences
2. **Graceful Degradation** - Newer content remains usable on older clients
3. **Offline Resilience** - Schema updates can propagate without internet

## Design Principles

### 1. Core Messaging Never Blocks

**Inviolable Rule**: Direct messages, basic groups, and BLE mesh transport MUST work regardless of client version. No update can ever block core communication.

Core features that MUST always work:
- Direct messages (NIP-17 gift wrap)
- Basic group messaging (NIP-17 multi-recipient)
- Reactions (kind 7)
- Read receipts (kind 15)
- Delivery status (kind 16)
- BLE mesh relay
- Device sync (core identity)

### 2. Modules Degrade Gracefully

Module content (events, governance, etc.) may contain fields unknown to older clients:
- Unknown fields are preserved, not discarded
- Partial content is displayed with upgrade prompts
- Messages can still be forwarded through mesh

### 3. Six-Month Support Window

Module schemas maintain backward compatibility for 6 months after a breaking change:
- Clients released within 6 months can parse all module content
- After 6 months, older clients see degraded module views
- Core messaging remains unaffected (indefinite support)

## Schema Format

### Module Schema Structure

All module schemas live in `protocol/schemas/modules/{module}/`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/modules/events/v1.json",
  "title": "EventsModule",
  "description": "Schema for events module content",

  "version": "1.0.0",
  "minReaderVersion": "1.0.0",
  "deprecatedAt": null,
  "sunsetAt": null,

  "$defs": {
    "Event": {
      "type": "object",
      "required": ["id", "title", "startAt", "createdBy", "_v"],
      "properties": {
        "_v": {
          "type": "string",
          "description": "Schema version that wrote this content"
        },
        "id": {
          "type": "string",
          "format": "uuid"
        },
        "title": {
          "type": "string",
          "maxLength": 256
        },
        "startAt": {
          "type": "integer",
          "description": "Unix timestamp (seconds)"
        },
        "createdBy": {
          "type": "string",
          "pattern": "^[0-9a-f]{64}$"
        }
      },
      "additionalProperties": true
    }
  }
}
```

### Message Envelope

All module content includes version metadata:

```typescript
interface ModuleContent<T> {
  // Schema version that created this content
  _v: string;

  // Minimum client version required to fully parse
  _minReader?: string;

  // Module identifier
  _module: string;

  // Actual content
  data: T;
}
```

### Example: Events Module Message

```json
{
  "_v": "1.2.0",
  "_minReader": "1.0.0",
  "_module": "events",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Community Meeting",
    "startAt": 1706198400,
    "endAt": 1706205600,
    "location": {
      "name": "Community Center",
      "coordinates": [40.7128, -74.0060]
    },
    "rsvpDeadline": 1706112000,
    "createdBy": "abc123..."
  }
}
```

## Version Compatibility Rules

### Semantic Versioning

| Change Type | Version Bump | Reader Impact |
|-------------|--------------|---------------|
| Add optional field | PATCH (1.0.x) | Fully compatible |
| Add required field with default | MINOR (1.x.0) | Compatible with warning |
| Remove field | MAJOR (x.0.0) | Requires minReaderVersion bump |
| Rename field | MAJOR (x.0.0) | Requires minReaderVersion bump |
| Change field type | MAJOR (x.0.0) | Requires minReaderVersion bump |

### Compatibility Matrix

```
Writer v1.2.0, Reader v1.0.0, minReaderVersion="1.0.0"
├── Full parse: YES
├── Unknown fields: ["rsvpDeadline"] → preserved
└── Action: Display all known fields, ignore unknown

Writer v2.0.0, Reader v1.0.0, minReaderVersion="1.5.0"
├── Full parse: NO (reader < minReaderVersion)
├── Unknown fields: preserved
└── Action: Display partial content + "Update available" prompt

Writer v2.0.0, Reader v1.0.0, minReaderVersion="2.0.0"
├── Full parse: NO (reader < minReaderVersion)
├── Critical fields missing: true
└── Action: Display placeholder + "Update required" prompt
```

## Client Implementation

### Parsing Unknown Content

```typescript
interface ParseResult<T> {
  // Successfully parsed fields
  parsed: Partial<T>;

  // Raw content preserved for forwarding
  raw: unknown;

  // Parsing metadata
  meta: {
    writerVersion: string;
    readerVersion: string;
    minReaderVersion: string;
    canFullyParse: boolean;
    unknownFields: string[];
    missingRequiredFields: string[];
  };
}

function parseModuleContent<T>(
  content: unknown,
  schema: JSONSchema,
  readerVersion: string
): ParseResult<T> {
  const meta = extractVersionMeta(content);

  // Always preserve raw for forwarding
  const raw = structuredClone(content);

  // Attempt to parse known fields
  const parsed = parseKnownFields<T>(content, schema);

  // Determine parse quality
  const canFullyParse = semver.gte(readerVersion, meta.minReaderVersion);

  return { parsed, raw, meta: { ...meta, canFullyParse } };
}
```

### UI Degradation Levels

```typescript
enum ContentDisplayMode {
  // Full display - reader meets all requirements
  FULL = 'full',

  // Partial display - some fields unknown but content usable
  PARTIAL = 'partial',

  // Placeholder - critical fields missing, show update prompt
  PLACEHOLDER = 'placeholder',

  // Unknown module - module not installed
  UNKNOWN_MODULE = 'unknown_module',
}

function getDisplayMode(result: ParseResult<unknown>): ContentDisplayMode {
  if (result.meta.canFullyParse) {
    return ContentDisplayMode.FULL;
  }

  if (result.meta.missingRequiredFields.length === 0) {
    return ContentDisplayMode.PARTIAL;
  }

  return ContentDisplayMode.PLACEHOLDER;
}
```

### Mesh Relay Behavior

**Critical**: Nodes MUST relay messages they cannot fully parse.

```typescript
async function relayMessage(message: BLEEnvelope): Promise<void> {
  // 1. Check deduplication
  if (await isDuplicate(message.messageId)) {
    return;
  }

  // 2. Validate basic envelope structure (not content!)
  if (!isValidEnvelope(message)) {
    return;
  }

  // 3. Relay regardless of content parseability
  // This is critical for mixed-version mesh networks
  await broadcastToMesh(message);

  // 4. Attempt local processing
  try {
    await processLocally(message);
  } catch (e) {
    // Log but don't fail - relay succeeded
    console.warn('Could not process message locally:', e);
  }
}
```

## Offline Schema Distribution

### Schema Bundle Format

Schema bundles allow updates without internet:

```typescript
interface SchemaBundle {
  // Bundle version
  version: string;

  // Unix timestamp of creation
  createdAt: number;

  // Minimum client version to apply
  minClientVersion: string;

  // Schemas included
  schemas: {
    [moduleId: string]: {
      version: string;
      schema: JSONSchema;
    };
  };

  // Ed25519 signature by BuildIt key
  signature: string;

  // Public key for verification
  signedBy: string;
}
```

### Bundle Distribution Methods

1. **BLE Mesh Propagation**
   - Bundles are small (~50KB compressed)
   - Fit in single BLE exchange session
   - Propagate through mesh like messages

2. **QR Code Transfer**
   - For manual device-to-device transfer
   - Uses chunked QR codes for large bundles

3. **Sideload from File**
   - USB/SD card transfer
   - Email attachment (for limited connectivity)

### Bundle Verification

```typescript
async function applySchemaBundle(bundle: SchemaBundle): Promise<boolean> {
  // 1. Verify signature
  const validSignature = await verifyBundleSignature(bundle);
  if (!validSignature) {
    throw new Error('Invalid bundle signature');
  }

  // 2. Check version requirements
  const clientVersion = getClientVersion();
  if (!semver.gte(clientVersion, bundle.minClientVersion)) {
    throw new Error('Client update required before applying bundle');
  }

  // 3. Check freshness (don't apply old bundles)
  const currentBundle = await getCurrentSchemaBundle();
  if (currentBundle && bundle.createdAt <= currentBundle.createdAt) {
    return false; // Already have newer
  }

  // 4. Apply schemas
  for (const [moduleId, schema] of Object.entries(bundle.schemas)) {
    await updateModuleSchema(moduleId, schema);
  }

  // 5. Persist bundle metadata
  await storeSchemaBundle(bundle);

  return true;
}
```

### BLE Schema Sync Protocol

```typescript
// Discovery advertisement includes schema bundle version
interface DeviceInfo {
  // ... existing fields
  schemaBundleVersion?: string;
  schemaBundleCreatedAt?: number;
}

// Schema sync message types
enum SchemaSyncType {
  REQUEST_BUNDLE = 0x10,   // "Send me your schema bundle"
  BUNDLE_CHUNK = 0x11,     // Schema bundle chunk
  BUNDLE_COMPLETE = 0x12,  // Final chunk, includes signature
}
```

## Module Registry

### Central Registry Format

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/modules/_registry.json",
  "title": "ModuleRegistry",
  "description": "Registry of all module schemas and their versions",

  "modules": {
    "custom-fields": {
      "currentVersion": "1.0.0",
      "versions": ["1.0.0"],
      "dependencies": [],
      "schemaPath": "custom-fields/v1.json"
    },
    "events": {
      "currentVersion": "1.1.0",
      "versions": ["1.0.0", "1.1.0"],
      "dependencies": ["custom-fields"],
      "schemaPath": "events/v1.json"
    },
    "governance": {
      "currentVersion": "1.0.0",
      "versions": ["1.0.0"],
      "dependencies": ["custom-fields"],
      "schemaPath": "governance/v1.json"
    }
  },

  "deprecations": [
    {
      "module": "events",
      "version": "1.0.0",
      "deprecatedAt": "2025-07-01",
      "sunsetAt": "2026-01-01",
      "migrateTo": "1.1.0",
      "migrationNotes": "Location field restructured"
    }
  ]
}
```

## Code Generation

### Generated Artifacts

From `protocol/schemas/modules/`:

| Target | Output | Location |
|--------|--------|----------|
| TypeScript | interfaces + validators | `clients/web/src/generated/` |
| Swift | Codable structs | `clients/ios/Sources/Generated/` |
| Kotlin | data classes | `clients/android/app/src/.../generated/` |
| Rust | serde structs | `packages/crypto/src/generated/` |

### CI Validation

Every PR must pass:
1. Schema validation (JSON Schema draft 2020-12 compliance)
2. Breaking change detection (semver check)
3. All clients compile with generated types
4. Test vectors pass on all platforms

## Migration Strategy

### For Users

1. **Automatic**: Schema bundles propagate via mesh
2. **Prompted**: "New features available" notification
3. **Manual**: Import bundle from trusted peer

### For Developers

1. **Non-breaking changes**: Increment patch/minor, regenerate types
2. **Breaking changes**:
   - Increment major version
   - Set minReaderVersion appropriately
   - Update deprecation registry
   - Document migration path
   - 6-month sunset period begins

### Deprecation Timeline

```
Day 0     - New version released, old version deprecated
Day 0-180 - Both versions fully supported
Day 180   - Old version enters sunset
Day 180+  - Old version may show warnings
Day 365   - Old version removal allowed (but not required)
```

## Test Vectors

Each module schema MUST include test vectors:

```json
{
  "module": "events",
  "version": "1.1.0",
  "vectors": [
    {
      "name": "basic_event",
      "input": {
        "_v": "1.1.0",
        "_module": "events",
        "data": {
          "id": "...",
          "title": "Test Event"
        }
      },
      "expected": {
        "valid": true,
        "parseResult": "full"
      }
    },
    {
      "name": "future_version_event",
      "description": "Content from future v2.0 with minReader=1.5",
      "readerVersion": "1.1.0",
      "input": {
        "_v": "2.0.0",
        "_minReader": "1.5.0",
        "_module": "events",
        "data": {
          "id": "...",
          "title": "Future Event",
          "unknownField": true
        }
      },
      "expected": {
        "valid": true,
        "parseResult": "partial",
        "unknownFields": ["unknownField"],
        "displayMode": "partial"
      }
    }
  ]
}
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-25 | Initial specification |
