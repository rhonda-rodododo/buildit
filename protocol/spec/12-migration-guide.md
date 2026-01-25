# 12. Schema Migration Guide

## Overview

This guide covers how to evolve BuildIt schemas while maintaining cross-client compatibility and crisis resilience.

## Migration Principles

### 1. Core Messaging Never Breaks

**INVIOLABLE**: Direct messages, basic groups, and BLE mesh relay MUST work across ALL versions, FOREVER.

Core messaging schemas (`messaging/v1.json`) can only receive **additive changes**:
- Add optional fields (patch version)
- Never remove fields
- Never change field types
- Never add required fields

### 2. Six-Month Support Window for Modules

Module schemas maintain backward compatibility for 6 months:

```
Day 0   - Release v2.0.0 with breaking changes
        - v1.0.0 marked deprecated
Day 180 - v1.0.0 enters sunset period
Day 365 - v1.0.0 removal allowed (but not required)
```

### 3. Version Bump Guidelines

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Add optional field | PATCH (1.0.x) | Add `endAt?: number` |
| Add optional with new behavior | MINOR (1.x.0) | Add `recurrence?: {...}` |
| Change field type | MAJOR (x.0.0) | `startAt: number` → `startAt: {date, time}` |
| Remove field | MAJOR (x.0.0) | Remove `legacyField` |
| Rename field | MAJOR (x.0.0) | `start` → `startAt` |
| Add required field | MAJOR (x.0.0) | Add `_v: string` as required |

## Migration Workflow

### Step 1: Design the Change

Before making any schema change:

1. **Categorize the change** (patch/minor/major)
2. **Check core messaging impact** - if core, only additive allowed
3. **Design the migration path** - how do old clients handle new data?
4. **Document the change** - update changelog in schema file

### Step 2: Update Schema

```json
// schemas/modules/events/v2.json

{
  "$id": "https://buildit.network/schemas/modules/events/v2.json",
  "version": "2.0.0",
  "minReaderVersion": "1.5.0",  // Older clients can still read partial

  // Add migration notes
  "migrationNotes": {
    "from": "1.x.x",
    "changes": [
      {
        "type": "restructure",
        "field": "location",
        "before": "string",
        "after": "Location object",
        "migration": "Old string becomes location.name"
      }
    ],
    "breakingReason": "Location field restructured for coordinates support"
  },

  "$defs": {
    "Event": {
      // New schema definition
    }
  }
}
```

### Step 3: Update Registry

```json
// schemas/modules/_registry.json

{
  "modules": {
    "events": {
      "currentVersion": "2.0.0",
      "versions": ["1.0.0", "1.1.0", "2.0.0"],
      "schemaPath": "events/v2.json"
    }
  },

  "deprecations": [
    {
      "module": "events",
      "version": "1.0.0",
      "deprecatedAt": "2026-01-25",
      "sunsetAt": "2026-07-25",
      "migrateTo": "2.0.0",
      "migrationNotes": "Location field restructured - see v2.json"
    },
    {
      "module": "events",
      "version": "1.1.0",
      "deprecatedAt": "2026-01-25",
      "sunsetAt": "2026-07-25",
      "migrateTo": "2.0.0",
      "migrationNotes": "Location field restructured - see v2.json"
    }
  ]
}
```

### Step 4: Update Codegen

Run codegen to update all clients:

```bash
cd buildit-protocol
bun run codegen
```

This generates:
- TypeScript types in `buildit-network/src/generated/`
- Swift types in `buildit-ios/Sources/Generated/`
- Kotlin types in `buildit-android/app/.../generated/`
- Rust types in `buildit-crypto/src/generated/`

### Step 5: Implement Migration Logic

Each client needs migration code:

```typescript
// buildit-network/src/core/schema/migrations/events.ts

import { EventV1, EventV2 } from '@/generated/schemas';

export function migrateEventV1ToV2(v1: EventV1): EventV2 {
  return {
    _v: '2.0.0',
    ...v1,
    // Migrate location string to object
    location: v1.location
      ? { name: v1.location }
      : undefined,
  };
}

export function canReadAsV1(data: unknown): boolean {
  // Check if we can interpret v2 data as v1
  const v2 = data as EventV2;
  return typeof v2.location !== 'object' || v2.location === null;
}
```

### Step 6: Update Test Vectors

Add migration test vectors:

```json
// test-vectors/migrations/events-v1-to-v2.json

{
  "migration": "events-v1-to-v2",
  "cases": [
    {
      "name": "basic_event_migration",
      "v1Input": {
        "_v": "1.0.0",
        "id": "abc123",
        "title": "Meeting",
        "startAt": 1706198400,
        "location": "Community Center",
        "createdBy": "pubkey...",
        "createdAt": 1706112000
      },
      "v2Expected": {
        "_v": "2.0.0",
        "id": "abc123",
        "title": "Meeting",
        "startAt": 1706198400,
        "location": {
          "name": "Community Center"
        },
        "createdBy": "pubkey...",
        "createdAt": 1706112000
      }
    },
    {
      "name": "event_without_location",
      "v1Input": {
        "_v": "1.0.0",
        "id": "def456",
        "title": "Virtual Meeting",
        "startAt": 1706198400,
        "createdBy": "pubkey...",
        "createdAt": 1706112000
      },
      "v2Expected": {
        "_v": "2.0.0",
        "id": "def456",
        "title": "Virtual Meeting",
        "startAt": 1706198400,
        "createdBy": "pubkey...",
        "createdAt": 1706112000
      }
    }
  ]
}
```

### Step 7: Create Schema Bundle

Generate a new schema bundle for offline distribution:

```bash
bun run bundle:create --version 2.0.0
```

This creates a signed bundle that can propagate via BLE mesh.

### Step 8: Update Documentation

- Update CHANGELOG in schema file
- Update protocol spec if needed
- Add migration notes to _registry.json
- Update client implementation guides if API changes

## Migration Patterns

### Pattern 1: Add Optional Field (Patch)

The simplest and safest change:

```diff
 // events/v1.json → events/v1.patch.json
 {
   "version": "1.0.1",
   "minReaderVersion": "1.0.0",  // No change needed

   "Event": {
     "properties": {
       // ... existing fields
+      "virtualUrl": {
+        "type": "string",
+        "format": "uri",
+        "description": "URL for virtual attendance"
+      }
     }
   }
 }
```

**Client handling**:
- Old clients: Ignore `virtualUrl` (unknown field)
- New clients: Use `virtualUrl` if present

### Pattern 2: Add Feature with New Behavior (Minor)

Adding a field that changes behavior if present:

```diff
 // events/v1.json → events/v1.1.json
 {
   "version": "1.1.0",
   "minReaderVersion": "1.0.0",  // Old clients can still read

   "Event": {
     "properties": {
       // ... existing fields
+      "recurrence": {
+        "$ref": "#/$defs/RecurrenceRule",
+        "description": "Recurrence rule for repeating events"
+      }
     }
   }
 }
```

**Client handling**:
- Old clients: Show single event, ignore `recurrence`
- New clients: Generate recurring instances from rule

### Pattern 3: Restructure Field (Major)

Changing a field's structure requires careful migration:

```diff
 // events/v1.json → events/v2.json
 {
   "version": "2.0.0",
   "minReaderVersion": "1.5.0",  // Bump minReader, not to 2.0.0

   "migrationNotes": {
     "from": "1.x",
     "changes": [{
       "field": "location",
       "before": { "type": "string" },
       "after": { "$ref": "#/$defs/Location" }
     }]
   },

   "Event": {
     "properties": {
-      "location": { "type": "string" }
+      "location": { "$ref": "#/$defs/Location" }
     }
   },

+  "$defs": {
+    "Location": {
+      "type": "object",
+      "properties": {
+        "name": { "type": "string" },
+        "address": { "type": "string" },
+        "coordinates": { ... }
+      }
+    }
+  }
 }
```

**Client handling**:
- v1.0-1.4 clients: Show placeholder (can't parse location object)
- v1.5+ clients: Read `location.name`, ignore rest
- v2.0+ clients: Full location support

### Pattern 4: Remove Field (Major)

Removing fields requires careful deprecation:

```diff
 // events/v1.json → events/v2.json
 {
   "version": "2.0.0",
   "minReaderVersion": "2.0.0",

   "migrationNotes": {
     "removed": ["legacyField"],
     "reason": "Replaced by newField in v1.5"
   },

   "Event": {
     "properties": {
-      "legacyField": { ... }  // Removed
       // ... other fields
     }
   }
 }
```

**Deprecation timeline**:
1. v1.5: Add `newField`, mark `legacyField` as deprecated
2. v1.5-v1.9: Write both fields for compatibility
3. v2.0: Stop writing `legacyField`
4. v2.0+6mo: Can remove `legacyField` handling from readers

### Pattern 5: Rename Field (Major)

Field renames are effectively remove + add:

```diff
 // events/v1.json → events/v2.json
 {
   "version": "2.0.0",
   "minReaderVersion": "1.5.0",

   "migrationNotes": {
     "renames": [{"from": "start", "to": "startAt"}]
   },

   "Event": {
     "properties": {
-      "start": { "type": "integer" }
+      "startAt": { "type": "integer" }
     }
   }
 }
```

**Transition strategy**:
1. v1.5: Read both `start` and `startAt`, write both
2. v2.0: Read both, write only `startAt`
3. v2.0+6mo: Read only `startAt`

## Database Migrations

Schema changes may require local database migrations:

### TypeScript (Dexie)

```typescript
// src/core/storage/migrations/events-v2.ts

import type { ModuleMigration } from '@/core/storage/types';

export const eventsV2Migration: ModuleMigration = {
  version: 2,
  description: 'Migrate event location from string to object',

  async migrate(db) {
    const events = await db.events.toArray();

    for (const event of events) {
      if (typeof event.location === 'string') {
        await db.events.update(event.id, {
          location: { name: event.location },
        });
      }
    }
  },
};
```

### Swift (Core Data / SQLite)

```swift
// Sources/Core/Storage/Migrations/EventsV2Migration.swift

struct EventsV2Migration: DatabaseMigration {
    let version = 2
    let description = "Migrate event location from string to object"

    func migrate(db: Database) async throws {
        let events = try await db.events.all()

        for event in events {
            if let locationString = event.location as? String {
                let newLocation = Location(name: locationString)
                try await db.events.update(event.id) { event in
                    event.location = newLocation
                }
            }
        }
    }
}
```

### Kotlin (Room)

```kotlin
// core/storage/migrations/EventsV2Migration.kt

val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(database: SupportSQLiteDatabase) {
        // Create new location table
        database.execSQL("""
            CREATE TABLE locations (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                name TEXT,
                address TEXT,
                latitude REAL,
                longitude REAL,
                FOREIGN KEY(event_id) REFERENCES events(id)
            )
        """)

        // Migrate data
        database.execSQL("""
            INSERT INTO locations (id, event_id, name)
            SELECT hex(randomblob(16)), id, location
            FROM events
            WHERE location IS NOT NULL
        """)

        // Update events table
        database.execSQL("ALTER TABLE events DROP COLUMN location")
        database.execSQL("ALTER TABLE events ADD COLUMN location_id TEXT")
    }
}
```

## Rollback Strategy

### Client Rollback

If a schema change causes issues:

1. **Don't deploy schema bundle** - old clients continue working
2. **Deploy hotfix** - fix the issue in new version
3. **Re-evaluate migration** - consider different approach

### Data Rollback

For database migrations:

```typescript
// Include rollback in migration definition
export const eventsV2Migration: ModuleMigration = {
  version: 2,
  description: 'Migrate event location from string to object',

  async migrate(db) {
    // Forward migration
  },

  async rollback(db) {
    const events = await db.events.toArray();

    for (const event of events) {
      if (typeof event.location === 'object' && event.location?.name) {
        await db.events.update(event.id, {
          location: event.location.name,
        });
      }
    }
  },
};
```

## Testing Migrations

### Unit Tests

```typescript
describe('events v1 to v2 migration', () => {
  it('migrates string location to object', () => {
    const v1 = { _v: '1.0.0', location: 'Community Center' };
    const v2 = migrateEventV1ToV2(v1);
    expect(v2.location).toEqual({ name: 'Community Center' });
  });

  it('handles null location', () => {
    const v1 = { _v: '1.0.0', location: null };
    const v2 = migrateEventV1ToV2(v1);
    expect(v2.location).toBeUndefined();
  });

  it('handles missing location', () => {
    const v1 = { _v: '1.0.0' };
    const v2 = migrateEventV1ToV2(v1);
    expect(v2.location).toBeUndefined();
  });
});
```

### Integration Tests

```typescript
describe('cross-version compatibility', () => {
  it('v1 client can read v2 event partially', async () => {
    const v2Event = createV2Event();
    const parsed = v1Registry.parse('events', v2Event);

    expect(parsed.meta.canFullyParse).toBe(false);
    expect(parsed.meta.displayMode).toBe('partial');
    expect(parsed.parsed.title).toBe(v2Event.title);
  });

  it('v2 client can read v1 event fully', async () => {
    const v1Event = createV1Event();
    const parsed = v2Registry.parse('events', v1Event);

    expect(parsed.meta.canFullyParse).toBe(true);
    expect(parsed.meta.displayMode).toBe('full');
  });
});
```

## Checklist

### Before Releasing Schema Change

- [ ] Categorized change as patch/minor/major
- [ ] Updated schema version number
- [ ] Set appropriate `minReaderVersion`
- [ ] Added migration notes to schema
- [ ] Updated `_registry.json`
- [ ] Added deprecation entry if breaking
- [ ] Generated new types for all clients
- [ ] Implemented migration logic
- [ ] Added test vectors
- [ ] Created database migration if needed
- [ ] Updated documentation
- [ ] Tested cross-version compatibility
- [ ] Generated schema bundle

### After Releasing Schema Change

- [ ] Monitor error rates
- [ ] Check graceful degradation in old clients
- [ ] Verify BLE mesh relay still works
- [ ] Confirm schema bundle propagation
- [ ] Update support documentation

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-25 | Initial specification |
