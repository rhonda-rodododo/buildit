import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/authStore';
import { UsernameManager } from '@/core/username/usernameManager';
import { validateUsername, isUsernameAvailable } from '@/core/username/usernameUtils';
import { Check, X, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { DBUsernameSettings } from '@/core/storage/db';

export const ProfileSettings: FC = () => {
  const { t } = useTranslation();
  const currentIdentity = useAuthStore(state => state.currentIdentity);
  const loadIdentities = useAuthStore(state => state.loadIdentities);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [nip05, setNip05] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyingNIP05, setVerifyingNIP05] = useState(false);

  // Privacy settings
  const [settings, setSettings] = useState<DBUsernameSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Load current username and settings
  useEffect(() => {
    if (currentIdentity) {
      setUsername(currentIdentity.username || '');
      setDisplayName(currentIdentity.displayName || '');
      setNip05(currentIdentity.nip05 || '');

      // Load privacy settings
      UsernameManager.getSettings(currentIdentity.publicKey).then(s => {
        setSettings(s);
        setLoadingSettings(false);
      });
    }
  }, [currentIdentity]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username || username === currentIdentity?.username) {
      setUsernameAvailable(null);
      setUsernameError('');
      return;
    }

    const validation = validateUsername(username);
    if (!validation.valid) {
      setUsernameError(validation.error || '');
      setUsernameAvailable(false);
      return;
    }

    setUsernameError('');
    setCheckingUsername(true);

    const timer = setTimeout(async () => {
      const available = await isUsernameAvailable(username, currentIdentity?.publicKey);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [username, currentIdentity]);

  const handleSaveUsername = async () => {
    if (!currentIdentity) return;

    setSaving(true);
    try {
      const result = await UsernameManager.claimUsername(
        currentIdentity.publicKey,
        username,
        displayName || undefined
      );

      if (result.success) {
        toast.success(t('profile.usernameSaved'));
        await loadIdentities(); // Reload to get updated username
      } else {
        toast.error(result.error || t('profile.usernameSaveFailed'));
      }
    } catch (error) {
      toast.error(t('profile.usernameSaveFailed'));
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyNIP05 = async () => {
    if (!currentIdentity || !nip05) return;

    setVerifyingNIP05(true);
    try {
      const success = await UsernameManager.setNIP05(currentIdentity.publicKey, nip05);

      if (success) {
        toast.success(t('profile.nip05Verified'));
        await loadIdentities();
      } else {
        toast.error(t('profile.nip05Failed'));
      }
    } catch (error) {
      toast.error(t('profile.nip05Failed'));
      console.error(error);
    } finally {
      setVerifyingNIP05(false);
    }
  };

  const handleUpdatePrivacySettings = async (updates: Partial<DBUsernameSettings>) => {
    if (!currentIdentity) return;

    try {
      await UsernameManager.updateSettings(currentIdentity.publicKey, updates);
      const updated = await UsernameManager.getSettings(currentIdentity.publicKey);
      setSettings(updated);
      toast.success(t('profile.privacyUpdated'));
    } catch (error) {
      toast.error(t('profile.privacyUpdateFailed'));
      console.error(error);
    }
  };

  if (!currentIdentity) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>{t('profile.pleaseLogin')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageMeta titleKey="common.profile" descriptionKey="meta.settings" path="/app/settings/profile" />
      {/* Username & Display Name */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.usernameAndDisplayName')}</CardTitle>
          <CardDescription>
            {t('profile.usernameDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">{t('profile.username')}</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="username"
                  data-testid="username-input"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="alice-organizer"
                  className="pr-8"
                />
                {checkingUsername && (
                  <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <Check className="absolute right-2 top-2.5 h-4 w-4 text-green-600" />
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <X className="absolute right-2 top-2.5 h-4 w-4 text-red-600" />
                )}
              </div>
            </div>
            {usernameError && (
              <p className="text-sm text-red-600">{usernameError}</p>
            )}
            {usernameAvailable === false && !usernameError && (
              <p className="text-sm text-red-600">{t('profile.usernameTaken')}</p>
            )}
            {usernameAvailable === true && (
              <p className="text-sm text-green-600">{t('profile.usernameAvailable')}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('profile.usernameHint')}
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.displayName')}</Label>
            <Input
              id="displayName"
              data-testid="display-name-input"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Alice Martinez"
            />
            <p className="text-xs text-muted-foreground">
              {t('profile.displayNameHint')}
            </p>
          </div>

          <Button
            data-testid="save-username-button"
            onClick={handleSaveUsername}
            disabled={saving || !username || usernameAvailable === false || !!usernameError}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('profile.saving')}
              </>
            ) : (
              t('profile.saveUsername')
            )}
          </Button>
        </CardContent>
      </Card>

      {/* NIP-05 Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t('profile.nip05Verification')}
            {currentIdentity.nip05Verified && (
              <Badge variant="default" className="bg-green-600">
                <ShieldCheck className="mr-1 h-3 w-3" />
                {t('profile.verified')}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {t('profile.nip05Description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nip05">{t('profile.nip05Identifier')}</Label>
            <Input
              id="nip05"
              data-testid="nip05-input"
              value={nip05}
              onChange={e => setNip05(e.target.value)}
              placeholder="alice@example.com"
              type="text"
            />
            <p className="text-xs text-muted-foreground">
              {t('profile.nip05Hint')}
            </p>
          </div>

          <Button data-testid="verify-nip05-button" onClick={handleVerifyNIP05} disabled={verifyingNIP05 || !nip05}>
            {verifyingNIP05 ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('profile.verifying')}
              </>
            ) : (
              t('profile.verifyNip05')
            )}
          </Button>

          {currentIdentity.nip05Verified && currentIdentity.nip05 && (
            <Alert>
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertDescription>
                {t('profile.verifiedAs')} <strong>{currentIdentity.nip05}</strong>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.privacySettings')}</CardTitle>
          <CardDescription>
            {t('profile.privacyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingSettings ? (
            <p className="text-sm text-muted-foreground">{t('profile.loadingSettings')}</p>
          ) : (
            <>
              {/* Username Search */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('profile.usernameSearch')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('profile.usernameSearchHint')}
                  </p>
                </div>
                <Switch
                  checked={settings?.allowUsernameSearch ?? true}
                  onCheckedChange={checked =>
                    handleUpdatePrivacySettings({ allowUsernameSearch: checked })
                  }
                />
              </div>

              <Separator />

              {/* Show in Directory */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('profile.showInDirectory')}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t('profile.showInDirectoryHint')}
                  </p>
                </div>
                <Switch
                  checked={settings?.showInDirectory ?? true}
                  onCheckedChange={checked =>
                    handleUpdatePrivacySettings({ showInDirectory: checked })
                  }
                />
              </div>

              <Separator />

              {/* Profile Visibility */}
              <div className="space-y-2">
                <Label>{t('profile.profileVisibility')}</Label>
                <Select
                  value={settings?.visibleTo || 'public'}
                  onValueChange={value =>
                    handleUpdatePrivacySettings({ visibleTo: value as DBUsernameSettings['visibleTo'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t('profile.visibilityPublic')}</SelectItem>
                    <SelectItem value="groups">{t('profile.visibilityGroups')}</SelectItem>
                    <SelectItem value="friends">{t('profile.visibilityFriends')}</SelectItem>
                    <SelectItem value="none">{t('profile.visibilityPrivate')}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('profile.visibilityHint')}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Public Key Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.publicKey')}</CardTitle>
          <CardDescription>
            {t('profile.publicKeyDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t('profile.npub')}</Label>
            <Input value={currentIdentity.npub} readOnly className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              {t('profile.npubHint')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
