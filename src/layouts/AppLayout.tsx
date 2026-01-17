import { FC, useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AppHeader } from '@/components/navigation/AppHeader';
import { AppSidebar } from '@/components/navigation/AppSidebar';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';

/**
 * App layout - wraps authenticated app pages
 * Includes header, sidebar navigation, and breadcrumbs
 * Supports keyboard shortcuts for navigation
 */
export const AppLayout: FC = () => {
  const { currentIdentity } = useAuthStore();
  const navigate = useNavigate();

  // Keyboard shortcuts
  useEffect(() => {
  
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Ctrl/Cmd is pressed
      if (!e.ctrlKey && !e.metaKey) return;

      switch (e.key) {
        case '1':
          e.preventDefault();
          navigate('/app/messages');
          break;
        case '2':
          e.preventDefault();
          navigate('/app/groups');
          break;
        case ',':
          e.preventDefault();
          navigate('/app/settings');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (!currentIdentity) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <AppHeader />
      <div className="flex">
        {/* Desktop sidebar */}
        <AppSidebar className="hidden lg:flex" />

        {/* Main content */}
        <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 max-w-screen-2xl">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
};
