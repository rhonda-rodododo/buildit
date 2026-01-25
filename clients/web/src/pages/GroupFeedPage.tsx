import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { useGroupContext } from '@/contexts/GroupContext';
import { PageMeta } from '@/components/PageMeta';
import { ActivityFeed } from '@/components/feed/ActivityFeed';
import { PostComposer } from '@/modules/microblogging/components/PostComposer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Group Feed Page
 * Shows activity feed filtered to current group
 */
export const GroupFeedPage: FC = () => {
  const { t } = useTranslation();
  const { group, groupId, isLoading } = useGroupContext();

  if (isLoading) {
    return <div>{t('groupFeedPage.loading')}</div>;
  }

  if (!group) {
    return <div>{t('groupFeedPage.notFound')}</div>;
  }

  return (
    <div className="h-full p-4 space-y-6 overflow-y-auto">
      <PageMeta
        title={`${group.name} - ${t('groupFeedPage.feedSuffix')}`}
        descriptionKey="meta.groups"
        path={`/app/groups/${groupId}/feed`}
      />
      <div>
        <h1 className="text-3xl font-bold">{group.name} - {t('groupFeedPage.feedSuffix')}</h1>
        <p className="text-muted-foreground">
          {t('groupFeedPage.subtitle')}
        </p>
      </div>

      {/* Post composer */}
      <Card>
        <CardHeader>
          <CardTitle>{t('groupFeedPage.shareUpdate')}</CardTitle>
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
