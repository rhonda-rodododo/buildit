import { FC, createElement } from 'react';
import { NavLink } from 'react-router-dom';
import { Newspaper, MessageSquare, Users, UserPlus, Settings, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleStore } from '@/stores/moduleStore';
import { Separator } from '@/components/ui/separator';
import type { ModulePlugin } from '@/types/modules';

interface AppSidebarProps {
  className?: string;
}

/**
 * Get app-scoped routes from a module
 */
function getAppRoutes(module: ModulePlugin) {
  return (module.routes || []).filter((r) => r.scope === 'app');
}

/**
 * Check if module has any group-scoped routes
 */
function hasGroupRoutes(module: ModulePlugin) {
  return (module.routes || []).some((r) => r.scope === 'group' || !r.scope);
}

export const AppSidebar: FC<AppSidebarProps> = ({ className }) => {
  const { registry } = useModuleStore();

  const coreLinks = [
    { to: '/app', label: 'Feed', icon: Newspaper, end: true },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/friends', label: 'Friends', icon: UserPlus },
    { to: '/app/groups', label: 'Groups', icon: Users },
  ];

  // Get all installed modules
  const modules = Array.from(registry.values()).map((entry) => entry.plugin);

  // Separate modules with app-scoped routes from group-only modules
  const modulesWithAppRoutes = modules.filter((m) => getAppRoutes(m).length > 0);
  const groupOnlyModules = modules.filter(
    (m) => getAppRoutes(m).length === 0 && hasGroupRoutes(m)
  );

  return (
    <aside
      className={cn(
        'w-64 border-r bg-card p-4 flex flex-col gap-4 overflow-y-auto',
        className
      )}
    >
      {/* Core Navigation */}
      <nav className="space-y-1">
        {coreLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-muted'
              )
            }
          >
            {createElement(link.icon, { className: 'h-4 w-4' })}
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* App-scoped Module Routes */}
      {modulesWithAppRoutes.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
              Tools
            </h3>
            <nav className="space-y-1">
              {modulesWithAppRoutes.flatMap((module) =>
                getAppRoutes(module).map((route) => {
                  const Icon = module.metadata.icon;
                  return (
                    <NavLink
                      key={`${module.metadata.id}-${route.path}`}
                      to={`/app/${route.path}`}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted'
                        )
                      }
                      title={module.metadata.description}
                    >
                      {createElement(Icon, { className: 'h-4 w-4' })}
                      <span className="flex-1">{route.label || module.metadata.name}</span>
                    </NavLink>
                  );
                })
              )}
            </nav>
          </div>
        </>
      )}

      {/* Group-only modules indicator */}
      {groupOnlyModules.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
              Group Features
            </h3>
            <p className="text-xs text-muted-foreground px-3 pb-1">
              Available within groups
            </p>
            <nav className="space-y-1">
              {groupOnlyModules.slice(0, 5).map((module) => {
                const Icon = module.metadata.icon;
                return (
                  <NavLink
                    key={module.metadata.id}
                    to="/app/groups"
                    className="flex items-center gap-3 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                    title={`${module.metadata.name}: ${module.metadata.description}`}
                  >
                    {createElement(Icon, { className: 'h-4 w-4 flex-shrink-0' })}
                    <span className="truncate">{module.metadata.name}</span>
                  </NavLink>
                );
              })}
              {groupOnlyModules.length > 5 && (
                <NavLink
                  to="/app/groups"
                  className="flex items-center gap-3 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" />
                  <span>+{groupOnlyModules.length - 5} more in groups</span>
                </NavLink>
              )}
            </nav>
          </div>
        </>
      )}

      {/* Settings at bottom */}
      <div className="mt-auto">
        <Separator className="mb-4" />
        <NavLink
          to="/app/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-foreground hover:bg-muted'
            )
          }
        >
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
};
