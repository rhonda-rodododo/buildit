/**
 * TypeScript Module Translation Parser
 *
 * Parses module translation files that use defineModuleTranslations()
 * and extracts the translation objects for each locale.
 */

import type { LocaleTranslations, ModuleTranslationDef, SupportedLocale } from '../types';
import { flattenObject } from './json';

/**
 * Extract the object literal from a defineModuleTranslations() call
 *
 * This uses a simple regex-based approach that works for the standard format:
 *
 * export default defineModuleTranslations({
 *   en: { ... },
 *   es: { ... },
 * });
 */
export function parseModuleTranslations(
  content: string,
  moduleId: string
): ModuleTranslationDef {
  // Remove comments to avoid false matches
  const cleanContent = content
    .replace(/\/\*[\s\S]*?\*\//g, '') // Block comments
    .replace(/\/\/.*$/gm, ''); // Line comments

  // Find the defineModuleTranslations call
  const match = cleanContent.match(
    /defineModuleTranslations\s*\(\s*(\{[\s\S]*\})\s*\)/
  );

  if (!match) {
    throw new Error(
      `Could not find defineModuleTranslations() in module: ${moduleId}`
    );
  }

  const objectLiteral = match[1];

  // Parse the object literal using a safe eval approach
  // We use Function constructor since Bun doesn't have vm module
  try {
    const translations = parseObjectLiteral(objectLiteral);
    return {
      moduleId,
      translations: translations as Record<string, Record<string, unknown>>,
    };
  } catch (error) {
    throw new Error(
      `Failed to parse translations for module ${moduleId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse a JavaScript object literal string into an actual object
 *
 * This handles:
 * - Single-quoted strings
 * - Template literals (simple ones)
 * - Nested objects
 * - Trailing commas
 */
function parseObjectLiteral(literal: string): Record<string, unknown> {
  // Convert to valid JSON-like format
  let jsonish = literal
    // Remove any leading/trailing whitespace
    .trim()
    // Convert single quotes to double quotes (but not escaped ones or those in strings)
    .replace(/'/g, '"')
    // Remove trailing commas before closing braces/brackets
    .replace(/,(\s*[}\]])/g, '$1')
    // Handle unquoted keys (convert foo: to "foo":)
    .replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

  try {
    return JSON.parse(jsonish);
  } catch {
    // If that doesn't work, try a more aggressive approach
    // This handles edge cases like template literals
    try {
      // Use Function to evaluate as JS object
      const fn = new Function(`return (${literal});`);
      return fn() as Record<string, unknown>;
    } catch (evalError) {
      throw new Error(
        `Cannot parse object literal: ${evalError instanceof Error ? evalError.message : String(evalError)}`
      );
    }
  }
}

/**
 * Convert module translations to flattened format for a specific locale
 */
export function getModuleTranslationsForLocale(
  def: ModuleTranslationDef,
  locale: SupportedLocale
): LocaleTranslations {
  const localeData = def.translations[locale];

  if (!localeData || Object.keys(localeData).length === 0) {
    return new Map();
  }

  // Flatten with module namespace prefix
  return flattenObject(localeData as Record<string, unknown>, def.moduleId);
}

/**
 * Load and parse a module translation file
 */
export async function loadModuleTranslations(
  filePath: string,
  moduleId: string
): Promise<ModuleTranslationDef> {
  const file = Bun.file(filePath);
  if (!(await file.exists())) {
    throw new Error(`Module translation file not found: ${filePath}`);
  }
  const content = await file.text();
  return parseModuleTranslations(content, moduleId);
}
