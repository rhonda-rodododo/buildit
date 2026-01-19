import { FC } from 'react';
import { useParams } from 'react-router-dom';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const GroupDashboard: FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  return (
    <div className="space-y-6">
      <PageMeta titleKey="groups.title" descriptionKey="meta.groups" />
      <Card>
        <CardHeader>
          <CardTitle>Group Dashboard</CardTitle>
          <CardDescription>
            Group ID: {groupId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Welcome to your group! Use the sidebar to navigate between modules.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
