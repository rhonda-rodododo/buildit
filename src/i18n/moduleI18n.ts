/**
 * Module i18n Utilities
 *
 * Provides lazy loading of module translations to support code splitting.
 * Each module can register its own translations that load when the module loads.
 */

import i18n from 'i18next';

// Track which module namespaces have been loaded
const loadedNamespaces = new Set<string>();

/**
 * Module translation bundle type
 * Each locale maps to its translations for that module
 */
export interface ModuleTranslations {
  en: Record<string, unknown>;
  es?: Record<string, unknown>;
  fr?: Record<string, unknown>;
  ar?: Record<string, unknown>;
}

/**
 * Register module translations dynamically
 * Call this when a module is loaded to add its translations
 *
 * @param moduleId - The module identifier (used as namespace)
 * @param translations - Translation bundles for each locale
 *
 * @example
 * // In events module index.ts
 * import { registerModuleTranslations } from '@/i18n/moduleI18n';
 * import translations from './i18n';
 *
 * registerModuleTranslations('events', translations);
 */
export function registerModuleTranslations(
  moduleId: string,
  translations: ModuleTranslations
): void {
  // Skip if already loaded
  if (loadedNamespaces.has(moduleId)) {
    return;
  }

  // Add translations for each locale
  const locales = ['en', 'es', 'fr', 'ar'] as const;

  for (const locale of locales) {
    const localeTranslations = translations[locale];
    if (localeTranslations) {
      // Add to existing resource bundle under the module namespace
      i18n.addResourceBundle(
        locale,
        moduleId, // namespace = moduleId
        localeTranslations,
        true, // deep merge
        true  // overwrite
      );
    }
  }

  loadedNamespaces.add(moduleId);
}

/**
 * Check if module translations are loaded
 */
export function isModuleLoaded(moduleId: string): boolean {
  return loadedNamespaces.has(moduleId);
}

/**
 * Get all loaded module namespaces
 */
export function getLoadedNamespaces(): string[] {
  return Array.from(loadedNamespaces);
}

/**
 * Create a typed translation hook for a specific module
 * Returns the t function scoped to the module namespace
 *
 * @example
 * // In events module
 * import { useModuleTranslation } from '@/i18n/moduleI18n';
 *
 * function EventsView() {
 *   const { t } = useModuleTranslation('events');
 *   return <h1>{t('title')}</h1>; // Looks up 'events:title'
 * }
 */
export function createModuleTranslationHook(moduleId: string) {
  return function useModuleTranslation() {
    // This will be used with react-i18next's useTranslation
    // The namespace parameter scopes all lookups to the module
    return { namespace: moduleId };
  };
}

/**
 * Helper to create module translations structure
 * Ensures type safety for module translation files
 */
export function defineModuleTranslations<T extends Record<string, unknown>>(
  translations: {
    en: T;
    es?: Partial<T>;
    fr?: Partial<T>;
    ar?: Partial<T>;
  }
): ModuleTranslations {
  return translations as ModuleTranslations;
}

/**
 * Preload module translations before component render
 * Useful for critical modules that need translations immediately
 */
export async function preloadModuleTranslations(
  moduleId: string,
  loadTranslations: () => Promise<{ default: ModuleTranslations }>
): Promise<void> {
  if (loadedNamespaces.has(moduleId)) {
    return;
  }

  const { default: translations } = await loadTranslations();
  registerModuleTranslations(moduleId, translations);
}
