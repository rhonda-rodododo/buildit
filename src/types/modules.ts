import { z } from 'zod';
import type { BuildItDB } from '@/core/storage/db';

/**
 * Module Types
 * Each group can enable/configure modules independently
 */
export type ModuleType =
  | 'custom-fields' // Foundational module
  | 'messaging'
  | 'events'
  | 'mutual-aid'
  | 'governance'
  | 'wiki'
  | 'crm'
  | 'documents'
  | 'files';

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
 * Module Metadata
 */
export interface ModuleMetadata {
  id: string;
  type: ModuleType;
  name: string;
  description: string;
  version: string;
  author: string;
  icon: string;
  capabilities: ModuleCapability[];
  configSchema: ModuleConfigField[];
  requiredPermission: ModulePermission;
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
}

/**
 * Module Route Definition
 */
export interface ModuleRoute {
  path: string;
  component: React.ComponentType;
  exact?: boolean;
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
