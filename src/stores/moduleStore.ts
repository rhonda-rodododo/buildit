import { create } from 'zustand';
import type {
  ModulePlugin,
  ModuleRegistryEntry,
  ModuleInstance,
  ModuleState,
  ModuleType,
} from '@/types/modules';
import { db } from '@/core/storage/db';
import { useAuthStore } from './authStore';

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
          console.warn(`Module ${metadata.id} is already registered`);
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

        console.info(`Module ${metadata.id} registered successfully`);
      },

      unregisterModule: async (moduleId: string) => {
        const entry = get().registry.get(moduleId);
        if (!entry) {
          console.warn(`Module ${moduleId} is not registered`);
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

        console.info(`Module ${moduleId} unregistered successfully`);
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

          console.info(`Module ${moduleId} enabled for group ${groupId}`);
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
          console.warn(`Module ${moduleId} is not registered`);
          return;
        }

        const key = getInstanceKey(groupId, moduleId);
        const instance = get().instances.get(key);

        if (!instance) {
          console.warn(`Module ${moduleId} is not enabled for group ${groupId}`);
          return;
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

        console.info(`Module ${moduleId} disabled for group ${groupId}`);
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

        console.info(`Module ${moduleId} config updated for group ${groupId}`);
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
        console.info('📥 Loading module instances from database...');
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
        console.info(`✅ Loaded ${instances.length} module instances from database`);
      },
    })
);
