/**
 * Device Fingerprint Service
 * Generates device fingerprints for tracking and identifying devices
 * Uses FingerprintJS for privacy-aware device identification
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';
import type { DeviceFingerprint, DeviceFingerprintParams, DeviceInfo, DeviceType } from '@/types/device';

/**
 * Device Fingerprint Service class
 */
export class DeviceFingerprintService {
  private static instance: DeviceFingerprintService;
  private fpPromise: Promise<any> | null = null;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): DeviceFingerprintService {
    if (!DeviceFingerprintService.instance) {
      DeviceFingerprintService.instance = new DeviceFingerprintService();
    }
    return DeviceFingerprintService.instance;
  }

  /**
   * Initialize FingerprintJS
   */
  public async init(): Promise<void> {
    if (!this.fpPromise) {
      this.fpPromise = FingerprintJS.load();
    }
  }

  /**
   * Generate device fingerprint
   */
  public async generateFingerprint(
    params: DeviceFingerprintParams = {}
  ): Promise<DeviceFingerprint> {
    await this.init();

    if (!this.fpPromise) {
      throw new Error('FingerprintJS not initialized');
    }

    const fp = await this.fpPromise;
    const result = await fp.get();

    // Extract components based on privacy settings
    const components: Record<string, string | number | boolean> = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
      colorDepth: screen.colorDepth,
    };

    if (params.includeScreen !== false) {
      components.screenResolution = `${screen.width}x${screen.height}`;
      components.availableScreenResolution = `${screen.availWidth}x${screen.availHeight}`;
    }

    if (params.includeTimezone !== false) {
      components.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      components.timezoneOffset = new Date().getTimezoneOffset();
    }

    if (params.includeLanguage !== false) {
      components.languages = navigator.languages.join(',');
    }

    return {
      hash: result.visitorId,
      confidence: result.confidence?.score || 0.5,
      components,
    };
  }

  /**
   * Get device information
   */
  public async getDeviceInfo(deviceName?: string): Promise<Partial<DeviceInfo>> {
    const fingerprint = await this.generateFingerprint();
    const ua = navigator.userAgent;

    return {
      name: deviceName || this.generateDeviceName(),
      type: this.detectDeviceType(),
      browser: this.detectBrowser(),
      os: this.detectOS(),
      platform: navigator.platform,
      screenResolution: fingerprint.components.screenResolution as string,
      userAgent: ua,
      icon: this.getDeviceIcon(this.detectDeviceType()),
    };
  }

  /**
   * Generate a default device name
   */
  private generateDeviceName(): string {
    const browser = this.detectBrowser();
    const os = this.detectOS();
    return `${browser} on ${os}`;
  }

  /**
   * Detect device type
   */
  private detectDeviceType(): DeviceType {
    const ua = navigator.userAgent.toLowerCase();

    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|opera mini|opera mobi|skyfire|maemo|windows phone|palm|iemobile|symbian|symbianos|fennec/i.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Detect browser name and version
   */
  private detectBrowser(): string {
    const ua = navigator.userAgent;
    let browser = 'Unknown';

    if (ua.includes('Firefox/')) {
      const version = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || '';
      browser = `Firefox ${version}`;
    } else if (ua.includes('Edg/')) {
      const version = ua.match(/Edg\/(\d+\.\d+)/)?.[1] || '';
      browser = `Edge ${version}`;
    } else if (ua.includes('Chrome/')) {
      const version = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || '';
      browser = `Chrome ${version}`;
    } else if (ua.includes('Safari/')) {
      const version = ua.match(/Version\/(\d+\.\d+)/)?.[1] || '';
      browser = `Safari ${version}`;
    } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
      const version = ua.match(/(?:Opera|OPR)\/(\d+\.\d+)/)?.[1] || '';
      browser = `Opera ${version}`;
    }

    return browser;
  }

  /**
   * Detect operating system
   */
  private detectOS(): string {
    const ua = navigator.userAgent;
    let os = 'Unknown';

    if (ua.includes('Win')) {
      os = 'Windows';
      if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
      else if (ua.includes('Windows NT 6.3')) os = 'Windows 8.1';
      else if (ua.includes('Windows NT 6.2')) os = 'Windows 8';
      else if (ua.includes('Windows NT 6.1')) os = 'Windows 7';
    } else if (ua.includes('Mac')) {
      os = 'macOS';
      const version = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1].replace('_', '.');
      if (version) os = `macOS ${version}`;
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    } else if (ua.includes('Android')) {
      os = 'Android';
      const version = ua.match(/Android (\d+\.\d+)/)?.[1];
      if (version) os = `Android ${version}`;
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      os = 'iOS';
      const version = ua.match(/OS (\d+[._]\d+)/)?.[1].replace('_', '.');
      if (version) os = `iOS ${version}`;
    }

    return os;
  }

  /**
   * Get device icon name based on type
   */
  private getDeviceIcon(type: DeviceType): string {
    switch (type) {
      case 'mobile':
        return 'smartphone';
      case 'tablet':
        return 'tablet';
      case 'desktop':
        return 'monitor';
      default:
        return 'help-circle';
    }
  }

  /**
   * Compare two fingerprints to determine if they're from the same device
   */
  public compareFingerprints(fp1: DeviceFingerprint, fp2: DeviceFingerprint): number {
    if (fp1.hash === fp2.hash) {
      return 1.0; // Exact match
    }

    // Compare components for partial match
    let matchCount = 0;
    let totalCount = 0;

    const keys = new Set([
      ...Object.keys(fp1.components),
      ...Object.keys(fp2.components),
    ]);

    for (const key of keys) {
      totalCount++;
      if (fp1.components[key] === fp2.components[key]) {
        matchCount++;
      }
    }

    return totalCount > 0 ? matchCount / totalCount : 0;
  }

  /**
   * Generate a stable device ID from fingerprint
   * This can be used when WebAuthn is not available
   */
  public async generateDeviceId(): Promise<string> {
    const fingerprint = await this.generateFingerprint();
    return `device_${fingerprint.hash}`;
  }

  /**
   * Check if device fingerprinting should be limited (privacy mode)
   */
  public shouldLimitFingerprinting(): boolean {
    // Check for privacy indicators
    if ((navigator as any).doNotTrack === '1') {
      return true;
    }

    if ((navigator as any).globalPrivacyControl) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const deviceFingerprintService = DeviceFingerprintService.getInstance();
