import { FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { GroupsView } from '@/components/groups/GroupsView';

export const GroupsPage: FC = () => {
  return (
    <>
      <PageMeta titleKey="groups.title" descriptionKey="meta.groups" path="/app/groups" />
      <GroupsView />
    </>
  );
};
