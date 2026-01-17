import { FC } from 'react';
import { Outlet, useRoutes } from 'react-router-dom';
import { GroupSidebar } from '@/components/navigation/GroupSidebar';
import { GroupContextProvider } from '@/contexts/GroupContext';
import { getModuleRoutes } from '@/routes';

/**
 * Group layout - wraps group-specific pages
 * Includes group sidebar with enabled modules
 * Provides GroupContext to all nested routes
 */
export const GroupLayout: FC = () => {
  const router = useRoutes(getModuleRoutes('group', 'element'));
  return (
    <GroupContextProvider>
      <div className="flex gap-6">
        {/* Desktop group sidebar */}
        <GroupSidebar className="hidden lg:flex" />

        {/* Group content */}
        <div className="flex-1">
           {router}
           <Outlet />
        </div>
      </div>
    </GroupContextProvider>
  );
};
