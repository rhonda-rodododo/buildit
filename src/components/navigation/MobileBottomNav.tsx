/**
 * MobileBottomNav Component
 * Fixed bottom navigation bar for mobile devices
 * Follows iOS/Android native app patterns for familiar UX
 */

import { FC } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, MessageSquare, Users, Calendar, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useConversationsStore } from '@/core/messaging/conversationsStore';
import { useHapticFeedback } from '@/hooks/useMobile';

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: number;
  end?: boolean;
}

export const MobileBottomNav: FC = () => {
  const location = useLocation();
  const { conversations } = useConversationsStore();
  const { lightTap } = useHapticFeedback();

  const unreadMessages = conversations.filter(c => c.unreadCount > 0).reduce((sum, c) => sum + c.unreadCount, 0);

  const navItems: NavItem[] = [
    { to: '/app', label: 'Home', icon: Home, end: true },
    { to: '/app/messages', label: 'Messages', icon: MessageSquare, badge: unreadMessages },
    { to: '/app/groups', label: 'Groups', icon: Users },
    { to: '/app/events', label: 'Events', icon: Calendar },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ];

  const handleNavClick = () => {
    lightTap();
  };

  // Determine active tab based on current path
  const getIsActive = (item: NavItem) => {
    if (item.end) {
      return location.pathname === item.to;
    }
    return location.pathname.startsWith(item.to);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t md:hidden safe-area-bottom"
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = getIsActive(item);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={handleNavClick}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-[44px] min-h-[44px] py-1 px-2 transition-colors relative',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg mx-0.5',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground active:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'h-6 w-6 transition-transform',
                    isActive && 'scale-110'
                  )}
                  aria-hidden="true"
                />
                {/* Badge for unread counts */}
                {item.badge && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1"
                    aria-label={`${item.badge} unread`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] mt-1 font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {item.label}
              </span>
              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  aria-hidden="true"
                />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

/**
 * MobileBottomNavSpacer Component
 * Add this at the bottom of scrollable content to prevent
 * content from being hidden behind the fixed bottom nav
 */
export const MobileBottomNavSpacer: FC = () => {
  return <div className="h-20 md:hidden" aria-hidden="true" />;
};
