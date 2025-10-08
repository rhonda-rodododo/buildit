/**
 * Transport Status Indicator
 *
 * Shows connection status for BLE mesh (PRIMARY) and Nostr relays (SECONDARY)
 * Displays in header/status bar to inform users of offline/online status
 */

import { useEffect, useState } from 'react';
import { Bluetooth, Wifi, WifiOff, Radio } from 'lucide-react';
import { TransportService, TransportStatus, TransportType } from '@/core/transport';
import { cn } from '@/lib/utils';

export function TransportStatusIndicator() {
  const [bleStatus, setBleStatus] = useState<TransportStatus>(TransportStatus.DISCONNECTED);
  const [nostrStatus, setNostrStatus] = useState<TransportStatus>(TransportStatus.DISCONNECTED);
  const [blePeers, setBlePeers] = useState<number>(0);
  const [nostrRelays, setNostrRelays] = useState<number>(0);

  useEffect(() => {
    const transport = TransportService.getInstance();

    // Subscribe to BLE status changes
    const unsubBLE = transport.onStatusChange(TransportType.BLE_MESH, (status) => {
      setBleStatus(status);
      updatePeerCount();
    });

    // Subscribe to Nostr status changes
    const unsubNostr = transport.onStatusChange(TransportType.NOSTR_RELAY, (status) => {
      setNostrStatus(status);
      updateRelayCount();
    });

    // Update peer/relay counts
    const updatePeerCount = async () => {
      const peers = await transport.getBLEPeers();
      setBlePeers(peers.length);
    };

    const updateRelayCount = async () => {
      const relays = await transport.getNostrRelays();
      setNostrRelays(relays.length);
    };

    // Initial update
    updatePeerCount();
    updateRelayCount();

    // Periodic update every 10 seconds
    const interval = setInterval(() => {
      updatePeerCount();
      updateRelayCount();
    }, 10000);

    return () => {
      unsubBLE();
      unsubNostr();
      clearInterval(interval);
    };
  }, []);

  // Determine primary connection status
  const isConnected = bleStatus === TransportStatus.CONNECTED || nostrStatus === TransportStatus.CONNECTED;
  const isPrimary = bleStatus === TransportStatus.CONNECTED;

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* BLE Mesh Status (PRIMARY) */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md",
        bleStatus === TransportStatus.CONNECTED && "bg-green-500/10 text-green-500",
        bleStatus === TransportStatus.CONNECTING && "bg-yellow-500/10 text-yellow-500",
        bleStatus === TransportStatus.DISCONNECTED && "bg-gray-500/10 text-gray-500",
        bleStatus === TransportStatus.ERROR && "bg-red-500/10 text-red-500"
      )}>
        <Bluetooth className="w-4 h-4" />
        {bleStatus === TransportStatus.CONNECTED ? (
          <span className="text-xs font-medium">{blePeers} mesh</span>
        ) : (
          <span className="text-xs">Mesh</span>
        )}
      </div>

      {/* Nostr Relays Status (SECONDARY) */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md",
        nostrStatus === TransportStatus.CONNECTED && "bg-blue-500/10 text-blue-500",
        nostrStatus === TransportStatus.CONNECTING && "bg-yellow-500/10 text-yellow-500",
        nostrStatus === TransportStatus.DISCONNECTED && "bg-gray-500/10 text-gray-500",
        nostrStatus === TransportStatus.ERROR && "bg-red-500/10 text-red-500"
      )}>
        {nostrStatus === TransportStatus.CONNECTED ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        {nostrStatus === TransportStatus.CONNECTED ? (
          <span className="text-xs font-medium">{nostrRelays} relays</span>
        ) : (
          <span className="text-xs">Offline</span>
        )}
      </div>

      {/* Overall Status Icon */}
      {isConnected && (
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded-md",
          isPrimary ? "bg-green-500/10 text-green-500" : "bg-blue-500/10 text-blue-500"
        )}>
          <Radio className="w-4 h-4" />
          <span className="text-xs font-medium">
            {isPrimary ? 'Mesh' : 'Cloud'}
          </span>
        </div>
      )}
    </div>
  );
}
