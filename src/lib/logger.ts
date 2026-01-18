/**
 * Development-only logger utility
 *
 * Wraps console methods to only log in development mode.
 * In production builds, these become no-ops for performance.
 *
 * Usage:
 * import { logger } from '@/lib/logger';
 * logger.info('Initializing module...');
 * logger.debug('Debug data:', data);
 * logger.warn('Warning message');
 * logger.error('Error message', error);
 */

const isDev = import.meta.env.DEV;

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  group: (label: string) => void;
  groupEnd: () => void;
  time: (label: string) => void;
  timeEnd: (label: string) => void;
}

/**
 * Create a no-op function for production
 */
const noop = (): void => {
  // Intentionally empty - no-op for production
};

/**
 * Development logger - logs to console in dev, no-op in production
 */
export const logger: Logger = isDev
  ? {
      debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
      info: (...args: unknown[]) => console.info('[INFO]', ...args),
      warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
      error: (...args: unknown[]) => console.error('[ERROR]', ...args),
      group: (label: string) => console.group(label),
      groupEnd: () => console.groupEnd(),
      time: (label: string) => console.time(label),
      timeEnd: (label: string) => console.timeEnd(label),
    }
  : {
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
 * Create a namespaced logger for a specific module/component
 *
 * Usage:
 * const log = createLogger('MyModule');
 * log.info('Starting...'); // Outputs: [INFO][MyModule] Starting...
 */
export function createLogger(namespace: string): Logger {
  if (!isDev) {
    return {
      debug: noop,
      info: noop,
      warn: noop,
      error: noop,
      group: noop,
      groupEnd: noop,
      time: noop,
      timeEnd: noop,
    };
  }

  return {
    debug: (...args: unknown[]) => console.debug(`[DEBUG][${namespace}]`, ...args),
    info: (...args: unknown[]) => console.info(`[INFO][${namespace}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[WARN][${namespace}]`, ...args),
    error: (...args: unknown[]) => console.error(`[ERROR][${namespace}]`, ...args),
    group: (label: string) => console.group(`[${namespace}] ${label}`),
    groupEnd: () => console.groupEnd(),
    time: (label: string) => console.time(`[${namespace}] ${label}`),
    timeEnd: (label: string) => console.timeEnd(`[${namespace}] ${label}`),
  };
}

/**
 * Always-on logger for critical errors that should show in production
 *
 * Use sparingly - only for errors that users/developers need to see
 * in production to diagnose issues.
 */
export const criticalLogger = {
  error: (...args: unknown[]) => console.error('[CRITICAL]', ...args),
  warn: (...args: unknown[]) => console.warn('[CRITICAL]', ...args),
};

export default logger;
