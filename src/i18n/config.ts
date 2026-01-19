import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import ar from './locales/ar.json'

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
} as const

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl' },
] as const

export type LanguageCode = keyof typeof resources

// Get saved language from localStorage or use default
const savedLanguage = localStorage.getItem('i18n-language') as LanguageCode | null
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
