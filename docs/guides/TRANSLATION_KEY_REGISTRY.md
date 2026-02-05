# Translation Key Registry

Comprehensive guide to BuildIt's internationalization architecture, translation
flow across platforms, naming conventions, module namespaces, and contributor
instructions.

## Translation Flow

Web module translations are the **single source of truth**. iOS and Android
localization files are generated automatically by the `i18n-codegen` tool.

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOURCES OF TRUTH                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Core:    packages/i18n/src/locales/*.json (11 languages)   │
│  2. Modules: src/modules/*/i18n/index.ts (23 modules)          │
│  3. Mobile:  packages/i18n/src/mobile/*.json (mobile-only)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                    bun run i18n:codegen
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│     Web       │     │    Android    │     │      iOS      │
│  (no change)  │     │  strings.xml  │     │ .strings +    │
│  i18next      │     │  per locale   │     │ .stringsdict  │
│               │     │               │     │ + L10n.swift  │
└───────────────┘     └───────────────┘     └───────────────┘
```

### Source Files

| Source Type | Location | Description |
|-------------|----------|-------------|
| Core | `clients/web/packages/i18n/src/locales/{locale}.json` | App-wide translations (auth, nav, settings, schema, etc.) |
| Module | `clients/web/src/modules/{module}/i18n/index.ts` | Feature-specific translations, namespaced by module |
| Mobile-only | `clients/web/packages/i18n/src/mobile/{locale}.json` | Translations only used on iOS/Android (BLE, widgets, etc.) |

### Generated Output Files

| Platform | Output Location | Format |
|----------|----------------|--------|
| Android | `clients/android/app/src/main/res/values-{locale}/strings.xml` | Android XML resources |
| iOS strings | `clients/ios/BuildIt/Resources/{locale}.lproj/Localizable.strings` | Apple .strings |
| iOS plurals | `clients/ios/BuildIt/Resources/{locale}.lproj/Localizable.stringsdict` | Apple .stringsdict |
| iOS accessors | `clients/ios/BuildIt/Sources/Core/Localization/L10n.swift` | Type-safe Swift enum |

### Commands

```bash
# From repo root
bun run i18n:codegen           # Generate all platform files
bun run i18n:validate          # Validate translations only

# From tools/i18n-codegen
bun run generate               # Same as above
bun run generate --verbose     # Show detailed output
bun run validate               # Validate without generating
```

---

## Naming Conventions per Platform

### Key Flattening

Nested JSON keys are flattened with underscore separators for native platforms:

```json
// Input (en.json)
{
  "auth": {
    "login": {
      "title": "Login"
    }
  }
}
```

| Platform | Key | Access Pattern |
|----------|-----|---------------|
| Web (i18next) | `auth.login.title` | `t('auth.login.title')` |
| iOS (Swift) | `auth_login_title` | `L10n.Auth.Login.title` |
| Android (Kotlin) | `auth_login_title` | `stringResource(R.string.auth_login_title)` |

### Module Key Prefixes

Module translations are prefixed with the module name:

| Source | Flattened Key |
|--------|--------------|
| `events/i18n` `{ title: "Events" }` | `events_title` |
| `governance/i18n` `{ voting: "Voting" }` | `governance_voting` |
| `mutual-aid/i18n` `{ requests: "Requests" }` | `mutual_aid_requests` |

Mobile-only translations use the `mobile_` prefix:
- `mobile_ble_serviceNotificationTitle`
- `mobile_widgets_loading`

### Interpolation

The codegen tool converts i18next-style interpolation to platform-native formats:

| i18next (Web) | Android | iOS |
|---------------|---------|-----|
| `{{name}}` | `%s` | `%@` |
| `{{count}}` | `%d` | `%lld` |
| Multiple: `{{a}} and {{b}}` | `%1$s and %2$s` | `%1$@ and %2$@` |

---

## Module Namespaces

All 23 module translation namespaces, their source files, and translation status.

### Fully Translated (en, es, fr, ar + placeholders for 7 other locales)

| Module | Namespace | Source File | Key Count (en) |
|--------|-----------|-------------|----------------|
| Calling | `calling` | `src/modules/calling/i18n/index.ts` | ~15 |
| CRM | `crm` | `src/modules/crm/i18n/index.ts` | ~15 |
| Custom Fields | `custom-fields` | `src/modules/custom-fields/i18n/index.ts` | ~20 |
| Database | `database` | `src/modules/database/i18n/index.ts` | ~15 |
| Documents | `documents` | `src/modules/documents/i18n/index.ts` | ~15 |
| Events | `events` | `src/modules/events/i18n/index.ts` | ~20 |
| Files | `files` | `src/modules/files/i18n/index.ts` | ~15 |
| Forms | `forms` | `src/modules/forms/i18n/index.ts` | ~15 |
| Friends | `friends` | `src/modules/friends/i18n/index.ts` | ~12 |
| Fundraising | `fundraising` | `src/modules/fundraising/i18n/index.ts` | ~15 |
| Governance | `governance` | `src/modules/governance/i18n/index.ts` | ~20 |
| Hotlines | `hotlines` | `src/modules/hotlines/i18n/index.ts` | ~15 |
| Messaging | `messaging` | `src/modules/messaging/i18n/index.ts` | ~20 |
| Microblogging | `microblogging` | `src/modules/microblogging/i18n/index.ts` | ~15 |
| Mutual Aid | `mutual-aid` | `src/modules/mutual-aid/i18n/index.ts` | ~20 |
| Newsletters | `newsletters` | `src/modules/newsletters/i18n/index.ts` | ~15 |
| Public Pages | `public` | `src/modules/public/i18n/index.ts` | ~12 |
| Publishing | `publishing` | `src/modules/publishing/i18n/index.ts` | ~15 |
| Search | `search` | `src/modules/search/i18n/index.ts` | ~10 |
| Security | `security` | `src/modules/security/i18n/index.ts` | ~12 |
| Social | `social` | `src/modules/social/i18n/index.ts` | ~20 |
| Training | `training` | `src/modules/training/i18n/index.ts` | ~15 |
| Wiki | `wiki` | `src/modules/wiki/i18n/index.ts` | ~15 |

### Core Namespaces (in locale JSON files)

These are not modules but top-level key groups in the core locale files:

| Namespace | Description | Example Keys |
|-----------|-------------|--------------|
| `app` | App name and tagline | `app.name`, `app.tagline` |
| `meta` | Page meta descriptions | `meta.home`, `meta.messages` |
| `auth` | Authentication flow | `auth.login`, `auth.createIdentity` |
| `nav` | Navigation labels | `nav.home`, `nav.messages` |
| `groups` | Group management | `groups.create`, `groups.members` |
| `settings` | Settings pages | `settings.title`, `settings.profile` |
| `notifications` | Notification strings | `notifications.title`, `notifications.markAllRead` |
| `schema` | Schema versioning UI | `schema.updateAvailable`, `schema.fullyCompatible` |
| `profile` | Profile management | `profile.edit`, `profile.displayName` |
| `common` | Shared UI strings | `common.save`, `common.cancel`, `common.loading` |
| `errors` | Error messages | `errors.generic`, `errors.network` |
| `friends` | Friend management | `friends.add`, `friends.requests` |
| `friendRequestCard` | Friend request UI | `friendRequestCard.accept`, `friendRequestCard.sent` |

---

## Instructions for Adding New Translations

### Adding a new key to an existing module

1. Open `clients/web/src/modules/{module}/i18n/index.ts`
2. Add the key to the `en` section first
3. Add translations for priority languages (`es`, `fr`, `ar`)
4. Add `[NEEDS_TRANSLATION]` prefixed English text for other locales
5. Run `bun run i18n:codegen` to regenerate native platform files

Example:

```typescript
export default defineModuleTranslations({
  en: {
    // ... existing keys
    newFeature: 'New Feature Label',
  },
  es: {
    // ... existing keys
    newFeature: 'Etiqueta de Nueva Función',
  },
  fr: {
    // ... existing keys
    newFeature: 'Étiquette de Nouvelle Fonctionnalité',
  },
  ar: {
    // ... existing keys
    newFeature: 'تسمية الميزة الجديدة',
  },
  'zh-CN': {
    // ... existing keys
    newFeature: '[NEEDS_TRANSLATION] New Feature Label',
  },
  // ... same for vi, ko, ru, pt, ht, tl
});
```

### Adding a new core key

1. Add the key to `clients/web/packages/i18n/src/locales/en.json`
2. Add translations to `es.json`, `fr.json`, `ar.json`
3. Add `[NEEDS_TRANSLATION]` prefixed values to all other locale files
4. Run `bun run i18n:codegen`

### Adding a new module

1. Create `clients/web/src/modules/{module}/i18n/index.ts`
2. Use the `defineModuleTranslations()` helper from `@/i18n/moduleI18n`
3. Include all 11 locales (en complete, es/fr/ar translated, others with placeholders)
4. Register in the module's `index.ts`:
   ```typescript
   import { registerModuleTranslations } from '@/i18n/moduleI18n';
   import translations from './i18n';
   registerModuleTranslations('my-module', translations);
   ```
5. Run `bun run i18n:codegen`

### Adding a new language

1. Add the locale code to `tools/i18n-codegen/src/types.ts` (`SUPPORTED_LOCALES`)
2. Add platform locale mappings if needed (`LOCALE_MAPPINGS`)
3. Create `clients/web/packages/i18n/src/locales/{locale}.json` (copy from `en.json`, prefix all values)
4. Add the locale to `clients/web/src/i18n/moduleI18n.ts` (`ModuleTranslations` type)
5. Add entries to all module `i18n/index.ts` files
6. Run `bun run i18n:codegen`

---

## Supported Languages & Priority

### Priority Tiers

| Tier | Languages | Rationale | Translation Quality |
|------|-----------|-----------|-------------------|
| **Tier 1** | English (en) | Source language | Complete, authoritative |
| **Tier 2** | Spanish (es), French (fr), Arabic (ar) | Primary activist community languages in the US and globally | Full human-quality translations |
| **Tier 3** | Chinese Simplified (zh-CN), Vietnamese (vi), Korean (ko), Russian (ru), Portuguese (pt) | Large diaspora communities, significant organizing populations | `[NEEDS_TRANSLATION]` placeholders, awaiting community translation |
| **Tier 4** | Haitian Creole (ht), Tagalog (tl) | Important immigrant communities, underserved by tech | `[NEEDS_TRANSLATION]` placeholders, awaiting community translation |

### Why These Languages

BuildIt serves activist groups, co-ops, unions, and community organizers. The
language selection reflects:

- **Spanish**: Largest non-English language in the US; critical for labor, immigration, and community organizing
- **French**: Major organizing language across Africa, the Caribbean, and Quebec
- **Arabic**: Spoken by diaspora communities organizing around civil rights and mutual aid
- **Chinese, Vietnamese, Korean**: Large immigrant communities with active civic organizations
- **Russian**: Active diaspora with organizing needs
- **Portuguese**: Brazilian diaspora communities
- **Haitian Creole**: Underserved community with high organizing activity
- **Tagalog**: Filipino communities active in labor and civic organizing

### Placeholder Convention

Keys that have not yet been translated use the `[NEEDS_TRANSLATION]` prefix:

```json
"title": "[NEEDS_TRANSLATION] Public Pages"
```

This convention:
- Makes untranslated strings visible in the UI during testing
- Enables automated auditing (grep for `[NEEDS_TRANSLATION]`)
- Preserves the English fallback so the app remains usable
- Signals to community translators which strings need attention

---

## Schema Versioning Keys

Cross-platform registry for schema-versioning UI strings. These keys ensure
consistent messaging when version mismatches are detected between clients.

### Schema Update Notifications

| Description | Web Key | iOS Key | Android Key |
|-------------|---------|---------|-------------|
| Schema update available | `schema.updateAvailable` | `schema_update_available` | `schema_update_available` |
| Newer version detected | `schema.newerVersionDetected` | `schema_newer_version_detected` | `schema_newer_version_detected` |
| Update recommended | `schema.updateRecommended` | `schema_update_recommended` | `schema_update_recommended` |
| Bundle outdated | `schema.bundleOutdated` | `schema_bundle_outdated` | `schema_bundle_outdated` |
| Update now (action) | `schema.updateNow` | `schema_update_now` | `schema_update_now` |
| Check for updates | `schema.checkForUpdates` | `schema_check_for_updates` | `schema_check_for_updates` |

### Compatibility Status

| Description | Web Key | iOS Key | Android Key |
|-------------|---------|---------|-------------|
| Fully compatible | `schema.fullyCompatible` | `schema_fully_compatible` | `schema_fully_compatible` |
| Partially compatible | `schema.partiallyCompatible` | `schema_partially_compatible` | `schema_partially_compatible` |
| Incompatible | `schema.incompatible` | `schema_incompatible` | `schema_incompatible` |
| Content partially readable | `schema.contentPartiallyReadable` | `schema_content_partially_readable` | `schema_content_partially_readable` |
| Unknown fields preserved | `schema.unknownFieldsPreserved` | `schema_unknown_fields_preserved` | `schema_unknown_fields_preserved` |

### Version Information

| Description | Web Key | iOS Key | Android Key |
|-------------|---------|---------|-------------|
| Schema version label | `schema.schemaVersion` | `schema_schema_version` | `schema_schema_version` |
| This version is deprecated | `schema.thisVersionDeprecated` | `schema_this_version_deprecated` | `schema_this_version_deprecated` |
| Days until sunset | `schema.daysUntilSunset` | `schema_days_until_sunset` | `schema_days_until_sunset` |
| Update for full features | `schema.updateForFullFeatures` | `schema_update_for_full_features` | `schema_update_for_full_features` |

### QR Schema Import

| Description | Web Key | iOS Key | Android Key |
|-------------|---------|---------|-------------|
| Import schema via QR | `schema.importSchemaQR` | `schema_import_schema_qr` | `schema_import_schema_qr` |
| Scan schema bundles | `schema.scanSchemaBundles` | `schema_scan_schema_bundles` | `schema_scan_schema_bundles` |
| Start scanning | `schema.startScanning` | `schema_start_scanning` | `schema_start_scanning` |
| Stop scanning | `schema.stopScanning` | `schema_stop_scanning` | `schema_stop_scanning` |
| Manual input | `schema.manualInput` | `schema_manual_input` | `schema_manual_input` |
| Bundle ready | `schema.bundleReady` | `schema_bundle_ready` | `schema_bundle_ready` |
| Scan again | `schema.scanAgain` | `schema_scan_again` | `schema_scan_again` |

### Error Messages

| Description | Web Key | iOS Key | Android Key |
|-------------|---------|---------|-------------|
| Camera permission error | `schema.cameraPermissionError` | `schema_camera_permission_error` | `schema_camera_permission_error` |
| Missing bundle hash | `schema.missingBundleHash` | `schema_missing_bundle_hash` | `schema_missing_bundle_hash` |
| Missing chunk | `schema.missingChunk` | `schema_missing_chunk` | `schema_missing_chunk` |
| Decode failed | `schema.decodeFailed` | `schema_decode_failed` | `schema_decode_failed` |

### Parameterized Strings

| Description | Web (i18next) | iOS (Swift) | Android (Kotlin) |
|-------------|---------------|-------------|-------------------|
| Days until sunset | `{{count}} days until sunset` | `%lld days until sunset` | `%d days until sunset` |
| Missing chunk N | `Missing chunk {{index}}` | `Missing chunk %@` | `Missing chunk %s` |
| Items with newer features | `{{count}} {{module}} items contain features...` | `%lld %@ items contain features...` | `%1$d %2$s items contain features...` |

---

## Auditing Translations

### Find untranslated strings

```bash
# Count [NEEDS_TRANSLATION] across all module i18n files
grep -r "NEEDS_TRANSLATION" clients/web/src/modules/*/i18n/index.ts | wc -l

# Find modules with empty locale objects
grep -r "'es': {}" clients/web/src/modules/*/i18n/index.ts

# Check core locale files for placeholders
grep -c "NEEDS_TRANSLATION" clients/web/packages/i18n/src/locales/*.json

# Validate with the codegen tool
bun run i18n:validate
```

### Translation coverage by locale

After running `bun run i18n:codegen --verbose`, the tool reports key counts per
locale. Compare against the English key count to determine coverage percentage.

---

## Implementation Notes

### Web (TypeScript / i18next)

- Keys accessed via `t('namespace.key')` or `t('module:key')` for module translations
- Core translations loaded at app init from JSON files
- Module translations registered via `registerModuleTranslations()` which calls `i18next.addResourceBundle()`
- Deep merge is enabled so partial module translations overlay the English fallback

### iOS (Swift / SwiftUI)

- Generated `L10n.swift` provides type-safe accessors: `L10n.Auth.Login.title`
- `.strings` files in `{locale}.lproj/` directories
- `.stringsdict` for plurals
- String key format: `auth_login_title` (underscore-separated)

### Android (Kotlin / Compose)

- Generated `strings.xml` in `values-{locale}/` directories
- Access via `stringResource(R.string.auth_login_title)`
- String key format: `auth_login_title` (underscore-separated)
- Locale code `zh-CN` maps to Android's `zh-rCN`
