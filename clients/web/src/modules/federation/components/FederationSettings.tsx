/**
 * Federation Settings Panel
 *
 * Settings UI for enabling/disabling ActivityPub and Bluesky federation.
 */

import { FC, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Globe, CloudLightning } from 'lucide-react';
import { useFederationStore } from '../federationStore';
import { useAuthStore } from '@/stores/authStore';

export const FederationSettings: FC = () => {
  const { t } = useTranslation('federation');
  const { fetchStatus, setConfig } = useFederationStore();
  const pubkey = useAuthStore((s) => s.currentIdentity?.publicKey);
  const [apEnabled, setApEnabled] = useState(false);
  const [atEnabled, setAtEnabled] = useState(false);
  const [atHandle, setAtHandle] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pubkey) return;
    fetchStatus(pubkey).then((status) => {
      if (status?.federated) {
        setApEnabled(status.ap_enabled ?? false);
        setAtEnabled(status.at_enabled ?? false);
        setAtHandle(status.at_handle ?? '');
        setConfig({
          _v: '1.0.0',
          nostrPubkey: pubkey,
          username: status.username ?? '',
          apEnabled: status.ap_enabled ?? false,
          atEnabled: status.at_enabled ?? false,
          atHandle: status.at_handle ?? null,
        });
      }
      setLoading(false);
    });
  }, [pubkey, fetchStatus, setConfig]);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse h-32 bg-muted rounded" />
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Globe className="w-5 h-5" />
          {t('settings.title')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('settings.description')}
        </p>
      </div>

      {/* ActivityPub Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <p className="font-medium">{t('settings.activityPub')}</p>
            <p className="text-sm text-muted-foreground">
              {t('settings.activityPubDescription')}
            </p>
          </div>
        </div>
        <Button
          variant={apEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setApEnabled(!apEnabled)}
          aria-pressed={apEnabled}
          aria-label={t('settings.toggleActivityPub')}
        >
          {apEnabled ? t('settings.enabled') : t('settings.disabled')}
        </Button>
      </div>

      {/* Bluesky Toggle */}
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
            <CloudLightning className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-medium">{t('settings.bluesky')}</p>
            <p className="text-sm text-muted-foreground">
              {t('settings.blueskyDescription')}
            </p>
          </div>
        </div>
        <Button
          variant={atEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAtEnabled(!atEnabled)}
          aria-pressed={atEnabled}
          aria-label={t('settings.toggleBluesky')}
        >
          {atEnabled ? t('settings.enabled') : t('settings.disabled')}
        </Button>
      </div>

      {/* Bluesky App Password (only when enabled) */}
      {atEnabled && (
        <div className="p-4 border rounded-lg space-y-3">
          <label htmlFor="at-handle" className="text-sm font-medium">
            {t('settings.blueskyHandle')}
          </label>
          <input
            id="at-handle"
            type="text"
            value={atHandle}
            onChange={(e) => setAtHandle(e.target.value)}
            placeholder="yourname.bsky.social"
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t('settings.blueskyAppPasswordNote')}
          </p>
        </div>
      )}

      {/* Privacy Notice */}
      <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <p className="text-sm">
          <strong>{t('settings.privacyNotice')}</strong>{' '}
          {t('settings.privacyNoticeText')}
        </p>
      </div>
    </Card>
  );
};
