/**
 * Tor Settings Component
 * Configure Tor integration, .onion relays, and security features
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Shield,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useTorStore } from '@/modules/security/tor/torStore';
import { TorConnectionMethod, TorStatus } from '@/modules/security/tor/types';
import { TorStatusIndicator } from './TorStatusIndicator';

export function TorSettings() {
  const { t } = useTranslation();
  const {
    config,
    status,
    onionRelays,
    warnings,
    updateConfig,
    enable,
    disable,
    addOnionRelay,
    removeOnionRelay,
    healthCheckRelays,
  } = useTorStore();

  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [newRelayName, setNewRelayName] = useState('');
  const [isHealthChecking, setIsHealthChecking] = useState(false);

  const handleToggleTor = async () => {
    if (config.enabled) {
      disable();
    } else {
      try {
        await enable();
      } catch (error) {
        console.error('Failed to enable Tor:', error);
      }
    }
  };

  const handleAddRelay = () => {
    if (!newRelayUrl.trim()) return;

    // Validate .onion URL
    if (!newRelayUrl.includes('.onion')) {
      alert(t('tor.invalidOnionAddress'));
      return;
    }

    // Ensure ws:// protocol
    let url = newRelayUrl.trim();
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      url = `ws://${url}`;
    }

    addOnionRelay({
      url,
      name: newRelayName.trim() || undefined,
      read: true,
      write: true,
    });

    setNewRelayUrl('');
    setNewRelayName('');
  };

  const handleHealthCheck = async () => {
    setIsHealthChecking(true);
    try {
      await healthCheckRelays();
    } finally {
      setIsHealthChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('tor.title')}
          </CardTitle>
          <CardDescription>
            {t('tor.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TorStatusIndicator detailed />

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="tor-enabled">{t('tor.enableRouting')}</Label>
              <p className="text-sm text-muted-foreground">
                {t('tor.enableRoutingDesc')}
              </p>
            </div>
            <Switch
              id="tor-enabled"
              checked={config.enabled}
              onCheckedChange={handleToggleTor}
              disabled={status === TorStatus.CONNECTING}
            />
          </div>

          {/* Connection Method */}
          <div className="space-y-2">
            <Label htmlFor="connection-method">{t('tor.connectionMethod')}</Label>
            <Select
              value={config.method}
              onValueChange={(value) =>
                updateConfig({ method: value as TorConnectionMethod })
              }
              disabled={!config.enabled}
            >
              <SelectTrigger id="connection-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TorConnectionMethod.AUTO}>
                  {t('tor.methodAuto')}
                </SelectItem>
                <SelectItem value={TorConnectionMethod.TOR_BROWSER}>
                  {t('tor.methodTorBrowser')}
                </SelectItem>
                <SelectItem value={TorConnectionMethod.MANUAL_PROXY}>
                  {t('tor.methodManualProxy')}
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.method === TorConnectionMethod.AUTO &&
                t('tor.methodAutoDesc')}
              {config.method === TorConnectionMethod.TOR_BROWSER &&
                t('tor.methodTorBrowserDesc')}
              {config.method === TorConnectionMethod.MANUAL_PROXY &&
                t('tor.methodManualProxyDesc')}
            </p>
          </div>

          {/* Manual Proxy Settings */}
          {config.method === TorConnectionMethod.MANUAL_PROXY && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{t('tor.proxyConfig')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="proxy-host">{t('tor.proxyHost')}</Label>
                  <Input
                    id="proxy-host"
                    value={config.socks5?.host || '127.0.0.1'}
                    onChange={(e) =>
                      updateConfig({
                        socks5: {
                          ...config.socks5!,
                          host: e.target.value,
                        },
                      })
                    }
                    placeholder="127.0.0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proxy-port">{t('tor.proxyPort')}</Label>
                  <Input
                    id="proxy-port"
                    type="number"
                    value={config.socks5?.port || 9050}
                    onChange={(e) =>
                      updateConfig({
                        socks5: {
                          ...config.socks5!,
                          port: parseInt(e.target.value, 10),
                        },
                      })
                    }
                    placeholder="9050"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t('tor.proxyHint')}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Relay Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('tor.onionRelays')}</CardTitle>
              <CardDescription>
                {t('tor.onionRelaysDesc')}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHealthCheck}
              disabled={isHealthChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isHealthChecking ? 'animate-spin' : ''}`} />
              {t('tor.healthCheck')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Relay Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="onion-only">{t('tor.onionOnlyMode')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('tor.onionOnlyModeDesc')}
                </p>
              </div>
              <Switch
                id="onion-only"
                checked={config.onionOnly}
                onCheckedChange={(checked) => updateConfig({ onionOnly: checked })}
                disabled={!config.enabled}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="fallback-clearnet">{t('tor.fallbackClearnet')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('tor.fallbackClearnetDesc')}
                </p>
              </div>
              <Switch
                id="fallback-clearnet"
                checked={config.fallbackToClearnet}
                onCheckedChange={(checked) => updateConfig({ fallbackToClearnet: checked })}
                disabled={!config.enabled || config.onionOnly}
              />
            </div>
          </div>

          {/* Add New Relay */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <Label>{t('tor.addCustomRelay')}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t('tor.onionAddress')}
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder={t('tor.nameOptional')}
                value={newRelayName}
                onChange={(e) => setNewRelayName(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleAddRelay} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                {t('tor.add')}
              </Button>
            </div>
          </div>

          {/* Relay List */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('tor.tableRelay')}</TableHead>
                  <TableHead>{t('tor.tableUrl')}</TableHead>
                  <TableHead className="text-center">{t('tor.tableStatus')}</TableHead>
                  <TableHead className="text-right">{t('tor.tableLatency')}</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onionRelays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {t('tor.noRelaysConfigured')}
                    </TableCell>
                  </TableRow>
                ) : (
                  onionRelays.map((relay) => (
                    <TableRow key={relay.url}>
                      <TableCell className="font-medium">
                        {relay.name || t('tor.customRelay')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {relay.url.substring(0, 40)}...
                      </TableCell>
                      <TableCell className="text-center">
                        {relay.healthy === undefined ? (
                          <Badge variant="secondary">{t('tor.statusUnknown')}</Badge>
                        ) : relay.healthy ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('tor.statusHealthy')}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            {t('tor.statusDown')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {relay.latency ? `${Math.round(relay.latency)}ms` : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOnionRelay(relay.url)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Security Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t('tor.enhancedSecurity')}
          </CardTitle>
          <CardDescription>
            {t('tor.enhancedSecurityDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="block-webrtc">{t('tor.blockWebRTC')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('tor.blockWebRTCDesc')}
              </p>
            </div>
            <Switch
              id="block-webrtc"
              checked={config.enhancedSecurity.blockWebRTC}
              onCheckedChange={(checked) =>
                updateConfig({
                  enhancedSecurity: {
                    ...config.enhancedSecurity,
                    blockWebRTC: checked,
                  },
                })
              }
              disabled={!config.enabled}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="block-geolocation">{t('tor.blockGeolocation')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('tor.blockGeolocationDesc')}
              </p>
            </div>
            <Switch
              id="block-geolocation"
              checked={config.enhancedSecurity.blockGeolocation}
              onCheckedChange={(checked) =>
                updateConfig({
                  enhancedSecurity: {
                    ...config.enhancedSecurity,
                    blockGeolocation: checked,
                  },
                })
              }
              disabled={!config.enabled}
            />
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="fingerprint-protection">{t('tor.fingerprintProtection')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('tor.fingerprintProtectionDesc')}
              </p>
            </div>
            <Switch
              id="fingerprint-protection"
              checked={config.enhancedSecurity.fingerprintProtection}
              onCheckedChange={(checked) =>
                updateConfig({
                  enhancedSecurity: {
                    ...config.enhancedSecurity,
                    fingerprintProtection: checked,
                  },
                })
              }
              disabled={!config.enabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{t('tor.securityWarnings')}</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              {warnings.map((warning, i) => (
                <li key={i} className="text-sm">
                  {warning}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{t('tor.howToUse')}</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p className="text-sm">
            <strong>{t('tor.recommended')}</strong> {t('tor.recommendedNote')}
          </p>
          <p className="text-sm">
            <strong>{t('tor.advanced')}</strong> {t('tor.advancedNote')}
          </p>
          <p className="text-sm">
            <strong>{t('tor.note')}</strong> {t('tor.noteNote')}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
