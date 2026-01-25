# Making Schema Changes

This guide covers how to evolve schemas while maintaining cross-client compatibility.

## Quick Reference

| Change Type | Version Bump | Safe? |
|-------------|--------------|-------|
| Add optional field | PATCH (1.0.x) | ✅ Yes |
| Add required field with default | MINOR (1.x.0) | ⚠️ Needs migration |
| Change field type | MAJOR (x.0.0) | ❌ Breaking |
| Remove field | MAJOR (x.0.0) | ❌ Breaking |
| Rename field | MAJOR (x.0.0) | ❌ Breaking |

## Safe Change: Add Optional Field

1. **Edit schema** (`protocol/schemas/modules/{module}/v1.json`):
   ```diff
    "properties": {
      // existing fields...
   +  "newField": {
   +    "type": "string",
   +    "description": "New optional field"
   +  }
    }
   ```

2. **Bump patch version**:
   ```diff
   - "version": "1.0.0",
   + "version": "1.0.1",
   ```

3. **Generate types**:
   ```bash
   bun run codegen
   ```

4. **Update client code** to use new field (optional)

5. **Commit**:
   ```bash
   git commit -m "feat({module}): add newField to schema"
   ```

## Breaking Change: Change Field Type

1. **Create new schema version** (`protocol/schemas/modules/{module}/v2.json`)

2. **Update registry** with deprecation:
   ```json
   {
     "modules": {
       "{module}": {
         "currentVersion": "2.0.0",
         "versions": ["1.0.0", "2.0.0"]
       }
     },
     "deprecations": [{
       "module": "{module}",
       "version": "1.0.0",
       "deprecatedAt": "2026-01-25",
       "sunsetAt": "2026-07-25",
       "migrateTo": "2.0.0"
     }]
   }
   ```

3. **Add migration logic** in each client

4. **Update test vectors** with cross-version tests

5. **Generate types**: `bun run codegen`

6. **Commit**:
   ```bash
   git commit -m "feat({module}): v2 schema with new field type

   BREAKING CHANGE: fieldName changed from string to object
   Migration: Old clients can read v2 partially"
   ```

## Core Messaging Warning

**NEVER make breaking changes to `messaging/v1.json`**

Core messaging must work across ALL versions forever (crisis resilience).

Only additive changes allowed:
- ✅ Add optional fields
- ❌ Add required fields
- ❌ Change field types
- ❌ Remove fields

## Full Workflow

See `protocol/spec/12-migration-guide.md` for complete migration procedures.
