/**
 * UnlockForm Component
 * Password entry form for returning users who already have an identity stored.
 * Shows identity info and provides paths to recovery or switching accounts.
 */

import { useState, type FormEvent } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  Unlock,
  UserPlus,
  ChevronDown,
  User,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '@/config/app';
import type { Identity } from '@/types/identity';

interface UnlockFormProps {
  /** Called when user wants to recover with recovery phrase */
  onRecoveryClick: () => void;
  /** Called when user wants to create a new identity */
  onCreateNewClick: () => void;
  /** Called when user wants to import an existing identity */
  onImportClick: () => void;
}

export function UnlockForm({ onRecoveryClick, onCreateNewClick, onImportClick }: UnlockFormProps) {
  const { t } = useTranslation();
  const { currentIdentity, identities, unlock, setCurrentIdentity, isUnlocking, error } =
    useAuthStore();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  // Get initials for avatar
  const getInitials = (identity: Omit<Identity, 'privateKey'> | null): string => {
    if (!identity) return '?';
    const name = identity.displayName || identity.name || '';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!password.trim()) {
      setLocalError(t('auth.unlock.passwordRequired', 'Please enter your password'));
      return;
    }

    try {
      await unlock(password);
    } catch (err) {
      // Error is already set in the store, but we can also handle it here
      console.error('Unlock failed:', err);
    }
  };

  const handleSwitchIdentity = async (publicKey: string) => {
    setLocalError(null);
    setPassword('');
    try {
      await setCurrentIdentity(publicKey);
    } catch (err) {
      console.error('Failed to switch identity:', err);
    }
  };

  // Get short version of npub for display
  const getShortNpub = (npub?: string): string => {
    if (!npub) return '';
    return `${npub.slice(0, 8)}...${npub.slice(-4)}`;
  };

  const otherIdentities = identities.filter((id) => id.publicKey !== currentIdentity?.publicKey);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Unlock className="h-5 w-5" />
          {t('auth.unlock.title', 'Welcome Back')}
        </CardTitle>
        <CardDescription>{APP_CONFIG.fullName}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Identity Display - show selected identity or selector */}
        {currentIdentity ? (
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary">
                  {getInitials(currentIdentity)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">
                  {currentIdentity.displayName || currentIdentity.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  {getShortNpub(currentIdentity.npub)}
                </p>
              </div>
            </div>

            {/* Account Switcher (only show if multiple identities) */}
            {otherIdentities.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8">
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {otherIdentities.map((identity) => (
                    <DropdownMenuItem
                      key={identity.publicKey}
                      onClick={() => handleSwitchIdentity(identity.publicKey)}
                      className="cursor-pointer"
                    >
                      <User className="h-4 w-4 mr-2" />
                      <span className="truncate">
                        {identity.displayName || identity.name}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onCreateNewClick} className="cursor-pointer">
                    <UserPlus className="h-4 w-4 mr-2" />
                    {t('auth.unlock.addAccount', 'Add Another Account')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ) : identities.length > 0 ? (
          /* No identity selected - show selector */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.unlock.selectAccount', 'Select an account to unlock')}
            </p>
            <div className="space-y-2">
              {identities.map((identity) => (
                <button
                  key={identity.publicKey}
                  onClick={() => handleSwitchIdentity(identity.publicKey)}
                  className="w-full flex items-center gap-3 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(identity)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {identity.displayName || identity.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {getShortNpub(identity.npub)}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Password Form - only show when an identity is selected */}
        {currentIdentity && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlock-password">{t('auth.unlock.password', 'Password')}</Label>
              <div className="relative">
                <Input
                  id="unlock-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.unlock.passwordPlaceholder', 'Enter your password')}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalError(null);
                  }}
                  className="pr-12"
                  autoFocus
                  autoComplete="current-password"
                  aria-describedby={displayError ? 'unlock-error' : undefined}
                  aria-invalid={displayError ? 'true' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={showPassword ? t('auth.hidePassword', 'Hide password') : t('auth.showPassword', 'Show password')}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {displayError && (
              <Alert variant="destructive" id="unlock-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{displayError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full" disabled={isUnlocking || !password.trim()}>
              {isUnlocking ? t('auth.unlock.unlocking', 'Unlocking...') : t('auth.unlock.button', 'Unlock')}
            </Button>
          </form>
        )}
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        {/* Forgot Password / Recovery */}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={onRecoveryClick}
        >
          <KeyRound className="h-4 w-4 mr-2" />
          {t('auth.unlock.forgotPassword', 'Forgot Password?')}
        </Button>

        {/* Alternative Actions */}
        <div className="flex items-center gap-2 w-full">
          <Button variant="outline" size="sm" className="flex-1" onClick={onImportClick}>
            {t('auth.unlock.importKey', 'Import Key')}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onCreateNewClick}>
            {t('auth.unlock.newAccount', 'New Account')}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default UnlockForm;
