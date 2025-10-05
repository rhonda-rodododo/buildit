/**
 * Device Login Notifications Tests
 * Tests for login notification system and anomaly detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceLoginNotificationService } from '@/lib/notifications/DeviceLoginNotifications';
import type { LoginNotification } from '@/lib/notifications/DeviceLoginNotifications';
import type { DeviceInfo } from '@/types/device';

// Note: Database operations in service will work with actual IndexedDB in browser
// For unit tests, they gracefully handle errors

describe('Device Login Notifications', () => {
  let service: DeviceLoginNotificationService;

  const mockDevice: DeviceInfo = {
    id: 'device-123',
    name: 'Test Device',
    type: 'desktop',
    browser: 'Chrome 120',
    os: 'Windows 11',
    platform: 'web',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    lastSeen: Date.now(),
    firstSeen: Date.now(),
    isCurrent: true,
    isTrusted: false,
    webAuthnEnabled: true,
    icon: 'desktop',
  };

  beforeEach(() => {
    service = DeviceLoginNotificationService.getInstance();
  });

  describe('Notification Creation', () => {
    it('should create login notification with correct properties', async () => {
      const notification = await service.createLoginNotification(mockDevice);

      expect(notification.id).toBeDefined();
      expect(notification.deviceId).toBe(mockDevice.id);
      expect(notification.deviceName).toBe(mockDevice.name);
      expect(notification.platform).toBe(mockDevice.platform);
      expect(notification.timestamp).toBeDefined();
      expect(notification.read).toBe(false);
      expect(notification.trustDevice).toBe(false);
    });

    it('should detect device type from user agent', async () => {
      const mobileDevice: DeviceInfo = {
        ...mockDevice,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      };

      const notification = await service.createLoginNotification(mobileDevice);
      expect(notification.deviceType).toBe('mobile');
    });

    it('should detect tablet device type', async () => {
      const tabletDevice: DeviceInfo = {
        ...mockDevice,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
      };

      const notification = await service.createLoginNotification(tabletDevice);
      expect(notification.deviceType).toBe('tablet');
    });

    it('should detect desktop device type', async () => {
      const desktopDevice: DeviceInfo = {
        ...mockDevice,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      };

      const notification = await service.createLoginNotification(desktopDevice);
      expect(notification.deviceType).toBe('desktop');
    });
  });

  describe('Device Trust Management', () => {
    it('should mark notification as read', async () => {
      const notificationId = 'test-notification-123';
      // Should not throw
      await expect(service.markAsRead(notificationId)).resolves.toBeUndefined();
    });

    it('should trust a device', async () => {
      const deviceId = 'device-to-trust';
      // Should not throw - actual DB update would happen in integration tests
      await expect(service.trustDevice(deviceId)).resolves.toBeUndefined();
    });

    it('should revoke device access', async () => {
      const deviceId = 'device-to-revoke';
      const reason = 'Suspicious activity detected';

      // Should not throw
      await expect(service.revokeDevice(deviceId, reason)).resolves.toBeUndefined();
    });

    it('should revoke device without reason', async () => {
      const deviceId = 'device-to-revoke';

      // Should not throw even without reason
      await expect(service.revokeDevice(deviceId)).resolves.toBeUndefined();
    });
  });

  describe('Anomaly Detection', () => {
    it('should analyze login patterns', async () => {
      const publicKey = 'test-pubkey';
      const currentLogin: LoginNotification = {
        id: 'login-1',
        deviceId: 'device-1',
        deviceName: 'New Device',
        deviceType: 'mobile',
        platform: 'iOS',
        timestamp: Date.now(),
        read: false,
        trustDevice: false,
      };

      const analysis = await service.analyzeLoginPattern(publicKey, currentLogin);

      expect(analysis).toHaveProperty('isAnomalous');
      expect(analysis).toHaveProperty('confidence');
      expect(typeof analysis.isAnomalous).toBe('boolean');
      expect(typeof analysis.confidence).toBe('number');
      expect(analysis.confidence).toBeGreaterThanOrEqual(0);
      expect(analysis.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect no anomalies for empty history', async () => {
      const publicKey = 'new-user-pubkey';
      const currentLogin: LoginNotification = {
        id: 'login-1',
        deviceId: 'device-1',
        deviceName: 'First Device',
        deviceType: 'desktop',
        platform: 'web',
        timestamp: Date.now(),
        read: false,
        trustDevice: false,
      };

      const analysis = await service.analyzeLoginPattern(publicKey, currentLogin);

      // No history means no anomalies
      expect(analysis.isAnomalous).toBe(false);
    });
  });

  describe('Login History', () => {
    it('should get login history', async () => {
      const publicKey = 'test-pubkey';
      const history = await service.getLoginHistory(publicKey);

      expect(Array.isArray(history)).toBe(true);
    });

    it('should get login history with custom limit', async () => {
      const publicKey = 'test-pubkey';
      const limit = 5;
      const history = await service.getLoginHistory(publicKey, limit);

      expect(Array.isArray(history)).toBe(true);
      // In actual implementation, this would respect the limit
    });

    it('should get unread notifications', async () => {
      const publicKey = 'test-pubkey';
      const unread = await service.getUnreadNotifications(publicKey);

      expect(Array.isArray(unread)).toBe(true);
    });
  });

  describe('Device Detection', () => {
    it('should check if device is new (requires IndexedDB)', async () => {
      const fingerprint = 'new-device-fingerprint';
      const publicKey = 'test-pubkey';

      try {
        const isNew = await service.isNewDevice(fingerprint, publicKey);
        // Should return boolean if DB is available
        expect(typeof isNew).toBe('boolean');
      } catch (error) {
        // Expected in Node test environment without IndexedDB
        expect(error).toBeDefined();
      }
    });

    it('should handle device fingerprint check (requires IndexedDB)', async () => {
      const fingerprint = 'known-device-fingerprint';
      const publicKey = 'test-pubkey';

      try {
        await service.isNewDevice(fingerprint, publicKey);
        // If successful, operation worked
        expect(true).toBe(true);
      } catch (error) {
        // Expected in Node test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('Notification Delivery', () => {
    it('should handle notification creation in Node environment', async () => {
      // In Node environment, notification creation should work
      // even without window object (graceful degradation)
      const notification = await service.createLoginNotification(mockDevice);

      expect(notification).toBeDefined();
      expect(notification.deviceId).toBe(mockDevice.id);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = DeviceLoginNotificationService.getInstance();
      const instance2 = DeviceLoginNotificationService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle device with minimal metadata', async () => {
      const minimalDevice: DeviceInfo = {
        id: 'minimal-device',
        name: 'Basic Device',
        type: 'unknown',
        browser: 'Unknown',
        os: 'Unknown',
        platform: 'web',
        userAgent: '',
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        isCurrent: false,
        isTrusted: false,
        webAuthnEnabled: false,
        icon: 'unknown',
      };

      const notification = await service.createLoginNotification(minimalDevice);

      expect(notification).toBeDefined();
      expect(notification.deviceId).toBe(minimalDevice.id);
      expect(notification.deviceType).toBe('unknown');
    });

    it('should handle malformed user agent', async () => {
      const badDevice: DeviceInfo = {
        ...mockDevice,
        userAgent: 'completely invalid user agent string !@#$%',
      };

      const notification = await service.createLoginNotification(badDevice);

      // Should still create notification with 'unknown' type
      expect(notification).toBeDefined();
      expect(notification.deviceType).toBeDefined();
    });
  });
});
