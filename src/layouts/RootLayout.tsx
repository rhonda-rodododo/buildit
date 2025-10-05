import { FC, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceStore } from '@/stores/deviceStore';
import { initializeDatabase } from '@/core/storage/db';

/**
 * Root layout - handles app initialization
 */
export const RootLayout: FC = () => {
  const { currentIdentity, loadIdentities } = useAuthStore();
  const { initializeCurrentDevice, checkWebAuthnSupport } = useDeviceStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize database and load identities on mount
    initializeDatabase().then(async () => {
      await loadIdentities();
      // Initialize device tracking and WebAuthn support
      await checkWebAuthnSupport();
      await initializeCurrentDevice();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return <Outlet />;
};
