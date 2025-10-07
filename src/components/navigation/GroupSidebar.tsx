import { FC, createElement } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Users, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGroupContext } from '@/contexts/GroupContext';
import { Skeleton } from '@/components/ui/skeleton';

interface GroupSidebarProps {
  className?: string;
}

export const GroupSidebar: FC<GroupSidebarProps> = ({ className }) => {
  const { groupId, group, availableModules, isModuleEnabled, isLoading, error } = useGroupContext();

  if (isLoading) {
    return (
      <aside className={cn('w-64 border-r bg-muted/10 p-4 space-y-4', className)}>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>
    );
  }

  if (error || !group) {
    return (
      <aside className={cn('w-64 border-r bg-muted/10 p-4', className)}>
        <div className="text-sm text-muted-foreground">
          {error || 'Group not found'}
        </div>
      </aside>
    );
  }

  // Get routes from enabled modules
  const enabledModuleRoutes = availableModules
    .filter(module => isModuleEnabled(module.metadata.id))
    .flatMap(module =>
      (module.routes || [])
        .filter(route => route.scope === 'group')
        .map(route => ({
          path: route.path,
          label: route.label || module.metadata.name,
          icon: module.metadata.icon,
          moduleId: module.metadata.id,
        }))
    );

  return (
    <aside className={cn('w-64 border-r bg-muted/10 p-4 space-y-6', className)}>
      {/* Group name */}
      <div className="px-3">
        <h2 className="text-lg font-semibold truncate">{group.name}</h2>
        <p className="text-xs text-muted-foreground truncate">{group.description}</p>
      </div>

      <nav className="space-y-1">
        {/* Dashboard link */}
        <NavLink
          to={`/app/groups/${groupId}`}
          end
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )
          }
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </NavLink>

        {/* Feed link */}
        <NavLink
          to={`/app/groups/${groupId}/feed`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )
          }
        >
          <MessageSquare className="h-4 w-4" />
          Feed
        </NavLink>

        {/* Members link */}
        <NavLink
          to={`/app/groups/${groupId}/members`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )
          }
        >
          <Users className="h-4 w-4" />
          Members
        </NavLink>

        {/* Divider */}
        {enabledModuleRoutes.length > 0 && (
          <div className="border-t my-2" />
        )}

        {/* Module route links */}
        {enabledModuleRoutes.map((route) => (
          <NavLink
            key={route.path}
            to={`/app/groups/${groupId}/${route.path}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )
            }
          >
            {createElement(route.icon, { className: 'h-4 w-4 flex-shrink-0' })}
            <span className="truncate">{route.label}</span>
          </NavLink>
        ))}

        {/* Divider */}
        <div className="border-t my-2" />

        {/* Settings link */}
        <NavLink
          to={`/app/groups/${groupId}/settings`}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </nav>
    </aside>
  );
};
