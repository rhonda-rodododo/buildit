import { FC } from 'react';
import { NavLink } from 'react-router-dom';
import { User, Shield, Lock, Bell, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsSidebarProps {
  className?: string;
}

export const SettingsSidebar: FC<SettingsSidebarProps> = ({ className }) => {
  const settingsLinks = [
    { to: '/app/settings/profile', label: 'Profile', icon: User },
    { to: '/app/settings/security', label: 'Security', icon: Shield },
    { to: '/app/settings/privacy', label: 'Privacy', icon: Lock },
    { to: '/app/settings/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings/preferences', label: 'Preferences', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'w-64 border-r bg-muted/10 p-4 space-y-4',
        className
      )}
    >
      <div>
        <h2 className="text-lg font-semibold px-3 mb-2">Settings</h2>
        <nav className="space-y-1">
          {settingsLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
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
          ))}
        </nav>
      </div>
    </aside>
  );
};
