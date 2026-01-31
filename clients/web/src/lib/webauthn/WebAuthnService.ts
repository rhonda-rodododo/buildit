/**
 * WebAuthn Service
 * Handles passkey registration, authentication, and key protection using WebAuthn/FIDO2
 */

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  browserSupportsWebAuthnAutofill,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/types';

import type {
  AuthenticatorTransport,
  WebAuthnCredential,
  WebAuthnRegistrationOptions,
  WebAuthnAuthenticationOptions,
} from '@/types/device';
import { timingSafeEqual } from '@/lib/utils';

/**
 * WebAuthn Service class for managing passkey authentication
 */
export class WebAuthnService {
  private static instance: WebAuthnService;
  private isSupported: boolean = false;
  private hasPlatformAuthenticator: boolean = false;
  private hasAutofillSupport: boolean = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): WebAuthnService {
    if (!WebAuthnService.instance) {
      WebAuthnService.instance = new WebAuthnService();
    }
    return WebAuthnService.instance;
  }

  /**
   * Initialize WebAuthn support detection
   */
  public async init(): Promise<void> {
    this.isSupported = browserSupportsWebAuthn();

    if (this.isSupported) {
      this.hasPlatformAuthenticator = await platformAuthenticatorIsAvailable();
      this.hasAutofillSupport = await browserSupportsWebAuthnAutofill();
    }
  }

  /**
   * Check if WebAuthn is supported
   */
  public isWebAuthnSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Check if platform authenticator (biometric) is available
   */
  public isPlatformAuthenticatorAvailable(): boolean {
    return this.hasPlatformAuthenticator;
  }

  /**
   * Check if browser autofill is supported
   */
  public isAutofillSupported(): boolean {
    return this.hasAutofillSupport;
  }

  /**
   * Register a new WebAuthn credential (passkey)
   * Used for key protection and biometric authentication
   */
  public async registerCredential(
    npub: string,
    displayName: string
  ): Promise<WebAuthnCredential> {
    if (!this.isSupported) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    // Generate registration options
    const options = this.generateRegistrationOptions(npub, displayName);

    try {
      // Start registration with the user's authenticator
      const response = await startRegistration({
        optionsJSON: options as unknown as PublicKeyCredentialCreationOptionsJSON,
      });

      // Create credential record
      const credential: WebAuthnCredential = {
        id: response.id,
        publicKey: response.response.publicKey || '',
        deviceId: '', // Will be set by caller
        counter: 0,
        createdAt: Date.now(),
        aaguid: response.response.authenticatorData
          ? this.extractAAGUID(response.response.authenticatorData)
          : undefined,
        transports: this.filterKnownTransports(response.response.transports),
        userHandle: npub,
      };

      return credential;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'InvalidStateError') {
          throw new Error(
            'Authenticator was probably already registered. Please try with a different device.'
          );
        } else if (error.name === 'NotAllowedError') {
          throw new Error('User cancelled the registration or verification failed.');
        }
      }
      throw error;
    }
  }

  /**
   * Authenticate using an existing WebAuthn credential
   * Returns the credential ID if successful
   */
  public async authenticateCredential(
    credentials: WebAuthnCredential[]
  ): Promise<string> {
    if (!this.isSupported) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    // Generate authentication options
    const options = this.generateAuthenticationOptions(credentials);

    try {
      // Start authentication with the user's authenticator
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
      });

      // Return the credential ID that was used
      return response.id;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('User cancelled the authentication or verification failed.');
        }
      }
      throw error;
    }
  }

  /**
   * Authenticate with browser autofill (Conditional UI)
   * Allows seamless authentication from username fields
   */
  public async authenticateWithAutofill(
    credentials: WebAuthnCredential[]
  ): Promise<string> {
    if (!this.isSupported) {
      throw new Error('WebAuthn is not supported in this browser');
    }

    if (!this.hasAutofillSupport) {
      throw new Error('Browser autofill is not supported');
    }

    const options = this.generateAuthenticationOptions(credentials);

    try {
      const response = await startAuthentication({
        optionsJSON: options as unknown as PublicKeyCredentialRequestOptionsJSON,
        useBrowserAutofill: true,
      });

      return response.id;
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('User cancelled the authentication.');
        }
      }
      throw error;
    }
  }

  /**
   * Generate registration options for WebAuthn
   */
  private generateRegistrationOptions(
    npub: string,
    displayName: string
  ): WebAuthnRegistrationOptions {
    // Generate a random challenge
    const challenge = this.generateChallenge();

    return {
      challenge,
      rp: {
        name: 'BuildIt Network',
        id: window.location.hostname,
      },
      user: {
        id: this.encodeUserHandle(npub),
        name: npub,
        displayName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform', // Prefer biometric/platform authenticators
        residentKey: 'preferred',
        requireResidentKey: false,
        userVerification: 'preferred',
      },
      timeout: 60000,
      attestation: 'none', // No attestation for better privacy
    };
  }

  /**
   * Generate authentication options for WebAuthn
   */
  private generateAuthenticationOptions(
    credentials: WebAuthnCredential[]
  ): WebAuthnAuthenticationOptions {
    const challenge = this.generateChallenge();

    return {
      challenge,
      rpId: window.location.hostname,
      allowCredentials: credentials.map((cred) => ({
        type: 'public-key',
        id: cred.id,
        transports: cred.transports,
      })),
      timeout: 60000,
      userVerification: 'preferred',
    };
  }

  /**
   * Generate a random challenge for WebAuthn
   */
  private generateChallenge(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.bufferToBase64url(array);
  }

  /**
   * Encode user handle (npub) to base64url
   */
  private encodeUserHandle(npub: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(npub);
    return this.bufferToBase64url(data);
  }

  /**
   * Convert buffer to base64url string
   */
  private bufferToBase64url(buffer: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...buffer));
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Extract AAGUID from authenticator data
   */
  private static readonly KNOWN_TRANSPORTS: ReadonlySet<string> = new Set<AuthenticatorTransport>([
    'usb', 'nfc', 'ble', 'internal', 'hybrid',
  ]);

  /**
   * Filter transport strings to only known AuthenticatorTransport values.
   * The WebAuthn API may return future transport types we don't recognize.
   */
  private filterKnownTransports(transports?: string[]): AuthenticatorTransport[] | undefined {
    if (!transports) return undefined;
    return transports.filter(
      (t): t is AuthenticatorTransport => WebAuthnService.KNOWN_TRANSPORTS.has(t)
    );
  }

  private extractAAGUID(authenticatorData: string): string | undefined {
    try {
      // AAGUID is bytes 37-52 of authenticator data
      // This is a simplified extraction - in production, proper parsing is needed
      const data = atob(authenticatorData);
      if (data.length < 52) return undefined;

      const aaguid = data.substring(37, 53);
      return btoa(aaguid);
    } catch {
      return undefined;
    }
  }

  /**
   * Verify if a credential is still valid
   * This should be called periodically to ensure credential hasn't been revoked
   *
   * SECURITY: Uses timing-safe comparison to prevent timing attacks that could
   * reveal information about valid credential IDs through response time differences.
   */
  public async verifyCredential(credential: WebAuthnCredential): Promise<boolean> {
    try {
      // Try to authenticate with this specific credential
      const result = await this.authenticateCredential([credential]);
      // SECURITY: Use timing-safe comparison to prevent timing attacks
      return result !== null && timingSafeEqual(result, credential.id);
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const webAuthnService = WebAuthnService.getInstance();
