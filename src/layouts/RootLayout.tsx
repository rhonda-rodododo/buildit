import { FC, Suspense, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { RouteLoader } from '@/components/ui/page-loader';

/**
 * Root layout - handles app initialization
 */
export const  RootLayout: FC = () => {
  const { currentIdentity, loadIdentities } = useAuthStore();
  const { initializeCurrentDevice, checkWebAuthnSupport } = useDeviceStore();
  const navigate = useNavigate();
 

  useEffect(() => {
    // Load identities on mount (database is initialized in main.tsx)
    (async () => {
      await loadIdentities();

      // Initialize device tracking and WebAuthn support
      await checkWebAuthnSupport();
      await initializeCurrentDevice();
    
    })();
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    useEffect(() => {
       const { pathname } = window.location;
      if (pathname) {
          navigate(pathname)
      }
    }, [loadIdentities])

  useEffect(() => {
    // Redirect based on auth state
    if (currentIdentity) {
      
      // If logged in and at root, go to app
      if (window.location.pathname === '/') {
        navigate('/app', { replace: true });
      }
    } else {
      // If not logged in and not at login, go to login
      if (!window.location.pathname.startsWith('/login')) {
        navigate('/login', { replace: true });
      }
    }

  }, [currentIdentity, navigate]);


  return (
    <Suspense fallback={<RouteLoader />}>
      <Outlet />
    </Suspense>
  );
};
