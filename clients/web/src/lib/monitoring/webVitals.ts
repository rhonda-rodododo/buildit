/**
 * Web Vitals Monitoring
 *
 * Tracks Core Web Vitals (LCP, FID, CLS, TTFB, INP) and custom
 * application metrics. Reports to console in development and to
 * an analytics endpoint in production.
 *
 * Privacy: No PII is collected. All metrics are purely performance
 * numbers with no user-identifying information.
 *
 * Uses the `web-vitals` library for standardized CWV measurement.
 */

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

/** Supported Core Web Vital metric names */
export type CoreWebVitalName = 'LCP' | 'FID' | 'CLS' | 'TTFB' | 'INP';

/** Custom application metric names */
export type CustomMetricName =
  | 'message_send_latency'
  | 'ble_connect_time'
  | 'app_startup_time'
  | 'relay_connect_time'
  | 'module_load_time'
  | 'db_query_time';

/** All tracked metric names */
export type MetricName = CoreWebVitalName | CustomMetricName;

/** A single metric measurement */
export interface MetricEntry {
  name: MetricName;
  value: number;
  /** Rating: good, needs-improvement, poor (for CWV) */
  rating?: 'good' | 'needs-improvement' | 'poor';
  /** Delta from previous measurement (for CWV) */
  delta?: number;
  /** Timestamp when the metric was recorded */
  timestamp: number;
  /** Navigation type (reload, navigate, back_forward, prerender) */
  navigationType?: string;
}

/** Configuration for the web vitals reporter */
export interface WebVitalsConfig {
  /** Whether to report metrics (default: true in production, false in dev) */
  enabled?: boolean;
  /** Analytics endpoint URL for production reporting */
  analyticsEndpoint?: string;
  /** How often to flush batched metrics (ms, default: 30000) */
  flushIntervalMs?: number;
  /** Maximum batch size before forcing a flush (default: 25) */
  maxBatchSize?: number;
  /** Log to console in development (default: true) */
  devConsoleLog?: boolean;
}

// --------------------------------------------------------------------------
// Metric Thresholds (based on Google's CWV thresholds)
// --------------------------------------------------------------------------

const CWV_THRESHOLDS: Record<CoreWebVitalName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

// --------------------------------------------------------------------------
// State
// --------------------------------------------------------------------------

let _config: WebVitalsConfig = {};
let _initialized = false;
let _metricsBatch: MetricEntry[] = [];
let _flushTimer: ReturnType<typeof setInterval> | null = null;

// --------------------------------------------------------------------------
// Rating
// --------------------------------------------------------------------------

/**
 * Rate a Core Web Vital measurement against standard thresholds.
 */
function rateCWV(name: CoreWebVitalName, value: number): MetricEntry['rating'] {
  const thresholds = CWV_THRESHOLDS[name];
  if (!thresholds) return undefined;
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

// --------------------------------------------------------------------------
// Reporting
// --------------------------------------------------------------------------

/**
 * Log a metric to the console in a readable format.
 */
function logMetricToConsole(entry: MetricEntry): void {
  const ratingLabel = entry.rating
    ? ` [${entry.rating}]`
    : '';
  const unit = entry.name === 'CLS' ? '' : 'ms';

  console.debug(
    `[WebVitals] ${entry.name}: ${entry.value.toFixed(entry.name === 'CLS' ? 4 : 1)}${unit}${ratingLabel}`,
  );
}

/**
 * Send a batch of metrics to the analytics endpoint.
 * Uses `navigator.sendBeacon` for reliability (survives page unload).
 */
function sendMetricsBatch(metrics: MetricEntry[]): void {
  if (metrics.length === 0) return;

  const endpoint = _config.analyticsEndpoint;
  if (!endpoint) return;

  const payload = JSON.stringify({
    metrics,
    // No PII: just a random session ID for grouping metrics from the same page load
    sessionId: _sessionId,
    timestamp: Date.now(),
  });

  // Prefer sendBeacon for fire-and-forget reliability
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const sent = navigator.sendBeacon(endpoint, payload);
    if (!sent) {
      // Fallback to fetch if sendBeacon fails (e.g., payload too large)
      fetchFallback(endpoint, payload);
    }
  } else {
    fetchFallback(endpoint, payload);
  }
}

/**
 * Fallback to fetch API when sendBeacon is unavailable.
 */
function fetchFallback(endpoint: string, payload: string): void {
  fetch(endpoint, {
    method: 'POST',
    body: payload,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {
    // Silently ignore network errors - metrics are best-effort
  });
}

/**
 * Flush all batched metrics.
 */
function flushMetrics(): void {
  if (_metricsBatch.length === 0) return;

  const batch = [..._metricsBatch];
  _metricsBatch = [];

  sendMetricsBatch(batch);
}

// Random session ID (not user-identifying, just groups metrics per page load)
const _sessionId = Math.random().toString(36).slice(2, 10);

// --------------------------------------------------------------------------
// Core Web Vitals Collection
// --------------------------------------------------------------------------

/**
 * Record a metric entry. Handles both console logging (dev) and
 * batching for production reporting.
 */
function recordMetric(entry: MetricEntry): void {
  // Console logging in development
  if (_config.devConsoleLog !== false && import.meta.env.DEV) {
    logMetricToConsole(entry);
  }

  // Batch for production reporting
  if (_config.analyticsEndpoint) {
    _metricsBatch.push(entry);

    // Force flush if batch is large
    if (_metricsBatch.length >= (_config.maxBatchSize ?? 25)) {
      flushMetrics();
    }
  }
}

/**
 * Initialize Core Web Vitals collection using the web-vitals library.
 * The library is dynamically imported to keep it out of the critical path.
 */
async function initCoreWebVitals(): Promise<void> {
  try {
    const webVitals = await import('web-vitals');

    const handleMetric = (name: CoreWebVitalName) => {
      return (metric: { value: number; delta: number; navigationType: string }) => {
        recordMetric({
          name,
          value: metric.value,
          delta: metric.delta,
          rating: rateCWV(name, metric.value),
          timestamp: Date.now(),
          navigationType: metric.navigationType,
        });
      };
    };

    webVitals.onLCP(handleMetric('LCP'));
    webVitals.onFID(handleMetric('FID'));
    webVitals.onCLS(handleMetric('CLS'));
    webVitals.onTTFB(handleMetric('TTFB'));
    webVitals.onINP(handleMetric('INP'));
  } catch (error) {
    // web-vitals not available (e.g., unsupported browser)
    if (import.meta.env.DEV) {
      console.warn('[WebVitals] Failed to load web-vitals library:', error);
    }
  }
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Initialize web vitals monitoring.
 *
 * @param config - Configuration options. In development, metrics are
 *   logged to the console. In production, they are batched and sent
 *   to the configured analytics endpoint.
 */
export async function initWebVitals(config: WebVitalsConfig = {}): Promise<void> {
  if (_initialized) return;

  _config = {
    enabled: config.enabled ?? true,
    analyticsEndpoint: config.analyticsEndpoint || import.meta.env.VITE_ANALYTICS_ENDPOINT,
    flushIntervalMs: config.flushIntervalMs ?? 30_000,
    maxBatchSize: config.maxBatchSize ?? 25,
    devConsoleLog: config.devConsoleLog ?? true,
  };

  if (!_config.enabled) return;

  // Start Core Web Vitals collection
  await initCoreWebVitals();

  // Set up periodic flushing for production
  if (_config.analyticsEndpoint && (_config.flushIntervalMs ?? 30_000) > 0) {
    _flushTimer = setInterval(flushMetrics, _config.flushIntervalMs);
  }

  // Flush on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushMetrics();
      }
    });

    // Also flush on pagehide for browsers that support it
    window.addEventListener('pagehide', flushMetrics);
  }

  _initialized = true;
}

/**
 * Record a custom application metric.
 *
 * @param name - The metric name (e.g., 'message_send_latency')
 * @param value - The measurement value (typically milliseconds)
 */
export function trackMetric(name: CustomMetricName, value: number): void {
  if (!_initialized && !import.meta.env.DEV) return;

  recordMetric({
    name,
    value,
    timestamp: Date.now(),
  });
}

/**
 * Convenience: Create a timer that records duration when stopped.
 *
 * @example
 * ```ts
 * const timer = startTimer('ble_connect_time');
 * await connectToBLEDevice();
 * timer.stop(); // Automatically records the duration
 * ```
 */
export function startTimer(metricName: CustomMetricName): { stop: () => number } {
  const start = performance.now();

  return {
    stop(): number {
      const duration = performance.now() - start;
      trackMetric(metricName, duration);
      return duration;
    },
  };
}

/**
 * Convenience: Measure the duration of an async operation.
 *
 * @example
 * ```ts
 * const result = await measureAsync('relay_connect_time', () => connectToRelay());
 * ```
 */
export async function measureAsync<T>(
  metricName: CustomMetricName,
  fn: () => Promise<T>,
): Promise<T> {
  const timer = startTimer(metricName);
  try {
    return await fn();
  } finally {
    timer.stop();
  }
}

/**
 * Tear down web vitals monitoring. Used primarily for testing.
 */
export function destroyWebVitals(): void {
  if (_flushTimer) {
    clearInterval(_flushTimer);
    _flushTimer = null;
  }
  flushMetrics();
  _metricsBatch = [];
  _initialized = false;
}

/**
 * Get current metric batch (for testing/debugging).
 */
export function getMetricsBatch(): ReadonlyArray<MetricEntry> {
  return [..._metricsBatch];
}
