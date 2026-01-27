import type { ModulePlugin, ModuleDependency } from '@/types/modules';
import { normalizeDependency } from '@/types/modules';
import { useModuleStore } from '@/stores/moduleStore';
import { registerModuleSchema } from '@/core/storage/db';

import { logger } from '@/lib/logger';
/**
 * Result of dependency graph validation
 */
interface DependencyGraphValidation {
  valid: boolean;
  cycles?: string[][];
  warnings?: string[];
}

/**
 * Validate dependency graph for cycles
 * Called during module registration to prevent circular dependencies
 *
 * Only checks 'requires' relationships as they form hard dependencies.
 * 'optional' and 'enhances' don't cause initialization problems.
 */
function validateDependencyGraph(
  newPlugin: ModulePlugin,
  existingModules: Map<string, ModulePlugin>
): DependencyGraphValidation {
  // Build combined registry with new module
  const registry = new Map(existingModules);
  registry.set(newPlugin.metadata.id, newPlugin);

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];
  const warnings: string[] = [];

  function getNormalizedDeps(moduleId: string): ModuleDependency[] {
    const plugin = registry.get(moduleId);
    if (!plugin) return [];
    const rawDeps = plugin.metadata.dependencies || [];
    return rawDeps.map(normalizeDependency);
  }

  function detectCycle(moduleId: string, path: string[]): boolean {
    if (recursionStack.has(moduleId)) {
      // Found a cycle
      const cycleStart = path.indexOf(moduleId);
      cycles.push([...path.slice(cycleStart), moduleId]);
      return true;
    }

    if (visited.has(moduleId)) {
      return false;
    }

    visited.add(moduleId);
    recursionStack.add(moduleId);

    const deps = getNormalizedDeps(moduleId);

    // Only traverse 'requires' relationships for cycle detection
    // as these are the only ones that could cause initialization issues
    for (const dep of deps) {
      if (dep.relationship === 'requires') {
        if (detectCycle(dep.moduleId, [...path, moduleId])) {
          // Don't return early - continue to find all cycles
        }
      }
    }

    recursionStack.delete(moduleId);
    return false;
  }

  // Check for cycles starting from the new module
  detectCycle(newPlugin.metadata.id, []);

  // Also validate that all required dependencies exist
  const deps = getNormalizedDeps(newPlugin.metadata.id);
  for (const dep of deps) {
    if (dep.relationship === 'requires' && !registry.has(dep.moduleId)) {
      warnings.push(
        `Module "${newPlugin.metadata.id}" requires "${dep.moduleId}" but it is not registered. ` +
        `Ensure "${dep.moduleId}" is loaded first.`
      );
    }
  }

  return {
    valid: cycles.length === 0,
    cycles: cycles.length > 0 ? cycles : undefined,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
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
    id: 'public',
    load: () => import('@/modules/public'),
  },
  {
    id: 'messaging',
    load: () => import('@/modules/messaging'),
  },
  {
    id: 'calling',
    load: () => import('@/modules/calling'),
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
  {
    id: 'publishing',
    load: () => import('@/modules/publishing'),
  },
  {
    id: 'newsletters',
    load: () => import('@/modules/newsletters'),
  },
  {
    id: 'friends',
    load: () => import('@/modules/friends'),
  },
  {
    id: 'security',
    load: () => import('@/modules/security'),
  },
];

/**
 * Track loaded plugins for cycle detection
 */
const loadedPlugins = new Map<string, ModulePlugin>();

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

    // Validate dependency graph before registering
    const validation = validateDependencyGraph(plugin, loadedPlugins);

    if (!validation.valid) {
      const cycleStr = validation.cycles!
        .map(c => c.join(' → '))
        .join(', ');
      console.error(
        `❌ Cannot load module "${plugin.metadata.id}": circular dependency detected: ${cycleStr}`
      );
      return null;
    }

    if (validation.warnings?.length) {
      validation.warnings.forEach(w => console.warn(`⚠️ ${w}`));
    }

    // Track loaded plugin for future cycle detection
    loadedPlugins.set(plugin.metadata.id, plugin);

    // Register module schema with the schema registry (before db instance is created)
    if (plugin.schema && plugin.schema.length > 0) {
      registerModuleSchema(plugin.metadata.id, plugin.schema);
    } else {
      logger.info(`⏭️  Module ${plugin.metadata.id} has no schema`);
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

  logger.info('📦 Initializing modules...');

  // Load modules sequentially to ensure schemas are registered before db creation
  for (const loader of MODULE_LOADERS) {
    const plugin = await loadModule(loader);
    if (plugin) {
      await moduleStore.registerModule(plugin);
    }
  }

  logger.info(`✅ ${MODULE_LOADERS.length} modules registered successfully`);

  // Verify schemas were registered
  const { getRegisteredSchemaCount } = await import('@/core/storage/db');
  const schemaCount = getRegisteredSchemaCount();
  logger.info(`📋 Schema registry has ${schemaCount} module schemas`);

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
