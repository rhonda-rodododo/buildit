/**
 * i18n Codegen Types
 */

/** Supported locales across the platform */
export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'ar',
  'zh-CN',
  'vi',
  'ko',
  'ru',
  'pt',
  'ht',
  'tl',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Locale mappings for platform-specific codes */
export const LOCALE_MAPPINGS = {
  // Android uses different format for some locales
  android: {
    'zh-CN': 'zh-rCN',
  } as Record<string, string>,
  // iOS uses different format for some locales
  ios: {
    'zh-CN': 'zh-Hans',
  } as Record<string, string>,
};

/** Flattened translation entry */
export interface TranslationEntry {
  key: string;
  value: string;
  comment?: string;
  isPlural?: boolean;
  pluralForms?: Record<string, string>;
}

/** Translations for a single locale */
export type LocaleTranslations = Map<string, TranslationEntry>;

/** All translations indexed by locale */
export type AllTranslations = Map<SupportedLocale, LocaleTranslations>;

/** Source type for tracking where translations came from */
export type SourceType = 'core' | 'module' | 'mobile';

/** Translation source metadata */
export interface TranslationSource {
  type: SourceType;
  path: string;
  namespace?: string;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  key: string;
  locale: SupportedLocale;
  message: string;
}

export interface ValidationWarning {
  key: string;
  locale: SupportedLocale;
  message: string;
}

/** Generator options */
export interface GeneratorOptions {
  outputDir: string;
  sourceLocale: SupportedLocale;
  generateComments: boolean;
  validateOnly: boolean;
}

/** Module translation definition from TypeScript files */
export interface ModuleTranslationDef {
  moduleId: string;
  translations: Record<string, Record<string, unknown>>;
}
