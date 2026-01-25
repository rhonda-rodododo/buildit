# 09. Schema Code Generation

## Overview

This specification defines how JSON Schema definitions in `buildit-protocol/schemas/` are transformed into native type definitions for each client platform.

## Code Generation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│ buildit-protocol/schemas/                                        │
│  ├── modules/events/v1.json                                      │
│  ├── modules/messaging/v1.json                                   │
│  └── ...                                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ codegen/generate.ts                                              │
│  - Reads all JSON Schema files                                   │
│  - Validates schemas                                             │
│  - Generates target language code                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┬────────────────┐
        ▼                ▼                ▼                ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│  TypeScript   │ │     Swift     │ │    Kotlin     │ │     Rust      │
│  interfaces   │ │    structs    │ │ data classes  │ │    structs    │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
        │                │                │                │
        ▼                ▼                ▼                ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ buildit-      │ │ buildit-ios/  │ │ buildit-      │ │ buildit-      │
│ network/src/  │ │ Sources/      │ │ android/app/  │ │ crypto/src/   │
│ generated/    │ │ Generated/    │ │ src/.../      │ │ generated/    │
│               │ │               │ │ generated/    │ │               │
└───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘
```

## Output Structure

### TypeScript (Web/Desktop)

**Output Path**: `buildit-network/src/generated/schemas/`

```typescript
// src/generated/schemas/index.ts
export * from './events';
export * from './messaging';
export * from './governance';
export * from './types';

// src/generated/schemas/events.ts
/**
 * @generated from buildit-protocol/schemas/modules/events/v1.json
 * @version 1.0.0
 * @minReaderVersion 1.0.0
 */

import { z } from 'zod';

// Zod schema for runtime validation
export const EventSchema = z.object({
  _v: z.string().regex(/^\d+\.\d+\.\d+$/),
  id: z.string().uuid(),
  title: z.string().max(256),
  description: z.string().max(8192).optional(),
  startAt: z.number().int(),
  endAt: z.number().int().optional(),
  allDay: z.boolean().default(false),
  timezone: z.string().optional(),
  location: LocationSchema.optional(),
  virtualUrl: z.string().url().max(2048).optional(),
  rsvpDeadline: z.number().int().optional(),
  maxAttendees: z.number().int().min(1).optional(),
  visibility: z.enum(['group', 'public', 'private']).default('group'),
  recurrence: RecurrenceRuleSchema.optional(),
  attachments: z.array(AttachmentSchema).max(10).optional(),
  customFields: z.record(z.unknown()).optional(),
  createdBy: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.number().int(),
  updatedAt: z.number().int().optional(),
}).passthrough(); // Allow unknown fields for forward compatibility

// TypeScript type (inferred from Zod)
export type Event = z.infer<typeof EventSchema>;

// Version constants
export const EVENTS_SCHEMA_VERSION = '1.0.0';
export const EVENTS_MIN_READER_VERSION = '1.0.0';

// Validator function
export function validateEvent(data: unknown): data is Event {
  return EventSchema.safeParse(data).success;
}

// Parser with graceful degradation
export function parseEvent(data: unknown): ParseResult<Event> {
  const result = EventSchema.safeParse(data);
  if (result.success) {
    return {
      parsed: result.data,
      raw: data,
      meta: {
        writerVersion: (data as any)?._v ?? 'unknown',
        canFullyParse: true,
        unknownFields: [],
      },
    };
  }

  // Graceful degradation: parse what we can
  const partial = parseKnownFields(data, EventSchema);
  return {
    parsed: partial,
    raw: data,
    meta: {
      writerVersion: (data as any)?._v ?? 'unknown',
      canFullyParse: false,
      unknownFields: findUnknownFields(data, EventSchema),
    },
  };
}
```

### Swift (iOS)

**Output Path**: `buildit-ios/Sources/Generated/`

```swift
// Sources/Generated/Schemas/Events.swift
/**
 * @generated from buildit-protocol/schemas/modules/events/v1.json
 * @version 1.0.0
 * @minReaderVersion 1.0.0
 */

import Foundation

// MARK: - Event

public struct Event: Codable, Sendable {
    /// Schema version that created this content
    public let _v: String

    /// Unique event identifier
    public let id: UUID

    /// Event title
    public let title: String

    /// Event description (markdown supported)
    public let description: String?

    /// Start time as Unix timestamp (seconds)
    public let startAt: Int64

    /// End time as Unix timestamp (seconds)
    public let endAt: Int64?

    /// Whether this is an all-day event
    public let allDay: Bool

    /// IANA timezone identifier
    public let timezone: String?

    /// Event location
    public let location: Location?

    /// URL for virtual attendance
    public let virtualUrl: URL?

    /// RSVP deadline as Unix timestamp
    public let rsvpDeadline: Int64?

    /// Maximum number of attendees
    public let maxAttendees: Int?

    /// Who can see this event
    public let visibility: EventVisibility

    /// Recurrence rule
    public let recurrence: RecurrenceRule?

    /// Attachments
    public let attachments: [Attachment]?

    /// Custom field values
    public let customFields: [String: AnyCodable]?

    /// Creator's public key (hex)
    public let createdBy: String

    /// Creation timestamp (Unix seconds)
    public let createdAt: Int64

    /// Last update timestamp (Unix seconds)
    public let updatedAt: Int64?

    /// Unknown fields preserved for forwarding
    private var _unknownFields: [String: AnyCodable] = [:]

    // MARK: - Coding Keys

    private enum CodingKeys: String, CodingKey {
        case _v, id, title, description, startAt, endAt, allDay
        case timezone, location, virtualUrl, rsvpDeadline, maxAttendees
        case visibility, recurrence, attachments, customFields
        case createdBy, createdAt, updatedAt
    }

    // MARK: - Custom Decoding (preserve unknown fields)

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        _v = try container.decode(String.self, forKey: ._v)
        id = try container.decode(UUID.self, forKey: .id)
        title = try container.decode(String.self, forKey: .title)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        startAt = try container.decode(Int64.self, forKey: .startAt)
        endAt = try container.decodeIfPresent(Int64.self, forKey: .endAt)
        allDay = try container.decodeIfPresent(Bool.self, forKey: .allDay) ?? false
        timezone = try container.decodeIfPresent(String.self, forKey: .timezone)
        location = try container.decodeIfPresent(Location.self, forKey: .location)
        virtualUrl = try container.decodeIfPresent(URL.self, forKey: .virtualUrl)
        rsvpDeadline = try container.decodeIfPresent(Int64.self, forKey: .rsvpDeadline)
        maxAttendees = try container.decodeIfPresent(Int.self, forKey: .maxAttendees)
        visibility = try container.decodeIfPresent(EventVisibility.self, forKey: .visibility) ?? .group
        recurrence = try container.decodeIfPresent(RecurrenceRule.self, forKey: .recurrence)
        attachments = try container.decodeIfPresent([Attachment].self, forKey: .attachments)
        customFields = try container.decodeIfPresent([String: AnyCodable].self, forKey: .customFields)
        createdBy = try container.decode(String.self, forKey: .createdBy)
        createdAt = try container.decode(Int64.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Int64.self, forKey: .updatedAt)

        // Preserve unknown fields for forwarding
        let dynamicContainer = try decoder.container(keyedBy: DynamicCodingKeys.self)
        let knownKeys = Set(CodingKeys.allCases.map { $0.stringValue })
        for key in dynamicContainer.allKeys {
            if !knownKeys.contains(key.stringValue) {
                _unknownFields[key.stringValue] = try dynamicContainer.decode(
                    AnyCodable.self,
                    forKey: key
                )
            }
        }
    }

    // MARK: - Custom Encoding (include unknown fields)

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)

        try container.encode(_v, forKey: ._v)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(description, forKey: .description)
        try container.encode(startAt, forKey: .startAt)
        try container.encodeIfPresent(endAt, forKey: .endAt)
        try container.encode(allDay, forKey: .allDay)
        try container.encodeIfPresent(timezone, forKey: .timezone)
        try container.encodeIfPresent(location, forKey: .location)
        try container.encodeIfPresent(virtualUrl, forKey: .virtualUrl)
        try container.encodeIfPresent(rsvpDeadline, forKey: .rsvpDeadline)
        try container.encodeIfPresent(maxAttendees, forKey: .maxAttendees)
        try container.encode(visibility, forKey: .visibility)
        try container.encodeIfPresent(recurrence, forKey: .recurrence)
        try container.encodeIfPresent(attachments, forKey: .attachments)
        try container.encodeIfPresent(customFields, forKey: .customFields)
        try container.encode(createdBy, forKey: .createdBy)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)

        // Re-encode unknown fields
        var dynamicContainer = encoder.container(keyedBy: DynamicCodingKeys.self)
        for (key, value) in _unknownFields {
            try dynamicContainer.encode(value, forKey: DynamicCodingKeys(stringValue: key)!)
        }
    }
}

public enum EventVisibility: String, Codable, Sendable {
    case group
    case `public`
    case `private`
}

// MARK: - Version Constants

public enum EventsSchema {
    public static let version = "1.0.0"
    public static let minReaderVersion = "1.0.0"
}
```

### Kotlin (Android)

**Output Path**: `buildit-android/app/src/main/java/network/buildit/generated/`

```kotlin
// generated/schemas/Events.kt
/**
 * @generated from buildit-protocol/schemas/modules/events/v1.json
 * @version 1.0.0
 * @minReaderVersion 1.0.0
 */

package network.buildit.generated.schemas

import kotlinx.serialization.*
import kotlinx.serialization.json.*

/**
 * An event with time, location, and RSVP tracking
 */
@Serializable
data class Event(
    /** Schema version that created this content */
    @SerialName("_v")
    val schemaVersion: String,

    /** Unique event identifier */
    val id: String,

    /** Event title */
    val title: String,

    /** Event description (markdown supported) */
    val description: String? = null,

    /** Start time as Unix timestamp (seconds) */
    val startAt: Long,

    /** End time as Unix timestamp (seconds) */
    val endAt: Long? = null,

    /** Whether this is an all-day event */
    val allDay: Boolean = false,

    /** IANA timezone identifier */
    val timezone: String? = null,

    /** Event location */
    val location: Location? = null,

    /** URL for virtual attendance */
    val virtualUrl: String? = null,

    /** RSVP deadline as Unix timestamp */
    val rsvpDeadline: Long? = null,

    /** Maximum number of attendees */
    val maxAttendees: Int? = null,

    /** Who can see this event */
    val visibility: EventVisibility = EventVisibility.GROUP,

    /** Recurrence rule */
    val recurrence: RecurrenceRule? = null,

    /** Attachments */
    val attachments: List<Attachment>? = null,

    /** Custom field values */
    val customFields: Map<String, JsonElement>? = null,

    /** Creator's public key (hex) */
    val createdBy: String,

    /** Creation timestamp (Unix seconds) */
    val createdAt: Long,

    /** Last update timestamp (Unix seconds) */
    val updatedAt: Long? = null,

    /** Unknown fields preserved for forwarding */
    @Transient
    internal val unknownFields: Map<String, JsonElement> = emptyMap()
)

@Serializable
enum class EventVisibility {
    @SerialName("group") GROUP,
    @SerialName("public") PUBLIC,
    @SerialName("private") PRIVATE
}

/**
 * Custom serializer that preserves unknown fields
 */
object EventSerializer : KSerializer<Event> {
    override val descriptor = Event.serializer().descriptor

    override fun deserialize(decoder: Decoder): Event {
        val json = decoder as? JsonDecoder
            ?: throw SerializationException("Expected JsonDecoder")

        val element = json.decodeJsonElement().jsonObject
        val knownKeys = setOf(
            "_v", "id", "title", "description", "startAt", "endAt",
            "allDay", "timezone", "location", "virtualUrl", "rsvpDeadline",
            "maxAttendees", "visibility", "recurrence", "attachments",
            "customFields", "createdBy", "createdAt", "updatedAt"
        )

        val unknownFields = element.filterKeys { it !in knownKeys }
        val event = Json.decodeFromJsonElement(Event.serializer(), element)

        return event.copy(unknownFields = unknownFields)
    }

    override fun serialize(encoder: Encoder, value: Event) {
        val json = encoder as? JsonEncoder
            ?: throw SerializationException("Expected JsonEncoder")

        val element = Json.encodeToJsonElement(Event.serializer(), value).jsonObject.toMutableMap()
        element.putAll(value.unknownFields)

        json.encodeJsonElement(JsonObject(element))
    }
}

object EventsSchema {
    const val VERSION = "1.0.0"
    const val MIN_READER_VERSION = "1.0.0"
}
```

### Rust (Crypto Library)

**Output Path**: `buildit-crypto/src/generated/`

```rust
// src/generated/schemas/events.rs
//! @generated from buildit-protocol/schemas/modules/events/v1.json
//! @version 1.0.0
//! @minReaderVersion 1.0.0

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// An event with time, location, and RSVP tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    /// Schema version that created this content
    #[serde(rename = "_v")]
    pub schema_version: String,

    /// Unique event identifier
    pub id: String,

    /// Event title
    pub title: String,

    /// Event description (markdown supported)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Start time as Unix timestamp (seconds)
    pub start_at: i64,

    /// End time as Unix timestamp (seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_at: Option<i64>,

    /// Whether this is an all-day event
    #[serde(default)]
    pub all_day: bool,

    /// IANA timezone identifier
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,

    /// Event location
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<Location>,

    /// URL for virtual attendance
    #[serde(skip_serializing_if = "Option::is_none")]
    pub virtual_url: Option<String>,

    /// RSVP deadline as Unix timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rsvp_deadline: Option<i64>,

    /// Maximum number of attendees
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_attendees: Option<i32>,

    /// Who can see this event
    #[serde(default)]
    pub visibility: EventVisibility,

    /// Recurrence rule
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recurrence: Option<RecurrenceRule>,

    /// Attachments
    #[serde(skip_serializing_if = "Option::is_none")]
    pub attachments: Option<Vec<Attachment>>,

    /// Custom field values
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_fields: Option<HashMap<String, serde_json::Value>>,

    /// Creator's public key (hex)
    pub created_by: String,

    /// Creation timestamp (Unix seconds)
    pub created_at: i64,

    /// Last update timestamp (Unix seconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<i64>,

    /// Unknown fields preserved for forwarding
    #[serde(flatten)]
    pub unknown_fields: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum EventVisibility {
    #[default]
    Group,
    Public,
    Private,
}

pub mod events_schema {
    pub const VERSION: &str = "1.0.0";
    pub const MIN_READER_VERSION: &str = "1.0.0";
}
```

## Codegen Tool

### Installation

```bash
# In buildit-protocol/
bun install
```

### Usage

```bash
# Generate all targets
bun run codegen

# Generate specific target
bun run codegen --target typescript
bun run codegen --target swift
bun run codegen --target kotlin
bun run codegen --target rust

# Validate schemas only (no generation)
bun run codegen --validate

# Watch mode for development
bun run codegen --watch
```

### Configuration

**`buildit-protocol/codegen.config.ts`**:

```typescript
import { defineConfig } from './codegen/config';

export default defineConfig({
  schemasDir: './schemas/modules',
  outputDir: './generated',

  targets: {
    typescript: {
      enabled: true,
      outputPath: '../buildit-network/src/generated/schemas',
      runtime: 'zod', // 'zod' | 'io-ts' | 'none'
      style: 'interface', // 'interface' | 'type'
    },
    swift: {
      enabled: true,
      outputPath: '../buildit-ios/Sources/Generated',
      codable: true,
      sendable: true,
    },
    kotlin: {
      enabled: true,
      outputPath: '../buildit-android/app/src/main/java/network/buildit/generated',
      serialization: 'kotlinx', // 'kotlinx' | 'gson' | 'moshi'
    },
    rust: {
      enabled: true,
      outputPath: '../buildit-crypto/src/generated',
      serde: true,
    },
  },

  validation: {
    strict: true,
    requireTestVectors: true,
    requireMinReaderVersion: true,
  },
});
```

## Implementation Notes

### Unknown Field Preservation

All generated types MUST preserve unknown fields for:
1. **Relay forwarding**: Nodes relay messages they can't fully parse
2. **Future compatibility**: Older clients can store and re-serialize newer content
3. **Round-trip safety**: Parse → serialize produces identical output

### Validation Levels

1. **Strict**: All required fields present, all types match
2. **Lenient**: Required fields present, type coercion allowed
3. **Partial**: Parse what's available, track missing fields

### CI Integration

```yaml
# .github/workflows/schema-validation.yml
name: Schema Validation

on:
  push:
    paths:
      - 'buildit-protocol/schemas/**'
  pull_request:
    paths:
      - 'buildit-protocol/schemas/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        working-directory: buildit-protocol
        run: bun install

      - name: Validate schemas
        working-directory: buildit-protocol
        run: bun run codegen --validate

      - name: Generate code
        working-directory: buildit-protocol
        run: bun run codegen

      - name: Check for uncommitted changes
        run: |
          git diff --exit-code || (echo "Generated code out of sync" && exit 1)
```

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-25 | Initial specification |
