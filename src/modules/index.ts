/**
 * Module Registry
 * Central registry for all BuildIt Network modules
 */

import type { ModulePlugin } from '@/types/modules';
import { db } from '@/core/storage/db';

// Import all modules
import customFieldsModule from './custom-fields';
import eventsModule from './events';
import mutualAidModule from './mutual-aid';
import governanceModule from './governance';
import wikiModule from './wiki';
import messagingModule from './messaging';
import crmModule from './crm';
import documentsModule from './documents';
import filesModule from './files';

/**
 * All available modules
 */
export const ALL_MODULES: ModulePlugin[] = [
  customFieldsModule,
  messagingModule,
  eventsModule,
  mutualAidModule,
  governanceModule,
  wikiModule,
  crmModule,
  documentsModule,
  filesModule,
];

/**
 * Module registry map (keyed by module ID)
 */
export const MODULE_REGISTRY = new Map<string, ModulePlugin>(
  ALL_MODULES.map((mod) => [mod.metadata.id, mod])
);

/**
 * Initialize all modules
 * This should be called BEFORE database initialization
 */
export async function initializeModules(): Promise<void> {
  console.log('🔧 Initializing modules...');

  // Register all module schemas with the database
  for (const module of ALL_MODULES) {
    if (module.schema && module.schema.length > 0) {
      db.addModuleSchema(module.metadata.id, module.schema);
      console.log(`  ✓ Registered schema for ${module.metadata.name} (${module.schema.length} tables)`);
    }

    // Call module onRegister lifecycle hook
    if (module.lifecycle?.onRegister) {
      await module.lifecycle.onRegister();
    }
  }

  console.log(`✅ ${ALL_MODULES.length} modules initialized`);
}

/**
 * Get module by ID
 */
export function getModule(moduleId: string): ModulePlugin | undefined {
  return MODULE_REGISTRY.get(moduleId);
}

/**
 * Get all modules
 */
export function getAllModules(): ModulePlugin[] {
  return ALL_MODULES;
}

/**
 * Get modules by type
 */
export function getModulesByType(type: string): ModulePlugin[] {
  return ALL_MODULES.filter((mod) => mod.metadata.type === type);
}

/**
 * Check if module is registered
 */
export function isModuleRegistered(moduleId: string): boolean {
  return MODULE_REGISTRY.has(moduleId);
}

// Export individual modules for direct import
export {
  customFieldsModule,
  eventsModule,
  mutualAidModule,
  governanceModule,
  wikiModule,
  messagingModule,
  crmModule,
  documentsModule,
  filesModule,
};
