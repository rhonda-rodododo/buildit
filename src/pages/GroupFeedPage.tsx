import { FC } from 'react';
import { useGroupContext } from '@/contexts/GroupContext';
import { ActivityFeed } from '@/components/feed/ActivityFeed';
import { PostComposer } from '@/modules/microblogging/components/PostComposer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Group Feed Page
 * Shows activity feed filtered to current group
 */
export const GroupFeedPage: FC = () => {
  const { group, groupId, isLoading } = useGroupContext();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!group) {
    return <div>Group not found</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{group.name} - Feed</h1>
        <p className="text-muted-foreground">
          Activity and updates from this group
        </p>
      </div>

      {/* Post composer */}
      <Card>
        <CardHeader>
          <CardTitle>Share an update</CardTitle>
        </CardHeader>
        <CardContent>
          <PostComposer />
        </CardContent>
      </Card>

      {/* Activity feed filtered to this group */}
      <ActivityFeed groupId={groupId} />
    </div>
  );
};
