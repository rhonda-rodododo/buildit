import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ModeToggle } from '@/components/mode-toggle';
import { ColorThemePicker } from '@/components/color-theme-picker';
import { SchemaStatusList } from '@/components/schema/SchemaStatusCard';

export const PreferencesSettings: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageMeta titleKey="common.settings" descriptionKey="meta.preferences" path="/app/settings/preferences" />
      <Card>
        <CardHeader>
          <CardTitle>{t('preferences.title')}</CardTitle>
          <CardDescription>
            {t('preferences.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('preferences.language')}</label>
            <LanguageSwitcher />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('preferences.colorMode')}</label>
            <ModeToggle />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">{t('preferences.theme')}</label>
            <ColorThemePicker />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schema Versions</CardTitle>
          <CardDescription>
            Module schema versions installed on this device. Schema updates enable new features
            and ensure compatibility with other users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SchemaStatusList />
        </CardContent>
      </Card>
    </div>
  );
};
