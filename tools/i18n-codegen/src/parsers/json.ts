/**
 * JSON Translation Parser
 *
 * Parses nested JSON files (core and mobile translations) and flattens them
 * to key-value pairs with underscore-separated keys.
 */

import type { LocaleTranslations, TranslationEntry } from '../types';

/**
 * Flatten a nested object to dot-notation keys
 *
 * Example:
 *   { auth: { login: { title: "Login" } } }
 *   → { "auth_login_title": "Login" }
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
  result: Map<string, TranslationEntry> = new Map()
): Map<string, TranslationEntry> {
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}_${key}` : key;

    if (typeof value === 'string') {
      result.set(flatKey, {
        key: flatKey,
        value,
      });
    } else if (typeof value === 'object' && value !== null) {
      // Check if this is a plural object
      if (isPluralObject(value)) {
        result.set(flatKey, {
          key: flatKey,
          value: (value as Record<string, string>).other || (value as Record<string, string>).one || '',
          isPlural: true,
          pluralForms: value as Record<string, string>,
        });
      } else {
        // Recurse into nested object
        flattenObject(value as Record<string, unknown>, flatKey, result);
      }
    }
  }

  return result;
}

/**
 * Check if an object represents plural forms
 * Plurals have keys like: zero, one, two, few, many, other
 */
function isPluralObject(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  const keys = Object.keys(obj);
  const pluralKeys = ['zero', 'one', 'two', 'few', 'many', 'other'];
  // Must have at least 'one' or 'other' and all keys must be plural keys
  return (
    keys.some((k) => k === 'one' || k === 'other') &&
    keys.every((k) => pluralKeys.includes(k)) &&
    keys.every((k) => typeof (obj as Record<string, unknown>)[k] === 'string')
  );
}

/**
 * Parse a JSON translation file
 */
export function parseJsonTranslations(
  jsonContent: string,
  namespace?: string
): LocaleTranslations {
  const data = JSON.parse(jsonContent) as Record<string, unknown>;
  const flattened = flattenObject(data);

  // Apply namespace prefix if provided
  if (namespace) {
    const namespaced: LocaleTranslations = new Map();
    for (const [key, entry] of flattened) {
      const namespacedKey = `${namespace}_${key}`;
      namespaced.set(namespacedKey, {
        ...entry,
        key: namespacedKey,
      });
    }
    return namespaced;
  }

  return flattened;
}

/**
 * Load and parse a JSON translation file from disk
 */
export async function loadJsonTranslations(
  filePath: string,
  namespace?: string
): Promise<LocaleTranslations> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Translation file not found: ${filePath}`);
  }
  const content = await file.text();
  return parseJsonTranslations(content, namespace);
}
