import { describe, it, expect, beforeEach } from 'vitest';
import { useModuleStore } from '@/stores/moduleStore';
import type { ModulePlugin } from '@/types/modules';

describe('Module System Integration', () => {
  beforeEach(() => {
    // Reset module store
    useModuleStore.getState().modules.clear();
  });

  describe('Module Dependency Resolution', () => {
    it('should load modules in dependency order', () => {
      const store = useModuleStore.getState();

      // Base module (no dependencies)
      const customFieldsModule: ModulePlugin = {
        id: 'custom-fields',
        name: 'Custom Fields',
        version: '1.0.0',
        description: 'Base module for custom fields',
        dependencies: [],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      // Dependent module
      const eventsModule: ModulePlugin = {
        id: 'events',
        name: 'Events',
        version: '1.0.0',
        description: 'Events module',
        dependencies: ['custom-fields'],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      store.registerModule(customFieldsModule);
      store.registerModule(eventsModule);

      expect(store.modules.has('custom-fields')).toBe(true);
      expect(store.modules.has('events')).toBe(true);
    });

    it('should throw error when dependency is missing', () => {
      const store = useModuleStore.getState();

      const eventsModule: ModulePlugin = {
        id: 'events',
        name: 'Events',
        version: '1.0.0',
        description: 'Events module',
        dependencies: ['custom-fields'], // Missing dependency
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      expect(() => store.registerModule(eventsModule)).toThrow();
    });

    it('should handle complex dependency chains', () => {
      const store = useModuleStore.getState();

      const customFields: ModulePlugin = {
        id: 'custom-fields',
        name: 'Custom Fields',
        version: '1.0.0',
        description: 'Base',
        dependencies: [],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      const database: ModulePlugin = {
        id: 'database',
        name: 'Database',
        version: '1.0.0',
        description: 'Database',
        dependencies: ['custom-fields'],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      const crm: ModulePlugin = {
        id: 'crm',
        name: 'CRM',
        version: '1.0.0',
        description: 'CRM',
        dependencies: ['database'],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      store.registerModule(customFields);
      store.registerModule(database);
      store.registerModule(crm);

      expect(store.modules.size).toBe(3);
    });
  });

  describe('Module Enable/Disable per Group', () => {
    it('should enable module for specific group', () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
        defaultConfig: { setting1: 'value1' },
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      store.registerModule(testModule);
      store.enableModule('test-module', 'group-1', { setting1: 'custom' });

      const groupModules = store.getGroupModules('group-1');
      expect(groupModules).toHaveLength(1);
      expect(groupModules[0].id).toBe('test-module');
      expect(groupModules[0].config.setting1).toBe('custom');
    });

    it('should isolate module config per group', () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
        defaultConfig: { setting1: 'default' },
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      store.registerModule(testModule);
      store.enableModule('test-module', 'group-1', { setting1: 'config1' });
      store.enableModule('test-module', 'group-2', { setting1: 'config2' });

      const group1Modules = store.getGroupModules('group-1');
      const group2Modules = store.getGroupModules('group-2');

      expect(group1Modules[0].config.setting1).toBe('config1');
      expect(group2Modules[0].config.setting1).toBe('config2');
    });

    it('should disable module for specific group only', () => {
      const store = useModuleStore.getState();

      const testModule: ModulePlugin = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
      };

      store.registerModule(testModule);
      store.enableModule('test-module', 'group-1');
      store.enableModule('test-module', 'group-2');

      store.disableModule('test-module', 'group-1');

      expect(store.isModuleEnabled('test-module', 'group-1')).toBe(false);
      expect(store.isModuleEnabled('test-module', 'group-2')).toBe(true);
    });
  });

  describe('Module Lifecycle Hooks', () => {
    it('should call onRegister hook', () => {
      const store = useModuleStore.getState();
      let registerCalled = false;

      const testModule: ModulePlugin = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
        onRegister: () => {
          registerCalled = true;
        },
      };

      store.registerModule(testModule);
      expect(registerCalled).toBe(true);
    });

    it('should call onEnable and onDisable hooks', () => {
      const store = useModuleStore.getState();
      let enableCalled = false;
      let disableCalled = false;

      const testModule: ModulePlugin = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
        defaultConfig: {},
        configSchema: { type: 'object', properties: {} },
        permissions: [],
        onEnable: () => {
          enableCalled = true;
        },
        onDisable: () => {
          disableCalled = true;
        },
      };

      store.registerModule(testModule);
      store.enableModule('test-module', 'group-1');
      expect(enableCalled).toBe(true);

      store.disableModule('test-module', 'group-1');
      expect(disableCalled).toBe(true);
    });

    it('should call onConfigUpdate hook', () => {
      const store = useModuleStore.getState();
      let configUpdateCalled = false;
      let updatedConfig: any;

      const testModule: ModulePlugin = {
        id: 'test-module',
        name: 'Test Module',
        version: '1.0.0',
        description: 'Test',
        dependencies: [],
        defaultConfig: { setting1: 'default' },
        configSchema: { type: 'object', properties: {} },
        permissions: [],
        onConfigUpdate: (_groupId, config) => {
          configUpdateCalled = true;
          updatedConfig = config;
        },
      };

      store.registerModule(testModule);
      store.enableModule('test-module', 'group-1');
      store.updateModuleConfig('test-module', 'group-1', { setting1: 'updated' });

      expect(configUpdateCalled).toBe(true);
      expect(updatedConfig.setting1).toBe('updated');
    });
  });
});
