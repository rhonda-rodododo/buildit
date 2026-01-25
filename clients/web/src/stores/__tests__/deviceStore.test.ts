/**
 * DeviceStore Tests
 * Tests for device management, sessions, and WebAuthn credentials
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDeviceStore } from '../deviceStore';
import type { DeviceInfo, WebAuthnCredential } from '@/types/device';

// Mock WebAuthn service
vi.mock('@/lib/webauthn/WebAuthnService', () => ({
  webAuthnService: {
    init: vi.fn().mockResolvedValue(undefined),
    isWebAuthnSupported: vi.fn(() => true),
  },
}));

// Mock device fingerprint service
vi.mock('@/lib/device/DeviceFingerprintService', () => ({
  deviceFingerprintService: {
    getDeviceInfo: vi.fn().mockResolvedValue({
      name: 'Test Device',
      type: 'desktop',
      browser: 'Chrome',
      os: 'Windows',
      platform: 'Win32',
    }),
    generateDeviceId: vi.fn().mockResolvedValue('test-device-id'),
  },
}));

describe('deviceStore', () => {
  beforeEach(() => {
    // Reset store state
    useDeviceStore.setState({
      devices: new Map(),
      sessions: new Map(),
      activities: [],
      credentials: new Map(),
      authorizationRequests: new Map(),
      currentDeviceId: null,
      privacySettings: {
        anonymizeIpAddresses: true,
        limitFingerprinting: false,
        autoExpireSessions: true,
        sessionTimeoutMinutes: 60 * 24 * 30,
        requireAuthOnNewDevice: true,
        enableLocationTracking: false,
        logActivityHistory: true,
      },
      isWebAuthnSupported: false,
    });
  });

  describe('Device Management', () => {
    const mockDevice: DeviceInfo = {
      id: 'device-1',
      name: 'My Laptop',
      type: 'desktop',
      browser: 'Chrome',
      os: 'Windows 11',
      platform: 'Win32',
      lastSeen: Date.now(),
      firstSeen: Date.now(),
      isCurrent: true,
      isTrusted: false,
      webAuthnEnabled: false,
    };

    describe('addDevice', () => {
      it('should add a device', () => {
        const { addDevice } = useDeviceStore.getState();

        addDevice(mockDevice);

        const { devices } = useDeviceStore.getState();
        expect(devices.get('device-1')).toEqual(mockDevice);
      });
    });

    describe('removeDevice', () => {
      it('should remove a device and associated data', () => {
        const { addDevice, removeDevice, createSession, addCredential } =
          useDeviceStore.getState();

        // Setup device with session and credential
        addDevice(mockDevice);
        createSession('device-1');
        addCredential({
          id: 'cred-1',
          publicKey: 'pubkey',
          deviceId: 'device-1',
          credentialId: 'cred-id',
          counter: 0,
          createdAt: Date.now(),
        });

        removeDevice('device-1');

        const { devices, sessions, credentials } = useDeviceStore.getState();
        expect(devices.has('device-1')).toBe(false);
        // Sessions and credentials should also be removed
        expect(
          Array.from(sessions.values()).filter((s) => s.deviceId === 'device-1')
        ).toHaveLength(0);
        expect(
          Array.from(credentials.values()).filter((c) => c.deviceId === 'device-1')
        ).toHaveLength(0);
      });
    });

    describe('updateDevice', () => {
      it('should update device properties', () => {
        const { addDevice, updateDevice } = useDeviceStore.getState();

        addDevice(mockDevice);
        updateDevice('device-1', { name: 'Updated Laptop' });

        const { devices } = useDeviceStore.getState();
        expect(devices.get('device-1')?.name).toBe('Updated Laptop');
      });

      it('should not fail for non-existent device', () => {
        const { updateDevice } = useDeviceStore.getState();

        expect(() => updateDevice('non-existent', { name: 'Test' })).not.toThrow();
      });
    });

    describe('getDevice', () => {
      it('should return device by id', () => {
        const { addDevice, getDevice } = useDeviceStore.getState();

        addDevice(mockDevice);

        expect(getDevice('device-1')).toEqual(mockDevice);
      });

      it('should return undefined for non-existent device', () => {
        const { getDevice } = useDeviceStore.getState();

        expect(getDevice('non-existent')).toBeUndefined();
      });
    });

    describe('trustDevice', () => {
      it('should mark device as trusted', () => {
        const { addDevice, trustDevice } = useDeviceStore.getState();

        addDevice(mockDevice);
        trustDevice('device-1');

        const { devices } = useDeviceStore.getState();
        expect(devices.get('device-1')?.isTrusted).toBe(true);
      });

      it('should log activity', () => {
        const { addDevice, trustDevice } = useDeviceStore.getState();

        addDevice(mockDevice);
        trustDevice('device-1');

        const { activities } = useDeviceStore.getState();
        expect(activities.some((a) => a.type === 'device_trusted')).toBe(true);
      });
    });

    describe('untrustDevice', () => {
      it('should mark device as untrusted', () => {
        const { addDevice, trustDevice, untrustDevice } = useDeviceStore.getState();

        addDevice({ ...mockDevice, isTrusted: true });
        untrustDevice('device-1');

        const { devices } = useDeviceStore.getState();
        expect(devices.get('device-1')?.isTrusted).toBe(false);
      });
    });

    describe('setCurrentDevice', () => {
      it('should set current device id', () => {
        const { setCurrentDevice } = useDeviceStore.getState();

        setCurrentDevice('device-1');

        const { currentDeviceId } = useDeviceStore.getState();
        expect(currentDeviceId).toBe('device-1');
      });
    });
  });

  describe('Session Management', () => {
    beforeEach(() => {
      const { addDevice } = useDeviceStore.getState();
      addDevice({
        id: 'device-1',
        name: 'Test Device',
        type: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
        platform: 'Win32',
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        isCurrent: true,
        isTrusted: false,
        webAuthnEnabled: false,
      });
    });

    describe('createSession', () => {
      it('should create a new session', () => {
        const { createSession } = useDeviceStore.getState();

        const session = createSession('device-1');

        expect(session).toBeDefined();
        expect(session.deviceId).toBe('device-1');
        expect(session.isActive).toBe(true);
      });

      it('should anonymize IP address when setting enabled', () => {
        const { createSession } = useDeviceStore.getState();

        const session = createSession('device-1', '192.168.1.1');

        expect(session.ipAddress).toBeUndefined();
      });

      it('should include IP when anonymization disabled', () => {
        useDeviceStore.setState((state) => ({
          privacySettings: { ...state.privacySettings, anonymizeIpAddresses: false },
        }));

        const { createSession } = useDeviceStore.getState();

        const session = createSession('device-1', '192.168.1.1');

        expect(session.ipAddress).toBe('192.168.1.1');
      });
    });

    describe('updateSession', () => {
      it('should update session properties', () => {
        const { createSession, updateSession } = useDeviceStore.getState();

        const session = createSession('device-1');
        updateSession(session.id, { isActive: false });

        const { sessions } = useDeviceStore.getState();
        expect(sessions.get(session.id)?.isActive).toBe(false);
      });
    });

    describe('revokeSession', () => {
      it('should mark session as inactive', () => {
        const { createSession, revokeSession } = useDeviceStore.getState();

        const session = createSession('device-1');
        revokeSession(session.id);

        const { sessions } = useDeviceStore.getState();
        expect(sessions.get(session.id)?.isActive).toBe(false);
      });

      it('should log activity', () => {
        const { createSession, revokeSession } = useDeviceStore.getState();

        const session = createSession('device-1');
        revokeSession(session.id);

        const { activities } = useDeviceStore.getState();
        expect(activities.some((a) => a.type === 'session_revoked')).toBe(true);
      });
    });

    describe('revokeAllSessions', () => {
      it('should revoke all sessions except current', () => {
        useDeviceStore.setState({ currentDeviceId: 'device-1' });
        const { createSession, revokeAllSessions, addDevice } =
          useDeviceStore.getState();

        addDevice({
          id: 'device-2',
          name: 'Other Device',
          type: 'mobile',
          browser: 'Safari',
          os: 'iOS',
          platform: 'iPhone',
          lastSeen: Date.now(),
          firstSeen: Date.now(),
          isCurrent: false,
          isTrusted: false,
          webAuthnEnabled: false,
        });

        const session1 = createSession('device-1');
        const session2 = createSession('device-2');

        revokeAllSessions(true);

        const { sessions } = useDeviceStore.getState();
        expect(sessions.get(session1.id)?.isActive).toBe(true);
        expect(sessions.get(session2.id)?.isActive).toBe(false);
      });

      it('should revoke all sessions when exceptCurrent is false', () => {
        const { createSession, revokeAllSessions } = useDeviceStore.getState();

        const session1 = createSession('device-1');

        revokeAllSessions(false);

        const { sessions } = useDeviceStore.getState();
        expect(sessions.get(session1.id)?.isActive).toBe(false);
      });
    });

    describe('getActiveSessions', () => {
      it('should return only active sessions', () => {
        const { createSession, revokeSession, getActiveSessions } =
          useDeviceStore.getState();

        const session1 = createSession('device-1');
        const session2 = createSession('device-1');
        revokeSession(session1.id);

        const active = getActiveSessions();

        expect(active).toHaveLength(1);
        expect(active[0].id).toBe(session2.id);
      });
    });
  });

  describe('Activity Logging', () => {
    beforeEach(() => {
      const { addDevice } = useDeviceStore.getState();
      addDevice({
        id: 'device-1',
        name: 'Test Device',
        type: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
        platform: 'Win32',
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        isCurrent: true,
        isTrusted: false,
        webAuthnEnabled: false,
      });
    });

    describe('logActivity', () => {
      it('should log an activity', () => {
        const { logActivity } = useDeviceStore.getState();

        logActivity({
          deviceId: 'device-1',
          type: 'login',
          description: 'User logged in',
        });

        const { activities } = useDeviceStore.getState();
        expect(activities).toHaveLength(1);
        expect(activities[0].type).toBe('login');
        expect(activities[0].id).toBeDefined();
        expect(activities[0].timestamp).toBeDefined();
      });

      it('should not log when logging disabled', () => {
        useDeviceStore.setState((state) => ({
          privacySettings: { ...state.privacySettings, logActivityHistory: false },
        }));

        const { logActivity } = useDeviceStore.getState();

        logActivity({
          deviceId: 'device-1',
          type: 'login',
          description: 'Test',
        });

        const { activities } = useDeviceStore.getState();
        expect(activities).toHaveLength(0);
      });
    });

    describe('getDeviceActivities', () => {
      it('should return activities for a device', () => {
        const { logActivity, getDeviceActivities, addDevice } =
          useDeviceStore.getState();

        addDevice({
          id: 'device-2',
          name: 'Other',
          type: 'mobile',
          browser: 'Safari',
          os: 'iOS',
          platform: 'iPhone',
          lastSeen: Date.now(),
          firstSeen: Date.now(),
          isCurrent: false,
          isTrusted: false,
          webAuthnEnabled: false,
        });

        logActivity({ deviceId: 'device-1', type: 'login', description: 'Login 1' });
        logActivity({ deviceId: 'device-2', type: 'login', description: 'Login 2' });
        logActivity({ deviceId: 'device-1', type: 'logout', description: 'Logout' });

        const activities = getDeviceActivities('device-1');

        expect(activities).toHaveLength(2);
        expect(activities.every((a) => a.deviceId === 'device-1')).toBe(true);
      });

      it('should limit results', () => {
        const { logActivity, getDeviceActivities } = useDeviceStore.getState();

        for (let i = 0; i < 10; i++) {
          logActivity({ deviceId: 'device-1', type: 'login', description: `Activity ${i}` });
        }

        const activities = getDeviceActivities('device-1', 5);

        expect(activities).toHaveLength(5);
      });

      it('should sort by timestamp descending', () => {
        const { getDeviceActivities } = useDeviceStore.getState();

        // Set up activities with explicit timestamps
        const baseTime = Date.now();
        useDeviceStore.setState({
          activities: [
            { id: '1', deviceId: 'device-1', type: 'login', description: 'First', timestamp: baseTime - 2000 },
            { id: '2', deviceId: 'device-1', type: 'login', description: 'Second', timestamp: baseTime - 1000 },
            { id: '3', deviceId: 'device-1', type: 'login', description: 'Third', timestamp: baseTime },
          ],
        });

        const activities = getDeviceActivities('device-1');

        expect(activities[0].description).toBe('Third');
        expect(activities[1].description).toBe('Second');
        expect(activities[2].description).toBe('First');
      });
    });

    describe('clearOldActivities', () => {
      it('should remove activities older than specified days', () => {
        const { clearOldActivities } = useDeviceStore.getState();

        // Set up activities with different timestamps
        const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
        const newTime = Date.now();

        useDeviceStore.setState({
          activities: [
            { id: '1', deviceId: 'device-1', type: 'login', description: 'Old', timestamp: oldTime },
            { id: '2', deviceId: 'device-1', type: 'login', description: 'New', timestamp: newTime },
          ],
        });

        clearOldActivities(5);

        const { activities } = useDeviceStore.getState();
        expect(activities).toHaveLength(1);
        expect(activities[0].description).toBe('New');
      });
    });
  });

  describe('WebAuthn Credentials', () => {
    const mockCredential: WebAuthnCredential = {
      id: 'cred-1',
      publicKey: 'mock-public-key',
      deviceId: 'device-1',
      credentialId: 'credential-id',
      counter: 0,
      createdAt: Date.now(),
    };

    beforeEach(() => {
      const { addDevice } = useDeviceStore.getState();
      addDevice({
        id: 'device-1',
        name: 'Test Device',
        type: 'desktop',
        browser: 'Chrome',
        os: 'Windows',
        platform: 'Win32',
        lastSeen: Date.now(),
        firstSeen: Date.now(),
        isCurrent: true,
        isTrusted: false,
        webAuthnEnabled: false,
      });
    });

    describe('addCredential', () => {
      it('should add a credential', () => {
        const { addCredential } = useDeviceStore.getState();

        addCredential(mockCredential);

        const { credentials } = useDeviceStore.getState();
        expect(credentials.get('cred-1')).toEqual(mockCredential);
      });

      it('should log activity', () => {
        const { addCredential } = useDeviceStore.getState();

        addCredential(mockCredential);

        const { activities } = useDeviceStore.getState();
        expect(activities.some((a) => a.type === 'webauthn_registered')).toBe(true);
      });
    });

    describe('removeCredential', () => {
      it('should remove a credential', () => {
        const { addCredential, removeCredential } = useDeviceStore.getState();

        addCredential(mockCredential);
        removeCredential('cred-1');

        const { credentials } = useDeviceStore.getState();
        expect(credentials.has('cred-1')).toBe(false);
      });
    });

    describe('updateCredentialCounter', () => {
      it('should update counter and lastUsed', () => {
        const { addCredential, updateCredentialCounter } = useDeviceStore.getState();

        addCredential(mockCredential);
        updateCredentialCounter('cred-1', 5);

        const { credentials } = useDeviceStore.getState();
        expect(credentials.get('cred-1')?.counter).toBe(5);
        expect(credentials.get('cred-1')?.lastUsed).toBeDefined();
      });
    });

    describe('getCredential', () => {
      it('should return credential by id', () => {
        const { addCredential, getCredential } = useDeviceStore.getState();

        addCredential(mockCredential);

        expect(getCredential('cred-1')).toEqual(mockCredential);
      });
    });

    describe('getDeviceCredentials', () => {
      it('should return credentials for a device', () => {
        const { addCredential, getDeviceCredentials } = useDeviceStore.getState();

        addCredential(mockCredential);
        addCredential({ ...mockCredential, id: 'cred-2', deviceId: 'device-2' });

        const creds = getDeviceCredentials('device-1');

        expect(creds).toHaveLength(1);
        expect(creds[0].id).toBe('cred-1');
      });
    });
  });

  describe('Device Authorization', () => {
    const mockDeviceInfo: DeviceInfo = {
      id: 'new-device',
      name: 'New Device',
      type: 'mobile',
      browser: 'Safari',
      os: 'iOS',
      platform: 'iPhone',
      lastSeen: Date.now(),
      firstSeen: Date.now(),
      isCurrent: false,
      isTrusted: false,
      webAuthnEnabled: false,
    };

    describe('createAuthorizationRequest', () => {
      it('should create an authorization request', () => {
        const { createAuthorizationRequest } = useDeviceStore.getState();

        const request = createAuthorizationRequest(mockDeviceInfo);

        expect(request).toBeDefined();
        expect(request.deviceInfo).toEqual(mockDeviceInfo);
        expect(request.status).toBe('pending');
        expect(request.expiresAt).toBeGreaterThan(Date.now());
      });
    });

    describe('approveDevice', () => {
      it('should approve and add device', () => {
        const { createAuthorizationRequest, approveDevice } =
          useDeviceStore.getState();

        const request = createAuthorizationRequest(mockDeviceInfo);
        approveDevice(request.id);

        const { authorizationRequests, devices } = useDeviceStore.getState();
        expect(authorizationRequests.get(request.id)?.status).toBe('approved');
        expect(devices.has('new-device')).toBe(true);
      });
    });

    describe('denyDevice', () => {
      it('should deny the request', () => {
        const { createAuthorizationRequest, denyDevice } = useDeviceStore.getState();

        const request = createAuthorizationRequest(mockDeviceInfo);
        denyDevice(request.id);

        const { authorizationRequests, devices } = useDeviceStore.getState();
        expect(authorizationRequests.get(request.id)?.status).toBe('denied');
        expect(devices.has('new-device')).toBe(false);
      });
    });

    describe('getPendingAuthorizations', () => {
      it('should return only pending non-expired requests', () => {
        const { createAuthorizationRequest, denyDevice, getPendingAuthorizations } =
          useDeviceStore.getState();

        const request1 = createAuthorizationRequest(mockDeviceInfo);
        const request2 = createAuthorizationRequest({
          ...mockDeviceInfo,
          id: 'device-2',
        });
        denyDevice(request2.id);

        const pending = getPendingAuthorizations();

        expect(pending).toHaveLength(1);
        expect(pending[0].id).toBe(request1.id);
      });
    });
  });

  describe('Privacy Settings', () => {
    describe('updatePrivacySettings', () => {
      it('should update privacy settings', () => {
        const { updatePrivacySettings } = useDeviceStore.getState();

        updatePrivacySettings({
          anonymizeIpAddresses: false,
          enableLocationTracking: true,
        });

        const { privacySettings } = useDeviceStore.getState();
        expect(privacySettings.anonymizeIpAddresses).toBe(false);
        expect(privacySettings.enableLocationTracking).toBe(true);
      });
    });
  });

  describe('Initialization', () => {
    describe('initializeCurrentDevice', () => {
      it('should set up current device', async () => {
        const { initializeCurrentDevice } = useDeviceStore.getState();

        await initializeCurrentDevice();

        const { devices, currentDeviceId, sessions } = useDeviceStore.getState();
        expect(devices.has('test-device-id')).toBe(true);
        expect(currentDeviceId).toBe('test-device-id');
        expect(sessions.size).toBeGreaterThan(0);
      });
    });

    describe('checkWebAuthnSupport', () => {
      it('should check and update WebAuthn support', async () => {
        const { checkWebAuthnSupport } = useDeviceStore.getState();

        await checkWebAuthnSupport();

        const { isWebAuthnSupported } = useDeviceStore.getState();
        expect(isWebAuthnSupported).toBe(true);
      });
    });
  });
});
