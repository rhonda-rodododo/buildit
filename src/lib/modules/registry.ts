import type { ModulePlugin } from '@/types/modules';
import { useModuleStore } from '@/stores/moduleStore';
import { registerModuleSchema } from '@/core/storage/db';

// Debug: Track if this module has been imported
if (typeof window !== 'undefined') {
  console.log('[REGISTRY] registry.ts imported at:', new Date().toISOString());
  (window as any).__REGISTRY_IMPORTED = true;
  (window as any).__MODULE_LOAD_ERRORS = [];
  (window as any).__MODULES_LOADED = [];
}

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
];

/**
 * Load a single module
 */
async function loadModule(loader: ModuleLoader): Promise<ModulePlugin | null> {
  const timestamp = () => `[${new Date().toISOString()}]`;

  try {
    console.log(timestamp(), `    Loading module file: ${loader.id}...`);
    const module = await loader.load();
    console.log(timestamp(), `    ✓ Module file loaded: ${loader.id}`);

    // Try default export first
    let plugin: ModulePlugin | null = null;
    if ('default' in module && typeof module.default === 'object' && module.default !== null && 'metadata' in module.default) {
      plugin = module.default as ModulePlugin;
      console.log(timestamp(), `    ✓ Found default export plugin: ${plugin.metadata.id}`);
    } else {
      // Fallback: find first exported module plugin (named like MessagingModule, EventsModule, etc.)
      plugin = Object.values(module).find(
        (value): value is ModulePlugin =>
          typeof value === 'object' && value !== null && 'metadata' in value
      ) || null;
      if (plugin) {
        console.log(timestamp(), `    ✓ Found named export plugin: ${plugin.metadata.id}`);
      }
    }

    if (!plugin) {
      console.error(timestamp(), `    ✗ No module plugin found in module ${loader.id}`);
      if (typeof window !== 'undefined') {
        (window as any).__MODULE_LOAD_ERRORS.push({ module: loader.id, error: 'No plugin found' });
      }
      return null;
    }

    // Register module schema with the schema registry (before db instance is created)
    if (plugin.schema && plugin.schema.length > 0) {
      console.log(timestamp(), `    Registering schema for ${plugin.metadata.id} (${plugin.schema.length} tables)...`);
      console.log(timestamp(), `      BEFORE registerModuleSchema - about to register`);
      registerModuleSchema(plugin.metadata.id, plugin.schema);
      console.log(timestamp(), `    ✓ Schema registered for ${plugin.metadata.id}`);
    } else {
      console.log(timestamp(), `    ⏭️  Module ${plugin.metadata.id} has no schema`);
    }

    // Debug: Track successful load
    if (typeof window !== 'undefined') {
      (window as any).__MODULES_LOADED.push({
        id: plugin.metadata.id,
        hasSchema: !!(plugin.schema && plugin.schema.length > 0),
        schemaTableCount: plugin.schema?.length || 0
      });
    }

    return plugin;
  } catch (error) {
    console.error(timestamp(), `    ✗ Failed to load module ${loader.id}:`, error);
    if (typeof window !== 'undefined') {
      (window as any).__MODULE_LOAD_ERRORS.push({
        module: loader.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
    return null;
  }
}

/**
 * Initialize all modules
 * Call this on app startup
 */
export async function initializeModules(): Promise<void> {
  const timestamp = () => `[${new Date().toISOString()}]`;

  // Debug: Track function call
  if (typeof window !== 'undefined') {
    (window as any).__INITIALIZE_MODULES_CALLED = true;
    console.log(timestamp(), '📦 [REGISTRY] initializeModules() CALLED');
  }

  const moduleStore = useModuleStore.getState();

  console.log(timestamp(), '📦 Initializing modules...');

  // Load modules sequentially to ensure schemas are registered before db creation
  for (const loader of MODULE_LOADERS) {
    console.log(timestamp(), `  Loading module: ${loader.id}...`);
    const loadStart = Date.now();
    const plugin = await loadModule(loader);
    const loadEnd = Date.now();

    if (plugin) {
      console.log(timestamp(), `  ✓ Module ${loader.id} loaded in ${loadEnd - loadStart}ms, registering with store...`);
      const regStart = Date.now();
      await moduleStore.registerModule(plugin);
      const regEnd = Date.now();
      console.log(timestamp(), `  ✓ Module ${loader.id} registered with store in ${regEnd - regStart}ms`);
    } else {
      console.error(timestamp(), `  ✗ Module ${loader.id} failed to load`);
    }
  }

  console.log(timestamp(), `✅ ${MODULE_LOADERS.length} modules processed`);

  // Verify schemas were registered
  console.log(timestamp(), '🔍 Checking schema registry...');
  const { getRegisteredSchemaCount } = await import('@/core/storage/db');
  const schemaCount = getRegisteredSchemaCount();
  console.log(timestamp(), `📋 Schema registry has ${schemaCount} module schemas`);

  if (schemaCount === 0) {
    console.error(timestamp(), '❌ No schemas registered! Modules may have failed to load.');
    console.error(timestamp(), '   This likely means _dbInstance was created before schemas could register');
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
