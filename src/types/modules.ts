import { z } from 'zod';

/**
 * Module Types
 * Each group can enable/configure modules independently
 */
export type ModuleType =
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
 * Module Plugin Interface
 * All modules must implement this interface
 */
export interface ModulePlugin {
  metadata: ModuleMetadata;
  lifecycle?: ModuleLifecycle;
  routes?: ModuleRoute[];
  components?: ModuleComponentSlots;

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
