import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const ErrorBoundary: FC = () => {
  const { t } = useTranslation();
  const error = useRouteError();

  let errorMessage: string;
  let errorStatus: string | number = t('common.error');

  if (isRouteErrorResponse(error)) {
    errorStatus = error.status;
    errorMessage = error.statusText || error.data?.message || t('common.anErrorOccurred');
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = t('common.unknownError');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{errorStatus}</CardTitle>
          <CardDescription>{t('common.somethingWentWrong')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/app">{t('common.goToApp')}</Link>
            </Button>
            <Button onClick={() => window.location.reload()}>
              {t('common.reloadPage')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
