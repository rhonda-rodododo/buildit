/**
 * Tor Store
 * Manages Tor configuration, status, and .onion relay connections
 */

import { create } from 'zustand';
import {
  TorStatus,
  TorConnectionMethod,
  type TorConfig,
  type OnionRelay,
  type TorStats,
  DEFAULT_TOR_CONFIG,
  KNOWN_ONION_RELAYS,
} from './types';
import {
  detectTorBrowser,
  canAccessOnionServices,
  getTorSecurityWarnings,
} from './detection';

interface TorStore {
  /** Current Tor configuration */
  config: TorConfig;

  /** Current Tor status */
  status: TorStatus;

  /** Available .onion relays */
  onionRelays: OnionRelay[];

  /** Tor statistics */
  stats: TorStats;

  /** Security warnings */
  warnings: string[];

  /** Last detection timestamp */
  lastDetection: number | null;

  // Actions
  /** Initialize Tor detection and configuration */
  initialize: () => Promise<void>;

  /** Update Tor configuration */
  updateConfig: (config: Partial<TorConfig>) => void;

  /** Enable Tor routing */
  enable: () => Promise<void>;

  /** Disable Tor routing */
  disable: () => void;

  /** Add custom .onion relay */
  addOnionRelay: (relay: OnionRelay) => void;

  /** Remove .onion relay */
  removeOnionRelay: (url: string) => void;

  /** Health check for .onion relays */
  healthCheckRelays: () => Promise<void>;

  /** Get active relay URLs (based on Tor config) */
  getActiveRelays: () => string[];

  /** Update statistics */
  updateStats: (stats: Partial<TorStats>) => void;

  /** Refresh security warnings */
  refreshWarnings: () => void;
}

export const useTorStore = create<TorStore>()(
  (set, get) => ({
      config: DEFAULT_TOR_CONFIG,
      status: TorStatus.DISABLED,
      onionRelays: KNOWN_ONION_RELAYS,
      stats: {
        connectedOnionRelays: 0,
        totalOnionRelays: KNOWN_ONION_RELAYS.length,
        connectedClearnetRelays: 0,
        avgOnionLatency: 0,
        bytesSent: 0,
        bytesReceived: 0,
        uptime: 0,
      },
      warnings: [],
      lastDetection: null,

      initialize: async () => {
        console.info('[Tor] Initializing Tor detection...');
        set({ status: TorStatus.DETECTING });

        try {
          // Detect Tor Browser
          const isTorBrowser = detectTorBrowser();
          const canAccessOnion = await canAccessOnionServices();

          console.info('[Tor] Detection:', { isTorBrowser, canAccessOnion });

          if (isTorBrowser && canAccessOnion) {
            // Auto-enable Tor if Tor Browser detected
            set((state) => ({
              config: {
                ...state.config,
                method: TorConnectionMethod.TOR_BROWSER,
                enabled: true,
              },
              status: TorStatus.ENABLED,
              lastDetection: Date.now(),
            }));
            console.info('[Tor] Tor Browser detected - auto-enabled');
          } else {
            // Not in Tor Browser - remain disabled
            set({
              status: TorStatus.DISABLED,
              lastDetection: Date.now(),
            });
          }

          // Refresh security warnings
          get().refreshWarnings();
        } catch (error) {
          console.error('[Tor] Detection failed:', error);
          set({
            status: TorStatus.ERROR,
            lastDetection: Date.now(),
          });
        }
      },

      updateConfig: (newConfig) => {
        set((state) => ({
          config: {
            ...state.config,
            ...newConfig,
          },
        }));

        // Refresh warnings when config changes
        get().refreshWarnings();
      },

      enable: async () => {
        const state = get();

        console.info('[Tor] Enabling Tor routing...');
        set({ status: TorStatus.CONNECTING });

        try {
          // Check if we can use .onion services
          const canAccess = await canAccessOnionServices();

          if (!canAccess && state.config.onionOnly) {
            throw new Error(
              'Cannot access .onion services. ' +
              'Please use Tor Browser or disable "Onion Only" mode.'
            );
          }

          // Enable Tor
          set((state) => ({
            config: {
              ...state.config,
              enabled: true,
            },
            status: TorStatus.CONNECTED,
          }));

          console.info('[Tor] Tor routing enabled');

          // Start health checks
          get().healthCheckRelays();
        } catch (error) {
          console.error('[Tor] Failed to enable:', error);
          set({
            status: TorStatus.ERROR,
            warnings: [
              ...(get().warnings || []),
              `Failed to enable Tor: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ],
          });
          throw error;
        }
      },

      disable: () => {
        console.info('[Tor] Disabling Tor routing...');
        set((state) => ({
          config: {
            ...state.config,
            enabled: false,
          },
          status: TorStatus.DISABLED,
        }));
      },

      addOnionRelay: (relay) => {
        set((state) => {
          // Check for duplicates
          if (state.onionRelays.some((r) => r.url === relay.url)) {
            console.warn('[Tor] Relay already exists:', relay.url);
            return state;
          }

          return {
            onionRelays: [...state.onionRelays, relay],
            stats: {
              ...state.stats,
              totalOnionRelays: state.stats.totalOnionRelays + 1,
            },
          };
        });
      },

      removeOnionRelay: (url) => {
        set((state) => ({
          onionRelays: state.onionRelays.filter((r) => r.url !== url),
          stats: {
            ...state.stats,
            totalOnionRelays: Math.max(0, state.stats.totalOnionRelays - 1),
          },
        }));
      },

      healthCheckRelays: async () => {
        console.info('[Tor] Starting relay health checks...');

        const relays = get().onionRelays;
        const healthChecks = relays.map(async (relay) => {
          const startTime = Date.now();
          try {
            // Note: We can't actually health check .onion relays from browser
            // without being connected through Tor. This is a placeholder.
            // In production, health checks would happen through the Tor connection.

            const latency = Date.now() - startTime;

            return {
              ...relay,
              lastHealthCheck: Date.now(),
              healthy: true,
              latency,
            };
          } catch (error) {
            console.error('[Tor] Health check failed for', relay.url, error);
            return {
              ...relay,
              lastHealthCheck: Date.now(),
              healthy: false,
              latency: undefined,
            };
          }
        });

        const results = await Promise.allSettled(healthChecks);

        set({
          onionRelays: results.map((result, i) => {
            if (result.status === 'fulfilled') {
              return result.value;
            }
            // Health check failed - mark as unhealthy
            return {
              ...relays[i],
              lastHealthCheck: Date.now(),
              healthy: false,
            };
          }),
        });

        // Update stats
        const healthyCount = get().onionRelays.filter((r) => r.healthy).length;
        const avgLatency =
          get().onionRelays
            .filter((r) => r.latency !== undefined)
            .reduce((sum, r) => sum + (r.latency || 0), 0) /
          Math.max(1, healthyCount);

        set((state) => ({
          stats: {
            ...state.stats,
            connectedOnionRelays: healthyCount,
            avgOnionLatency: avgLatency,
          },
        }));

        console.info('[Tor] Health checks complete:', { healthyCount, avgLatency });
      },

      getActiveRelays: () => {
        const state = get();

        if (!state.config.enabled) {
          // Tor disabled - return empty (use default clearnet relays)
          return [];
        }

        if (state.config.onionOnly) {
          // Use only .onion relays
          return state.onionRelays.map((r) => r.url);
        }

        // Use .onion relays if available, fallback to clearnet
        if (state.config.fallbackToClearnet) {
          return state.onionRelays.map((r) => r.url);
          // Clearnet relays will be added by the relay manager if .onion fails
        }

        // Use .onion relays only (no fallback)
        return state.onionRelays.map((r) => r.url);
      },

      updateStats: (newStats) => {
        set((state) => ({
          stats: {
            ...state.stats,
            ...newStats,
          },
        }));
      },

      refreshWarnings: () => {
        const warnings = getTorSecurityWarnings();
        set({ warnings });
      },
    })
);
