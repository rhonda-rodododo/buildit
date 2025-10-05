import { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Users, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleStore } from '@/stores/moduleStore';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';

export const MobileNav: FC = () => {
  const { registry } = useModuleStore();

  const coreLinks = [
    { to: '/app', label: 'Home', icon: Home, end: true },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/groups', label: 'Groups', icon: Users },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ];

  // Get all installed modules
  const modules = Array.from(registry.values()).map((entry) => entry.plugin);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">Menu</h2>
        <SheetClose asChild>
          <Button variant="ghost" size="icon">
            <X className="h-5 w-5" />
          </Button>
        </SheetClose>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Core Navigation */}
        <nav className="space-y-1">
          {coreLinks.map((link) => (
            <SheetClose key={link.to} asChild>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )
                }
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            </SheetClose>
          ))}
        </nav>

        {/* Installed Modules */}
        {modules.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground px-3">
              Modules
            </h3>
            <nav className="space-y-1">
              {modules.map((module) => (
                <div
                  key={module.metadata.id}
                  className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground"
                >
                  <span>{module.metadata.icon}</span>
                  {module.metadata.name}
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};
