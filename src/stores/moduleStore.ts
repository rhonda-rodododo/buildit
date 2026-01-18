import { create } from 'zustand';
import type {
  ModulePlugin,
  ModuleRegistryEntry,
  ModuleInstance,
  ModuleState,
  ModuleType,
  ModuleDependency,
  DependencyStatus,
} from '@/types/modules';
import { normalizeDependency } from '@/types/modules';
import { db } from '@/core/storage/db';
import { useAuthStore } from './authStore';

import { logger } from '@/lib/logger';
interface ModuleStore {
  // Registry
  registry: Map<string, ModuleRegistryEntry>;

  // Active module instances per group
  instances: Map<string, ModuleInstance>; // key: `${groupId}:${moduleId}`

  // Actions
  registerModule: (plugin: ModulePlugin) => Promise<void>;
  unregisterModule: (moduleId: string) => Promise<void>;
  enableModule: (groupId: string, moduleId: string, config?: Record<string, unknown>) => Promise<void>;
  disableModule: (groupId: string, moduleId: string) => Promise<void>;
  updateModuleConfig: (groupId: string, moduleId: string, config: Record<string, unknown>) => Promise<void>;
  getModuleInstance: (groupId: string, moduleId: string) => ModuleInstance | undefined;
  getGroupModules: (groupId: string) => ModuleInstance[];
  getModulesByType: (groupId: string, type: ModuleType) => ModuleInstance[];
  isModuleEnabled: (groupId: string, moduleId: string) => boolean;
  loadModuleInstances: () => Promise<void>;

  // Dependency Discovery API
  /**
   * Get all dependencies for a module with their current satisfaction status
   */
  getDependencyStatus: (groupId: string, moduleId: string) => DependencyStatus[];

  /**
   * Get all enabled optional dependencies for a module
   */
  getActiveOptionalDependencies: (groupId: string, moduleId: string) => string[];

  /**
   * Check if a specific optional dependency is enabled
   */
  hasOptionalDependency: (groupId: string, moduleId: string, dependencyId: string) => boolean;

  /**
   * Get all modules that enhance a given module (via 'enhances' metadata or 'optional' dependency)
   */
  getEnhancingModules: (groupId: string, moduleId: string) => string[];

  /**
   * Get modules that are recommended with a given module
   */
  getRecommendedModules: (moduleId: string) => string[];

  /**
   * Get normalized dependencies for a module
   */
  getNormalizedDependencies: (moduleId: string) => ModuleDependency[];

  /**
   * Check if a module provides a specific capability
   */
  hasCapability: (moduleId: string, capabilityId: string) => boolean;

  /**
   * Get all modules that provide a given capability
   */
  getModulesWithCapability: (capabilityId: string) => string[];
}

function getInstanceKey(groupId: string, moduleId: string): string {
  return `${groupId}:${moduleId}`;
}

export const useModuleStore = create<ModuleStore>()((set, get) => ({
  registry: new Map(),
  instances: new Map(),

      registerModule: async (plugin: ModulePlugin) => {
        const { metadata, lifecycle } = plugin;

        // Check if already registered
        if (get().registry.has(metadata.id)) {
          logger.warn(`Module ${metadata.id} is already registered`);
          return;
        }

        // Call onRegister lifecycle hook
        if (lifecycle?.onRegister) {
          await lifecycle.onRegister();
        }

        // Add to registry
        const entry: ModuleRegistryEntry = {
          plugin,
          registeredAt: Date.now(),
        };

        set((state) => {
          const newRegistry = new Map(state.registry);
          newRegistry.set(metadata.id, entry);
          return { registry: newRegistry };
        });

        logger.info(`Module ${metadata.id} registered successfully`);
      },

      unregisterModule: async (moduleId: string) => {
        const entry = get().registry.get(moduleId);
        if (!entry) {
          logger.warn(`Module ${moduleId} is not registered`);
          return;
        }

        // Call onUnregister lifecycle hook
        if (entry.plugin.lifecycle?.onUnregister) {
          await entry.plugin.lifecycle.onUnregister();
        }

        // Remove from registry
        set((state) => {
          const newRegistry = new Map(state.registry);
          newRegistry.delete(moduleId);
          return { registry: newRegistry };
        });

        // Disable all instances
        const instances = Array.from(get().instances.values()).filter(
          (instance) => instance.moduleId === moduleId
        );

        for (const instance of instances) {
          await get().disableModule(instance.groupId, moduleId);
        }

        logger.info(`Module ${moduleId} unregistered successfully`);
      },

      enableModule: async (groupId: string, moduleId: string, config?: Record<string, unknown>) => {
        const entry = get().registry.get(moduleId);
        if (!entry) {
          throw new Error(`Module ${moduleId} is not registered`);
        }

        const key = getInstanceKey(groupId, moduleId);
        const existingInstance = get().instances.get(key);

        // If already enabled, just update config
        if (existingInstance?.state === 'enabled') {
          if (config) {
            await get().updateModuleConfig(groupId, moduleId, config);
          }
          return;
        }

        // Normalize dependencies to new format
        const normalizedDeps = get().getNormalizedDependencies(moduleId);

        // Check required dependencies before enabling
        const missingDeps: string[] = [];
        for (const dep of normalizedDeps) {
          if (dep.relationship === 'requires') {
            const depInstance = get().getModuleInstance(groupId, dep.moduleId);
            if (depInstance?.state !== 'enabled') {
              const depEntry = get().registry.get(dep.moduleId);
              missingDeps.push(depEntry?.plugin.metadata.name || dep.moduleId);
            }
          }
        }
        if (missingDeps.length > 0) {
          throw new Error(`Cannot enable ${entry.plugin.metadata.name}: requires ${missingDeps.join(', ')} to be enabled first`);
        }

        // Check incompatible modules (both new format and legacy conflicts)
        const activeConflicts: string[] = [];

        // New format: incompatibleWith relationship
        for (const dep of normalizedDeps) {
          if (dep.relationship === 'incompatibleWith') {
            const conflictInstance = get().getModuleInstance(groupId, dep.moduleId);
            if (conflictInstance?.state === 'enabled') {
              const conflictEntry = get().registry.get(dep.moduleId);
              activeConflicts.push(conflictEntry?.plugin.metadata.name || dep.moduleId);
            }
          }
        }

        // Legacy: conflicts array
        const conflicts = entry.plugin.metadata.conflicts;
        if (conflicts?.length) {
          for (const conflictId of conflicts) {
            const conflictInstance = get().getModuleInstance(groupId, conflictId);
            if (conflictInstance?.state === 'enabled') {
              const conflictEntry = get().registry.get(conflictId);
              const name = conflictEntry?.plugin.metadata.name || conflictId;
              if (!activeConflicts.includes(name)) {
                activeConflicts.push(name);
              }
            }
          }
        }

        if (activeConflicts.length > 0) {
          throw new Error(`Cannot enable ${entry.plugin.metadata.name}: conflicts with ${activeConflicts.join(', ')}`);
        }

        // Get config
        const finalConfig = config || entry.plugin.getDefaultConfig?.() || {};

        // Validate config
        if (entry.plugin.validateConfig) {
          const isValid = await entry.plugin.validateConfig(finalConfig);
          if (!isValid) {
            throw new Error(`Invalid configuration for module ${moduleId}`);
          }
        }

        // Create instance
        const enabledBy = useAuthStore.getState().currentIdentity?.publicKey || 'system';
        const instance: ModuleInstance = {
          moduleId,
          groupId,
          state: 'loading',
          config: finalConfig,
          enabledAt: Date.now(),
          enabledBy,
        };

        set((state) => {
          const newInstances = new Map(state.instances);
          newInstances.set(key, instance);
          return { instances: newInstances };
        });

        try {
          // Call onEnable lifecycle hook
          if (entry.plugin.lifecycle?.onEnable) {
            await entry.plugin.lifecycle.onEnable(groupId, finalConfig);
          }

          // Update state to enabled
          set((state) => {
            const newInstances = new Map(state.instances);
            const updatedInstance = { ...instance, state: 'enabled' as ModuleState };
            newInstances.set(key, updatedInstance);
            return { instances: newInstances };
          });

          // Persist to database
          await db.moduleInstances.put({
            id: key,
            moduleId,
            groupId,
            state: 'enabled',
            config: finalConfig,
            enabledAt: instance.enabledAt,
            enabledBy: instance.enabledBy,
            updatedAt: Date.now(),
          });

          logger.info(`Module ${moduleId} enabled for group ${groupId}`);

          // Call onDependencyEnabled for modules that have this as an optional dependency
          for (const [, regEntry] of get().registry) {
            const otherModuleId = regEntry.plugin.metadata.id;
            if (otherModuleId === moduleId) continue;

            const otherInstance = get().getModuleInstance(groupId, otherModuleId);
            if (otherInstance?.state !== 'enabled') continue;

            const otherDeps = get().getNormalizedDependencies(otherModuleId);
            const hasOptionalDep = otherDeps.some(
              d => d.moduleId === moduleId && d.relationship === 'optional'
            );

            if (hasOptionalDep && regEntry.plugin.lifecycle?.onDependencyEnabled) {
              try {
                await regEntry.plugin.lifecycle.onDependencyEnabled(groupId, moduleId, finalConfig);
              } catch (err) {
                logger.warn(`Failed to notify ${otherModuleId} of dependency enabled:`, err);
              }
            }
          }

          // Call onEnhancedBy for this module if enhancing modules are already enabled
          if (entry.plugin.lifecycle?.onEnhancedBy) {
            const enhancingModules = get().getEnhancingModules(groupId, moduleId);
            for (const enhancerId of enhancingModules) {
              const enhancerInstance = get().getModuleInstance(groupId, enhancerId);
              if (enhancerInstance?.state === 'enabled') {
                try {
                  await entry.plugin.lifecycle.onEnhancedBy(
                    groupId,
                    enhancerId,
                    enhancerInstance.config
                  );
                } catch (err) {
                  logger.warn(`Failed to notify ${moduleId} of enhancement by ${enhancerId}:`, err);
                }
              }
            }
          }
        } catch (error) {
          // Update state to error
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set((state) => {
            const newInstances = new Map(state.instances);
            const errorInstance = {
              ...instance,
              state: 'error' as ModuleState,
              lastError: errorMessage,
            };
            newInstances.set(key, errorInstance);
            return { instances: newInstances };
          });

          throw error;
        }
      },

      disableModule: async (groupId: string, moduleId: string) => {
        const entry = get().registry.get(moduleId);
        if (!entry) {
          logger.warn(`Module ${moduleId} is not registered`);
          return;
        }

        const key = getInstanceKey(groupId, moduleId);
        const instance = get().instances.get(key);

        if (!instance) {
          logger.warn(`Module ${moduleId} is not enabled for group ${groupId}`);
          return;
        }

        // Check if any other enabled modules have a required dependency on this one
        const dependents: string[] = [];
        for (const [, regEntry] of get().registry) {
          const otherModuleId = regEntry.plugin.metadata.id;
          const normalizedDeps = get().getNormalizedDependencies(otherModuleId);

          const hasRequiredDep = normalizedDeps.some(
            d => d.moduleId === moduleId && d.relationship === 'requires'
          );

          if (hasRequiredDep) {
            const depInstance = get().getModuleInstance(groupId, otherModuleId);
            if (depInstance?.state === 'enabled') {
              dependents.push(regEntry.plugin.metadata.name);
            }
          }
        }
        if (dependents.length > 0) {
          throw new Error(`Cannot disable ${entry.plugin.metadata.name}: ${dependents.join(', ')} depends on it`);
        }

        // Notify modules with optional dependency on this module BEFORE disabling
        for (const [, regEntry] of get().registry) {
          const otherModuleId = regEntry.plugin.metadata.id;
          if (otherModuleId === moduleId) continue;

          const otherInstance = get().getModuleInstance(groupId, otherModuleId);
          if (otherInstance?.state !== 'enabled') continue;

          const otherDeps = get().getNormalizedDependencies(otherModuleId);
          const hasOptionalDep = otherDeps.some(
            d => d.moduleId === moduleId && d.relationship === 'optional'
          );

          if (hasOptionalDep && regEntry.plugin.lifecycle?.onDependencyDisabled) {
            try {
              await regEntry.plugin.lifecycle.onDependencyDisabled(groupId, moduleId);
            } catch (err) {
              logger.warn(`Failed to notify ${otherModuleId} of dependency disabled:`, err);
            }
          }
        }

        // Call onDisable lifecycle hook
        if (entry.plugin.lifecycle?.onDisable) {
          await entry.plugin.lifecycle.onDisable(groupId);
        }

        // Remove from instances
        set((state) => {
          const newInstances = new Map(state.instances);
          newInstances.delete(key);
          return { instances: newInstances };
        });

        // Remove from database
        await db.moduleInstances.delete(key);

        logger.info(`Module ${moduleId} disabled for group ${groupId}`);
      },

      updateModuleConfig: async (
        groupId: string,
        moduleId: string,
        config: Record<string, unknown>
      ) => {
        const entry = get().registry.get(moduleId);
        if (!entry) {
          throw new Error(`Module ${moduleId} is not registered`);
        }

        const key = getInstanceKey(groupId, moduleId);
        const instance = get().instances.get(key);

        if (!instance) {
          throw new Error(`Module ${moduleId} is not enabled for group ${groupId}`);
        }

        // Validate config
        if (entry.plugin.validateConfig) {
          const isValid = await entry.plugin.validateConfig(config);
          if (!isValid) {
            throw new Error(`Invalid configuration for module ${moduleId}`);
          }
        }

        // Call onConfigUpdate lifecycle hook
        if (entry.plugin.lifecycle?.onConfigUpdate) {
          await entry.plugin.lifecycle.onConfigUpdate(groupId, config);
        }

        // Update instance
        set((state) => {
          const newInstances = new Map(state.instances);
          const updatedInstance = { ...instance, config };
          newInstances.set(key, updatedInstance);
          return { instances: newInstances };
        });

        // Update database
        await db.moduleInstances.update(key, {
          config,
          updatedAt: Date.now(),
        });

        logger.info(`Module ${moduleId} config updated for group ${groupId}`);
      },

      getModuleInstance: (groupId: string, moduleId: string) => {
        const key = getInstanceKey(groupId, moduleId);
        return get().instances.get(key);
      },

      getGroupModules: (groupId: string) => {
        return Array.from(get().instances.values()).filter(
          (instance) => instance.groupId === groupId
        );
      },

      getModulesByType: (groupId: string, type: ModuleType) => {
        const modules = get().getGroupModules(groupId);
        return modules.filter((instance) => {
          const entry = get().registry.get(instance.moduleId);
          return entry?.plugin.metadata.type === type;
        });
      },

      isModuleEnabled: (groupId: string, moduleId: string) => {
        const instance = get().getModuleInstance(groupId, moduleId);
        return instance?.state === 'enabled';
      },

      loadModuleInstances: async () => {
        logger.info('📥 Loading module instances from database...');
        const instances = await db.moduleInstances.toArray();
        const instanceMap = new Map<string, ModuleInstance>();

        for (const dbInstance of instances) {
          const instance: ModuleInstance = {
            moduleId: dbInstance.moduleId,
            groupId: dbInstance.groupId,
            state: dbInstance.state,
            config: dbInstance.config,
            enabledAt: dbInstance.enabledAt,
            enabledBy: dbInstance.enabledBy,
            lastError: dbInstance.lastError,
          };
          instanceMap.set(dbInstance.id, instance);
        }

        set({ instances: instanceMap });
        logger.info(`✅ Loaded ${instances.length} module instances from database`);
      },

      // Dependency Discovery API Implementation

      getNormalizedDependencies: (moduleId: string): ModuleDependency[] => {
        const entry = get().registry.get(moduleId);
        if (!entry) return [];

        const rawDeps = entry.plugin.metadata.dependencies || [];
        return rawDeps.map(normalizeDependency);
      },

      getDependencyStatus: (groupId: string, moduleId: string): DependencyStatus[] => {
        const normalizedDeps = get().getNormalizedDependencies(moduleId);
        const statuses: DependencyStatus[] = [];

        for (const dep of normalizedDeps) {
          const targetInstance = get().getModuleInstance(groupId, dep.moduleId);
          const targetEnabled = targetInstance?.state === 'enabled';

          // Version compatibility check (simplified - just check if enabled)
          // Semver comparison deferred - currently all modules compatible
          const versionCompatible = true;

          const satisfied =
            dep.relationship === 'requires'
              ? targetEnabled && versionCompatible
              : dep.relationship === 'optional'
              ? targetEnabled
              : dep.relationship === 'incompatibleWith'
              ? !targetEnabled
              : true; // recommendedWith, enhances don't require satisfaction

          statuses.push({
            moduleId: dep.moduleId,
            relationship: dep.relationship,
            satisfied,
            targetModuleEnabled: targetEnabled,
            versionCompatible,
            reason: dep.reason,
          });
        }

        return statuses;
      },

      getActiveOptionalDependencies: (groupId: string, moduleId: string): string[] => {
        const normalizedDeps = get().getNormalizedDependencies(moduleId);
        const active: string[] = [];

        for (const dep of normalizedDeps) {
          if (dep.relationship === 'optional') {
            const targetInstance = get().getModuleInstance(groupId, dep.moduleId);
            if (targetInstance?.state === 'enabled') {
              active.push(dep.moduleId);
            }
          }
        }

        return active;
      },

      hasOptionalDependency: (groupId: string, moduleId: string, dependencyId: string): boolean => {
        const normalizedDeps = get().getNormalizedDependencies(moduleId);
        const dep = normalizedDeps.find(
          d => d.moduleId === dependencyId && d.relationship === 'optional'
        );

        if (!dep) return false;

        const targetInstance = get().getModuleInstance(groupId, dependencyId);
        return targetInstance?.state === 'enabled';
      },

      getEnhancingModules: (groupId: string, moduleId: string): string[] => {
        const enhancing: string[] = [];

        for (const [, regEntry] of get().registry) {
          const otherModuleId = regEntry.plugin.metadata.id;
          if (otherModuleId === moduleId) continue;

          // Check if this module declares it enhances our target
          const enhancesArray = regEntry.plugin.metadata.enhances || [];
          if (enhancesArray.includes(moduleId)) {
            const instance = get().getModuleInstance(groupId, otherModuleId);
            if (instance?.state === 'enabled') {
              enhancing.push(otherModuleId);
            }
            continue;
          }

          // Check if this module has 'enhances' relationship to our target
          const normalizedDeps = get().getNormalizedDependencies(otherModuleId);
          const hasEnhancesRel = normalizedDeps.some(
            d => d.moduleId === moduleId && d.relationship === 'enhances'
          );

          if (hasEnhancesRel) {
            const instance = get().getModuleInstance(groupId, otherModuleId);
            if (instance?.state === 'enabled') {
              enhancing.push(otherModuleId);
            }
          }
        }

        return enhancing;
      },

      getRecommendedModules: (moduleId: string): string[] => {
        const normalizedDeps = get().getNormalizedDependencies(moduleId);
        const recommended: string[] = [];

        for (const dep of normalizedDeps) {
          if (dep.relationship === 'recommendedWith') {
            recommended.push(dep.moduleId);
          }
        }

        // Also check modules that recommend this one
        for (const [, regEntry] of get().registry) {
          const otherModuleId = regEntry.plugin.metadata.id;
          if (otherModuleId === moduleId) continue;

          const otherDeps = get().getNormalizedDependencies(otherModuleId);
          const recommendsThis = otherDeps.some(
            d => d.moduleId === moduleId && d.relationship === 'recommendedWith'
          );

          if (recommendsThis && !recommended.includes(otherModuleId)) {
            recommended.push(otherModuleId);
          }
        }

        return recommended;
      },

      hasCapability: (moduleId: string, capabilityId: string): boolean => {
        const entry = get().registry.get(moduleId);
        if (!entry) return false;

        const providesCapabilities = entry.plugin.metadata.providesCapabilities || [];
        return providesCapabilities.includes(capabilityId);
      },

      getModulesWithCapability: (capabilityId: string): string[] => {
        const modulesWithCap: string[] = [];

        for (const [, regEntry] of get().registry) {
          const providesCapabilities = regEntry.plugin.metadata.providesCapabilities || [];
          if (providesCapabilities.includes(capabilityId)) {
            modulesWithCap.push(regEntry.plugin.metadata.id);
          }
        }

        return modulesWithCap;
      },
    })
);
