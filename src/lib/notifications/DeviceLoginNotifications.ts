/**
 * Device Login Notifications
 * Alerts users when their account is accessed from a new device
 */

import type { DeviceInfo } from '@/types/device';
import { useDeviceStore } from '@/stores/deviceStore';

export interface LoginNotification {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  platform: string;
  ipAddress?: string;
  location?: {
    city?: string;
    country?: string;
    timezone?: string;
  };
  timestamp: number;
  read: boolean;
  trustDevice: boolean;
}

export class DeviceLoginNotificationService {
  private static instance: DeviceLoginNotificationService;

  private constructor() {}

  public static getInstance(): DeviceLoginNotificationService {
    if (!DeviceLoginNotificationService.instance) {
      DeviceLoginNotificationService.instance = new DeviceLoginNotificationService();
    }
    return DeviceLoginNotificationService.instance;
  }

  /**
   * Create a login notification for a new device
   */
  public async createLoginNotification(device: DeviceInfo): Promise<LoginNotification> {
    // @ts-expect-error - DeviceInfo may have metadata from extended implementations
    const metadata = device.metadata;

    const notification: LoginNotification = {
      id: crypto.randomUUID(),
      deviceId: device.id,
      deviceName: device.name,
      deviceType: this.detectDeviceType(device.userAgent),
      platform: device.platform,
      ipAddress: metadata?.ipAddress,
      location: await this.detectLocation(metadata?.ipAddress),
      timestamp: Date.now(),
      read: false,
      trustDevice: false,
    };

    // Store notification in database
    await this.storeNotification(notification);

    // Trigger notification (in-app, push, email, etc.)
    await this.triggerNotification(notification);

    return notification;
  }

  /**
   * Check if device is new (not seen before)
   */
  public async isNewDevice(deviceFingerprint: string, _publicKey: string): Promise<boolean> {
    const store = useDeviceStore.getState();
    const devices = Array.from(store.devices.values());

    // Check if any existing device has this fingerprint and is trusted
    const authorizedDevice = devices.find((d: DeviceInfo) => {
      return d.fingerprint === deviceFingerprint && d.isTrusted;
    });

    return !authorizedDevice;
  }

  /**
   * Mark notification as read
   */
  public async markAsRead(notificationId: string): Promise<void> {
    // In a real implementation, update database
    console.log(`Marking notification ${notificationId} as read`);
  }

  /**
   * Trust a device after verifying the login
   */
  public async trustDevice(deviceId: string): Promise<void> {
    const store = useDeviceStore.getState();
    store.trustDevice(deviceId);
  }

  /**
   * Get all unread login notifications for current user
   */
  public async getUnreadNotifications(_publicKey: string): Promise<LoginNotification[]> {
    // In real implementation, query from database
    // For now, return empty array
    return [];
  }

  /**
   * Revoke device access and mark as suspicious
   */
  public async revokeDevice(deviceId: string, reason?: string): Promise<void> {
    const store = useDeviceStore.getState();

    // Untrust the device
    store.untrustDevice(deviceId);

    // Revoke all sessions for this device
    const sessions = Array.from(store.sessions.values()).filter(s => s.deviceId === deviceId);
    sessions.forEach(session => store.revokeSession(session.id));

    // Log activity
    store.logActivity({
      deviceId,
      type: 'device_removed',
      description: `Device revoked: ${reason || 'No reason provided'}`,
    });
  }

  /**
   * Detect device type from user agent
   */
  private detectDeviceType(userAgent: string): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    const ua = userAgent;

    // Check for tablet first (more specific)
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    // Check for mobile devices
    if (/(mobile|android|iphone|ipod|iemobile|blackberry|kindle|silk-accelerated|(hpw|web)os|opera m(obi|ini))/i.test(ua)) {
      return 'mobile';
    }
    // Check for desktop OS
    if (/(windows|mac|linux)/i.test(ua)) {
      return 'desktop';
    }
    return 'unknown';
  }

  /**
   * Detect approximate location from IP address
   * NOTE: Requires external geolocation service
   */
  private async detectLocation(ipAddress?: string): Promise<LoginNotification['location'] | undefined> {
    if (!ipAddress) return undefined;

    // In production, use a geolocation service like:
    // - ip-api.com
    // - ipinfo.io
    // - MaxMind GeoIP

    // For now, return undefined (privacy-preserving default)
    // Location detection should be opt-in
    return undefined;
  }

  /**
   * Store notification in database
   */
  private async storeNotification(notification: LoginNotification): Promise<void> {
    // In real implementation, store in IndexedDB notifications table
    console.log('Login notification created:', {
      deviceName: notification.deviceName,
      platform: notification.platform,
      timestamp: new Date(notification.timestamp).toISOString(),
    });
  }

  /**
   * Trigger notification delivery
   */
  private async triggerNotification(notification: LoginNotification): Promise<void> {
    // Priority order:
    // 1. In-app notification (immediate)
    // 2. Push notification (if enabled)
    // 3. Email notification (if configured)

    // In-app notification
    await this.sendInAppNotification(notification);

    // Push notification (requires service worker and browser environment)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      await this.sendPushNotification(notification);
    }

    // Email notification (requires backend service)
    // Future enhancement: await this.sendEmailNotification(notification);
  }

  /**
   * Send in-app notification
   */
  private async sendInAppNotification(notification: LoginNotification): Promise<void> {
    // Dispatch custom event for app to handle (browser only)
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('device-login', {
        detail: notification,
      });
      window.dispatchEvent(event);
    }
  }

  /**
   * Send push notification
   */
  private async sendPushNotification(notification: LoginNotification): Promise<void> {
    const title = 'New Device Login';
    const body = `Login from ${notification.deviceName} on ${notification.platform}`;

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'Notification' in window) {
      const registration = await navigator.serviceWorker.ready;
      const options: NotificationOptions & { actions?: Array<{ action: string; title: string }> } = {
        body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: `device-login-${notification.deviceId}`,
        requireInteraction: true,
        actions: [
          { action: 'trust', title: 'Trust Device' },
          { action: 'revoke', title: 'Revoke Access' },
        ],
      };
      await registration.showNotification(title, options);
    }
  }

  /**
   * Get login history for a specific identity
   */
  public async getLoginHistory(_publicKey: string, _limit: number = 10): Promise<LoginNotification[]> {
    // In real implementation, query from database with filtering
    // For now, return empty array
    return [];
  }

  /**
   * Analyze login patterns for anomaly detection
   */
  public async analyzeLoginPattern(
    publicKey: string,
    currentLogin: LoginNotification
  ): Promise<{
    isAnomalous: boolean;
    reason?: string;
    confidence: number;
  }> {
    const history = await this.getLoginHistory(publicKey, 50);

    // Simple anomaly detection
    const anomalies: string[] = [];

    // Check for unusual location (if available)
    if (currentLogin.location && history.length > 0) {
      const commonCountry = this.getMostCommonCountry(history);
      if (currentLogin.location.country && currentLogin.location.country !== commonCountry) {
        anomalies.push('unusual_location');
      }
    }

    // Check for unusual device type
    const commonDeviceType = this.getMostCommonDeviceType(history);
    if (currentLogin.deviceType !== commonDeviceType && commonDeviceType !== 'unknown') {
      anomalies.push('unusual_device_type');
    }

    // Check for rapid successive logins from different locations
    const recentLogins = history.filter(h =>
      h.timestamp > Date.now() - 3600000 // Last hour
    );
    if (recentLogins.length > 5) {
      anomalies.push('rapid_logins');
    }

    return {
      isAnomalous: anomalies.length > 0,
      reason: anomalies.join(', '),
      confidence: Math.min(anomalies.length * 0.3, 0.9),
    };
  }

  private getMostCommonCountry(history: LoginNotification[]): string | undefined {
    const countries = history
      .map(h => h.location?.country)
      .filter((c): c is string => !!c);

    if (countries.length === 0) return undefined;

    const counts = countries.reduce((acc, country) => {
      acc[country] = (acc[country] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  private getMostCommonDeviceType(history: LoginNotification[]): LoginNotification['deviceType'] {
    const types = history.map(h => h.deviceType);
    const counts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[0] as LoginNotification['deviceType']) || 'unknown';
  }
}

export const deviceLoginNotifications = DeviceLoginNotificationService.getInstance();
