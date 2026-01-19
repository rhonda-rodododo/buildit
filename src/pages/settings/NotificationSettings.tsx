import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const NotificationSettings: FC = () => {
  return (
    <div className="space-y-6">
      <PageMeta titleKey="common.notifications" descriptionKey="meta.notifications" path="/app/settings/notifications" />
      <Card>
        <CardHeader>
          <CardTitle>Notification Settings</CardTitle>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notification settings coming soon...
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
