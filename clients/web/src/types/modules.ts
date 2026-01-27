import { z } from 'zod';
import type { BuildItDB } from '@/core/storage/db';
import type { LucideIcon } from 'lucide-react';

/**
 * Module Types
 * Each group can enable/configure modules independently
 */
export type ModuleType =
  | 'custom-fields' // Foundational module
  | 'public' // Public pages and analytics infrastructure
  | 'messaging'
  | 'calling' // Voice/video calling module
  | 'events'
  | 'mutual-aid'
  | 'governance'
  | 'wiki'
  | 'database'
  | 'crm'
  | 'documents'
  | 'files'
  | 'microblogging'
  | 'forms'
  | 'fundraising'
  | 'publishing'
  | 'newsletters'
  | 'friends' // Friend relationships and contacts
  | 'security'; // Privacy and security enhancements (Tor, etc.)

/**
 * Module Capability - defines what a module can do
 */
export interface ModuleCapability {
  id: string;
  name: string;
  description: string;
  requiresPermission?: string[];
}

/**
 * Module Permission - defines who can use a module
 */
export type ModulePermission = 'admin' | 'moderator' | 'member' | 'all';

/**
 * Module Configuration Schema
 * Defines configurable settings for a module
 */
export interface ModuleConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  defaultValue: unknown;
  options?: { label: string; value: string }[];
  description?: string;
  required?: boolean;
}

/**
 * Dependency Relationship Types
 * Defines how one module relates to another
 */
export type DependencyRelationship =
  | 'requires'           // Hard dependency - cannot enable without it
  | 'optional'           // Soft dependency - works alone, enhanced if available
  | 'enhances'           // This module enhances another (inverse of optional)
  | 'recommendedWith'    // UI hint - suggested companion module
  | 'incompatibleWith';  // Cannot be enabled together

/**
 * Enhancement Configuration
 * Defines what features are unlocked when a dependency is met
 */
export interface EnhancementConfig {
  /** Feature flags that are enabled when dependency is met */
  featureFlags?: string[];
  /** UI slots where components can be injected */
  uiSlots?: string[];
  /** Data integrations that are activated */
  dataIntegrations?: string[];
}

/**
 * Module Dependency
 * Defines required or optional dependencies for a module
 */
export interface ModuleDependency {
  moduleId: string;

  /**
   * Relationship type between modules
   * - 'requires': Hard dependency, cannot enable without it
   * - 'optional': Works alone, enhanced when available
   * - 'enhances': This module enhances another module
   * - 'recommendedWith': UI hint for suggested companion
   * - 'incompatibleWith': Cannot be enabled together
   */
  relationship: DependencyRelationship;

  /** Minimum version requirement (semver) */
  minVersion?: string;

  /** Maximum version allowed (for compatibility) */
  maxVersion?: string;

  /** Human-readable explanation of why this dependency exists */
  reason?: string;

  /** Configuration for what features are unlocked when dependency is met */
  enhancementConfig?: EnhancementConfig;
}

/**
 * Legacy Module Dependency (for backward compatibility)
 * @deprecated Use ModuleDependency with 'relationship' instead
 */
export interface LegacyModuleDependency {
  moduleId: string;
  required: boolean;
  minVersion?: string;
}

/**
 * Dependency Status at runtime
 * Describes whether a dependency is satisfied for a specific group
 */
export interface DependencyStatus {
  moduleId: string;
  relationship: DependencyRelationship;
  satisfied: boolean;
  targetModuleEnabled: boolean;
  versionCompatible: boolean;
  reason?: string;
}

/**
 * Normalize legacy dependency format to new format
 */
export function normalizeDependency(
  dep: ModuleDependency | LegacyModuleDependency
): ModuleDependency {
  // Check if it's already in new format
  if ('relationship' in dep) {
    return dep;
  }

  // Convert legacy format
  return {
    moduleId: dep.moduleId,
    relationship: dep.required ? 'requires' : 'optional',
    minVersion: dep.minVersion,
  };
}

/**
 * Module Metadata
 */
export interface ModuleMetadata {
  id: string;
  type: ModuleType;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: LucideIcon;
  capabilities: ModuleCapability[];
  configSchema: ModuleConfigField[];
  requiredPermission: ModulePermission;

  /**
   * Modules this module depends on
   * Supports both new relationship-based format and legacy required boolean
   */
  dependencies?: (ModuleDependency | LegacyModuleDependency)[];

  /**
   * Capability IDs this module provides to other modules
   * e.g., ['custom-fields', 'file-upload']
   */
  providesCapabilities?: string[];

  /**
   * Module IDs this module enhances when enabled
   * This is the inverse of an 'optional' dependency
   */
  enhances?: string[];

  /**
   * @deprecated Use dependencies with relationship: 'incompatibleWith' instead
   * Module IDs that conflict with this module
   */
  conflicts?: string[];
}

/**
 * Module State
 */
export type ModuleState = 'disabled' | 'enabled' | 'loading' | 'error';

/**
 * Module Instance - represents an enabled module in a group
 */
export interface ModuleInstance {
  moduleId: string;
  groupId: string;
  state: ModuleState;
  config: Record<string, unknown>;
  enabledAt: number;
  enabledBy: string; // pubkey
  lastError?: string;
}

/**
 * Module Lifecycle Hooks
 */
export interface ModuleLifecycle {
  /**
   * Called when module is registered
   */
  onRegister?: () => void | Promise<void>;

  /**
   * Called when module is enabled for a group
   */
  onEnable?: (groupId: string, config: Record<string, unknown>) => void | Promise<void>;

  /**
   * Called when module is disabled for a group
   */
  onDisable?: (groupId: string) => void | Promise<void>;

  /**
   * Called when module config is updated
   */
  onConfigUpdate?: (groupId: string, config: Record<string, unknown>) => void | Promise<void>;

  /**
   * Called when module is unregistered
   */
  onUnregister?: () => void | Promise<void>;

  /**
   * Called when an optional dependency becomes available
   * Allows module to enhance itself when a companion module is enabled
   */
  onDependencyEnabled?: (
    groupId: string,
    dependencyModuleId: string,
    dependencyConfig: Record<string, unknown>
  ) => void | Promise<void>;

  /**
   * Called when an optional dependency is disabled
   * Allows module to gracefully degrade features
   */
  onDependencyDisabled?: (
    groupId: string,
    dependencyModuleId: string
  ) => void | Promise<void>;

  /**
   * Called when this module is enabled and an enhancing module is already active
   */
  onEnhancedBy?: (
    groupId: string,
    enhancingModuleId: string,
    enhancingConfig: Record<string, unknown>
  ) => void | Promise<void>;
}

/**
 * Module Route Definition
 */
export interface ModuleRoute {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
  scope?: 'app' | 'group'; // Where the route is mounted (default: 'group')
  requiresEnabled?: boolean; // Only show if module is enabled for group (default: true for group scope)
  label?: string; // Display label for navigation
}

/**
 * Module Component Slots
 * Modules can inject components into predefined slots
 */
export interface ModuleComponentSlots {
  sidebar?: React.ComponentType[];
  groupHeader?: React.ComponentType[];
  groupSettings?: React.ComponentType[];
  userSettings?: React.ComponentType[];
  dashboard?: React.ComponentType[];
}

/**
 * Database Table Schema Definition
 * Defines a Dexie table schema for a module
 */
export interface TableSchema {
  name: string; // Table name
  schema: string; // Dexie schema string (e.g., "id, name, created")
  indexes: string[]; // Index definitions
}

/**
 * Module Migration
 * Handles database schema upgrades
 */
export interface ModuleMigration {
  version: number; // Migration version
  description: string; // What this migration does
  migrate: (db: BuildItDB) => Promise<void> | void; // Migration function
}

/**
 * Module Seed Data
 * Provides example/template data for modules
 */
export interface ModuleSeed {
  name: string; // Seed name
  description: string; // What this seed provides
  data: (db: BuildItDB, groupId: string, userPubkey: string) => Promise<void> | void; // Seed function
}

/**
 * Module Plugin Interface
 * All modules must implement this interface
 */
export interface ModulePlugin {
  metadata: ModuleMetadata;
  lifecycle?: ModuleLifecycle;
  routes?: ModuleRoute[];
  components?: ModuleComponentSlots;

  /**
   * Database schema for this module
   * Tables defined here will be loaded at app initialization
   */
  schema?: TableSchema[];

  /**
   * Database migrations for this module
   * Applied when module schema changes
   */
  migrations?: ModuleMigration[];

  /**
   * Seed data for this module
   * Can be used for demos, testing, or templates
   */
  seeds?: ModuleSeed[];

  /**
   * Validate module configuration
   */
  validateConfig?: (config: Record<string, unknown>) => boolean | Promise<boolean>;

  /**
   * Get default configuration
   */
  getDefaultConfig?: () => Record<string, unknown>;
}

/**
 * Module Registry Entry
 */
export interface ModuleRegistryEntry {
  plugin: ModulePlugin;
  registeredAt: number;
}

/**
 * Database schema for module instances
 */
export const DBModuleInstanceSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  groupId: z.string(),
  state: z.enum(['disabled', 'enabled', 'loading', 'error']),
  config: z.record(z.string(), z.unknown()),
  enabledAt: z.number(),
  enabledBy: z.string(),
  lastError: z.string().optional(),
  updatedAt: z.number(),
});

export type DBModuleInstance = z.infer<typeof DBModuleInstanceSchema>;
