import { FC } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { GroupSidebar } from '@/components/navigation/GroupSidebar';

/**
 * Group layout - wraps group-specific pages
 * Includes group sidebar with enabled modules
 */
export const GroupLayout: FC = () => {
  const { groupId } = useParams<{ groupId: string }>();

  if (!groupId) {
    return <div>No group selected</div>;
  }

  return (
    <div className="flex gap-6">
      {/* Desktop group sidebar */}
      <GroupSidebar groupId={groupId} className="hidden lg:flex" />

      {/* Group content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
};
