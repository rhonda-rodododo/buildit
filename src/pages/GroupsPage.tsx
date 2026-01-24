import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { GroupsView } from '@/components/groups/GroupsView';

export const GroupsPage: FC = () => {
  return (
    <div className="h-full flex flex-col">
      <PageMeta titleKey="groups.title" descriptionKey="meta.groups" path="/app/groups" />
      <GroupsView />
    </div>
  );
};
