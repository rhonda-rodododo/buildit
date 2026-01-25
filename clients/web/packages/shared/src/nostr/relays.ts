/**
 * Nostr Relay Configuration
 * Default relays for fetching public content
 */

/**
 * Default Nostr relays for public content
 */
export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
  'wss://relay.snort.social',
] as const;

/**
 * Relay pool configuration
 */
export interface RelayConfig {
  url: string;
  read: boolean;
  write: boolean;
  timeout?: number;
}

/**
 * Get default relay configuration
 */
export function getDefaultRelayConfig(): RelayConfig[] {
  return DEFAULT_RELAYS.map((url) => ({
    url,
    read: true,
    write: false, // SSR app is read-only
    timeout: 10000, // 10 second timeout
  }));
}
