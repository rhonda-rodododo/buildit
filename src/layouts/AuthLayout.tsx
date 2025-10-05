import { FC } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

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
      <Outlet />
    </div>
  );
};
