/**
 * Scoped debug logging utility
 *
 * In production: Only critical errors are logged
 * In development: Controlled by DEBUG flag
 *
 * Usage:
 *   // Set debug scopes (localStorage or env var)
 *   localStorage.setItem('DEBUG', 'transport,sync')  // specific scopes
 *   localStorage.setItem('DEBUG', '*')               // all scopes
 *   // Or: VITE_DEBUG=transport,sync bun run dev
 *
 *   // Create scoped logger
 *   const log = createLogger('transport');
 *   log.debug('Connecting...');  // only if 'transport' in DEBUG
 *   log.info('Connected');       // only if 'transport' in DEBUG
 *   log.warn('Slow connection'); // always in dev
 *   log.error('Failed');         // always
 *
 * Available scopes:
 *   transport - relay connections, WebSocket
 *   sync      - data syncing with relays
 *   messaging - message receiver, conversations
 *   modules   - module registration/lifecycle
 *   db        - database operations
 *   offline   - cache, queue processing
 *   auth      - identity, sessions, device sync
 *   ble       - BLE mesh networking
 *   tor       - Tor routing
 *   init      - app initialization
 */

const isDev = import.meta.env.DEV;

/**
 * Get enabled debug scopes from localStorage or env var
 */
function getDebugScopes(): Set<string> {
  if (!isDev) return new Set();

  try {
    // Check localStorage first (can be changed at runtime)
    const localDebug = typeof localStorage !== 'undefined'
      ? localStorage.getItem('DEBUG')
      : null;

    // Fall back to env var
    const debugValue = localDebug ?? import.meta.env.VITE_DEBUG ?? '';

    if (!debugValue) return new Set();
    if (debugValue === '*') return new Set(['*']);

    return new Set(
      debugValue
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

/**
 * Check if a scope is enabled for debug logging
 */
function isScopeEnabled(scope: string): boolean {
  const scopes = getDebugScopes();
  if (scopes.has('*')) return true;
  return scopes.has(scope.toLowerCase());
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}

const noop = (): void => {};

const noopLogger: Logger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  group: noop,
  groupEnd: noop,
  time: noop,
  timeEnd: noop,
};

/**
 * Create a scoped logger
 *
 * debug/info only log if the scope is in DEBUG
 * warn/error always log in dev mode
 */
export function createLogger(scope: string): Logger {
  if (!isDev) {
    // Production: only errors via criticalLogger
    return {
      ...noopLogger,
      error: (...args: unknown[]) => console.error(`[${scope}]`, ...args),
    };
  }

  const prefix = `[${scope}]`;

  return {
    debug: (...args: unknown[]) => {
      if (isScopeEnabled(scope)) {
        console.debug(prefix, ...args);
      }
    },
    info: (...args: unknown[]) => {
      if (isScopeEnabled(scope)) {
        console.info(prefix, ...args);
      }
    },
    // Warnings always show in dev
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    // Errors always show
    error: (...args: unknown[]) => console.error(prefix, ...args),
    group: (label: string) => {
      if (isScopeEnabled(scope)) {
        console.group(`${prefix} ${label}`);
      }
    },
    groupEnd: () => {
      if (isScopeEnabled(scope)) {
        console.groupEnd();
      }
    },
    time: (label: string) => {
      if (isScopeEnabled(scope)) {
        console.time(`${prefix} ${label}`);
      }
    },
    timeEnd: (label: string) => {
      if (isScopeEnabled(scope)) {
        console.timeEnd(`${prefix} ${label}`);
      }
    },
  };
}

/**
 * Default logger (unscoped) - use sparingly
 *
 * In dev: warn/error only (no debug/info spam)
 * In prod: errors only
 *
 * Prefer createLogger('scope') for most logging
 */
export const logger: Logger = isDev
  ? {
      debug: noop, // Use createLogger for debug
      info: noop,  // Use createLogger for info
      warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
      error: (...args: unknown[]) => console.error('[ERROR]', ...args),
      group: noop,
      groupEnd: noop,
      time: noop,
      timeEnd: noop,
    }
  : {
      ...noopLogger,
      error: (...args: unknown[]) => console.error('[ERROR]', ...args),
    };

/**
 * Critical logger - always logs, even in production
 *
 * Use sparingly for errors that users/developers need to see
 */
export const criticalLogger = {
  error: (...args: unknown[]) => console.error('[CRITICAL]', ...args),
  warn: (...args: unknown[]) => console.warn('[CRITICAL]', ...args),
};

/**
 * Helper to enable debug scopes at runtime
 */
export function enableDebug(...scopes: string[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('DEBUG', scopes.join(','));
    console.info(`[DEBUG] Enabled scopes: ${scopes.join(', ') || '(none)'}`);
  }
}

/**
 * Helper to disable all debug logging
 */
export function disableDebug(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('DEBUG');
    console.info('[DEBUG] All debug logging disabled');
  }
}

/**
 * List available debug scopes
 */
export const DEBUG_SCOPES = [
  'transport',  // relay connections, WebSocket
  'sync',       // data syncing with relays
  'messaging',  // message receiver, conversations
  'modules',    // module registration/lifecycle
  'db',         // database operations
  'offline',    // cache, queue processing
  'auth',       // identity, sessions, device sync
  'ble',        // BLE mesh networking
  'tor',        // Tor routing
  'init',       // app initialization
] as const;

export type DebugScope = typeof DEBUG_SCOPES[number];

export default logger;
