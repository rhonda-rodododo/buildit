import { FC } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ModeToggle } from '@/components/mode-toggle';

export const PreferencesSettings: FC = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
          <CardDescription>
            Manage your app preferences and appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Language</label>
            <LanguageSwitcher />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
            <ModeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
