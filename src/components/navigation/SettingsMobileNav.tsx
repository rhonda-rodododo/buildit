import { FC } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, Shield, Lock, Bell, Settings, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export const SettingsMobileNav: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const settingsLinks = [
    { to: '/app/settings/profile', label: 'Profile', icon: User },
    { to: '/app/settings/security', label: 'Security', icon: Shield },
    { to: '/app/settings/privacy', label: 'Privacy', icon: Lock },
    { to: '/app/settings/notifications', label: 'Notifications', icon: Bell },
    { to: '/app/settings/preferences', label: 'Preferences', icon: Settings },
  ];

  const currentPage =
    settingsLinks.find((link) => location.pathname === link.to) ||
    settingsLinks[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2">
            <currentPage.icon className="h-4 w-4" />
            {currentPage.label}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-full">
        {settingsLinks.map((link) => (
          <DropdownMenuItem
            key={link.to}
            onClick={() => navigate(link.to)}
            className="flex items-center gap-2"
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
