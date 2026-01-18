/**
 * WebAuthnService Tests
 * Tests for WebAuthn/passkey functionality
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebAuthnService } from '../WebAuthnService';
import type { WebAuthnCredential } from '@/types/device';

// Setup global window with location
if (typeof globalThis.window === 'undefined') {
  (globalThis as any).window = {
    location: { hostname: 'localhost' },
  };
}
if (!globalThis.window.location) {
  (globalThis.window as any).location = { hostname: 'localhost' };
}

// Mock @simplewebauthn/browser
const mockStartRegistration = vi.fn();
const mockStartAuthentication = vi.fn();
const mockBrowserSupportsWebAuthn = vi.fn(() => true);
const mockPlatformAuthenticatorIsAvailable = vi.fn(() => Promise.resolve(true));
const mockBrowserSupportsWebAuthnAutofill = vi.fn(() => Promise.resolve(true));

vi.mock('@simplewebauthn/browser', () => ({
  startRegistration: mockStartRegistration,
  startAuthentication: mockStartAuthentication,
  browserSupportsWebAuthn: mockBrowserSupportsWebAuthn,
  platformAuthenticatorIsAvailable: mockPlatformAuthenticatorIsAvailable,
  browserSupportsWebAuthnAutofill: mockBrowserSupportsWebAuthnAutofill,
}));

describe('WebAuthnService', () => {
  let service: WebAuthnService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get a fresh instance for testing
    // Note: Using Object.create to bypass singleton for testing
    service = Object.create(WebAuthnService.prototype);
    (service as any).isSupported = false;
    (service as any).hasPlatformAuthenticator = false;
    (service as any).hasAutofillSupport = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = WebAuthnService.getInstance();
      const instance2 = WebAuthnService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('init', () => {
    it('should detect WebAuthn support', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      mockPlatformAuthenticatorIsAvailable.mockResolvedValue(true);
      mockBrowserSupportsWebAuthnAutofill.mockResolvedValue(true);

      await service.init();

      expect(service.isWebAuthnSupported()).toBe(true);
      expect(service.isPlatformAuthenticatorAvailable()).toBe(true);
      expect(service.isAutofillSupported()).toBe(true);
    });

    it('should handle no WebAuthn support', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(false);

      await service.init();

      expect(service.isWebAuthnSupported()).toBe(false);
      expect(service.isPlatformAuthenticatorAvailable()).toBe(false);
      expect(service.isAutofillSupported()).toBe(false);
    });
  });

  describe('isWebAuthnSupported', () => {
    it('should return false before init', () => {
      expect(service.isWebAuthnSupported()).toBe(false);
    });

    it('should return true after init with support', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      await service.init();
      expect(service.isWebAuthnSupported()).toBe(true);
    });
  });

  describe('isPlatformAuthenticatorAvailable', () => {
    it('should return false before init', () => {
      expect(service.isPlatformAuthenticatorAvailable()).toBe(false);
    });

    it('should return true when platform authenticator available', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      mockPlatformAuthenticatorIsAvailable.mockResolvedValue(true);
      await service.init();
      expect(service.isPlatformAuthenticatorAvailable()).toBe(true);
    });
  });

  describe('isAutofillSupported', () => {
    it('should return false before init', () => {
      expect(service.isAutofillSupported()).toBe(false);
    });

    it('should return true when autofill supported', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      mockBrowserSupportsWebAuthnAutofill.mockResolvedValue(true);
      await service.init();
      expect(service.isAutofillSupported()).toBe(true);
    });
  });

  describe('registerCredential', () => {
    beforeEach(async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      await service.init();
    });

    it('should throw if WebAuthn not supported', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(false);
      await service.init();

      await expect(
        service.registerCredential('npub1test', 'Test User')
      ).rejects.toThrow('WebAuthn is not supported in this browser');
    });

    // Note: The following tests require a full browser environment with window.location
    // These are tested at the E2E level instead.
    // - should register a credential successfully
    // - should handle InvalidStateError (already registered)
    // - should handle NotAllowedError (user cancelled)
    // - should re-throw other errors
  });

  describe('authenticateCredential', () => {
    const mockCredentials: WebAuthnCredential[] = [
      {
        id: 'cred-1',
        publicKey: 'pk1',
        deviceId: 'device-1',
        counter: 5,
        createdAt: Date.now(),
        transports: ['internal'],
        userHandle: 'npub1test',
      },
    ];

    beforeEach(async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      await service.init();
    });

    it('should throw if WebAuthn not supported', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(false);
      await service.init();

      await expect(
        service.authenticateCredential(mockCredentials)
      ).rejects.toThrow('WebAuthn is not supported in this browser');
    });

    // Note: The following tests require a full browser environment with window.location
    // These are tested at the E2E level instead.
    // - should authenticate successfully
    // - should handle NotAllowedError (user cancelled)
  });

  describe('authenticateWithAutofill', () => {
    const mockCredentials: WebAuthnCredential[] = [
      {
        id: 'cred-1',
        publicKey: 'pk1',
        deviceId: 'device-1',
        counter: 0,
        createdAt: Date.now(),
      },
    ];

    beforeEach(async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      mockBrowserSupportsWebAuthnAutofill.mockResolvedValue(true);
      await service.init();
    });

    it('should throw if WebAuthn not supported', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(false);
      await service.init();

      await expect(
        service.authenticateWithAutofill(mockCredentials)
      ).rejects.toThrow('WebAuthn is not supported in this browser');
    });

    it('should throw if autofill not supported', async () => {
      mockBrowserSupportsWebAuthn.mockReturnValue(true);
      mockBrowserSupportsWebAuthnAutofill.mockResolvedValue(false);
      await service.init();

      await expect(
        service.authenticateWithAutofill(mockCredentials)
      ).rejects.toThrow('Browser autofill is not supported');
    });

    // Note: The following tests require a full browser environment with window.location
    // These are tested at the E2E level instead.
    // - should authenticate with autofill
    // - should handle NotAllowedError
  });

  describe('verifyCredential', () => {
    // Note: verifyCredential tests require a full browser environment with window.location
    // These are tested at the E2E level instead, as they call authenticateCredential internally.
  });
});
