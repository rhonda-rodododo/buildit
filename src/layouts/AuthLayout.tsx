import { FC, Suspense } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { RouteLoader } from '@/components/ui/page-loader';

/**
 * Auth layout - wraps unauthenticated pages
 * Redirects to app if already logged in
 */
export const AuthLayout: FC = () => {
  const { currentIdentity } = useAuthStore();

  if (currentIdentity) {
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
