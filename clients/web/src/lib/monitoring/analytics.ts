/**
 * Privacy-Preserving Analytics
 *
 * DESIGN PRINCIPLES:
 * - NO cookies - zero persistent identifiers
 * - NO PII - no pubkeys, usernames, IPs, or fingerprinting
 * - NO cross-session tracking - each page load is independent
 * - NO individual event tracking - all data is aggregated before sending
 * - Respects Do Not Track (DNT) header
 * - Users can opt out via settings
 *
 * WHAT WE TRACK (aggregate counts only):
 * - Which modules are enabled (total count, not per-user)
 * - Error rates by category
 * - Performance metric distributions (p50, p95, p99)
 * - Feature adoption (e.g., "N sessions used governance module")
 *
 * WHAT WE NEVER TRACK:
 * - Individual user behavior or journeys
 * - Message content or metadata
 * - Public keys, usernames, or any identifiers
 * - IP addresses (stripped server-side too)
 * - Cross-session or cross-device linkage
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** Supported aggregate metric categories */
export type AnalyticsCategory =
  | 'module_usage'
  | 'error_rate'
  | 'performance'
  | 'feature_adoption'
  | 'platform_info';

/** A single aggregate data point */
interface AggregateDataPoint {
  category: AnalyticsCategory;
  /** The specific metric within the category (e.g., "events_module", "ble_errors") */
  metric: string;
  /** Aggregate value (count, percentage, or distribution) */
  value: number;
}

/** Aggregated analytics payload sent to the server */
interface AnalyticsPayload {
  /** Schema version for backwards compatibility */
  schemaVersion: 1;
  /** Timestamp of aggregation (rounded to nearest hour for privacy) */
  timestamp: number;
  /** Aggregated data points */
  data: AggregateDataPoint[];
  /** Platform metadata (non-identifying) */
  platform: {
    /** 'desktop' (Tauri) or 'web' */
    type: 'desktop' | 'web';
    /** Screen size bucket (not exact dimensions) */
    screenBucket: 'small' | 'medium' | 'large' | 'xlarge';
    /** Locale language code only (e.g., 'en', 'es') - no region */
    language: string;
  };
}

/** Configuration for analytics */
export interface AnalyticsConfig {
  /** Whether analytics is enabled (default: true in production) */
  enabled?: boolean;
  /** Analytics endpoint URL */
  endpoint?: string;
  /** How often to send aggregated data (ms, default: 300000 / 5 min) */
  flushIntervalMs?: number;
}

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------

let _config: AnalyticsConfig = {};
let _initialized = false;
let _optedOut = false;
let _flushTimer: ReturnType<typeof setInterval> | null = null;

/**
 * In-memory counters for the current session. These are aggregated
 * and flushed periodically. Never persisted to disk.
 */
const _counters: Map<string, number> = new Map();

/**
 * In-memory distributions for computing percentiles.
 * Keys are metric names, values are arrays of measurements.
 */
const _distributions: Map<string, number[]> = new Map();

// --------------------------------------------------------------------------
// Privacy Checks
// --------------------------------------------------------------------------

/**
 * Check if the browser has Do Not Track enabled.
 */
function isDoNotTrackEnabled(): boolean {
  if (typeof navigator === 'undefined') return false;

  // Standard DNT header
  if (navigator.doNotTrack === '1') return true;

  // Legacy IE
  // @ts-expect-error - msDoNotTrack is IE-specific
  if (typeof navigator.msDoNotTrack !== 'undefined' && navigator.msDoNotTrack === '1') return true;

  // Global Privacy Control
  // @ts-expect-error - GPC is a newer standard
  if (typeof navigator.globalPrivacyControl !== 'undefined' && navigator.globalPrivacyControl) return true;

  return false;
}

/**
 * Classify screen size into a non-identifying bucket.
 * We never send exact dimensions.
 */
function getScreenBucket(): AnalyticsPayload['platform']['screenBucket'] {
  if (typeof window === 'undefined') return 'medium';
  const width = window.innerWidth;
  if (width < 640) return 'small';
  if (width < 1024) return 'medium';
  if (width < 1440) return 'large';
  return 'xlarge';
}

/**
 * Get the language code without region (e.g., 'en' not 'en-US').
 */
function getLanguageCode(): string {
  if (typeof navigator === 'undefined') return 'unknown';
  const lang = navigator.language || 'unknown';
  // Only take the language part, not the region
  return lang.split('-')[0].toLowerCase();
}

/**
 * Round a timestamp to the nearest hour to reduce temporal precision.
 */
function roundToHour(timestamp: number): number {
  return Math.floor(timestamp / 3_600_000) * 3_600_000;
}

// --------------------------------------------------------------------------
// Data Collection (In-Memory Only)
// --------------------------------------------------------------------------

/**
 * Increment a counter for an aggregate metric.
 */
function incrementCounter(category: AnalyticsCategory, metric: string, amount = 1): void {
  const key = `${category}:${metric}`;
  _counters.set(key, (_counters.get(key) || 0) + amount);
}

/**
 * Record a distribution value for percentile computation.
 */
function recordDistribution(category: AnalyticsCategory, metric: string, value: number): void {
  const key = `${category}:${metric}`;
  const existing = _distributions.get(key) || [];
  existing.push(value);

  // Cap at 1000 entries to prevent memory growth
  if (existing.length > 1000) {
    existing.shift();
  }

  _distributions.set(key, existing);
}

/**
 * Compute percentiles from a distribution.
 */
function computePercentiles(values: number[]): { p50: number; p95: number; p99: number } {
  if (values.length === 0) return { p50: 0, p95: 0, p99: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => {
    const index = Math.ceil(sorted.length * (p / 100)) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
  };
}

// --------------------------------------------------------------------------
// Aggregation & Reporting
// --------------------------------------------------------------------------

/**
 * Build an aggregated payload from the in-memory counters and distributions.
 */
function buildPayload(): AnalyticsPayload {
  const data: AggregateDataPoint[] = [];

  // Add counter data points
  for (const [key, value] of _counters) {
    const [category, metric] = key.split(':');
    data.push({
      category: category as AnalyticsCategory,
      metric,
      value,
    });
  }

  // Add distribution percentiles
  for (const [key, values] of _distributions) {
    const [category, metric] = key.split(':');
    const percentiles = computePercentiles(values);

    data.push({ category: category as AnalyticsCategory, metric: `${metric}_p50`, value: percentiles.p50 });
    data.push({ category: category as AnalyticsCategory, metric: `${metric}_p95`, value: percentiles.p95 });
    data.push({ category: category as AnalyticsCategory, metric: `${metric}_p99`, value: percentiles.p99 });
  }

  // Detect platform type
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

  return {
    schemaVersion: 1,
    timestamp: roundToHour(Date.now()),
    data,
    platform: {
      type: isTauri ? 'desktop' : 'web',
      screenBucket: getScreenBucket(),
      language: getLanguageCode(),
    },
  };
}

/**
 * Send aggregated analytics data. Uses sendBeacon for reliability.
 */
function sendPayload(payload: AnalyticsPayload): void {
  const endpoint = _config.endpoint;
  if (!endpoint) return;

  // Only send if there is actual data
  if (payload.data.length === 0) return;

  const body = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body);
  } else {
    fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // Silently ignore - analytics is best-effort
    });
  }
}

/**
 * Flush: aggregate, send, and reset counters.
 */
function flush(): void {
  if (!_config.enabled || _optedOut) return;

  const payload = buildPayload();
  sendPayload(payload);

  // Reset counters (distributions are kept for rolling percentiles)
  _counters.clear();
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Initialize privacy-preserving analytics.
 *
 * Analytics will NOT initialize if:
 * - Do Not Track is enabled in the browser
 * - The user has opted out via `setAnalyticsOptOut(true)`
 * - No endpoint is configured
 */
export function initAnalytics(config: AnalyticsConfig = {}): void {
  if (_initialized) return;

  _config = {
    enabled: config.enabled ?? import.meta.env.PROD,
    endpoint: config.endpoint || import.meta.env.VITE_ANALYTICS_ENDPOINT,
    flushIntervalMs: config.flushIntervalMs ?? 300_000,
  };

  // Respect Do Not Track
  if (isDoNotTrackEnabled()) {
    if (import.meta.env.DEV) {
      console.debug('[Analytics] Do Not Track enabled, analytics disabled');
    }
    _config.enabled = false;
    _initialized = true;
    return;
  }

  // Check local opt-out preference
  if (typeof localStorage !== 'undefined') {
    const pref = localStorage.getItem('buildit_analytics_opt_out');
    if (pref === 'true') {
      _optedOut = true;
      _config.enabled = false;
    }
  }

  if (!_config.enabled) {
    _initialized = true;
    return;
  }

  // Start periodic flush
  if (_config.endpoint && (_config.flushIntervalMs ?? 300_000) > 0) {
    _flushTimer = setInterval(flush, _config.flushIntervalMs);
  }

  // Flush on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });
    window.addEventListener('pagehide', flush);
  }

  _initialized = true;

  if (import.meta.env.DEV) {
    console.debug('[Analytics] Initialized (privacy-preserving mode, no cookies, no PII)');
  }
}

/**
 * Set analytics opt-out preference. Persisted in localStorage.
 * When opted out, no data is collected or sent.
 */
export function setAnalyticsOptOut(optOut: boolean): void {
  _optedOut = optOut;

  if (typeof localStorage !== 'undefined') {
    if (optOut) {
      localStorage.setItem('buildit_analytics_opt_out', 'true');
    } else {
      localStorage.removeItem('buildit_analytics_opt_out');
    }
  }

  if (optOut) {
    // Clear any pending data
    _counters.clear();
    _distributions.clear();
  }
}

/**
 * Get whether the user has opted out of analytics.
 */
export function isAnalyticsOptedOut(): boolean {
  return _optedOut;
}

// --------------------------------------------------------------------------
// Module Usage Tracking
// --------------------------------------------------------------------------

/**
 * Track that a module is active/enabled.
 * Only increments a counter - does NOT track which user enabled it.
 */
export function trackModuleActive(moduleId: string): void {
  if (!_config.enabled || _optedOut) return;
  incrementCounter('module_usage', moduleId);
}

/**
 * Track an aggregate feature adoption event.
 * Example: "governance_vote_cast" - we track how many votes happen,
 * not who voted.
 */
export function trackFeatureUsed(featureName: string): void {
  if (!_config.enabled || _optedOut) return;
  incrementCounter('feature_adoption', featureName);
}

// --------------------------------------------------------------------------
// Error Rate Tracking
// --------------------------------------------------------------------------

/**
 * Track an error by category (e.g., "ble_connection", "relay_timeout").
 * Only the category is recorded, never the error message or stack.
 */
export function trackError(category: string): void {
  if (!_config.enabled || _optedOut) return;
  incrementCounter('error_rate', category);
}

// --------------------------------------------------------------------------
// Performance Distribution Tracking
// --------------------------------------------------------------------------

/**
 * Track a performance measurement for aggregate distribution analysis.
 * The individual value is never sent - only p50/p95/p99 are computed.
 */
export function trackPerformance(metric: string, durationMs: number): void {
  if (!_config.enabled || _optedOut) return;
  recordDistribution('performance', metric, durationMs);
}

// --------------------------------------------------------------------------
// Cleanup
// --------------------------------------------------------------------------

/**
 * Tear down analytics. Used primarily for testing.
 */
export function destroyAnalytics(): void {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  flush();
  _counters.clear();
  _distributions.clear();
  _initialized = false;
  _optedOut = false;
}

/**
 * Get current analytics state (for debugging/testing).
 */
export function getAnalyticsState(): {
  initialized: boolean;
  optedOut: boolean;
  enabled: boolean;
  counterCount: number;
  distributionCount: number;
} {
  return {
    initialized: _initialized,
    optedOut: _optedOut,
    enabled: _config.enabled ?? false,
    counterCount: _counters.size,
    distributionCount: _distributions.size,
  };
}
