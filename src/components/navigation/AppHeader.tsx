import { FC } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ModeToggle } from '@/components/mode-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MobileNav } from './MobileNav';
import { APP_CONFIG } from '@/config/app';

export const AppHeader: FC = () => {
  const { currentIdentity, logout } = useAuthStore();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <MobileNav />
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
          <NotificationCenter />
          <LanguageSwitcher />
          <ModeToggle />
          <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">
            {currentIdentity?.name}
          </span>
          <Button variant="outline" size="sm" onClick={logout} className="text-xs sm:text-sm">
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
};
