import { FC, Suspense, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { RouteLoader } from '@/components/ui/page-loader';

/**
 * Root layout - handles auth-based routing
 *
 * Note: App initialization (DB, modules, identities) is handled in main.tsx.
 * This layout only handles routing based on auth state.
 */
export const RootLayout: FC = () => {
  const currentIdentity = useAuthStore((s) => s.currentIdentity);
  const { initializeCurrentDevice, checkWebAuthnSupport } = useDeviceStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize device tracking on mount (one-time)
  useEffect(() => {
    (async () => {
      await checkWebAuthnSupport();
      await initializeCurrentDevice();
    })();
  }, [checkWebAuthnSupport, initializeCurrentDevice]);

  // Redirect based on auth state
  useEffect(() => {
    if (currentIdentity) {
      // If logged in and at root, go to app
      if (location.pathname === '/') {
        navigate('/app', { replace: true });
      }
    } else {
      // If not logged in and not at login/public pages, go to login
      if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/campaigns') && !location.pathname.startsWith('/wiki')) {
        const returnTo = location.pathname + location.search + location.hash;
        const loginUrl = returnTo.startsWith('/app')
          ? `/login?returnTo=${encodeURIComponent(returnTo)}`
          : '/login';
        navigate(loginUrl, { replace: true });
      }
    }
  }, [currentIdentity, navigate, location]);

  return (
    <Suspense fallback={<RouteLoader />}>
      <Outlet />
    </Suspense>
  );
};
