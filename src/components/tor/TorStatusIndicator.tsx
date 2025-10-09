/**
 * Tor Status Indicator
 * Shows current Tor connection status with visual indicator
 */

import { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Shield, ShieldAlert, ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { useTorStore } from '@/core/tor/torStore';
import { TorStatus } from '@/core/tor/types';
import { cn } from '@/lib/utils';

interface TorStatusIndicatorProps {
  /** Show detailed status */
  detailed?: boolean;
  /** Custom className */
  className?: string;
}

export function TorStatusIndicator({ detailed = false, className }: TorStatusIndicatorProps) {
  const { status, stats, warnings, initialize } = useTorStore();

  // Initialize Tor detection on mount
  useEffect(() => {
    if (status === TorStatus.DISABLED) {
      initialize();
    }
  }, []);

  const getStatusConfig = (status: TorStatus) => {
    switch (status) {
      case TorStatus.DISABLED:
        return {
          icon: ShieldOff,
          label: 'Tor Disabled',
          color: 'text-muted-foreground',
          variant: 'outline' as const,
          description: 'Not connected through Tor',
        };
      case TorStatus.DETECTING:
        return {
          icon: Loader2,
          label: 'Detecting',
          color: 'text-muted-foreground',
          variant: 'outline' as const,
          description: 'Detecting Tor Browser...',
          animated: true,
        };
      case TorStatus.ENABLED:
        return {
          icon: Shield,
          label: 'Tor Enabled',
          color: 'text-blue-600',
          variant: 'secondary' as const,
          description: 'Tor routing enabled',
        };
      case TorStatus.CONNECTING:
        return {
          icon: Loader2,
          label: 'Connecting',
          color: 'text-yellow-600',
          variant: 'secondary' as const,
          description: 'Connecting to .onion relays...',
          animated: true,
        };
      case TorStatus.CONNECTED:
        return {
          icon: ShieldCheck,
          label: 'Tor Active',
          color: 'text-green-600',
          variant: 'default' as const,
          description: `Connected to ${stats.connectedOnionRelays} .onion relays`,
        };
      case TorStatus.ERROR:
        return {
          icon: ShieldAlert,
          label: 'Tor Error',
          color: 'text-destructive',
          variant: 'destructive' as const,
          description: warnings[0] || 'Connection error',
        };
      default:
        return {
          icon: Shield,
          label: 'Unknown',
          color: 'text-muted-foreground',
          variant: 'outline' as const,
          description: 'Unknown status',
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  if (!detailed) {
    // Compact indicator for header/navbar
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={config.variant} className={cn('flex items-center gap-1.5', className)}>
              <Icon
                className={cn(
                  'h-3.5 w-3.5',
                  config.color,
                  config.animated && 'animate-spin'
                )}
              />
              <span>{config.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              {status === TorStatus.CONNECTED && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p>Connected relays: {stats.connectedOnionRelays}/{stats.totalOnionRelays}</p>
                  {stats.avgOnionLatency > 0 && (
                    <p>Avg latency: {Math.round(stats.avgOnionLatency)}ms</p>
                  )}
                </div>
              )}
              {warnings.length > 0 && (
                <div className="text-xs text-destructive mt-2">
                  <p className="font-medium">Warnings:</p>
                  <ul className="list-disc list-inside">
                    {warnings.slice(0, 2).map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Detailed indicator for settings page
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg border', className)}>
      <Icon
        className={cn(
          'h-5 w-5 mt-0.5',
          config.color,
          config.animated && 'animate-spin'
        )}
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{config.label}</p>
          <Badge variant={config.variant} className="text-xs">
            {status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>

        {status === TorStatus.CONNECTED && (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Onion Relays</p>
              <p className="font-medium">
                {stats.connectedOnionRelays}/{stats.totalOnionRelays}
              </p>
            </div>
            {stats.avgOnionLatency > 0 && (
              <div>
                <p className="text-muted-foreground">Avg Latency</p>
                <p className="font-medium">{Math.round(stats.avgOnionLatency)}ms</p>
              </div>
            )}
            {stats.uptime > 0 && (
              <div>
                <p className="text-muted-foreground">Uptime</p>
                <p className="font-medium">
                  {Math.round(stats.uptime / 1000 / 60)} min
                </p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Data</p>
              <p className="font-medium">
                ↑ {formatBytes(stats.bytesSent)} / ↓ {formatBytes(stats.bytesReceived)}
              </p>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-3 p-3 bg-destructive/10 rounded-md">
            <p className="text-sm font-medium text-destructive mb-1">Security Warnings:</p>
            <ul className="text-sm text-destructive/90 space-y-1 list-disc list-inside">
              {warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
}
