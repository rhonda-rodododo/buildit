import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const NotificationSettings: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <PageMeta titleKey="common.notifications" descriptionKey="meta.notifications" path="/app/settings/notifications" />
      <Card>
        <CardHeader>
          <CardTitle>{t('notifications.title')}</CardTitle>
          <CardDescription>
            {t('notifications.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('notifications.comingSoon')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
