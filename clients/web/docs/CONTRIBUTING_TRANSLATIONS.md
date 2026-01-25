# Contributing Translations

Thank you for helping translate BuildIt Network! This guide explains how to contribute translations to the project.

## Supported Languages

BuildIt Network currently supports 11 languages:

| Code | Language | Native Name | Direction |
|------|----------|-------------|-----------|
| en | English | English | LTR |
| es | Spanish | Español | LTR |
| fr | French | Français | LTR |
| ar | Arabic | العربية | RTL |
| zh-CN | Chinese (Simplified) | 简体中文 | LTR |
| vi | Vietnamese | Tiếng Việt | LTR |
| ko | Korean | 한국어 | LTR |
| ru | Russian | Русский | LTR |
| pt | Portuguese | Português | LTR |
| ht | Haitian Creole | Kreyòl Ayisyen | LTR |
| tl | Tagalog | Tagalog | LTR |

## Translation File Structure

### Core Translations

Core translations are located in `src/i18n/locales/`:

```
src/i18n/locales/
├── en.json      # English (source of truth)
├── es.json      # Spanish
├── fr.json      # French
├── ar.json      # Arabic
├── zh-CN.json   # Chinese (Simplified)
├── vi.json      # Vietnamese
├── ko.json      # Korean
├── ru.json      # Russian
├── pt.json      # Portuguese
├── ht.json      # Haitian Creole
└── tl.json      # Tagalog
```

### Module Translations

Each module can have its own translations in `src/modules/[module-name]/i18n/`:

```
src/modules/events/i18n/
├── index.ts     # Export all translations
├── en.json      # English
├── es.json      # Spanish
└── ...          # Other languages
```

## How to Contribute

### 1. Find Missing Translations

Use the English file (`en.json`) as the reference. Compare it with your target language to find missing keys:

```bash
# Count keys in English vs target language
bun run i18n:check
```

Or manually compare the files:

```bash
# Get all keys from English
jq -r 'paths(scalars) | join(".")' src/i18n/locales/en.json | sort > /tmp/en-keys.txt

# Get all keys from your language (e.g., Spanish)
jq -r 'paths(scalars) | join(".")' src/i18n/locales/es.json | sort > /tmp/es-keys.txt

# Find missing keys
diff /tmp/en-keys.txt /tmp/es-keys.txt
```

### 2. Add Translations

1. **Fork the repository** and create a branch:
   ```bash
   git checkout -b translations/es-updates
   ```

2. **Edit the locale file** in `src/i18n/locales/{lang}.json`

3. **Follow the JSON structure** exactly as in `en.json`:
   ```json
   {
     "common": {
       "save": "Guardar",
       "cancel": "Cancelar"
     },
     "auth": {
       "login": "Iniciar sesión",
       "logout": "Cerrar sesión"
     }
   }
   ```

4. **Test your changes**:
   ```bash
   bun run dev
   # Then switch to your language in the app settings
   ```

5. **Submit a Pull Request** with:
   - Clear title: "i18n: Add Spanish translations for polls feature"
   - List of keys you translated
   - Any context or notes for reviewers

### 3. Translation Guidelines

#### General Rules

- **Use formal/informal consistently**: Match the existing style in the language file
- **Keep placeholders intact**: `{{count}}` → `{{count}}` (don't translate)
- **Preserve HTML entities**: Keep `<br>` or `<strong>` tags if present
- **Test context**: See where the string appears before translating
- **Use native speakers**: Machine translation is a starting point, not the end

#### Pluralization

i18next supports pluralization. Use the correct plural forms:

```json
{
  "item": "item",
  "item_plural": "items",
  "item_0": "no items"  // Some languages need zero form
}
```

For languages with complex plural rules (e.g., Arabic, Russian):

```json
{
  "item_zero": "لا عناصر",
  "item_one": "عنصر واحد",
  "item_two": "عنصران",
  "item_few": "{{count}} عناصر",
  "item_many": "{{count}} عنصر",
  "item_other": "{{count}} عنصر"
}
```

#### Interpolation

Keep variable placeholders unchanged:

```json
// English
"welcome": "Welcome, {{name}}!"

// Spanish - keep {{name}} exactly
"welcome": "¡Bienvenido, {{name}}!"
```

#### Context

Some strings have context variants:

```json
{
  "date": "Date",
  "date_context_romantic": "Cita"  // Spanish: date can mean romantic date
}
```

### 4. RTL Languages (Arabic, Hebrew, etc.)

For RTL languages:

- The app automatically sets `dir="rtl"` on the document
- Keep text natural - don't reverse it manually
- Icons and layout flip automatically via CSS

Test RTL by:
1. Switching to Arabic in settings
2. Verifying layout mirrors correctly
3. Checking text alignment

## Adding a New Language

To add a completely new language:

1. **Create the locale file**: Copy `en.json` to `{code}.json`

2. **Register in config.ts**:
   ```typescript
   // src/i18n/config.ts
   import newLang from './locales/xx.json'

   export const resources = {
     // ... existing
     xx: { translation: newLang },
   }

   export const languages = [
     // ... existing
     { code: 'xx', name: 'Language', nativeName: 'Native', dir: 'ltr' },
   ]
   ```

3. **Update moduleI18n.ts**: Add the language code to the interface and arrays

4. **Translate at least the critical strings**:
   - `common.*` - Save, Cancel, Close, etc.
   - `auth.*` - Login, Logout, etc.
   - `nav.*` - Navigation items
   - `errors.*` - Error messages

5. **Submit a PR** following our contribution guidelines

## Translation Quality

### Do

- Use natural, native-sounding language
- Consider cultural context
- Test in the actual UI
- Ask for review from native speakers
- Keep consistent terminology throughout

### Don't

- Don't use Google Translate alone (use as starting point only)
- Don't translate brand names (BuildIt stays BuildIt)
- Don't change the meaning to fit grammar
- Don't add extra spaces or punctuation
- Don't translate technical terms that should stay English (e.g., "Nostr")

## Testing Translations

```bash
# Run the dev server
bun run dev

# Run i18n-related tests
bun run test --grep i18n

# Build to check for missing translations (warnings in console)
bun run build
```

## Questions?

- Open an issue with the `i18n` label
- Join our community chat for translation discussions
- Tag `@translations` in your PR for review

## Recognition

Contributors who help with translations will be recognized in our Contributors list. Thank you for making BuildIt Network accessible to more communities!
