/**
 * Application Configuration
 * Centralized configuration for app name, branding, and metadata
 */

export const APP_CONFIG = {
  name: 'BuildIt Network',
  tagline: 'A social action network for privacy-first organizing',
  fullName: 'BuildIt Network - a social action network',
  description: 'A privacy-first organizing platform built on Nostr protocol for activist groups, co-ops, unions, and community organizers.',
  version: '0.1.0',
  repository: 'https://github.com/buildn/buildit-network',
} as const

export type AppConfig = typeof APP_CONFIG
