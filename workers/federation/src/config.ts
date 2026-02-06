/**
 * Federation Worker configuration constants
 */

/** Maximum content length for AP notes */
export const AP_MAX_CONTENT_LENGTH = 5000;

/** Maximum content length for Bluesky posts (300 graphemes) */
export const AT_MAX_POST_GRAPHEMES = 300;

/** Maximum blob size for Bluesky uploads (1MB) */
export const AT_MAX_BLOB_SIZE = 1_000_000;

/** Bluesky PDS base URL */
export const AT_PDS_URL = 'https://bsky.social';

/** Bluesky API (AppView) base URL */
export const AT_API_URL = 'https://api.bsky.app';

/** Rate limit: max AP activities per minute per user */
export const AP_RATE_LIMIT_PER_MIN = 30;

/** Rate limit: max AT posts per minute per user */
export const AT_RATE_LIMIT_PER_MIN = 10;

/** How often to refresh AT sessions (in ms) — 6 hours */
export const AT_SESSION_REFRESH_INTERVAL = 6 * 60 * 60 * 1000;

/** Bridge reconnection delay (in ms) */
export const BRIDGE_RECONNECT_DELAY = 5_000;

/** Bridge subscription refresh interval (in ms) — 30 minutes */
export const BRIDGE_SUBSCRIPTION_REFRESH = 30 * 60 * 1000;

/** Federated event kinds — only these are eligible for federation */
export const FEDERABLE_KINDS = [0, 1, 5, 30023] as const;

/** ActivityPub content type */
export const AP_CONTENT_TYPE = 'application/activity+json';

/** ActivityPub context */
export const AP_CONTEXT = [
  'https://www.w3.org/ns/activitystreams',
  'https://w3id.org/security/v1',
] as const;

/** Software info for NodeInfo */
export const SOFTWARE_INFO = {
  name: 'buildit',
  version: '1.0.0',
  repository: 'https://github.com/buildit-network/buildit',
} as const;
