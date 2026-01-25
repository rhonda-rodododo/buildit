# Adding a New Module

This guide covers how to add a new feature module to BuildIt across all clients.

## Overview

Modules are feature packages that can be enabled/disabled per-group. Examples: Events, Governance, Mutual Aid.

## Step-by-Step

### 1. Define Schema (Protocol)

Create the schema in `protocol/schemas/modules/{module-name}/v1.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://buildit.network/schemas/modules/{module-name}/v1.json",
  "title": "{ModuleName}Module",
  "version": "1.0.0",
  "minReaderVersion": "1.0.0",

  "$defs": {
    "YourEntity": {
      "type": "object",
      "required": ["id", "title", "createdBy", "createdAt", "_v"],
      "additionalProperties": true,
      "properties": {
        "_v": { "type": "string" },
        "id": { "type": "string", "format": "uuid" },
        "title": { "type": "string", "maxLength": 256 },
        "createdBy": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "createdAt": { "type": "integer" }
      }
    }
  }
}
```

### 2. Update Registry

Add to `protocol/schemas/modules/_registry.json`:

```json
{
  "modules": {
    "{module-name}": {
      "name": "Module Name",
      "description": "What this module does",
      "currentVersion": "1.0.0",
      "versions": ["1.0.0"],
      "dependencies": ["custom-fields"],
      "schemaPath": "{module-name}/v1.json",
      "coreDependency": false
    }
  }
}
```

### 3. Generate Types

From repo root:

```bash
bun run codegen
```

This generates:
- `clients/web/src/generated/schemas/{module-name}.ts`
- `clients/ios/Sources/Generated/Schemas/{ModuleName}.swift`
- `clients/android/app/src/.../generated/schemas/{ModuleName}.kt`

### 4. Implement in Web Client

Create module structure in `clients/web/src/modules/{module-name}/`:

```
{module-name}/
├── index.ts              # Registration
├── schema.ts             # Dexie tables
├── types.ts              # Re-export generated types
├── {moduleName}Store.ts  # Zustand store
├── {moduleName}Manager.ts # Business logic
├── components/           # UI
├── hooks/                # Custom hooks
└── i18n/                 # Translations
```

**index.ts**:
```typescript
import { registerModuleSchema } from '@/core/storage/db';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import { schema } from './schema';
import translations from './i18n';

registerModuleSchema('{module-name}', schema);
registerModuleTranslations('{module-name}', translations);

export * from './types';
export { use{ModuleName}Store } from './{moduleName}Store';
```

### 5. Implement in iOS Client

Create in `clients/ios/Sources/Features/{ModuleName}/`:

```
{ModuleName}/
├── {ModuleName}View.swift
├── {ModuleName}ViewModel.swift
├── {ModuleName}Repository.swift
└── Models/
    └── (use generated types from Sources/Generated/)
```

### 6. Implement in Android Client

Create in `clients/android/app/src/main/java/network/buildit/features/{modulename}/`:

```
{modulename}/
├── {ModuleName}Screen.kt
├── {ModuleName}ViewModel.kt
├── {ModuleName}Repository.kt
└── (use generated types from generated/schemas/)
```

### 7. Add Test Vectors

Create `protocol/test-vectors/{module-name}/`:

```json
{
  "module": "{module-name}",
  "version": "1.0.0",
  "vectors": [
    {
      "name": "basic_entity",
      "valid": true,
      "input": { ... }
    }
  ]
}
```

### 8. Register in Module System

Add to `clients/web/src/lib/modules/registry.ts`:

```typescript
const MODULE_LOADERS: ModuleLoader[] = [
  // ... existing modules
  { id: '{module-name}', load: () => import('@/modules/{module-name}') },
];
```

## Checklist

- [ ] Schema defined in `protocol/schemas/modules/`
- [ ] Registry updated
- [ ] Types generated with `bun run codegen`
- [ ] Web client implementation
- [ ] iOS client implementation
- [ ] Android client implementation
- [ ] Test vectors added
- [ ] All tests passing
