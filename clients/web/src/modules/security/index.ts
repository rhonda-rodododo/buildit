/**
 * Security Module
 *
 * Privacy and security enhancements including Tor integration.
 * This is an optional module that enhances privacy for users who need it.
 */

import type { ModulePlugin } from '@/types/modules';
import { Shield } from 'lucide-react';
import { registerModuleTranslations } from '@/i18n/moduleI18n';
import securityTranslations from './i18n';

/**
 * Security Module Definition
 *
 * This module provides:
 * - Tor integration for anonymous relay connections
 * - Onion relay discovery and management
 * - Enhanced security features (WebRTC blocking, fingerprint protection)
 */
export const securityModule: ModulePlugin = {
  metadata: {
    id: 'security',
    type: 'security',
    name: 'Security & Privacy',
    version: '1.0.0',
    description: 'Enhanced privacy features including Tor integration for anonymous connections',
    author: 'BuildIt Network',
    icon: Shield,
    requiredPermission: 'all',

    dependencies: [],

    providesCapabilities: ['tor-routing', 'onion-relays', 'privacy-protection'],

    capabilities: [
      {
        id: 'tor-routing',
        name: 'Tor Routing',
        description: 'Route connections through Tor for anonymity',
      },
      {
        id: 'onion-relays',
        name: 'Onion Relays',
        description: 'Connect to .onion Nostr relays',
      },
      {
        id: 'privacy-protection',
        name: 'Privacy Protection',
        description: 'Block WebRTC leaks, geolocation, and fingerprinting',
      },
    ],

    configSchema: [
      {
        key: 'torEnabled',
        type: 'boolean',
        label: 'Enable Tor',
        description: 'Route connections through Tor network',
        defaultValue: false,
      },
      {
        key: 'onionOnly',
        type: 'boolean',
        label: 'Onion relays only',
        description: 'Only connect to .onion relays (requires Tor)',
        defaultValue: false,
      },
      {
        key: 'blockWebRTC',
        type: 'boolean',
        label: 'Block WebRTC',
        description: 'Prevent potential IP leaks through WebRTC',
        defaultValue: true,
      },
      {
        key: 'blockGeolocation',
        type: 'boolean',
        label: 'Block Geolocation',
        description: 'Disable geolocation API',
        defaultValue: true,
      },
    ],
  },

  // Register translations when module loads
  lifecycle: {
    onRegister: async () => {
      registerModuleTranslations('security', securityTranslations);
    },
  },

  // No database tables needed - settings stored in user preferences
  schema: [],

  getDefaultConfig: () => ({
    torEnabled: false,
    onionOnly: false,
    blockWebRTC: true,
    blockGeolocation: true,
  }),
};

// Re-export tor utilities
export * from './tor';

export default securityModule;
