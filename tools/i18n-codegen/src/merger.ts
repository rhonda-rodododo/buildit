// Translation Merger
// Combines translations from all sources: core JSON, module TS, and mobile JSON

import { glob } from 'glob';
import * as path from 'path';
import type {
  AllTranslations,
  LocaleTranslations,
  SupportedLocale,
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from './types';
import { SUPPORTED_LOCALES } from './types';
import { loadJsonTranslations } from './parsers/json';
import { loadModuleTranslations, getModuleTranslationsForLocale } from './parsers/typescript';

interface MergerConfig {
  webRoot: string;
  verbose?: boolean;
}

/**
 * Load all translations from all sources
 */
export async function loadAllTranslations(config: MergerConfig): Promise<AllTranslations> {
  const { webRoot, verbose } = config;
  const allTranslations: AllTranslations = new Map();

  // Initialize maps for each locale
  for (const locale of SUPPORTED_LOCALES) {
    allTranslations.set(locale, new Map());
  }

  // 1. Load core JSON translations
  if (verbose) console.log('Loading core translations...');
  await loadCoreTranslations(webRoot, allTranslations, verbose);

  // 2. Load module TypeScript translations
  if (verbose) console.log('Loading module translations...');
  await loadModuleTranslationsAll(webRoot, allTranslations, verbose);

  // 3. Load mobile JSON translations
  if (verbose) console.log('Loading mobile translations...');
  await loadMobileTranslations(webRoot, allTranslations, verbose);

  return allTranslations;
}

// Load core JSON translations from packages/i18n/locales/
async function loadCoreTranslations(
  webRoot: string,
  allTranslations: AllTranslations,
  verbose?: boolean
): Promise<void> {
  const localesDir = path.join(webRoot, 'packages/i18n/src/locales');

  for (const locale of SUPPORTED_LOCALES) {
    const filePath = path.join(localesDir, `${locale}.json`);
    try {
      const translations = await loadJsonTranslations(filePath);
      const localeMap = allTranslations.get(locale)!;

      for (const [key, entry] of translations) {
        localeMap.set(key, entry);
      }

      if (verbose) {
        console.log(`  [core] ${locale}: ${translations.size} keys`);
      }
    } catch (error) {
      if (verbose) {
        console.warn(`  [core] ${locale}: not found or error - ${error}`);
      }
    }
  }
}

// Load module TypeScript translations from src/modules/[module]/i18n/index.ts
async function loadModuleTranslationsAll(
  webRoot: string,
  allTranslations: AllTranslations,
  verbose?: boolean
): Promise<void> {
  const modulesDir = path.join(webRoot, 'src/modules');
  const pattern = path.join(modulesDir, '*/i18n/index.ts');
  const files = await glob(pattern);

  for (const filePath of files) {
    // Extract module ID from path
    const relativePath = path.relative(modulesDir, filePath);
    const moduleId = relativePath.split(path.sep)[0];

    try {
      const moduleDef = await loadModuleTranslations(filePath, moduleId);

      for (const locale of SUPPORTED_LOCALES) {
        const translations = getModuleTranslationsForLocale(moduleDef, locale);
        const localeMap = allTranslations.get(locale)!;

        for (const [key, entry] of translations) {
          localeMap.set(key, entry);
        }
      }

      if (verbose) {
        const enCount = getModuleTranslationsForLocale(moduleDef, 'en').size;
        console.log(`  [module] ${moduleId}: ${enCount} keys`);
      }
    } catch (error) {
      if (verbose) {
        console.warn(`  [module] ${moduleId}: error - ${error}`);
      }
    }
  }
}

// Load mobile JSON translations from packages/i18n/mobile/
async function loadMobileTranslations(
  webRoot: string,
  allTranslations: AllTranslations,
  verbose?: boolean
): Promise<void> {
  const mobileDir = path.join(webRoot, 'packages/i18n/src/mobile');

  for (const locale of SUPPORTED_LOCALES) {
    const filePath = path.join(mobileDir, `${locale}.json`);
    try {
      // Mobile translations use 'mobile' namespace
      const translations = await loadJsonTranslations(filePath, 'mobile');
      const localeMap = allTranslations.get(locale)!;

      for (const [key, entry] of translations) {
        localeMap.set(key, entry);
      }

      if (verbose) {
        console.log(`  [mobile] ${locale}: ${translations.size} keys`);
      }
    } catch {
      // Mobile translations are optional for non-English locales
      if (locale === 'en' && verbose) {
        console.warn(`  [mobile] ${locale}: not found (required)`);
      }
    }
  }
}

/**
 * Validate translations across all locales
 */
export function validateTranslations(
  allTranslations: AllTranslations,
  sourceLocale: SupportedLocale = 'en'
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const sourceTranslations = allTranslations.get(sourceLocale);
  if (!sourceTranslations) {
    errors.push({
      key: '*',
      locale: sourceLocale,
      message: `Source locale ${sourceLocale} has no translations`,
    });
    return { valid: false, errors, warnings };
  }

  const sourceKeys = new Set(sourceTranslations.keys());

  // Check each locale against source
  for (const locale of SUPPORTED_LOCALES) {
    if (locale === sourceLocale) continue;

    const localeTranslations = allTranslations.get(locale);
    if (!localeTranslations) {
      warnings.push({
        key: '*',
        locale,
        message: `Locale ${locale} has no translations`,
      });
      continue;
    }

    const localeKeys = new Set(localeTranslations.keys());

    // Find missing keys
    for (const key of sourceKeys) {
      if (!localeKeys.has(key)) {
        warnings.push({
          key,
          locale,
          message: `Missing translation`,
        });
      }
    }

    // Find extra keys (in target but not in source)
    for (const key of localeKeys) {
      if (!sourceKeys.has(key)) {
        warnings.push({
          key,
          locale,
          message: `Extra key not in source locale`,
        });
      }
    }

    // Check interpolation placeholders match
    for (const key of sourceKeys) {
      if (localeKeys.has(key)) {
        const sourceEntry = sourceTranslations.get(key)!;
        const localeEntry = localeTranslations.get(key)!;

        const sourcePlaceholders = extractPlaceholders(sourceEntry.value);
        const localePlaceholders = extractPlaceholders(localeEntry.value);

        if (!setsEqual(sourcePlaceholders, localePlaceholders)) {
          errors.push({
            key,
            locale,
            message: `Placeholder mismatch: source has {${[...sourcePlaceholders].join(', ')}}, locale has {${[...localePlaceholders].join(', ')}}`,
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Extract interpolation placeholders from a string
 * Matches: {{name}}, {name}, %s, %d, %1$s, %@
 */
function extractPlaceholders(value: string): Set<string> {
  const placeholders = new Set<string>();

  // i18next style: {{name}}
  const i18nextMatches = value.matchAll(/\{\{(\w+)\}\}/g);
  for (const match of i18nextMatches) {
    placeholders.add(`{{${match[1]}}}`);
  }

  // Simple braces: {name}
  const simpleMatches = value.matchAll(/\{(\w+)\}/g);
  for (const match of simpleMatches) {
    placeholders.add(`{${match[1]}}`);
  }

  // Android/Java style: %s, %d, %1$s, etc.
  const androidMatches = value.matchAll(/%(\d+\$)?[sdfa]/g);
  for (const match of androidMatches) {
    placeholders.add(match[0]);
  }

  // iOS style: %@
  const iosMatches = value.matchAll(/%@/g);
  for (const match of iosMatches) {
    placeholders.add(match[0]);
  }

  return placeholders;
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}
