# i18n Codegen

Generates iOS and Android localization files from the web i18n source of truth.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SOURCES OF TRUTH                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Core:    packages/i18n/src/locales/*.json (11 languages)   │
│  2. Modules: src/modules/*/i18n/index.ts (20+ modules)          │
│  3. Mobile:  packages/i18n/src/mobile/*.json (mobile-only)      │
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

## Usage

```bash
# From repo root
bun run i18n:codegen           # Generate all platform files
bun run i18n:validate          # Validate translations only

# From tools/i18n-codegen
bun run generate               # Same as above
bun run generate --verbose     # Show detailed output
bun run validate               # Validate without generating
```

## Outputs

### Android

Generates `strings.xml` files for each locale:
- `clients/android/app/src/main/res/values/strings.xml` (English)
- `clients/android/app/src/main/res/values-es/strings.xml` (Spanish)
- `clients/android/app/src/main/res/values-fr/strings.xml` (French)
- etc.

### iOS

Generates `Localizable.strings` and `Localizable.stringsdict` for each locale:
- `clients/ios/BuildIt/Resources/en.lproj/Localizable.strings`
- `clients/ios/BuildIt/Resources/es.lproj/Localizable.strings`
- etc.

Also generates type-safe Swift accessors:
- `clients/ios/BuildIt/Sources/Core/Localization/L10n.swift`

## Key Naming

Keys are flattened from nested JSON with underscore separators:

```json
// Input (en.json)
{
  "auth": {
    "login": {
      "title": "Login"
    }
  }
}

// Output key: auth_login_title
```

Module translations are prefixed with the module name:
- `events_title` (from events/i18n/index.ts)
- `governance_voting` (from governance/i18n/index.ts)

Mobile-only translations are prefixed with `mobile_`:
- `mobile_ble_serviceNotificationTitle`
- `mobile_widgets_loading`

## Interpolation

The tool converts i18next-style interpolation to platform-specific formats:

| i18next | Android | iOS |
|---------|---------|-----|
| `{{name}}` | `%s` | `%@` |
| `{{count}}` | `%d` | `%lld` |
| Multiple placeholders | `%1$s`, `%2$s` | `%1$@`, `%2$@` |

## Adding Translations

1. **Core translations**: Edit `clients/web/packages/i18n/src/locales/{lang}.json`
2. **Module translations**: Edit `clients/web/src/modules/{module}/i18n/index.ts`
3. **Mobile-only translations**: Edit `clients/web/packages/i18n/src/mobile/{lang}.json`
4. Run `bun run i18n:codegen` to regenerate platform files

## Supported Locales

| Code | Language |
|------|----------|
| en | English |
| es | Spanish |
| fr | French |
| ar | Arabic |
| zh-CN | Chinese (Simplified) |
| vi | Vietnamese |
| ko | Korean |
| ru | Russian |
| pt | Portuguese |
| ht | Haitian Creole |
| tl | Tagalog |

## Using Generated Strings

### Android (Kotlin/Compose)

```kotlin
import androidx.compose.ui.res.stringResource
import network.buildit.R

// In Composable
Text(stringResource(R.string.auth_login_title))

// With interpolation
Text(stringResource(R.string.groups_members, memberCount))
```

### iOS (SwiftUI)

```swift
import SwiftUI

// Using L10n type-safe accessors
Text(L10n.Auth.Login.title)

// With interpolation
Text(L10n.Groups.members(memberCount))

// Or using string key directly
Text("auth_login_title".localized)
```
