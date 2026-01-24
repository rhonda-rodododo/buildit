/**
 * LoginPage Component
 * Smart routing between different auth flows based on identity state:
 * - UnlockForm: User has identities stored, needs to unlock
 * - LoginForm: No identities, needs to create or import
 * - RecoveryForm: User forgot password, needs to recover
 */

import { useState, useEffect, type FC } from 'react';
import { PageMeta } from '@/components/PageMeta';
import { LoginForm } from '@/components/auth/LoginForm';
import { UnlockForm } from '@/components/auth/UnlockForm';
import { RecoveryForm } from '@/components/auth/RecoveryForm';
import { useAuthStore, getSavedIdentityPubkey } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

type AuthView = 'loading' | 'unlock' | 'login' | 'recovery';

export const LoginPage: FC = () => {
  const { identities, currentIdentity, loadIdentities, setCurrentIdentity, isLoading } = useAuthStore();
  const [view, setView] = useState<AuthView>('loading');
  const [defaultLoginTab, setDefaultLoginTab] = useState<'create' | 'import'>('create');

  // Load identities on mount and determine initial view
  useEffect(() => {
    const initializeView = async () => {
      // Load identities if not already loaded
      if (identities.length === 0) {
        await loadIdentities();
      }
    };

    initializeView();
  }, [loadIdentities, identities.length]);

  // Determine view based on identities state
  useEffect(() => {
    if (isLoading) {
      setView('loading');
      return;
    }

    // If we already have a view set that's not loading, don't override
    // (user may have navigated to login/recovery intentionally)
    if (view !== 'loading' && view !== 'unlock') {
      return;
    }

    if (identities.length > 0) {
      // Has identities - show unlock screen
      // Only auto-select an identity if there's one saved in localStorage
      // (This prevents auto-selecting after explicit logout)
      if (!currentIdentity) {
        const savedPubkey = getSavedIdentityPubkey();
        if (savedPubkey) {
          // Restore the previously selected identity
          const savedIdentity = identities.find(id => id.publicKey === savedPubkey);
          if (savedIdentity) {
            setCurrentIdentity(savedPubkey);
          }
        }
        // If no saved pubkey, don't auto-select - user explicitly logged out
      }
      setView('unlock');
    } else {
      // No identities - show login/create screen
      setView('login');
    }
  }, [identities, currentIdentity, isLoading, setCurrentIdentity, view]);

  // Handle navigation between views
  const handleShowRecovery = () => {
    setView('recovery');
  };

  const handleShowLogin = (tab: 'create' | 'import' = 'create') => {
    setDefaultLoginTab(tab);
    setView('login');
  };

  const handleBackToUnlock = () => {
    if (identities.length > 0) {
      setView('unlock');
    } else {
      setView('login');
    }
  };

  const handleRecoverySuccess = () => {
    // After successful recovery, go back to unlock (user is now logged in)
    setView('unlock');
  };

  // Render loading state
  if (view === 'loading') {
    return (
      <>
        <PageMeta titleKey="auth.login" descriptionKey="meta.login" path="/login" />
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Render unlock form for returning users
  if (view === 'unlock') {
    return (
      <>
        <PageMeta titleKey="auth.unlock" descriptionKey="meta.unlock" path="/login" />
        <UnlockForm
          onRecoveryClick={handleShowRecovery}
          onCreateNewClick={() => handleShowLogin('create')}
          onImportClick={() => handleShowLogin('import')}
        />
      </>
    );
  }

  // Render recovery form
  if (view === 'recovery') {
    return (
      <>
        <PageMeta titleKey="auth.recovery" descriptionKey="meta.recovery" path="/login" />
        <RecoveryForm
          onBack={handleBackToUnlock}
          onSuccess={handleRecoverySuccess}
          identityHint={
            currentIdentity
              ? {
                  name: currentIdentity.displayName || currentIdentity.name,
                  npub: currentIdentity.npub,
                }
              : undefined
          }
        />
      </>
    );
  }

  // Render login/create form for new users
  return (
    <>
      <PageMeta titleKey="auth.login" descriptionKey="meta.login" path="/login" />
      <LoginForm
        onBack={identities.length > 0 ? handleBackToUnlock : undefined}
        defaultTab={defaultLoginTab}
      />
    </>
  );
};
