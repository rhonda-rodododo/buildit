import { FC, createElement } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleStore } from '@/stores/moduleStore';

interface GroupSidebarProps {
  groupId: string;
  className?: string;
}

export const GroupSidebar: FC<GroupSidebarProps> = ({ groupId, className }) => {
  const { getGroupModules, registry } = useModuleStore();

  // Get enabled modules for this group
  const moduleInstances = getGroupModules(groupId).filter(
    (instance) => instance.state === 'enabled'
  );

  const enabledModules = moduleInstances
    .map((instance) => registry.get(instance.moduleId)?.plugin)
    .filter((plugin): plugin is NonNullable<typeof plugin> => plugin !== undefined);

  return (
    <aside
      className={cn(
        'w-64 border-r bg-muted/10 p-4 space-y-4',
        className
      )}
    >
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

        {/* Module links */}
        {enabledModules.map((module) => (
          <NavLink
            key={module.metadata.id}
            to={`/app/groups/${groupId}/${module.metadata.id}`}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )
            }
          >
            {createElement(module.metadata.icon, { className: 'h-5 w-5 flex-shrink-0' })}
            <span>{module.metadata.name}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
