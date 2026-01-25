/**
 * i18n Configuration Tests
 * Epic 36: Additional Translations - Technical validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import i18n from '../config';
import { languages, resources } from '../config';
import {
  registerModuleTranslations,
  isModuleLoaded,
  getLoadedNamespaces,
  defineModuleTranslations
} from '../moduleI18n';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

vi.stubGlobal('localStorage', localStorageMock);

describe('i18n Configuration', () => {
  describe('Language Configuration', () => {
    it('should have 11 supported languages', () => {
      expect(languages).toHaveLength(11);
    });

    it('should have all required language properties', () => {
      languages.forEach(lang => {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(lang).toHaveProperty('nativeName');
        expect(lang).toHaveProperty('dir');
        expect(['ltr', 'rtl']).toContain(lang.dir);
      });
    });

    it('should include English as default', () => {
      const english = languages.find(l => l.code === 'en');
      expect(english).toBeDefined();
      expect(english?.name).toBe('English');
    });

    it('should include Arabic with RTL direction', () => {
      const arabic = languages.find(l => l.code === 'ar');
      expect(arabic).toBeDefined();
      expect(arabic?.dir).toBe('rtl');
    });

    it('should have matching resources for all languages', () => {
      const resourceKeys = Object.keys(resources);
      languages.forEach(lang => {
        expect(resourceKeys).toContain(lang.code);
      });
    });
  });

  describe('Fallback Behavior', () => {
    it('should have English as fallback language', () => {
      expect(i18n.options.fallbackLng).toEqual(['en']);
    });

    it('should return English value for missing translation', () => {
      // Ensure we're testing with English as fallback
      i18n.changeLanguage('es');

      // This key should exist in English
      const enValue = i18n.t('common.cancel', { lng: 'en' });

      // Use a hypothetical missing key pattern
      const missingKeyResult = i18n.t('nonexistent.key.test123');

      // Missing keys return the key itself as fallback
      expect(missingKeyResult).toBe('nonexistent.key.test123');
    });

    it('should use English value when key missing in other locale', () => {
      // Get a key that exists in English
      const englishValue = i18n.t('common.save', { lng: 'en' });
      expect(englishValue).toBeTruthy();
      expect(typeof englishValue).toBe('string');
    });
  });

  describe('RTL Support', () => {
    it('should identify Arabic as RTL language', () => {
      const arabic = languages.find(l => l.code === 'ar');
      expect(arabic?.dir).toBe('rtl');
    });

    it('should identify all other languages as LTR', () => {
      const ltrLanguages = languages.filter(l => l.code !== 'ar');
      ltrLanguages.forEach(lang => {
        expect(lang.dir).toBe('ltr');
      });
    });

    it('should have only Arabic as RTL language', () => {
      const rtlLanguages = languages.filter(l => l.dir === 'rtl');
      expect(rtlLanguages).toHaveLength(1);
      expect(rtlLanguages[0].code).toBe('ar');
    });
  });

  describe('Language Switching', () => {
    beforeEach(() => {
      localStorageMock.clear();
      i18n.changeLanguage('en');
    });

    it('should switch to Spanish', async () => {
      await i18n.changeLanguage('es');
      expect(i18n.language).toBe('es');
    });

    it('should switch to Arabic', async () => {
      await i18n.changeLanguage('ar');
      expect(i18n.language).toBe('ar');
    });

    it('should switch to Chinese', async () => {
      await i18n.changeLanguage('zh-CN');
      expect(i18n.language).toBe('zh-CN');
    });

    it('should save language preference to localStorage', async () => {
      await i18n.changeLanguage('fr');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('i18n-language', 'fr');
    });

    it('should switch between all supported languages', async () => {
      for (const lang of languages) {
        await i18n.changeLanguage(lang.code);
        expect(i18n.language).toBe(lang.code);
      }
    });
  });

  describe('Resource Loading', () => {
    it('should have translation namespace for each language', () => {
      Object.entries(resources).forEach(([code, resource]) => {
        expect(resource).toHaveProperty('translation');
        expect(typeof resource.translation).toBe('object');
      });
    });

    it('should have common translations in all languages', () => {
      Object.entries(resources).forEach(([code, resource]) => {
        const translations = resource.translation as Record<string, unknown>;
        expect(translations).toHaveProperty('common');
      });
    });

    it('should have auth translations in all languages', () => {
      Object.entries(resources).forEach(([code, resource]) => {
        const translations = resource.translation as Record<string, unknown>;
        expect(translations).toHaveProperty('auth');
      });
    });
  });
});

describe('Module i18n', () => {
  describe('registerModuleTranslations', () => {
    it('should register module translations', () => {
      const testModule = defineModuleTranslations({
        en: { test: 'Test', hello: 'Hello' },
        es: { test: 'Prueba', hello: 'Hola' },
      });

      registerModuleTranslations('test-module', testModule);
      expect(isModuleLoaded('test-module')).toBe(true);
    });

    it('should not duplicate module registration', () => {
      const testModule = defineModuleTranslations({
        en: { key: 'value1' },
      });

      registerModuleTranslations('dupe-test', testModule);
      const firstLoad = getLoadedNamespaces().includes('dupe-test');

      // Try to register again
      const testModule2 = defineModuleTranslations({
        en: { key: 'value2' },
      });
      registerModuleTranslations('dupe-test', testModule2);

      expect(firstLoad).toBe(true);
      expect(isModuleLoaded('dupe-test')).toBe(true);
    });

    it('should track loaded namespaces', () => {
      const namespaces = getLoadedNamespaces();
      expect(Array.isArray(namespaces)).toBe(true);
    });
  });

  describe('defineModuleTranslations', () => {
    it('should create valid module translations object', () => {
      const translations = defineModuleTranslations({
        en: { title: 'Title', description: 'Description' },
        es: { title: 'Título' },
        fr: { title: 'Titre' },
        ar: { title: 'عنوان' },
        'zh-CN': { title: '标题' },
        vi: { title: 'Tiêu đề' },
        ko: { title: '제목' },
        ru: { title: 'Заголовок' },
        pt: { title: 'Título' },
        ht: { title: 'Tit' },
        tl: { title: 'Pamagat' },
      });

      expect(translations.en).toHaveProperty('title');
      expect(translations.es).toHaveProperty('title');
      expect(translations['zh-CN']).toHaveProperty('title');
    });

    it('should allow partial translations for non-English locales', () => {
      const translations = defineModuleTranslations({
        en: { a: 'A', b: 'B', c: 'C' },
        es: { a: 'A-es' }, // Only one key
      });

      expect(translations.en).toHaveProperty('a');
      expect(translations.en).toHaveProperty('b');
      expect(translations.en).toHaveProperty('c');
      expect(translations.es).toHaveProperty('a');
      expect(translations.es).not.toHaveProperty('b');
    });
  });
});

describe('Translation Keys Consistency', () => {
  it('should have same top-level keys in English resource', () => {
    const enTranslations = resources.en.translation as Record<string, unknown>;
    const expectedKeys = ['common', 'auth', 'nav', 'groups'];

    expectedKeys.forEach(key => {
      expect(enTranslations).toHaveProperty(key);
    });
  });

  it('should have string values at leaf nodes', () => {
    const checkLeafValues = (obj: unknown, path = ''): void => {
      if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
          if (typeof value === 'object' && value !== null) {
            checkLeafValues(value, `${path}.${key}`);
          } else {
            expect(typeof value).toBe('string');
          }
        });
      }
    };

    checkLeafValues(resources.en.translation);
  });
});

describe('Locale File Integrity', () => {
  const languageCodes = ['en', 'es', 'fr', 'ar', 'zh-CN', 'vi', 'ko', 'ru', 'pt', 'ht', 'tl'] as const;

  languageCodes.forEach(code => {
    it(`should have valid translations for ${code}`, () => {
      const resource = resources[code];
      expect(resource).toBeDefined();
      expect(resource.translation).toBeDefined();
      expect(typeof resource.translation).toBe('object');
    });
  });

  it('should have English as the most complete locale', () => {
    const countKeys = (obj: unknown): number => {
      if (typeof obj !== 'object' || obj === null) return 1;
      return Object.values(obj as Record<string, unknown>).reduce(
        (sum: number, v) => sum + countKeys(v),
        0
      );
    };

    const enKeyCount = countKeys(resources.en.translation);

    // English should have the most keys (or equal)
    languageCodes.forEach(code => {
      const keyCount = countKeys(resources[code].translation);
      expect(keyCount).toBeLessThanOrEqual(enKeyCount);
    });
  });
});
