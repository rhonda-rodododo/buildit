/**
 * Tor Integration Types
 * Types for Tor/onion relay configuration and status
 */

/**
 * Tor connection status
 */
export enum TorStatus {
  DISABLED = 'disabled',
  DETECTING = 'detecting',
  ENABLED = 'enabled',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * Tor connection method
 */
export enum TorConnectionMethod {
  /** Automatically detect Tor Browser */
  AUTO = 'auto',
  /** User running Tor Browser */
  TOR_BROWSER = 'tor_browser',
  /** Manual SOCKS5 proxy configuration */
  MANUAL_PROXY = 'manual_proxy',
  /** Disabled */
  DISABLED = 'disabled',
}

/**
 * SOCKS5 proxy configuration
 */
export interface Socks5Config {
  /** Proxy host (usually 127.0.0.1 or localhost) */
  host: string;
  /** Proxy port (default 9050 for Tor, 9150 for Tor Browser) */
  port: number;
  /** Enable DNS resolution through proxy */
  resolveDNS: boolean;
}

/**
 * Tor configuration
 */
export interface TorConfig {
  /** Connection method */
  method: TorConnectionMethod;
  /** Enable Tor routing */
  enabled: boolean;
  /** SOCKS5 proxy configuration (for manual method) */
  socks5?: Socks5Config;
  /** Use .onion relays exclusively */
  onionOnly: boolean;
  /** Fallback to clearnet relays if .onion unavailable */
  fallbackToClearnet: boolean;
  /** Enable enhanced security features */
  enhancedSecurity: {
    /** Block WebRTC to prevent IP leaks */
    blockWebRTC: boolean;
    /** Block geolocation API */
    blockGeolocation: boolean;
    /** Enhanced fingerprinting protection */
    fingerprintProtection: boolean;
  };
}

/**
 * Onion relay configuration
 */
export interface OnionRelay {
  /** .onion address (ws:// protocol) */
  url: string;
  /** Relay name/description */
  name?: string;
  /** Enable for read operations */
  read: boolean;
  /** Enable for write operations */
  write: boolean;
  /** Last health check timestamp */
  lastHealthCheck?: number;
  /** Health status */
  healthy?: boolean;
  /** Connection latency (ms) */
  latency?: number;
}

/**
 * Tor circuit information
 */
export interface TorCircuit {
  /** Circuit ID */
  id: string;
  /** Circuit status */
  status: 'building' | 'built' | 'failed';
  /** Circuit path (relay fingerprints) */
  path: string[];
  /** Build time (ms) */
  buildTime?: number;
}

/**
 * Tor connection statistics
 */
export interface TorStats {
  /** Connected .onion relays */
  connectedOnionRelays: number;
  /** Total .onion relays configured */
  totalOnionRelays: number;
  /** Connected clearnet relays */
  connectedClearnetRelays: number;
  /** Average latency to .onion relays (ms) */
  avgOnionLatency: number;
  /** Bytes sent over Tor */
  bytesSent: number;
  /** Bytes received over Tor */
  bytesReceived: number;
  /** Connection uptime (ms) */
  uptime: number;
}

/**
 * Default Tor configuration
 */
export const DEFAULT_TOR_CONFIG: TorConfig = {
  method: TorConnectionMethod.AUTO,
  enabled: false,
  socks5: {
    host: '127.0.0.1',
    port: 9050, // Standard Tor SOCKS5 port
    resolveDNS: true,
  },
  onionOnly: false,
  fallbackToClearnet: true,
  enhancedSecurity: {
    blockWebRTC: true,
    blockGeolocation: true,
    fingerprintProtection: true,
  },
};

/**
 * Known .onion Nostr relays
 * Source: https://github.com/0xtrr/onion-service-nostr-relays
 */
export const KNOWN_ONION_RELAYS: OnionRelay[] = [
  {
    url: 'ws://oxtrdevav64z64yb7x6rjg4ntzqjhedm5b5zjqulugknhzr46ny2qbad.onion',
    name: 'Oxtro Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://skzzn6cimfdv5e2phjc4yr5v7ikbxtn5f7dkwn5c7v47tduzlbosqmqd.onion',
    name: 'Skzzn Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://2jsnlhfnelig5acq6iacydmzdbdmg7xwunm4xl6qwbvzacw4lwrjmlyd.onion',
    name: 'JSNL Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://nostrland2gdw7g3y77ctftovvil76vquipymo7tsctlxpiwknevzfid.onion',
    name: 'Nostrland Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://bitcoinr6de5lkvx4tpwdmzrdfdpla5sya2afwpcabjup2xpi5dulbad.onion',
    name: 'Bitcoin Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://westbtcebhgi4ilxxziefho6bqu5lqwa5ncfjefnfebbhx2cwqx5knyd.onion',
    name: 'West BTC Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://sovbitm2enxfr5ot6qscwy5ermdffbqscy66wirkbsigvcshumyzbbqd.onion',
    name: 'Sovbit Mirror Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://sovbitgz5uqyh7jwcsudq4sspxlj4kbnurvd3xarkkx2use3k6rlibqd.onion',
    name: 'Sovbit Gateway Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://nostrwinemdptvqukjttinajfeedhf46hfd5bz2aj2q5uwp7zros3nad.onion',
    name: 'Nostr Wine Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://wineinboxkayswlofkugkjwhoyi744qvlzdxlmdvwe7cei2xxy4gc6ad.onion',
    name: 'Wine Inbox Relay',
    read: true,
    write: true,
  },
  {
    url: 'ws://winefiltermhqixxzmnzxhrmaufpnfq3rmjcl6ei45iy4aidrngpsyid.onion',
    name: 'Wine Filter Relay',
    read: true,
    write: true,
  },
];
