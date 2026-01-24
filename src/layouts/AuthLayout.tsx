import { FC, Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { RouteLoader } from '@/components/ui/page-loader';

/**
 * Auth layout - wraps unauthenticated pages
 * Redirects to app if already logged in AND unlocked
 */
export const AuthLayout: FC = () => {
  const { currentIdentity, lockState } = useAuthStore();

  // Only redirect to app if user has an identity AND is unlocked
  // If locked, stay on login page to unlock
  if (currentIdentity && lockState === 'unlocked') {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={<RouteLoader />}>
        <Outlet />
      </Suspense>
    </div>
  );
};
