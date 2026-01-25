import { FC } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const NotFoundPage: FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <PageMeta title="404" descriptionKey="meta.notFound" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>404 - {t('common.error')}</CardTitle>
          <CardDescription>
            {t('meta.notFound')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/app">{t('common.back')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
