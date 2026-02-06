/**
 * Monitoring Module
 *
 * Privacy-preserving error tracking, performance monitoring, and analytics.
 *
 * Usage:
 * ```ts
 * import { initMonitoring } from '@/lib/monitoring';
 *
 * // Initialize all monitoring systems at app startup
 * await initMonitoring();
 * ```
 *
 * Individual modules can also be imported directly:
 * ```ts
 * import { captureException } from '@/lib/monitoring/sentry';
 * import { trackMetric, startTimer } from '@/lib/monitoring/webVitals';
 * import { trackFeatureUsed, setAnalyticsOptOut } from '@/lib/monitoring/analytics';
 * ```
 */

export {
  initSentry,
  captureException,
  captureMessage,
  addBreadcrumb,
  setTag,
  setTransactionName,
  trackNavigation,
  trackModuleToggle,
  trackBLEEvent,
  trackRelayEvent,
  type SentryConfig,
} from './sentry';

export {
  initWebVitals,
  trackMetric,
  startTimer,
  measureAsync,
  destroyWebVitals,
  getMetricsBatch,
  type WebVitalsConfig,
  type MetricEntry,
  type MetricName,
  type CoreWebVitalName,
  type CustomMetricName,
} from './webVitals';

export {
  initAnalytics,
  setAnalyticsOptOut,
  isAnalyticsOptedOut,
  trackModuleActive,
  trackFeatureUsed,
  trackError,
  trackPerformance,
  destroyAnalytics,
  getAnalyticsState,
  type AnalyticsConfig,
  type AnalyticsCategory,
} from './analytics';

// --------------------------------------------------------------------------
// Unified Initialization
// --------------------------------------------------------------------------

export interface MonitoringConfig {
  /** Sentry DSN for error tracking */
  sentryDsn?: string;
  /** Sentry environment */
  sentryEnvironment?: string;
  /** App version for Sentry release tracking */
  appVersion?: string;
  /** Analytics endpoint URL */
  analyticsEndpoint?: string;
  /** Enable all monitoring (default: true in production) */
  enabled?: boolean;
}

/**
 * Initialize all monitoring systems with a single call.
 * Safe to call multiple times - subsequent calls are no-ops.
 *
 * In development, metrics are logged to the console.
 * In production, errors go to Sentry and metrics to the analytics endpoint.
 *
 * This function never throws - monitoring failures must never break the app.
 */
export async function initMonitoring(config: MonitoringConfig = {}): Promise<void> {
  const enabled = config.enabled ?? import.meta.env.PROD;

  try {
    // Initialize Sentry (error tracking)
    const { initSentry: _initSentry } = await import('./sentry');
    await _initSentry({
      dsn: config.sentryDsn,
      environment: config.sentryEnvironment,
      release: config.appVersion,
      sampleRate: enabled ? 1.0 : 0,
      tracesSampleRate: enabled ? 0.1 : 0,
    });
  } catch {
    // Sentry init failure is non-fatal
  }

  try {
    // Initialize Web Vitals (performance monitoring)
    const { initWebVitals: _initWebVitals } = await import('./webVitals');
    await _initWebVitals({
      enabled,
      analyticsEndpoint: config.analyticsEndpoint,
    });
  } catch {
    // Web Vitals init failure is non-fatal
  }

  try {
    // Initialize Privacy Analytics
    const { initAnalytics: _initAnalytics } = await import('./analytics');
    _initAnalytics({
      enabled,
      endpoint: config.analyticsEndpoint,
    });
  } catch {
    // Analytics init failure is non-fatal
  }
}
