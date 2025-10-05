import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const NotFoundPage: FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>404 - Page Not Found</CardTitle>
          <CardDescription>
            The page you're looking for doesn't exist.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/app">Go to App</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
