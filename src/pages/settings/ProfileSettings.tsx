import { FC, useState, useEffect } from 'react';
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
        toast.success('Username saved successfully');
        await loadIdentities(); // Reload to get updated username
      } else {
        toast.error(result.error || 'Failed to save username');
      }
    } catch (error) {
      toast.error('Failed to save username');
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
        toast.success('NIP-05 verified successfully');
        await loadIdentities();
      } else {
        toast.error('NIP-05 verification failed');
      }
    } catch (error) {
      toast.error('NIP-05 verification failed');
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
      toast.success('Privacy settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
      console.error(error);
    }
  };

  if (!currentIdentity) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertDescription>Please log in to manage your profile</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Username & Display Name */}
      <Card>
        <CardHeader>
          <CardTitle>Username & Display Name</CardTitle>
          <CardDescription>
            Set a human-readable username to make it easier for others to find and mention you
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Username */}
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="username"
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
              <p className="text-sm text-red-600">Username already taken</p>
            )}
            {usernameAvailable === true && (
              <p className="text-sm text-green-600">Username available</p>
            )}
            <p className="text-xs text-muted-foreground">
              3-20 characters, lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Alice Martinez"
            />
            <p className="text-xs text-muted-foreground">
              Your full name or preferred display name
            </p>
          </div>

          <Button
            onClick={handleSaveUsername}
            disabled={saving || !username || usernameAvailable === false || !!usernameError}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Username'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* NIP-05 Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            NIP-05 Verification
            {currentIdentity.nip05Verified && (
              <Badge variant="default" className="bg-green-600">
                <ShieldCheck className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Verify your identity with a domain name (username@domain.com)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nip05">NIP-05 Identifier</Label>
            <Input
              id="nip05"
              value={nip05}
              onChange={e => setNip05(e.target.value)}
              placeholder="alice@example.com"
              type="text"
            />
            <p className="text-xs text-muted-foreground">
              Enter your NIP-05 identifier to verify your identity
            </p>
          </div>

          <Button onClick={handleVerifyNIP05} disabled={verifyingNIP05 || !nip05}>
            {verifyingNIP05 ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify NIP-05'
            )}
          </Button>

          {currentIdentity.nip05Verified && currentIdentity.nip05 && (
            <Alert>
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <AlertDescription>
                Verified as <strong>{currentIdentity.nip05}</strong>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Privacy Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Privacy Settings</CardTitle>
          <CardDescription>
            Control who can find you and see your profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loadingSettings ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <>
              {/* Username Search */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Username Search</Label>
                  <p className="text-xs text-muted-foreground">
                    Allow others to find you by username
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
                  <Label>Show in Directory</Label>
                  <p className="text-xs text-muted-foreground">
                    Appear in the public user directory
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
                <Label>Profile Visibility</Label>
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
                    <SelectItem value="public">Public (anyone can see)</SelectItem>
                    <SelectItem value="groups">Groups only</SelectItem>
                    <SelectItem value="friends">Friends only</SelectItem>
                    <SelectItem value="none">Private (hidden)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Who can view your profile and posts
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Public Key Info */}
      <Card>
        <CardHeader>
          <CardTitle>Public Key</CardTitle>
          <CardDescription>
            Your Nostr public key (npub)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>npub</Label>
            <Input value={currentIdentity.npub} readOnly className="font-mono text-xs" />
            <p className="text-xs text-muted-foreground">
              Your unique identifier on the Nostr network
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
