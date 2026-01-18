/**
 * Tor Settings Component
 * Configure Tor integration, .onion relays, and security features
 */

import { useState } from 'react';
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
      alert('Please enter a valid .onion address');
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
            Tor Integration
          </CardTitle>
          <CardDescription>
            Connect to Nostr relays through Tor for enhanced privacy and censorship resistance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TorStatusIndicator detailed />

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="tor-enabled">Enable Tor Routing</Label>
              <p className="text-sm text-muted-foreground">
                Route Nostr connections through .onion relays
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
            <Label htmlFor="connection-method">Connection Method</Label>
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
                  Auto-detect (Recommended)
                </SelectItem>
                <SelectItem value={TorConnectionMethod.TOR_BROWSER}>
                  Tor Browser
                </SelectItem>
                <SelectItem value={TorConnectionMethod.MANUAL_PROXY}>
                  Manual SOCKS5 Proxy
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {config.method === TorConnectionMethod.AUTO &&
                'Automatically detect Tor Browser or SOCKS5 proxy'}
              {config.method === TorConnectionMethod.TOR_BROWSER &&
                'Use Tor Browser for .onion relay connections'}
              {config.method === TorConnectionMethod.MANUAL_PROXY &&
                'Configure custom SOCKS5 proxy (requires local Tor daemon)'}
            </p>
          </div>

          {/* Manual Proxy Settings */}
          {config.method === TorConnectionMethod.MANUAL_PROXY && (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm font-medium">SOCKS5 Proxy Configuration</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="proxy-host">Proxy Host</Label>
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
                  <Label htmlFor="proxy-port">Proxy Port</Label>
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
                Standard Tor: 9050, Tor Browser: 9150
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
              <CardTitle>Onion Relays</CardTitle>
              <CardDescription>
                Manage .onion Nostr relays for Tor connections
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHealthCheck}
              disabled={isHealthChecking}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isHealthChecking ? 'animate-spin' : ''}`} />
              Health Check
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Relay Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label htmlFor="onion-only">Onion Only Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Use only .onion relays (no clearnet fallback)
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
                <Label htmlFor="fallback-clearnet">Fallback to Clearnet</Label>
                <p className="text-xs text-muted-foreground">
                  Use clearnet relays if .onion relays unavailable
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
            <Label>Add Custom Relay</Label>
            <div className="flex gap-2">
              <Input
                placeholder=".onion address"
                value={newRelayUrl}
                onChange={(e) => setNewRelayUrl(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Name (optional)"
                value={newRelayName}
                onChange={(e) => setNewRelayName(e.target.value)}
                className="w-40"
              />
              <Button onClick={handleAddRelay} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Relay List */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Relay</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {onionRelays.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No .onion relays configured
                    </TableCell>
                  </TableRow>
                ) : (
                  onionRelays.map((relay) => (
                    <TableRow key={relay.url}>
                      <TableCell className="font-medium">
                        {relay.name || 'Custom Relay'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {relay.url.substring(0, 40)}...
                      </TableCell>
                      <TableCell className="text-center">
                        {relay.healthy === undefined ? (
                          <Badge variant="secondary">Unknown</Badge>
                        ) : relay.healthy ? (
                          <Badge variant="default" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Healthy
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Down
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
            Enhanced Security
          </CardTitle>
          <CardDescription>
            Additional protections when using Tor
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <Label htmlFor="block-webrtc">Block WebRTC</Label>
              <p className="text-xs text-muted-foreground">
                Prevent WebRTC IP leaks (requires browser extension)
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
              <Label htmlFor="block-geolocation">Block Geolocation</Label>
              <p className="text-xs text-muted-foreground">
                Deny all geolocation API requests
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
              <Label htmlFor="fingerprint-protection">Fingerprinting Protection</Label>
              <p className="text-xs text-muted-foreground">
                Enhanced protection against browser fingerprinting
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
          <AlertTitle>Security Warnings</AlertTitle>
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
        <AlertTitle>How to use Tor with BuildIt Network</AlertTitle>
        <AlertDescription className="space-y-2 mt-2">
          <p className="text-sm">
            <strong>Recommended:</strong> Use Tor Browser for the best privacy and security.
            BuildIt will automatically detect and use .onion relays.
          </p>
          <p className="text-sm">
            <strong>Advanced:</strong> Run a local Tor daemon (port 9050) and enable Manual
            Proxy mode for desktop integration.
          </p>
          <p className="text-sm">
            <strong>Note:</strong> WebRTC and geolocation blocking require browser
            configuration or extensions. Tor Browser includes these protections by default.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
