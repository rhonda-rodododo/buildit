import { FC, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { SyncStatusIndicator } from '@/components/offline/SyncStatusIndicator';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { AppSidebar } from './AppSidebar';
import { LogoutWarningDialog } from '@/components/auth/LogoutWarningDialog';
import { WindowControls } from '@/components/desktop';
import { APP_CONFIG } from '@/config/app';
import { dal } from '@/core/storage/dal';
import { useTranslation } from 'react-i18next';

export const AppHeader: FC = () => {
  const { t } = useTranslation();
  const { currentIdentity, logout } = useAuthStore();
  const [showLogoutWarning, setShowLogoutWarning] = useState(false);
  const [hasBackup, setHasBackup] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if user has a confirmed backup
  useEffect(() => {
    const checkBackupStatus = async () => {
      if (!currentIdentity?.publicKey) {
        setHasBackup(null);
        return;
      }

      try {
        const identity = await dal.get<{ recoveryPhraseConfirmedAt?: number; lastBackupAt?: number }>('identities', currentIdentity.publicKey);
        if (identity) {
          // User has backup if they confirmed recovery phrase OR created a backup file
          const hasConfirmedBackup = !!(
            identity.recoveryPhraseConfirmedAt ||
            identity.lastBackupAt
          );
          setHasBackup(hasConfirmedBackup);
        }
      } catch (err) {
        console.error('Failed to check backup status:', err);
        setHasBackup(false);
      }
    };

    checkBackupStatus();
  }, [currentIdentity?.publicKey]);

  const handleLogoutClick = async () => {
    // If user has a confirmed backup, logout directly
    if (hasBackup) {
      await logout();
      return;
    }

    // Otherwise, show warning dialog
    setShowLogoutWarning(true);
  };

  const handleLogoutConfirmed = async () => {
    await logout();
  };

  const handleBackupCreated = () => {
    // Update local state to reflect that user now has a backup
    setHasBackup(true);
  };

  return (
    <>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="mx-auto px-4 sm:px-6 lg:px-4 py-3 sm:py-4 lg:py-4 flex items-start justify-between ">
          <div className="flex items-center gap-4">
            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" aria-label={t('nav.openMenu', 'Open navigation menu')}>
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetTitle className="sr-only">{t('nav.navigationMenu', 'Navigation Menu')}</SheetTitle>
                <AppSidebar
                  className="w-full h-full border-r-0"
                  onLinkClick={() => setMobileMenuOpen(false)}
                />
              </SheetContent>
            </Sheet>

            {/* App logo/title */}
            <Link to="/app" className="flex flex-col">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {APP_CONFIG.name}
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">{APP_CONFIG.tagline}</p>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <SyncStatusIndicator showLabel className="hidden sm:flex" />
            <SyncStatusIndicator className="sm:hidden" />
            <NotificationCenter />
            <LanguageSwitcher />
            <ModeToggle />
            <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
              {currentIdentity?.name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogoutClick} className="text-xs sm:text-sm">
              {t('auth.logout.button', 'Logout')}
            </Button>
            {/* Desktop window controls (only visible in Tauri) */}
            <WindowControls className="hidden lg:flex ml-2" />
          </div>
        </div>
      </header>

      {/* Logout Warning Dialog */}
      {currentIdentity && (
        <LogoutWarningDialog
          open={showLogoutWarning}
          onOpenChange={setShowLogoutWarning}
          identityPubkey={currentIdentity.publicKey}
          onLogout={handleLogoutConfirmed}
          onBackupCreated={handleBackupCreated}
        />
      )}
    </>
  );
};
