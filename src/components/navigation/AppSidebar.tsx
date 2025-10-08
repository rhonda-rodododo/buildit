import { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { Newspaper, MessageSquare, Users, UserPlus, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleStore } from '@/stores/moduleStore';
import { Separator } from '@/components/ui/separator';

interface AppSidebarProps {
  className?: string;
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
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Installed Modules */}
      {modules.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
              Modules
            </h3>
            <nav className="space-y-1">
              {modules.map((module) => {
                const Icon = module.metadata.icon;
                return (
                  <div
                    key={module.metadata.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-not-allowed"
                    title={module.metadata.description}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{module.metadata.name}</span>
                  </div>
                );
              })}
            </nav>
          </div>
        </>
      )}

      {/* Settings at bottom */}
      <div>
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
