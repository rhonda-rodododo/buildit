import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const GroupDashboard: FC = () => {
  const { t } = useTranslation();
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <PageMeta titleKey="groups.title" descriptionKey="meta.groups" />
      <Card>
        <CardHeader>
          <CardTitle>{t('groupDashboard.title')}</CardTitle>
          <CardDescription>
            {t('groupDashboard.groupId', { id: groupId })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('groupDashboard.welcome')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
