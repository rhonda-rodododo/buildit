import { FC, createElement } from 'react';
import { NavLink } from 'react-router-dom';
import { Newspaper, MessageSquare, Users, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useModuleStore } from '@/stores/moduleStore';
import { Separator } from '@/components/ui/separator';
import type { ModulePlugin } from '@/types/modules';

interface AppSidebarProps {
  className?: string;
  /** Optional callback when a navigation link is clicked (useful for closing mobile sheets) */
  onLinkClick?: () => void;
}

/**
 * Get app-scoped routes from a module
 */
function getAppRoutes(module: ModulePlugin) {
  return (module.routes || []).filter((r) => r.scope === 'app');
}

export const AppSidebar: FC<AppSidebarProps> = ({ className, onLinkClick }) => {
  const { t } = useTranslation();
  const { registry } = useModuleStore();

  // Core navigation links (non-module pages)
  // Note: Friends is now loaded dynamically from the friends module
  const coreLinks = [
    { to: '/app', labelKey: 'nav.feed', label: 'Feed', icon: Newspaper, end: true },
    { to: '/app/messages', labelKey: 'nav.messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/groups', labelKey: 'nav.groups', label: 'Groups', icon: Users },
  ];

  // Get all installed modules
  const modules = Array.from(registry.values()).map((entry) => entry.plugin);

  // Only show modules with app-scoped routes
  // Group-only modules appear in GroupSidebar when viewing a group
  const modulesWithAppRoutes = modules.filter((m) => getAppRoutes(m).length > 0);

  return (
    <aside
      className={cn(
        'w-64 border-r bg-card p-4 flex flex-col gap-4',
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
            onClick={onLinkClick}
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
            {t(link.labelKey, link.label)}
          </NavLink>
        ))}
      </nav>

      {/* App-scoped Module Routes */}
      {modulesWithAppRoutes.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
              {t('nav.tools', 'Tools')}
            </h3>
            <nav className="space-y-1">
              {modulesWithAppRoutes.flatMap((module) =>
                getAppRoutes(module).map((route) => {
                  const Icon = module.metadata.icon;
                  return (
                    <NavLink
                      key={`${module.metadata.id}-${route.path}`}
                      to={`/app/${route.path}`}
                      onClick={onLinkClick}
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

      {/* Settings at bottom */}
      <div className="mt-auto">
        <Separator className="mb-4" />
        <NavLink
          to="/app/settings"
          onClick={onLinkClick}
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
          {t('nav.settings', 'Settings')}
        </NavLink>
      </div>
    </aside>
  );
};
