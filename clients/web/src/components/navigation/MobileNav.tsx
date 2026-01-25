import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { Home, MessageSquare, Users, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleStore } from '@/stores/moduleStore';
import { Button } from '@/components/ui/button';
import { SheetClose } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

export const MobileNav: FC = () => {
  const { t } = useTranslation();
  const { registry } = useModuleStore();

  const coreLinks = [
    { to: '/app', label: t('mobileNav.home'), icon: Home, end: true },
    { to: '/app/messages', label: t('mobileNav.messages'), icon: MessageSquare },
    { to: '/app/groups', label: t('mobileNav.groups'), icon: Users },
  ];

  // Get all installed modules
  const modules = Array.from(registry.values()).map((entry) => entry.plugin);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-lg font-semibold">{t('mobileNav.menu')}</h2>
        <SheetClose asChild>
          <Button variant="ghost" size="icon">
            <X className="h-5 w-5" />
          </Button>
        </SheetClose>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Core Navigation */}
        <nav className="space-y-1">
          {coreLinks.map((link) => (
            <SheetClose key={link.to} asChild>
              <NavLink
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
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
          <>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground px-3 uppercase tracking-wider">
                {t('mobileNav.modules')}
              </h3>
              <nav className="space-y-1">
                {modules
                  .filter((module) => {
                    // Only show modules that have app-level routes
                    const appRoutes = module.routes?.filter(r => r.scope === 'app') || [];
                    return appRoutes.length > 0;
                  })
                  .map((module) => {
                    const Icon = module.metadata.icon;
                    // Get the first app-level route for this module
                    const appRoute = module.routes?.find(r => r.scope === 'app');
                    const routePath = appRoute?.path || module.metadata.id;

                    return (
                      <SheetClose key={module.metadata.id} asChild>
                        <NavLink
                          to={`/app/${routePath}`}
                          className={({ isActive }) =>
                            cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                              isActive
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            )
                          }
                        >
                          <Icon className="h-4 w-4" />
                          {module.metadata.name}
                        </NavLink>
                      </SheetClose>
                    );
                  })}
              </nav>
            </div>
          </>
        )}

        {/* Settings */}
        <div>
          <Separator className="mb-4" />
          <SheetClose asChild>
            <NavLink
              to="/app/settings"
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )
              }
            >
              <Settings className="h-4 w-4" />
              {t('mobileNav.settings')}
            </NavLink>
          </SheetClose>
        </div>
      </div>
    </div>
  );
};
