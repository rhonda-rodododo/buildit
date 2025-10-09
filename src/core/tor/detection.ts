/**
 * Tor Browser Detection
 * Detects if the app is running in Tor Browser
 */

/**
 * Detect if running in Tor Browser
 * Tor Browser has specific characteristics:
 * - navigator.hardwareConcurrency is always 1 (to prevent fingerprinting)
 * - Screen resolution/browser window match
 * - Specific user agent patterns
 */
export function detectTorBrowser(): boolean {
  // Check if running in browser
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  let score = 0;

  // 1. Hardware concurrency check (strongest signal)
  // Tor Browser always reports 1 CPU core to prevent fingerprinting
  if (navigator.hardwareConcurrency === 1) {
    score += 3;
  }

  // 2. Check for Tor Browser user agent patterns
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Firefox') && !userAgent.includes('Chrome')) {
    // Tor Browser is based on Firefox ESR
    score += 1;
  }

  // 3. Check screen resolution (Tor Browser uses fixed resolutions)
  const width = window.screen.width;
  const height = window.screen.height;

  // Common Tor Browser resolutions (multiples of 200x100)
  const torResolutions = [
    [1000, 900], [1200, 900], [1400, 900],
    [1000, 1000], [1200, 1000], [1400, 1000],
    [1000, 1100], [1200, 1100], [1400, 1100],
  ];

  const matchesResolution = torResolutions.some(
    ([w, h]) => width === w && height === h
  );
  if (matchesResolution) {
    score += 2;
  }

  // 4. Check if browser window exactly matches screen (another Tor Browser trait)
  if (window.outerWidth === window.screen.width &&
      window.outerHeight === window.screen.height) {
    score += 1;
  }

  // 5. Check for WebRTC disabled (Tor Browser disables it by default)
  // Note: We can't directly check this without attempting WebRTC, so skip for now

  // 6. Check canvas fingerprinting protection
  // Tor Browser adds noise to canvas fingerprints
  // This is hard to detect reliably, so we skip it

  // Score threshold: 4+ indicates likely Tor Browser
  // Score of 3-4 = possibly Tor Browser
  // Score of 5+ = very likely Tor Browser
  return score >= 4;
}

/**
 * Check if .onion URLs are accessible
 * This requires actually being connected through Tor
 */
export async function canAccessOnionServices(): Promise<boolean> {
  // We can't actually test .onion connectivity from JavaScript
  // because browsers don't support SOCKS5 proxies directly
  //
  // Instead, we check if we're in Tor Browser, which has native .onion support
  return detectTorBrowser();
}

/**
 * Get recommended Tor configuration based on detection
 */
export function getRecommendedTorConfig(): {
  detected: boolean;
  method: 'tor_browser' | 'manual_proxy' | 'none';
  confidence: 'high' | 'medium' | 'low';
} {
  const isTorBrowser = detectTorBrowser();

  if (isTorBrowser) {
    return {
      detected: true,
      method: 'tor_browser',
      confidence: 'high',
    };
  }

  // Check if localhost:9050 or localhost:9150 might be available
  // We can't actually test this from browser, so return low confidence
  return {
    detected: false,
    method: 'none',
    confidence: 'low',
  };
}

/**
 * Check if WebRTC is available (should be disabled in Tor Browser)
 */
export function isWebRTCAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(
    window.RTCPeerConnection ||
    (window as any).mozRTCPeerConnection ||
    (window as any).webkitRTCPeerConnection
  );
}

/**
 * Check if geolocation API is available
 */
export function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Disable WebRTC if possible (for enhanced Tor security)
 * Note: This can't actually disable WebRTC from JavaScript
 * This function serves as documentation for what SHOULD be disabled
 */
export function shouldDisableWebRTC(): boolean {
  // WebRTC can leak real IP even through VPN/Tor
  // Users should disable it manually in browser settings or use an extension
  return isWebRTCAvailable();
}

/**
 * Block geolocation API if possible
 * Note: This can't actually block geolocation from JavaScript
 * This is documentation for what users should configure
 */
export function shouldBlockGeolocation(): boolean {
  return isGeolocationAvailable();
}

/**
 * Get Tor-related browser warnings
 */
export function getTorSecurityWarnings(): string[] {
  const warnings: string[] = [];

  if (isWebRTCAvailable()) {
    warnings.push(
      'WebRTC is enabled. This may leak your real IP address. ' +
      'Consider using a browser extension like WebRTC Leak Shield.'
    );
  }

  if (isGeolocationAvailable()) {
    warnings.push(
      'Geolocation API is available. Websites may request your location. ' +
      'Always deny geolocation requests when using Tor.'
    );
  }

  if (!detectTorBrowser() && typeof navigator !== 'undefined') {
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 1) {
      warnings.push(
        'Browser reports ' + navigator.hardwareConcurrency + ' CPU cores. ' +
        'Tor Browser reports 1 core to prevent fingerprinting.'
      );
    }
  }

  return warnings;
}
