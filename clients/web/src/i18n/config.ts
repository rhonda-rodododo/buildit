import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '@buildit/i18n/locales/en.json'
import es from '@buildit/i18n/locales/es.json'
import fr from '@buildit/i18n/locales/fr.json'
import ar from '@buildit/i18n/locales/ar.json'
import zhCN from '@buildit/i18n/locales/zh-CN.json'
import vi from '@buildit/i18n/locales/vi.json'
import ko from '@buildit/i18n/locales/ko.json'
import ru from '@buildit/i18n/locales/ru.json'
import pt from '@buildit/i18n/locales/pt.json'
import ht from '@buildit/i18n/locales/ht.json'
import tl from '@buildit/i18n/locales/tl.json'

export const defaultNS = 'translation'

export const resources = {
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
  fr: {
    translation: fr,
  },
  ar: {
    translation: ar,
  },
  'zh-CN': {
    translation: zhCN,
  },
  vi: {
    translation: vi,
  },
  ko: {
    translation: ko,
  },
  ru: {
    translation: ru,
  },
  pt: {
    translation: pt,
  },
  ht: {
    translation: ht,
  },
  tl: {
    translation: tl,
  },
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

// Get saved language from localStorage or use default
// Guard against environments where localStorage is not available (e.g. test environments)
const savedLanguage = (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
  ? localStorage.getItem('i18n-language')
  : null) as LanguageCode | null
const initialLanguage = savedLanguage && savedLanguage in resources ? savedLanguage : 'en'

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    defaultNS,
    // Support multiple namespaces for module translations
    ns: [defaultNS],
    // Allow module namespaces to be added dynamically
    partialBundledLanguages: true,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  })

// Save language preference when it changes
i18n.on('languageChanged', (lng) => {
  localStorage.setItem('i18n-language', lng)

  // Update document direction for RTL support
  const language = languages.find(l => l.code === lng)
  document.documentElement.dir = language ? language.dir : 'ltr'
  document.documentElement.lang = lng
})

// Set initial direction
const initialLang = languages.find(l => l.code === initialLanguage)
document.documentElement.dir = initialLang ? initialLang.dir : 'ltr'
document.documentElement.lang = initialLanguage

export default i18n
