import type { ModulePlugin } from '@/types/modules';
import { useModuleStore } from '@/stores/moduleStore';
import { registerModuleSchema } from '@/core/storage/db';

/**
 * Module loader definition
 */
interface ModuleLoader {
  id: string;
  load: () => Promise<any>; // Module can export default or named exports
}

/**
 * All available modules with dynamic imports
 * This is the ONLY place where modules are imported
 *
 * IMPORTANT: custom-fields must load first as it's a dependency for other modules
 */
const MODULE_LOADERS: ModuleLoader[] = [
  {
    id: 'custom-fields',
    load: () => import('@/modules/custom-fields'),
  },
  {
    id: 'public',
    load: () => import('@/modules/public'),
  },
  {
    id: 'messaging',
    load: () => import('@/modules/messaging'),
  },
  {
    id: 'events',
    load: () => import('@/modules/events'),
  },
  {
    id: 'mutual-aid',
    load: () => import('@/modules/mutual-aid'),
  },
  {
    id: 'governance',
    load: () => import('@/modules/governance'),
  },
  {
    id: 'wiki',
    load: () => import('@/modules/wiki'),
  },
  {
    id: 'database',
    load: () => import('@/modules/database'),
  },
  {
    id: 'crm',
    load: () => import('@/modules/crm'),
  },
  {
    id: 'documents',
    load: () => import('@/modules/documents'),
  },
  {
    id: 'files',
    load: () => import('@/modules/files'),
  },
  {
    id: 'microblogging',
    load: () => import('@/modules/microblogging'),
  },
  {
    id: 'forms',
    load: () => import('@/modules/forms'),
  },
  {
    id: 'fundraising',
    load: () => import('@/modules/fundraising'),
  },
];

/**
 * Load a single module
 */
async function loadModule(loader: ModuleLoader): Promise<ModulePlugin | null> {
  try {
    const module = await loader.load();

    // Try default export first
    let plugin: ModulePlugin | null = null;
    if ('default' in module && typeof module.default === 'object' && module.default !== null && 'metadata' in module.default) {
      plugin = module.default as ModulePlugin;
    } else {
      // Fallback: find first exported module plugin (named like MessagingModule, EventsModule, etc.)
      plugin = Object.values(module).find(
        (value): value is ModulePlugin =>
          typeof value === 'object' && value !== null && 'metadata' in value
      ) || null;
    }

    if (!plugin) {
      console.error(`No module plugin found in module ${loader.id}`);
      return null;
    }

    // Register module schema with the schema registry (before db instance is created)
    if (plugin.schema && plugin.schema.length > 0) {
      registerModuleSchema(plugin.metadata.id, plugin.schema);
    } else {
      console.log(`⏭️  Module ${plugin.metadata.id} has no schema`);
    }

    return plugin;
  } catch (error) {
    console.error(`Failed to load module ${loader.id}:`, error);
    return null;
  }
}

/**
 * Initialize all modules
 * Call this on app startup
 */
export async function initializeModules(): Promise<void> {
  const moduleStore = useModuleStore.getState();

  console.log('📦 Initializing modules...');

  // Load modules sequentially to ensure schemas are registered before db creation
  for (const loader of MODULE_LOADERS) {
    const plugin = await loadModule(loader);
    if (plugin) {
      await moduleStore.registerModule(plugin);
    }
  }

  console.log(`✅ ${MODULE_LOADERS.length} modules registered successfully`);

  // Verify schemas were registered
  const { getRegisteredSchemaCount } = await import('@/core/storage/db');
  const schemaCount = getRegisteredSchemaCount();
  console.log(`📋 Schema registry has ${schemaCount} module schemas`);

  if (schemaCount === 0) {
    console.error('❌ No schemas registered! Modules may have failed to load.');
  }
}

/**
 * Get a module plugin by ID
 */
export function getModulePlugin(moduleId: string): ModulePlugin | undefined {
  const moduleStore = useModuleStore.getState();
  const entry = moduleStore.registry.get(moduleId);
  return entry?.plugin;
}

/**
 * Get all registered modules
 */
export function getAllModules(): ModulePlugin[] {
  const moduleStore = useModuleStore.getState();
  return Array.from(moduleStore.registry.values()).map((entry) => entry.plugin);
}
