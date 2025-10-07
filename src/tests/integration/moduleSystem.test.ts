import { describe, it, expect, beforeEach } from 'vitest';
import { useModuleStore } from '@/stores/moduleStore';
import type { ModulePlugin } from '@/types/modules';
import { FileText } from 'lucide-react';

describe('Module System Integration', () => {
  beforeEach(() => {
    // Reset module store by creating a new instance
    useModuleStore.setState({
      registry: new Map(),
      instances: new Map(),
    });
  });

  describe('Module Registration', () => {
    it('should register a module successfully', async () => {
      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test module for unit tests',
          author: 'BuildIt Team',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
      };

      await useModuleStore.getState().registerModule(testModule);

      const store = useModuleStore.getState();
      expect(store.registry.has('test-module')).toBe(true);
      const entry = store.registry.get('test-module');
      expect(entry?.plugin.metadata.name).toBe('Test Module');
    });

    it('should not re-register an already registered module', async () => {
      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
      };

      await useModuleStore.getState().registerModule(testModule);
      await useModuleStore.getState().registerModule(testModule); // Try to register again

      const store = useModuleStore.getState();
      expect(store.registry.size).toBe(1);
    });

    it('should call onRegister lifecycle hook', async () => {
      let registerCalled = false;

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
        lifecycle: {
          onRegister: async () => {
            registerCalled = true;
          },
        },
      };

      await useModuleStore.getState().registerModule(testModule);
      expect(registerCalled).toBe(true);
    });
  });

  describe('Module Enable/Disable per Group', () => {
    it('should enable module for specific group', async () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
        getDefaultConfig: () => ({ setting1: 'value1' }),
      };

      await store.registerModule(testModule);
      await store.enableModule('group-1', 'test-module', { setting1: 'custom' });

      const groupModules = store.getGroupModules('group-1');
      expect(groupModules).toHaveLength(1);
      expect(groupModules[0].moduleId).toBe('test-module');
      expect(groupModules[0].config.setting1).toBe('custom');
      expect(groupModules[0].state).toBe('enabled');
    });

    it('should isolate module config per group', async () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
        getDefaultConfig: () => ({ setting1: 'default' }),
      };

      await store.registerModule(testModule);
      await store.enableModule('group-1', 'test-module', { setting1: 'config1' });
      await store.enableModule('group-2', 'test-module', { setting1: 'config2' });

      const group1Modules = store.getGroupModules('group-1');
      const group2Modules = store.getGroupModules('group-2');

      expect(group1Modules[0].config.setting1).toBe('config1');
      expect(group2Modules[0].config.setting1).toBe('config2');
    });

    it('should disable module for specific group only', async () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
      };

      await store.registerModule(testModule);
      await store.enableModule('group-1', 'test-module');
      await store.enableModule('group-2', 'test-module');

      await store.disableModule('group-1', 'test-module');

      expect(store.isModuleEnabled('group-1', 'test-module')).toBe(false);
      expect(store.isModuleEnabled('group-2', 'test-module')).toBe(true);
    });
  });

  describe('Module Lifecycle Hooks', () => {
    it('should call onEnable and onDisable hooks', async () => {
      const store = useModuleStore.getState();
      let enableCalled = false;
      let disableCalled = false;

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
        lifecycle: {
          onEnable: async () => {
            enableCalled = true;
          },
          onDisable: async () => {
            disableCalled = true;
          },
        },
      };

      await store.registerModule(testModule);
      await store.enableModule('group-1', 'test-module');
      expect(enableCalled).toBe(true);

      await store.disableModule('group-1', 'test-module');
      expect(disableCalled).toBe(true);
    });

    it('should call onConfigUpdate hook', async () => {
      const store = useModuleStore.getState();
      let configUpdateCalled = false;
      let updatedConfig: any;

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
        getDefaultConfig: () => ({ setting1: 'default' }),
        lifecycle: {
          onConfigUpdate: async (_groupId, config) => {
            configUpdateCalled = true;
            updatedConfig = config;
          },
        },
      };

      await store.registerModule(testModule);
      await store.enableModule('group-1', 'test-module');
      await store.updateModuleConfig('group-1', 'test-module', { setting1: 'updated' });

      expect(configUpdateCalled).toBe(true);
      expect(updatedConfig.setting1).toBe('updated');
    });
  });

  describe('Module Queries', () => {
    it('should get module instance for a group', async () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
      };

      await store.registerModule(testModule);
      await store.enableModule('group-1', 'test-module');

      const instance = store.getModuleInstance('group-1', 'test-module');
      expect(instance).toBeDefined();
      expect(instance?.moduleId).toBe('test-module');
      expect(instance?.groupId).toBe('group-1');
    });

    it('should check if module is enabled for a group', async () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        metadata: {
          id: 'test-module',
          type: 'custom-fields',
          name: 'Test Module',
          version: '1.0.0',
          description: 'Test',
          author: 'BuildIt',
          icon: FileText,
          capabilities: [],
          configSchema: [],
          requiredPermission: 'member',
        },
      };

      await store.registerModule(testModule);
      expect(store.isModuleEnabled('group-1', 'test-module')).toBe(false);

      await store.enableModule('group-1', 'test-module');
      expect(store.isModuleEnabled('group-1', 'test-module')).toBe(true);
    });
  });
});
