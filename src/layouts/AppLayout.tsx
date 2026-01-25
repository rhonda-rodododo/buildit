import { FC, Suspense, useEffect } from 'react';
import { Navigate, Outlet, useMatch } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { AppHeader } from '@/components/navigation/AppHeader';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { MobileBottomNav } from '@/components/navigation/MobileBottomNav';
import { RouteLoader } from '@/components/ui/page-loader';
import { BackupReminderBanner } from '@/components/auth/BackupReminderBanner';
import { CommandPaletteProvider } from '@/components/command-palette';
import { DesktopStatusBar } from '@/components/desktop';

/**
 * App layout - wraps authenticated app pages
 * Includes header, sidebar navigation, and breadcrumbs
 * Keyboard shortcuts are handled by CommandPaletteProvider
 */
export const AppLayout: FC = () => {
  const { currentIdentity } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  // Detect if we're in a group route (to hide main sidebar)
  const isGroupRoute = useMatch('/app/groups/:groupId/*');

  // Listen for toggle-sidebar custom event from keyboard shortcut
  useEffect(() => {
    const handleToggleSidebar = () => toggleSidebar();
    window.addEventListener('toggle-sidebar', handleToggleSidebar);
    return () => window.removeEventListener('toggle-sidebar', handleToggleSidebar);
  }, [toggleSidebar]);

  if (!currentIdentity) {
    return <Navigate to="/login" replace />;
  }

  return (
    <CommandPaletteProvider>
      <div className="h-screen grid grid-rows-[auto_1fr] bg-gradient-to-br from-background via-background to-muted/20">
        {/* Skip link for keyboard/screen reader users (WCAG 2.4.1) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-4 focus:left-4 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        {/* Header row */}
        <div>
          <AppHeader />
          <BackupReminderBanner className="mx-4 mt-2 sm:mx-6 lg:mx-8" />
        </div>

        {/* Content row - sidebar + main */}
        <div className={`grid ${!isGroupRoute && !sidebarCollapsed ? 'lg:grid-cols-[auto_1fr]' : ''} overflow-hidden`}>
          {/* Desktop sidebar - hidden when viewing a group (GroupSidebar takes over) or collapsed */}
          {!isGroupRoute && !sidebarCollapsed && <AppSidebar className="hidden lg:flex" />}

          {/* Main content - this is the ONLY scrollable area */}
          <main
            id="main-content"
            className="overflow-y-auto pb-20 md:pb-0"
          >
            <Suspense fallback={<RouteLoader />}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        {/* Mobile bottom navigation - fixed at bottom */}
        <MobileBottomNav />

        {/* Desktop status bar (only visible in Tauri) */}
        <DesktopStatusBar />
      </div>
    </CommandPaletteProvider>
  );
};
