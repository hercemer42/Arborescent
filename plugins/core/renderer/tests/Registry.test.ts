import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry } from '../Registry';
import { Plugin } from '../../shared/interface';
import { logger } from '../../../../src/renderer/services/logger';
import { checkApiCompatibility } from '../../shared/apiVersion';

vi.mock('../../../../src/renderer/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../shared/apiVersion', () => ({
  checkApiCompatibility: vi.fn(),
}));

vi.mock('../../../../src/renderer/store/plugins/pluginStore', () => ({
  usePluginStore: {
    getState: () => ({
      registerPlugin: vi.fn(),
      unregisterPlugin: vi.fn(),
      enablePlugin: vi.fn(),
      disablePlugin: vi.fn(),
    }),
  },
}));

describe('PluginRegistry', () => {
  const createMockPlugin = (name: string, enabled = true): Plugin => ({
    manifest: {
      name,
      version: '1.0.0',
      displayName: `${name} Plugin`,
      apiVersion: '1.0.0',
      enabled,
      builtin: false,
    },
    extensionPoints: {},
    initialize: vi.fn(),
    dispose: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear plugins between tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginRegistry as any).plugins.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginRegistry as any).initialized = false;

    // Default: compatible API
    vi.mocked(checkApiCompatibility).mockReturnValue({
      compatible: true,
      warning: '',
    });
  });

  describe('register', () => {
    it('should register a plugin', async () => {
      const plugin = createMockPlugin('test-plugin');

      await PluginRegistry.register(plugin);

      expect(PluginRegistry.getPlugin('test-plugin')).toBe(plugin);
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin registered',
        'Plugin Registry'
      );
    });

    it('should skip duplicate registration', async () => {
      const plugin1 = createMockPlugin('test-plugin');
      const plugin2 = createMockPlugin('test-plugin');

      await PluginRegistry.register(plugin1);
      await PluginRegistry.register(plugin2);

      expect(logger.warn).toHaveBeenCalledWith(
        'Plugin test-plugin is already registered',
        'Plugin Registry'
      );
      expect(PluginRegistry.getPlugin('test-plugin')).toBe(plugin1);
    });

    it('should reject incompatible API version', async () => {
      vi.mocked(checkApiCompatibility).mockReturnValue({
        compatible: false,
        warning: 'API version mismatch',
      });
      const plugin = createMockPlugin('test-plugin');

      await PluginRegistry.register(plugin);

      expect(PluginRegistry.getPlugin('test-plugin')).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        'Plugin "test-plugin Plugin": API version mismatch',
        expect.any(Error),
        'Plugin Registry'
      );
    });

    it('should initialize plugin if registry already initialized', async () => {
      const plugin = createMockPlugin('test-plugin');

      // Initialize registry first
      await PluginRegistry.initializeAll();

      await PluginRegistry.register(plugin);

      expect(plugin.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin initialized',
        'Plugin Registry'
      );
    });

    it('should not initialize plugin if disabled', async () => {
      const plugin = createMockPlugin('test-plugin', false);
      await PluginRegistry.initializeAll();

      await PluginRegistry.register(plugin);

      expect(plugin.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors during registration', async () => {
      const error = new Error('Init failed');
      const plugin = createMockPlugin('test-plugin');
      vi.mocked(plugin.initialize).mockRejectedValue(error);

      await PluginRegistry.initializeAll();
      await PluginRegistry.register(plugin);

      expect(logger.error).toHaveBeenCalledWith(
        'Plugin "test-plugin Plugin" failed to initialize',
        error,
        'Plugin Registry'
      );
    });
  });

  describe('unregister', () => {
    it('should unregister and dispose plugin', async () => {
      const plugin = createMockPlugin('test-plugin');
      await PluginRegistry.register(plugin);

      await PluginRegistry.unregister('test-plugin');

      expect(plugin.dispose).toHaveBeenCalled();
      expect(PluginRegistry.getPlugin('test-plugin')).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin unregistered',
        'Plugin Registry'
      );
    });

    it('should handle dispose errors', async () => {
      const error = new Error('Dispose failed');
      const plugin = createMockPlugin('test-plugin');
      vi.mocked(plugin.dispose).mockImplementation(() => {
        throw error;
      });
      await PluginRegistry.register(plugin);

      await PluginRegistry.unregister('test-plugin');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to dispose plugin test-plugin',
        error,
        'Plugin Registry'
      );
    });

    it('should handle unregistering non-existent plugin', async () => {
      await PluginRegistry.unregister('non-existent');

      // Should not throw or log errors
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('initializeAll', () => {
    it('should initialize all enabled plugins', async () => {
      const plugin1 = createMockPlugin('plugin1');
      const plugin2 = createMockPlugin('plugin2');
      await PluginRegistry.register(plugin1);
      await PluginRegistry.register(plugin2);

      await PluginRegistry.initializeAll();

      expect(plugin1.initialize).toHaveBeenCalled();
      expect(plugin2.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'All plugins initialized',
        'Plugin Registry'
      );
    });

    it('should skip disabled plugins', async () => {
      const plugin1 = createMockPlugin('plugin1', true);
      const plugin2 = createMockPlugin('plugin2', false);
      await PluginRegistry.register(plugin1);
      await PluginRegistry.register(plugin2);

      await PluginRegistry.initializeAll();

      expect(plugin1.initialize).toHaveBeenCalled();
      expect(plugin2.initialize).not.toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      const plugin = createMockPlugin('test-plugin');
      vi.mocked(plugin.initialize).mockRejectedValue(error);
      await PluginRegistry.register(plugin);

      await PluginRegistry.initializeAll();

      expect(logger.error).toHaveBeenCalledWith(
        'Plugin "test-plugin Plugin" failed to initialize',
        error,
        'Plugin Registry'
      );
    });
  });

  describe('disposeAll', () => {
    it('should dispose all plugins', async () => {
      const plugin1 = createMockPlugin('plugin1');
      const plugin2 = createMockPlugin('plugin2');
      await PluginRegistry.register(plugin1);
      await PluginRegistry.register(plugin2);

      await PluginRegistry.disposeAll();

      expect(plugin1.dispose).toHaveBeenCalled();
      expect(plugin2.dispose).toHaveBeenCalled();
      expect(PluginRegistry.getAllPlugins()).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        'All plugins disposed',
        'Plugin Registry'
      );
    });

    it('should handle dispose errors', async () => {
      const error = new Error('Dispose failed');
      const plugin = createMockPlugin('test-plugin');
      vi.mocked(plugin.dispose).mockImplementation(() => {
        throw error;
      });
      await PluginRegistry.register(plugin);

      await PluginRegistry.disposeAll();

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to dispose plugin test-plugin',
        error,
        'Plugin Registry'
      );
    });
  });

  describe('getPlugin', () => {
    it('should return plugin by name', async () => {
      const plugin = createMockPlugin('test-plugin');
      await PluginRegistry.register(plugin);

      expect(PluginRegistry.getPlugin('test-plugin')).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(PluginRegistry.getPlugin('non-existent')).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('should return all plugins', async () => {
      const plugin1 = createMockPlugin('plugin1');
      const plugin2 = createMockPlugin('plugin2');
      await PluginRegistry.register(plugin1);
      await PluginRegistry.register(plugin2);

      const plugins = PluginRegistry.getAllPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
    });

    it('should return empty array when no plugins registered', () => {
      expect(PluginRegistry.getAllPlugins()).toEqual([]);
    });
  });

  describe('getEnabledPlugins', () => {
    it('should return only enabled plugins', async () => {
      const plugin1 = createMockPlugin('plugin1', true);
      const plugin2 = createMockPlugin('plugin2', false);
      await PluginRegistry.register(plugin1);
      await PluginRegistry.register(plugin2);

      const plugins = PluginRegistry.getEnabledPlugins();

      expect(plugins).toHaveLength(1);
      expect(plugins).toContain(plugin1);
      expect(plugins).not.toContain(plugin2);
    });
  });

  describe('enablePlugin', () => {
    it('should enable and initialize plugin when registry initialized', async () => {
      const plugin = createMockPlugin('test-plugin', false);
      await PluginRegistry.register(plugin);
      await PluginRegistry.initializeAll();

      await PluginRegistry.enablePlugin('test-plugin');

      expect(plugin.manifest.enabled).toBe(true);
      expect(plugin.initialize).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin enabled and initialized',
        'Plugin Registry'
      );
    });

    it('should enable plugin without initializing when registry not initialized', async () => {
      const plugin = createMockPlugin('test-plugin', false);
      await PluginRegistry.register(plugin);

      await PluginRegistry.enablePlugin('test-plugin');

      expect(plugin.manifest.enabled).toBe(true);
      expect(plugin.initialize).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin enabled',
        'Plugin Registry'
      );
    });

    it('should throw error for non-existent plugin', async () => {
      await expect(
        PluginRegistry.enablePlugin('non-existent')
      ).rejects.toThrow('Plugin non-existent not found');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Init failed');
      const plugin = createMockPlugin('test-plugin', false);
      vi.mocked(plugin.initialize).mockRejectedValue(error);
      await PluginRegistry.register(plugin);
      await PluginRegistry.initializeAll();

      await PluginRegistry.enablePlugin('test-plugin');

      expect(logger.error).toHaveBeenCalledWith(
        'Plugin "test-plugin Plugin" failed to initialize',
        error,
        'Plugin Registry'
      );
    });
  });

  describe('disablePlugin', () => {
    it('should disable and dispose plugin', async () => {
      const plugin = createMockPlugin('test-plugin', true);
      await PluginRegistry.register(plugin);

      await PluginRegistry.disablePlugin('test-plugin');

      expect(plugin.manifest.enabled).toBe(false);
      expect(plugin.dispose).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin disabled',
        'Plugin Registry'
      );
    });

    it('should throw error for non-existent plugin', async () => {
      await expect(
        PluginRegistry.disablePlugin('non-existent')
      ).rejects.toThrow('Plugin non-existent not found');
    });

    it('should handle dispose errors', async () => {
      const error = new Error('Dispose failed');
      const plugin = createMockPlugin('test-plugin');
      vi.mocked(plugin.dispose).mockImplementation(() => {
        throw error;
      });
      await PluginRegistry.register(plugin);

      await PluginRegistry.disablePlugin('test-plugin');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to dispose plugin test-plugin',
        error,
        'Plugin Registry'
      );
    });
  });
});
