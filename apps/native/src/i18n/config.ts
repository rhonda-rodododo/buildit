/**
 * i18n Configuration for React Native
 *
 * Shares translation resources with the web app via symlinked locales folder.
 * Uses SecureStorage for language preference persistence.
 */

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { I18nManager, Platform } from 'react-native'
import { getSecureItem, setSecureItem, STORAGE_KEYS } from '../storage/secureStorage'

// Import translations from local locales folder
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ar from './locales/ar.json'
import zhCN from './locales/zh-CN.json'
import vi from './locales/vi.json'
import ko from './locales/ko.json'
import ru from './locales/ru.json'
import pt from './locales/pt.json'
import ht from './locales/ht.json'
import tl from './locales/tl.json'

export const defaultNS = 'translation'

export const resources = {
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  ar: { translation: ar },
  'zh-CN': { translation: zhCN },
  vi: { translation: vi },
  ko: { translation: ko },
  ru: { translation: ru },
  pt: { translation: pt },
  ht: { translation: ht },
  tl: { translation: tl },
} as const

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', dir: 'ltr' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', dir: 'ltr' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', dir: 'ltr' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', dir: 'ltr' },
  { code: 'ht', name: 'Haitian Creole', nativeName: 'Kreyòl Ayisyen', dir: 'ltr' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Tagalog', dir: 'ltr' },
] as const

export type LanguageCode = keyof typeof resources

/**
 * Get saved language from storage
 */
async function getSavedLanguage(): Promise<LanguageCode | null> {
  try {
    const saved = await getSecureItem(STORAGE_KEYS.LANGUAGE)
    if (saved && saved in resources) {
      return saved as LanguageCode
    }
  } catch (error) {
    console.warn('Failed to get saved language:', error)
  }
  return null
}

/**
 * Save language preference to storage
 */
async function saveLanguage(lng: string): Promise<void> {
  try {
    await setSecureItem(STORAGE_KEYS.LANGUAGE, lng)
  } catch (error) {
    console.warn('Failed to save language:', error)
  }
}

/**
 * Update RTL layout direction
 */
function updateRTLDirection(lng: string): void {
  const language = languages.find((l) => l.code === lng)
  const isRTL = language?.dir === 'rtl'

  if (Platform.OS !== 'web') {
    // On native, we need to set RTL mode
    if (I18nManager.isRTL !== isRTL) {
      I18nManager.allowRTL(isRTL)
      I18nManager.forceRTL(isRTL)
      // Note: Changes require app restart to take effect
    }
  }
}

// Initialize with default language
i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  ns: [defaultNS],
  partialBundledLanguages: true,
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  react: {
    useSuspense: false, // Disable suspense for React Native compatibility
  },
})

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  saveLanguage(lng)
  updateRTLDirection(lng)
})

/**
 * Initialize i18n with saved language preference
 * Call this on app startup
 */
export async function initializeI18n(): Promise<void> {
  const savedLng = await getSavedLanguage()
  if (savedLng) {
    await i18n.changeLanguage(savedLng)
    updateRTLDirection(savedLng)
  }
}

/**
 * Change app language
 */
export async function changeLanguage(lng: LanguageCode): Promise<void> {
  await i18n.changeLanguage(lng)
}

/**
 * Get current language info
 */
export function getCurrentLanguage() {
  const code = i18n.language as LanguageCode
  return languages.find((l) => l.code === code) || languages[0]
}

/**
 * Check if RTL restart is needed
 */
export function isRTLRestartNeeded(): boolean {
  const language = getCurrentLanguage()
  const isRTL = language.dir === 'rtl'
  return Platform.OS !== 'web' && I18nManager.isRTL !== isRTL
}

export default i18n
