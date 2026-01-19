import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ModeToggle } from '@/components/mode-toggle';
import { ColorThemePicker } from '@/components/color-theme-picker';

export const PreferencesSettings: FC = () => {
  return (
    <div className="space-y-6">
      <PageMeta titleKey="common.settings" descriptionKey="meta.preferences" path="/app/settings/preferences" />
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Manage your app preferences and appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <LanguageSwitcher />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Color Mode</label>
            <ModeToggle />
          </div>
          <div className="space-y-3">
            <label className="text-sm font-medium">Theme</label>
            <ColorThemePicker />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
