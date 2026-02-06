/**
 * Sentry Error Tracking - Privacy-Preserving Configuration
 *
 * CRITICAL: This module strips ALL PII before sending error reports.
 * No pubkeys, message content, usernames, IPs, or user directory paths
 * are ever sent to Sentry.
 *
 * Sentry is loaded lazily to avoid impacting startup performance.
 */

// --------------------------------------------------------------------------
// Types (Sentry SDK types reproduced here to avoid importing the full SDK
// at the module level - the SDK is loaded lazily)
// --------------------------------------------------------------------------

interface SentryEvent {
  exception?: {
    values?: Array<{
      value?: string;
      type?: string;
      stacktrace?: {
        frames?: Array<{
          filename?: string;
          abs_path?: string;
          function?: string;
          [key: string]: unknown;
        }>;
      };
    }>;
  };
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
  }>;
  request?: {
    url?: string;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };
  user?: Record<string, unknown>;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

interface SentryHint {
  originalException?: unknown;
  [key: string]: unknown;
}

interface SentryBreadcrumb {
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  type?: string;
  timestamp?: number;
}

// --------------------------------------------------------------------------
// PII Scrubbing Patterns
// --------------------------------------------------------------------------

/**
 * Patterns that match sensitive data which must be redacted before
 * any data leaves the client.
 */
const PII_PATTERNS = {
  /** Hex-encoded public keys (64-char hex strings typical of Nostr npubs) */
  PUBKEY_HEX: /\b[0-9a-f]{64}\b/gi,

  /** npub/nsec/note bech32-encoded Nostr identifiers */
  NOSTR_BECH32: /\b(npub|nsec|note|nprofile|nevent|naddr)1[0-9a-z]{6,}\b/gi,

  /** IPv4 addresses */
  IPV4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

  /** IPv6 addresses (simplified pattern) */
  IPV6: /\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b/g,

  /** User home directory paths (Linux, macOS, Windows) */
  USER_PATH: /(?:\/home\/[^/\s]+|\/Users\/[^/\s]+|C:\\Users\\[^\\\s]+)/g,

  /** Email-like patterns */
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
} as const;

/**
 * Scrub a string of all PII patterns.
 * Public keys are truncated to first 8 characters with "..." suffix.
 */
function scrubString(input: string): string {
  let result = input;

  // Replace full pubkeys with truncated versions
  result = result.replace(PII_PATTERNS.PUBKEY_HEX, (match) => {
    return `${match.slice(0, 8)}...`;
  });

  // Replace Nostr bech32 identifiers
  result = result.replace(PII_PATTERNS.NOSTR_BECH32, (match) => {
    const prefix = match.slice(0, match.indexOf('1') + 1);
    return `${prefix}[REDACTED]`;
  });

  // Replace IP addresses
  result = result.replace(PII_PATTERNS.IPV4, '[IP_REDACTED]');
  result = result.replace(PII_PATTERNS.IPV6, '[IP_REDACTED]');

  // Replace user directory paths
  result = result.replace(PII_PATTERNS.USER_PATH, '[USER_DIR]');

  // Replace email addresses
  result = result.replace(PII_PATTERNS.EMAIL, '[EMAIL_REDACTED]');

  return result;
}

/**
 * Recursively scrub PII from an arbitrary object structure.
 * Handles strings, arrays, and nested objects.
 */
function scrubObject<T>(obj: T, depth = 0): T {
  // Prevent infinite recursion
  if (depth > 10) return obj;

  if (typeof obj === 'string') {
    return scrubString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => scrubObject(item, depth + 1)) as T;
  }

  if (obj !== null && typeof obj === 'object') {
    const scrubbed: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Completely redact known sensitive field names
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('password') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('privkey') ||
        lowerKey.includes('private_key') ||
        lowerKey.includes('mnemonic') ||
        lowerKey.includes('seed') ||
        lowerKey.includes('nsec') ||
        lowerKey === 'content' ||
        lowerKey === 'plaintext' ||
        lowerKey === 'message_body'
      ) {
        scrubbed[key] = '[REDACTED]';
      } else {
        scrubbed[key] = scrubObject(value, depth + 1);
      }
    }
    return scrubbed as T;
  }

  return obj;
}

// --------------------------------------------------------------------------
// Sentry Hooks
// --------------------------------------------------------------------------

/**
 * beforeSend hook that strips all PII from Sentry events.
 * This is the last line of defense before data leaves the client.
 */
function beforeSend(event: SentryEvent, _hint: SentryHint): SentryEvent | null {
  // Never send user data
  delete event.user;

  // Scrub request data
  if (event.request) {
    // Remove IP from headers
    if (event.request.headers) {
      delete event.request.headers['X-Forwarded-For'];
      delete event.request.headers['X-Real-IP'];
      delete event.request.headers['CF-Connecting-IP'];
      // Remove cookie and authorization headers entirely
      delete event.request.headers['Cookie'];
      delete event.request.headers['Authorization'];
    }
    // Scrub URL of potential PII in query params
    if (event.request.url) {
      event.request.url = scrubString(event.request.url);
    }
  }

  // Scrub exception values and stack traces
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = scrubString(exception.value);
      }
      if (exception.stacktrace?.frames) {
        for (const frame of exception.stacktrace.frames) {
          if (frame.filename) {
            frame.filename = scrubString(frame.filename);
          }
          if (frame.abs_path) {
            frame.abs_path = scrubString(frame.abs_path);
          }
        }
      }
    }
  }

  // Scrub breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => scrubObject(breadcrumb));
  }

  // Scrub message
  if (event.message) {
    event.message = scrubString(event.message);
  }

  // Scrub tags and extra
  if (event.tags) {
    event.tags = scrubObject(event.tags);
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra);
  }

  return event;
}

/**
 * beforeBreadcrumb hook to filter and scrub breadcrumbs.
 */
function beforeBreadcrumb(breadcrumb: SentryBreadcrumb): SentryBreadcrumb | null {
  // Drop breadcrumbs that might contain message content
  if (breadcrumb.category === 'console' && breadcrumb.message) {
    // Only keep error-level console breadcrumbs
    if (breadcrumb.level !== 'error' && breadcrumb.level !== 'warning') {
      return null;
    }
  }

  // Scrub all breadcrumb data
  if (breadcrumb.message) {
    breadcrumb.message = scrubString(breadcrumb.message);
  }
  if (breadcrumb.data) {
    breadcrumb.data = scrubObject(breadcrumb.data);
  }

  return breadcrumb;
}

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------

/** Whether Sentry has been initialized */
let _initialized = false;

/** Lazily-loaded Sentry SDK reference */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;

/**
 * Configuration for Sentry initialization.
 */
export interface SentryConfig {
  /** Sentry DSN - if not provided, Sentry will not initialize */
  dsn?: string;
  /** Environment (production, staging, development) */
  environment?: string;
  /** Release version string */
  release?: string;
  /** Sample rate for error events (0.0 to 1.0) */
  sampleRate?: number;
  /** Sample rate for performance tracing (0.0 to 1.0) */
  tracesSampleRate?: number;
  /** Enable debug mode (logs to console) */
  debug?: boolean;
}

/**
 * Initialize Sentry error tracking with privacy-preserving defaults.
 *
 * Sentry is loaded lazily - this function dynamically imports the SDK
 * to avoid impacting initial bundle size and startup time.
 *
 * If no DSN is provided or SENTRY_DSN env var is not set, initialization
 * is silently skipped and all capture methods become no-ops.
 */
export async function initSentry(config: SentryConfig = {}): Promise<void> {
  if (_initialized) return;

  const dsn = config.dsn || import.meta.env.VITE_SENTRY_DSN;

  // No DSN = no Sentry. This is expected in development.
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.debug('[Monitoring] Sentry DSN not configured, error tracking disabled');
    }
    return;
  }

  try {
    // Dynamic import to keep Sentry out of the main bundle
    const Sentry = await import('@sentry/react');
    _sentry = Sentry;

    Sentry.init({
      dsn,
      environment: config.environment || import.meta.env.MODE || 'production',
      release: config.release || import.meta.env.VITE_APP_VERSION || '0.0.0',

      // Sampling
      sampleRate: config.sampleRate ?? 1.0,
      tracesSampleRate: config.tracesSampleRate ?? 0.1,

      // Privacy: strip PII before sending
      beforeSend: beforeSend as Parameters<typeof Sentry.init>[0] extends { beforeSend?: infer F } ? F : never,
      beforeBreadcrumb: beforeBreadcrumb as Parameters<typeof Sentry.init>[0] extends { beforeBreadcrumb?: infer F } ? F : never,

      // Do not send default PII (IPs, cookies, etc.)
      sendDefaultPii: false,

      // Limit breadcrumbs to reduce noise
      maxBreadcrumbs: 50,

      // Integrations
      integrations: [
        // Browser tracing for performance monitoring
        Sentry.browserTracingIntegration({
          // Do not trace all page loads, only sampled ones
          instrumentNavigation: true,
          instrumentPageLoad: true,
        }),
      ],

      // Ignore common non-actionable errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'originalCreateNotification',
        'canvas.contentDocument',
        'MyApp_RemoveAllHighlights',
        // Network errors (expected in offline-first app)
        'Network request failed',
        'Failed to fetch',
        'NetworkError',
        'Load failed',
        // ResizeObserver (browser quirk, not a real error)
        'ResizeObserver loop',
        // Tauri-specific
        'window.__TAURI__',
      ],

      // Only send errors from our own code
      allowUrls: [
        /buildit\.network/i,
        /localhost/i,
        /tauri:\/\//i,
      ],

      debug: config.debug ?? false,
    });

    _initialized = true;

    if (import.meta.env.DEV) {
      console.debug('[Monitoring] Sentry initialized (privacy-preserving mode)');
    }
  } catch (error) {
    // Sentry failing to load should never break the app
    console.warn('[Monitoring] Failed to initialize Sentry:', error);
  }
}

// --------------------------------------------------------------------------
// Public API - Safe wrappers that work even if Sentry is not initialized
// --------------------------------------------------------------------------

/**
 * Capture an exception and send it to Sentry.
 * No-op if Sentry is not initialized.
 */
export function captureException(error: Error, context?: Record<string, unknown>): void {
  if (!_sentry) {
    if (import.meta.env.DEV) {
      console.error('[Monitoring] Error captured (Sentry not initialized):', error);
    }
    return;
  }

  _sentry.captureException(error, {
    extra: context ? scrubObject(context) : undefined,
  });
}

/**
 * Capture a message and send it to Sentry.
 * No-op if Sentry is not initialized.
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
): void {
  if (!_sentry) return;
  _sentry.captureMessage(scrubString(message), level);
}

/**
 * Add a privacy-safe breadcrumb for debugging context.
 */
export function addBreadcrumb(breadcrumb: SentryBreadcrumb): void {
  if (!_sentry) return;
  _sentry.addBreadcrumb(scrubObject(breadcrumb));
}

/**
 * Set non-PII tags for error categorization.
 * Tags should NEVER contain user-identifiable information.
 */
export function setTag(key: string, value: string): void {
  if (!_sentry) return;
  _sentry.setTag(key, scrubString(value));
}

/**
 * Set the current transaction name for performance monitoring.
 */
export function setTransactionName(name: string): void {
  if (!_sentry) return;
  const scope = _sentry.getCurrentScope();
  if (scope) {
    scope.setTransactionName(name);
  }
}

// --------------------------------------------------------------------------
// Convenience: Key Action Breadcrumbs
// --------------------------------------------------------------------------

/**
 * Record a navigation breadcrumb (route change).
 */
export function trackNavigation(from: string, to: string): void {
  addBreadcrumb({
    category: 'navigation',
    message: `${from} -> ${to}`,
    level: 'info',
  });
}

/**
 * Record a module enable/disable action.
 */
export function trackModuleToggle(moduleId: string, enabled: boolean): void {
  addBreadcrumb({
    category: 'module',
    message: `Module ${moduleId} ${enabled ? 'enabled' : 'disabled'}`,
    level: 'info',
  });
}

/**
 * Record a BLE connection event.
 */
export function trackBLEEvent(action: string, success: boolean): void {
  addBreadcrumb({
    category: 'ble',
    message: `BLE ${action}: ${success ? 'success' : 'failure'}`,
    level: success ? 'info' : 'warning',
  });
}

/**
 * Record a relay connection event.
 */
export function trackRelayEvent(action: string, relayUrl: string): void {
  // Scrub the relay URL just in case
  addBreadcrumb({
    category: 'relay',
    message: `Relay ${action}: ${scrubString(relayUrl)}`,
    level: 'info',
  });
}

// --------------------------------------------------------------------------
// Exports for testing
// --------------------------------------------------------------------------

export const _testing = {
  scrubString,
  scrubObject,
  beforeSend,
  beforeBreadcrumb,
  PII_PATTERNS,
};
