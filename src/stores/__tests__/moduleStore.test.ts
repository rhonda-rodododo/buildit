import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useModuleStore } from '../moduleStore';
import type { ModulePlugin } from '@/types/modules';

// Mock the database
vi.mock('@/core/storage/db', () => ({
  db: {
    moduleInstances: {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe('moduleStore', () => {
  const mockModule: ModulePlugin = {
    metadata: {
      id: 'test-module',
      type: 'messaging',
      name: 'Test Module',
      description: 'A test module',
      version: '1.0.0',
      author: 'Test',
      icon: 'TestIcon',
      capabilities: [],
      configSchema: [],
      requiredPermission: 'member',
    },
    getDefaultConfig: () => ({ testSetting: true }),
    validateConfig: (config) => typeof config.testSetting === 'boolean',
  };

  beforeEach(() => {
    // Reset store state
    useModuleStore.setState({
      registry: new Map(),
      instances: new Map(),
    });
  });

  describe('registerModule', () => {
    it('should register a module successfully', async () => {
      const { registerModule } = useModuleStore.getState();

      await registerModule(mockModule);

      const { registry } = useModuleStore.getState();
      expect(registry.has('test-module')).toBe(true);
      const entry = registry.get('test-module');
      expect(entry?.plugin).toEqual(mockModule);
      expect(entry?.registeredAt).toBeDefined();
    });

    it('should warn when registering duplicate module', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { registerModule } = useModuleStore.getState();

      await registerModule(mockModule);
      await registerModule(mockModule);

      expect(consoleSpy).toHaveBeenCalledWith('Module test-module is already registered');
      consoleSpy.mockRestore();
    });

    it('should call onRegister lifecycle hook', async () => {
      const onRegister = vi.fn().mockResolvedValue(undefined);
      const moduleWithHook: ModulePlugin = {
        ...mockModule,
        lifecycle: { onRegister },
      };

      const { registerModule } = useModuleStore.getState();
      await registerModule(moduleWithHook);

      expect(onRegister).toHaveBeenCalled();
    });
  });

  describe('enableModule', () => {
    beforeEach(async () => {
      const { registerModule } = useModuleStore.getState();
      await registerModule(mockModule);
    });

    it('should enable a module for a group', async () => {
      const { enableModule } = useModuleStore.getState();
      const groupId = 'test-group';

      await enableModule(groupId, 'test-module');

      const { instances } = useModuleStore.getState();
      const instance = instances.get(`${groupId}:test-module`);
      expect(instance).toBeDefined();
      expect(instance?.state).toBe('enabled');
      expect(instance?.groupId).toBe(groupId);
      expect(instance?.moduleId).toBe('test-module');
    });

    it('should use default config when no config provided', async () => {
      const { enableModule, getModuleInstance } = useModuleStore.getState();
      const groupId = 'test-group';

      await enableModule(groupId, 'test-module');

      const instance = getModuleInstance(groupId, 'test-module');
      expect(instance?.config).toEqual({ testSetting: true });
    });

    it('should validate config before enabling', async () => {
      const { enableModule } = useModuleStore.getState();
      const groupId = 'test-group';

      await expect(
        enableModule(groupId, 'test-module', { testSetting: 'invalid' })
      ).rejects.toThrow('Invalid configuration');
    });

    it('should throw error for unregistered module', async () => {
      const { enableModule } = useModuleStore.getState();

      await expect(
        enableModule('test-group', 'nonexistent-module')
      ).rejects.toThrow('Module nonexistent-module is not registered');
    });

    it('should call onEnable lifecycle hook', async () => {
      const onEnable = vi.fn().mockResolvedValue(undefined);

      // Unregister and re-register with hook
      const { registry } = useModuleStore.getState();
      registry.delete('test-module');

      const moduleWithHook: ModulePlugin = {
        ...mockModule,
        lifecycle: { onEnable },
      };

      const { registerModule, enableModule } = useModuleStore.getState();
      await registerModule(moduleWithHook);
      await enableModule('test-group', 'test-module');

      expect(onEnable).toHaveBeenCalledWith('test-group', { testSetting: true });
    });
  });

  describe('disableModule', () => {
    beforeEach(async () => {
      const { registerModule, enableModule } = useModuleStore.getState();
      await registerModule(mockModule);
      await enableModule('test-group', 'test-module');
    });

    it('should disable a module for a group', async () => {
      const { disableModule } = useModuleStore.getState();

      await disableModule('test-group', 'test-module');

      const { instances } = useModuleStore.getState();
      expect(instances.has('test-group:test-module')).toBe(false);
    });

    it('should call onDisable lifecycle hook', async () => {
      const onDisable = vi.fn().mockResolvedValue(undefined);

      // Update registry with hook
      const { registry } = useModuleStore.getState();
      const entry = registry.get('test-module')!;
      entry.plugin.lifecycle = { onDisable };

      const { disableModule } = useModuleStore.getState();
      await disableModule('test-group', 'test-module');

      expect(onDisable).toHaveBeenCalledWith('test-group');
    });
  });

  describe('updateModuleConfig', () => {
    beforeEach(async () => {
      const { registerModule, enableModule } = useModuleStore.getState();
      await registerModule(mockModule);
      await enableModule('test-group', 'test-module');
    });

    it('should update module configuration', async () => {
      const { updateModuleConfig, getModuleInstance } = useModuleStore.getState();
      const newConfig = { testSetting: false };

      await updateModuleConfig('test-group', 'test-module', newConfig);

      const instance = getModuleInstance('test-group', 'test-module');
      expect(instance?.config).toEqual(newConfig);
    });

    it('should validate config before updating', async () => {
      const { updateModuleConfig } = useModuleStore.getState();

      await expect(
        updateModuleConfig('test-group', 'test-module', { testSetting: 'invalid' })
      ).rejects.toThrow('Invalid configuration');
    });

    it('should call onConfigUpdate lifecycle hook', async () => {
      const onConfigUpdate = vi.fn().mockResolvedValue(undefined);

      // Update registry with hook
      const { registry } = useModuleStore.getState();
      const entry = registry.get('test-module')!;
      entry.plugin.lifecycle = { onConfigUpdate };

      const { updateModuleConfig } = useModuleStore.getState();
      const newConfig = { testSetting: false };
      await updateModuleConfig('test-group', 'test-module', newConfig);

      expect(onConfigUpdate).toHaveBeenCalledWith('test-group', newConfig);
    });
  });

  describe('getGroupModules', () => {
    beforeEach(async () => {
      const { registerModule, enableModule } = useModuleStore.getState();
      await registerModule(mockModule);
      await enableModule('group-1', 'test-module');
      await enableModule('group-2', 'test-module');
    });

    it('should return modules for a specific group', () => {
      const { getGroupModules } = useModuleStore.getState();

      const group1Modules = getGroupModules('group-1');
      const group2Modules = getGroupModules('group-2');

      expect(group1Modules).toHaveLength(1);
      expect(group2Modules).toHaveLength(1);
      expect(group1Modules[0].groupId).toBe('group-1');
      expect(group2Modules[0].groupId).toBe('group-2');
    });
  });

  describe('isModuleEnabled', () => {
    beforeEach(async () => {
      const { registerModule, enableModule } = useModuleStore.getState();
      await registerModule(mockModule);
      await enableModule('test-group', 'test-module');
    });

    it('should return true for enabled module', () => {
      const { isModuleEnabled } = useModuleStore.getState();

      expect(isModuleEnabled('test-group', 'test-module')).toBe(true);
    });

    it('should return false for disabled module', () => {
      const { isModuleEnabled } = useModuleStore.getState();

      expect(isModuleEnabled('test-group', 'nonexistent-module')).toBe(false);
      expect(isModuleEnabled('other-group', 'test-module')).toBe(false);
    });
  });
});
