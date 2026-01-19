/**
 * Remote Signing Panel
 * UI for NIP-46 bunker connections (remote signing)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Key,
  Link2,
  Unlink,
  Plus,
  Copy,
  Check,
  Shield,
  AlertTriangle,
  Smartphone,
  Clock,
  MoreVertical,
  Trash2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { bunkerService, remoteSigner } from '@/core/nostr/nip46';
import type { DBBunkerConnection } from '@/core/storage/db';
import type { Nip46Permission, PendingApproval } from '@/core/nostr/nip46';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';

interface RemoteSigningPanelProps {
  identityPubkey: string;
  mode: 'bunker' | 'client';
}

export function RemoteSigningPanel({ identityPubkey, mode }: RemoteSigningPanelProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {t('settings.remoteSigning.title', 'Remote Signing (NIP-46)')}
        </CardTitle>
        <CardDescription>
          {mode === 'bunker'
            ? t('settings.remoteSigning.bunkerDesc', 'Allow other devices to sign using this device as the key holder')
            : t('settings.remoteSigning.clientDesc', 'Connect to a bunker on another device to sign events')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === 'bunker' ? (
          <BunkerMode identityPubkey={identityPubkey} />
        ) : (
          <ClientMode />
        )}
      </CardContent>
    </Card>
  );
}

// Bunker Mode - This device holds the key
function BunkerMode({ identityPubkey }: { identityPubkey: string }) {
  const { t } = useTranslation();
  const [connections, setConnections] = useState<DBBunkerConnection[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [showNewConnection, setShowNewConnection] = useState(false);
  const [connectionToRevoke, setConnectionToRevoke] = useState<string | null>(null);

  useEffect(() => {
    loadConnections();

    // Subscribe to approval requests
    const unsubApprovals = bunkerService.onApprovalRequest((approval) => {
      setPendingApprovals((prev) => [...prev, approval]);
    });

    // Subscribe to connection updates
    const unsubConnections = bunkerService.onConnectionUpdate(() => {
      loadConnections();
    });

    return () => {
      unsubApprovals();
      unsubConnections();
    };
  }, [identityPubkey]);

  const loadConnections = async () => {
    const conns = await bunkerService.getConnections(identityPubkey);
    setConnections(conns);
  };

  const handleApproval = (requestId: string, approved: boolean) => {
    bunkerService.respondToApproval(requestId, approved);
    setPendingApprovals((prev) => prev.filter((a) => a.request.id !== requestId));
  };

  const handleRevokeConnection = async () => {
    if (!connectionToRevoke) return;
    await bunkerService.revokeConnection(connectionToRevoke);
    setConnectionToRevoke(null);
    loadConnections();
  };

  const activeConnections = connections.filter((c) => c.status === 'approved');
  const pendingConnections = connections.filter((c) => c.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Pending Approval Requests */}
      {pendingApprovals.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            {t('settings.remoteSigning.pendingApprovals', 'Pending Signing Requests')}
          </h4>
          {pendingApprovals.map((approval) => (
            <div
              key={approval.request.id}
              className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{approval.connection.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('settings.remoteSigning.requestType', 'Request:')} {approval.request.method}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApproval(approval.request.id, false)}
                  >
                    {t('common.deny', 'Deny')}
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproval(approval.request.id, true)}
                  >
                    {t('common.approve', 'Approve')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add New Connection Button */}
      <Dialog open={showNewConnection} onOpenChange={setShowNewConnection}>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            {t('settings.remoteSigning.addConnection', 'Add Remote Connection')}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <NewBunkerConnectionDialog
            identityPubkey={identityPubkey}
            onClose={() => {
              setShowNewConnection(false);
              loadConnections();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Active Connections */}
      {activeConnections.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('settings.remoteSigning.activeConnections', 'Active Connections')}</h4>
          {activeConnections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              onRevoke={() => setConnectionToRevoke(conn.id)}
            />
          ))}
        </div>
      )}

      {/* Pending Connections */}
      {pendingConnections.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('settings.remoteSigning.pendingConnections', 'Pending Connections')}</h4>
          {pendingConnections.map((conn) => (
            <PendingConnectionCard
              key={conn.id}
              connection={conn}
              onApprove={() => bunkerService.approveConnection(conn.id).then(loadConnections)}
              onDeny={() => bunkerService.denyConnection(conn.id).then(loadConnections)}
            />
          ))}
        </div>
      )}

      {activeConnections.length === 0 && pendingConnections.length === 0 && pendingApprovals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Link2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t('settings.remoteSigning.noConnections', 'No remote connections')}</p>
          <p className="text-sm">{t('settings.remoteSigning.noConnectionsDesc', 'Add a connection to allow other devices to sign using this identity.')}</p>
        </div>
      )}

      {/* Revoke Confirmation */}
      <AlertDialog open={!!connectionToRevoke} onOpenChange={() => setConnectionToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('settings.remoteSigning.revokeTitle', 'Revoke Connection')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('settings.remoteSigning.revokeDesc', 'This device will no longer be able to sign events. You can always add it back later.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeConnection} className="bg-destructive text-destructive-foreground">
              {t('common.revoke', 'Revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Client Mode - Connect to external bunker
function ClientMode() {
  const { t } = useTranslation();
  const [connections, setConnections] = useState<DBBunkerConnection[]>([]);
  const [connectionString, setConnectionString] = useState('');
  const [error, setError] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadConnections();

    const unsubState = remoteSigner.onStateChange(() => {
      loadConnections();
    });

    return () => unsubState();
  }, []);

  const loadConnections = async () => {
    const conns = await remoteSigner.getSavedConnections();
    setConnections(conns);
  };

  const handleConnect = async () => {
    if (!connectionString.startsWith('bunker://')) {
      setError(t('settings.remoteSigning.invalidConnectionString', 'Invalid connection string. Must start with bunker://'));
      return;
    }

    setIsConnecting(true);
    setError('');

    try {
      await remoteSigner.connect(connectionString);
      setConnectionString('');
      loadConnections();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async (connectionId: string) => {
    try {
      await remoteSigner.reconnect(connectionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reconnection failed');
    }
  };

  const handleDelete = async (connectionId: string) => {
    await remoteSigner.deleteConnection(connectionId);
    loadConnections();
  };

  const state = remoteSigner.getState();

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {state.connected && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertTitle>{t('settings.remoteSigning.connected', 'Connected')}</AlertTitle>
          <AlertDescription>
            {t('settings.remoteSigning.connectedTo', 'Connected to bunker:')} {state.bunkerPubkey?.slice(0, 8)}...
          </AlertDescription>
        </Alert>
      )}

      {/* New Connection */}
      <div className="space-y-3">
        <Label>{t('settings.remoteSigning.connectionString', 'Bunker Connection String')}</Label>
        <div className="flex gap-2">
          <Input
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
            placeholder="bunker://npub1..."
            className="font-mono text-sm"
          />
          <Button onClick={handleConnect} disabled={isConnecting || !connectionString}>
            <Link2 className="h-4 w-4 mr-2" />
            {isConnecting ? t('common.connecting', 'Connecting...') : t('common.connect', 'Connect')}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
      </div>

      {/* Saved Connections */}
      {connections.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium">{t('settings.remoteSigning.savedConnections', 'Saved Connections')}</h4>
          {connections.map((conn) => (
            <div key={conn.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <Key className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{conn.name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      {conn.remotePubkey.slice(0, 16)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={conn.status === 'approved' ? 'default' : 'secondary'}>
                    {conn.status}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleReconnect(conn.id)}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(conn.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {connections.length === 0 && !state.connected && (
        <div className="text-center py-8 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t('settings.remoteSigning.noSavedConnections', 'No saved connections')}</p>
          <p className="text-sm">{t('settings.remoteSigning.noSavedConnectionsDesc', 'Enter a bunker connection string to connect to a remote signer.')}</p>
        </div>
      )}
    </div>
  );
}

// Connection Card Component
function ConnectionCard({
  connection,
  onRevoke,
}: {
  connection: DBBunkerConnection;
  onRevoke: () => void;
}) {
  const { t } = useTranslation();
  const permissions: Nip46Permission[] = JSON.parse(connection.permissions);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-100 dark:bg-green-900 p-2">
            <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-medium">{connection.name}</p>
            <p className="text-sm text-muted-foreground font-mono">
              {connection.remotePubkey.slice(0, 16)}...
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRevoke} className="text-destructive">
              <Unlink className="h-4 w-4 mr-2" />
              {t('common.revoke', 'Revoke')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Separator className="my-3" />

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{t('settings.remoteSigning.lastUsed', 'Last used:')} {new Date(connection.lastConnected).toLocaleDateString()}</span>
        </div>
        <div className="flex gap-1">
          {permissions.slice(0, 3).map((p) => (
            <Badge key={p} variant="outline" className="text-xs">
              {p.replace('_', ' ')}
            </Badge>
          ))}
          {permissions.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{permissions.length - 3}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

// Pending Connection Card
function PendingConnectionCard({
  connection,
  onApprove,
  onDeny,
}: {
  connection: DBBunkerConnection;
  onApprove: () => void;
  onDeny: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="border rounded-lg p-4 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900 p-2">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="font-medium">{connection.name}</p>
            <p className="text-sm text-muted-foreground font-mono">
              {connection.remotePubkey.slice(0, 16)}...
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onDeny}>
            {t('common.deny', 'Deny')}
          </Button>
          <Button size="sm" onClick={onApprove}>
            {t('common.approve', 'Approve')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// New Bunker Connection Dialog
function NewBunkerConnectionDialog({
  identityPubkey: _identityPubkey,
  onClose,
}: {
  identityPubkey: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [connectionString, setConnectionString] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const relays = ['wss://relay.damus.io', 'wss://nos.lol'];

  useEffect(() => {
    generateConnectionString();
  }, []);

  const generateConnectionString = async () => {
    const connString = bunkerService.generateConnectionString(relays);
    setConnectionString(connString);

    const qr = await QRCode.toDataURL(connString, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 200,
    });
    setQrDataUrl(qr);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(connectionString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('settings.remoteSigning.newConnectionTitle', 'Add Remote Connection')}</DialogTitle>
        <DialogDescription>
          {t('settings.remoteSigning.newConnectionDesc', 'Share this connection string or QR code with the device you want to connect.')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="flex justify-center">
          {qrDataUrl && (
            <div className="border rounded-lg p-4">
              <img src={qrDataUrl} alt="Connection QR Code" className="w-48 h-48" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>{t('settings.remoteSigning.connectionString', 'Connection String')}</Label>
          <div className="flex gap-2">
            <Input
              value={connectionString}
              readOnly
              className="font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            {t('settings.remoteSigning.securityNote', 'Only share this with devices you trust. The connected device will be able to sign events on your behalf.')}
          </AlertDescription>
        </Alert>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>
          {t('common.done', 'Done')}
        </Button>
      </DialogFooter>
    </>
  );
}

export default RemoteSigningPanel;
