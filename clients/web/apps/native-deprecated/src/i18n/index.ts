/**
 * i18n exports for native app
 */

import i18n from './config'

export {
  initializeI18n,
  changeLanguage,
  getCurrentLanguage,
  isRTLRestartNeeded,
  languages,
  resources,
  type LanguageCode,
} from './config'

// Re-export react-i18next hooks for convenience
export { useTranslation, Trans } from 'react-i18next'

// Default export for I18nextProvider
export default i18n
