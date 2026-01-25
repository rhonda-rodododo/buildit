import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { languages, type LanguageCode } from '@/i18n/config'

interface LanguageSwitcherProps {
  variant?: 'ghost' | 'outline';
}

export function LanguageSwitcher({ variant = 'ghost' }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation()

  const handleLanguageChange = (languageCode: LanguageCode) => {
    i18n.changeLanguage(languageCode)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size="icon" className="h-9 w-9">
          <Languages className="h-4 w-4" />
          <span className="sr-only">{t('common.language.switch')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            className={`flex items-center justify-between ${
              i18n.language === language.code ? 'bg-accent' : ''
            }`}
          >
            <span>{language.nativeName}</span>
            {i18n.language === language.code && (
              <span className="ml-2 text-xs">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
