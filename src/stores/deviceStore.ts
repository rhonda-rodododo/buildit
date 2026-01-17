/**
 * Device Management Store
 * Manages devices, sessions, WebAuthn credentials, and device activity
 */

import { create } from 'zustand';
import type {
  DeviceInfo,
  DeviceSession,
  DeviceActivity,
  WebAuthnCredential,
  DeviceAuthorizationRequest,
  DevicePrivacySettings,
  DeviceManagerState,
} from '@/types/device';
import { webAuthnService } from '@/lib/webauthn/WebAuthnService';
import { deviceFingerprintService } from '@/lib/device/DeviceFingerprintService';

interface DeviceStore extends DeviceManagerState {
  // Device Management
  addDevice: (device: DeviceInfo) => void;
  removeDevice: (deviceId: string) => void;
  updateDevice: (deviceId: string, updates: Partial<DeviceInfo>) => void;
  getDevice: (deviceId: string) => DeviceInfo | undefined;
  trustDevice: (deviceId: string) => void;
  untrustDevice: (deviceId: string) => void;
  setCurrentDevice: (deviceId: string) => void;

  // Session Management
  createSession: (deviceId: string, ipAddress?: string, location?: string) => DeviceSession;
  updateSession: (sessionId: string, updates: Partial<DeviceSession>) => void;
  revokeSession: (sessionId: string) => void;
  revokeAllSessions: (exceptCurrent?: boolean) => void;
  getActiveSessions: () => DeviceSession[];

  // Activity Logging
  logActivity: (activity: Omit<DeviceActivity, 'id' | 'timestamp'>) => void;
  getDeviceActivities: (deviceId: string, limit?: number) => DeviceActivity[];
  clearOldActivities: (daysToKeep: number) => void;

  // WebAuthn Credentials
  addCredential: (credential: WebAuthnCredential) => void;
  removeCredential: (credentialId: string) => void;
  updateCredentialCounter: (credentialId: string, counter: number) => void;
  getCredential: (credentialId: string) => WebAuthnCredential | undefined;
  getDeviceCredentials: (deviceId: string) => WebAuthnCredential[];

  // Device Authorization
  createAuthorizationRequest: (deviceInfo: DeviceInfo) => DeviceAuthorizationRequest;
  approveDevice: (requestId: string) => void;
  denyDevice: (requestId: string) => void;
  getPendingAuthorizations: () => DeviceAuthorizationRequest[];

  // Privacy Settings
  updatePrivacySettings: (settings: Partial<DevicePrivacySettings>) => void;

  // Initialization
  initializeCurrentDevice: () => Promise<void>;
  checkWebAuthnSupport: () => Promise<void>;
}

const defaultPrivacySettings: DevicePrivacySettings = {
  anonymizeIpAddresses: true,
  limitFingerprinting: false,
  autoExpireSessions: true,
  sessionTimeoutMinutes: 60 * 24 * 30, // 30 days
  requireAuthOnNewDevice: true,
  enableLocationTracking: false,
  logActivityHistory: true,
};

export const useDeviceStore = create<DeviceStore>()(
  (set, get) => ({
      devices: new Map(),
      sessions: new Map(),
      activities: [],
      credentials: new Map(),
      authorizationRequests: new Map(),
      currentDeviceId: null,
      privacySettings: defaultPrivacySettings,
      isWebAuthnSupported: false,

      // Device Management
      addDevice: (device) =>
        set((state) => {
          const devices = new Map(state.devices);
          devices.set(device.id, device);
          return { devices };
        }),

      removeDevice: (deviceId) =>
        set((state) => {
          const devices = new Map(state.devices);
          devices.delete(deviceId);

          // Remove associated sessions
          const sessions = new Map(state.sessions);
          Array.from(sessions.values())
            .filter((s) => s.deviceId === deviceId)
            .forEach((s) => sessions.delete(s.id));

          // Remove associated credentials
          const credentials = new Map(state.credentials);
          Array.from(credentials.values())
            .filter((c) => c.deviceId === deviceId)
            .forEach((c) => credentials.delete(c.id));

          return { devices, sessions, credentials };
        }),

      updateDevice: (deviceId, updates) =>
        set((state) => {
          const devices = new Map(state.devices);
          const device = devices.get(deviceId);
          if (device) {
            devices.set(deviceId, { ...device, ...updates });
          }
          return { devices };
        }),

      getDevice: (deviceId) => {
        return get().devices.get(deviceId);
      },

      trustDevice: (deviceId) =>
        set((state) => {
          const devices = new Map(state.devices);
          const device = devices.get(deviceId);
          if (device) {
            devices.set(deviceId, { ...device, isTrusted: true });

            // Log activity
            get().logActivity({
              deviceId,
              type: 'device_trusted',
              description: `Device "${device.name}" marked as trusted`,
            });
          }
          return { devices };
        }),

      untrustDevice: (deviceId) =>
        set((state) => {
          const devices = new Map(state.devices);
          const device = devices.get(deviceId);
          if (device) {
            devices.set(deviceId, { ...device, isTrusted: false });

            // Log activity
            get().logActivity({
              deviceId,
              type: 'device_untrusted',
              description: `Device "${device.name}" marked as untrusted`,
            });
          }
          return { devices };
        }),

      setCurrentDevice: (deviceId) => set({ currentDeviceId: deviceId }),

      // Session Management
      createSession: (deviceId, ipAddress, location) => {
        const session: DeviceSession = {
          id: crypto.randomUUID(),
          deviceId,
          ipAddress: get().privacySettings.anonymizeIpAddresses
            ? undefined
            : ipAddress,
          location: get().privacySettings.enableLocationTracking
            ? location
            : undefined,
          createdAt: Date.now(),
          lastActive: Date.now(),
          isActive: true,
        };

        set((state) => {
          const sessions = new Map(state.sessions);
          sessions.set(session.id, session);
          return { sessions };
        });

        get().logActivity({
          deviceId,
          type: 'login',
          description: 'New session created',
        });

        return session;
      },

      updateSession: (sessionId, updates) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          const session = sessions.get(sessionId);
          if (session) {
            sessions.set(sessionId, { ...session, ...updates });
          }
          return { sessions };
        }),

      revokeSession: (sessionId) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          const session = sessions.get(sessionId);
          if (session) {
            sessions.set(sessionId, { ...session, isActive: false });

            get().logActivity({
              deviceId: session.deviceId,
              type: 'session_revoked',
              description: 'Session revoked',
            });
          }
          return { sessions };
        }),

      revokeAllSessions: (exceptCurrent = true) =>
        set((state) => {
          const sessions = new Map(state.sessions);
          const currentDeviceId = state.currentDeviceId;

          Array.from(sessions.values()).forEach((session) => {
            if (exceptCurrent && session.deviceId === currentDeviceId) {
              return; // Keep current device session
            }
            sessions.set(session.id, { ...session, isActive: false });

            get().logActivity({
              deviceId: session.deviceId,
              type: 'session_revoked',
              description: 'Session revoked (all sessions)',
            });
          });

          return { sessions };
        }),

      getActiveSessions: () => {
        return Array.from(get().sessions.values()).filter((s) => s.isActive);
      },

      // Activity Logging
      logActivity: (activity) =>
        set((state) => {
          if (!state.privacySettings.logActivityHistory) {
            return state;
          }

          const newActivity: DeviceActivity = {
            ...activity,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
          };

          return {
            activities: [...state.activities, newActivity],
          };
        }),

      getDeviceActivities: (deviceId, limit = 50) => {
        return get()
          .activities.filter((a) => a.deviceId === deviceId)
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);
      },

      clearOldActivities: (daysToKeep) =>
        set((state) => {
          const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;
          return {
            activities: state.activities.filter((a) => a.timestamp > cutoff),
          };
        }),

      // WebAuthn Credentials
      addCredential: (credential) =>
        set((state) => {
          const credentials = new Map(state.credentials);
          credentials.set(credential.id, credential);

          get().logActivity({
            deviceId: credential.deviceId,
            type: 'webauthn_registered',
            description: 'WebAuthn credential registered',
          });

          return { credentials };
        }),

      removeCredential: (credentialId) =>
        set((state) => {
          const credentials = new Map(state.credentials);
          const credential = credentials.get(credentialId);
          if (credential) {
            credentials.delete(credentialId);

            get().logActivity({
              deviceId: credential.deviceId,
              type: 'device_removed',
              description: 'WebAuthn credential removed',
            });
          }
          return { credentials };
        }),

      updateCredentialCounter: (credentialId, counter) =>
        set((state) => {
          const credentials = new Map(state.credentials);
          const credential = credentials.get(credentialId);
          if (credential) {
            credentials.set(credentialId, {
              ...credential,
              counter,
              lastUsed: Date.now(),
            });
          }
          return { credentials };
        }),

      getCredential: (credentialId) => {
        return get().credentials.get(credentialId);
      },

      getDeviceCredentials: (deviceId) => {
        return Array.from(get().credentials.values()).filter(
          (c) => c.deviceId === deviceId
        );
      },

      // Device Authorization
      createAuthorizationRequest: (deviceInfo) => {
        const request: DeviceAuthorizationRequest = {
          id: crypto.randomUUID(),
          deviceInfo,
          requestedAt: Date.now(),
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
          status: 'pending',
          notificationSent: false,
        };

        set((state) => {
          const authorizationRequests = new Map(state.authorizationRequests);
          authorizationRequests.set(request.id, request);
          return { authorizationRequests };
        });

        return request;
      },

      approveDevice: (requestId) =>
        set((state) => {
          const authorizationRequests = new Map(state.authorizationRequests);
          const request = authorizationRequests.get(requestId);
          if (request) {
            authorizationRequests.set(requestId, {
              ...request,
              status: 'approved',
            });

            // Add device
            get().addDevice({
              ...request.deviceInfo,
              isTrusted: false,
              webAuthnEnabled: false,
            });
          }
          return { authorizationRequests };
        }),

      denyDevice: (requestId) =>
        set((state) => {
          const authorizationRequests = new Map(state.authorizationRequests);
          const request = authorizationRequests.get(requestId);
          if (request) {
            authorizationRequests.set(requestId, {
              ...request,
              status: 'denied',
            });
          }
          return { authorizationRequests };
        }),

      getPendingAuthorizations: () => {
        return Array.from(get().authorizationRequests.values()).filter(
          (r) => r.status === 'pending' && r.expiresAt > Date.now()
        );
      },

      // Privacy Settings
      updatePrivacySettings: (settings) =>
        set((state) => ({
          privacySettings: { ...state.privacySettings, ...settings },
        })),

      // Initialization
      initializeCurrentDevice: async () => {
        const deviceInfo = await deviceFingerprintService.getDeviceInfo();
        const deviceId = await deviceFingerprintService.generateDeviceId();

        const device: DeviceInfo = {
          id: deviceId,
          name: deviceInfo.name || 'Current Device',
          type: deviceInfo.type || 'unknown',
          browser: deviceInfo.browser || 'Unknown',
          os: deviceInfo.os || 'Unknown',
          platform: deviceInfo.platform || 'Unknown',
          screenResolution: deviceInfo.screenResolution,
          userAgent: deviceInfo.userAgent || navigator.userAgent,
          lastSeen: Date.now(),
          firstSeen: Date.now(),
          isCurrent: true,
          isTrusted: true,
          webAuthnEnabled: webAuthnService.isWebAuthnSupported(),
          icon: deviceInfo.icon || 'help-circle',
        };

        get().addDevice(device);
        get().setCurrentDevice(deviceId);
        get().createSession(deviceId);
      },

      checkWebAuthnSupport: async () => {
        await webAuthnService.init();
        set({ isWebAuthnSupported: webAuthnService.isWebAuthnSupported() });
      },
    })
);
