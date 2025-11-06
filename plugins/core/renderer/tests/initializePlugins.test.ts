import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerPlugins, disposePlugins } from '../initializePlugins';
import { PluginManager } from '../Manager';
import { PluginRegistry } from '../Registry';

vi.mock('../Manager', () => ({
  PluginManager: {
    start: vi.fn(),
    stop: vi.fn(),
    registerPlugin: vi.fn(),
    disposePlugins: vi.fn(),
  },
}));

vi.mock('../Registry', () => ({
  PluginRegistry: {
    register: vi.fn(),
  },
}));

vi.mock('../../../plugins.config', () => ({
  PLUGINS: [
    {
      name: 'test-plugin-1',
      pluginPath: '/path/to/plugin1',
      manifestPath: '/path/to/manifest1',
      rendererCommandsPath: '/path/to/commands1',
    },
    {
      name: 'test-plugin-2',
      pluginPath: '/path/to/plugin2',
      manifestPath: '/path/to/manifest2',
      // No renderer commands
    },
  ],
}));

describe('initializePlugins', () => {
  const mockPlugin1 = {
    manifest: {
      name: 'test-plugin-1',
      version: '1.0.0',
      displayName: 'Test Plugin 1',
      apiVersion: '1.0.0',
      enabled: true,
      builtin: false,
    },
    extensionPoints: {},
    initialize: vi.fn(),
    dispose: vi.fn(),
  };

  const mockPlugin2 = {
    manifest: {
      name: 'test-plugin-2',
      version: '1.0.0',
      displayName: 'Test Plugin 2',
      apiVersion: '1.0.0',
      enabled: true,
      builtin: false,
    },
    extensionPoints: {},
    initialize: vi.fn(),
    dispose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerPlugins', () => {
    it('should start plugin manager', async () => {
      vi.mocked(PluginManager.start).mockResolvedValue(undefined);
      vi.mocked(PluginManager.registerPlugin)
        .mockResolvedValueOnce(mockPlugin1)
        .mockResolvedValueOnce(mockPlugin2);
      vi.mocked(PluginRegistry.register).mockResolvedValue(undefined);

      // Mock dynamic import
      vi.doMock('/path/to/commands1', () => ({
        registerCommands: vi.fn(),
      }));

      await registerPlugins();

      expect(PluginManager.start).toHaveBeenCalled();
    });

    it('should register all plugins with PluginManager', async () => {
      vi.mocked(PluginManager.start).mockResolvedValue(undefined);
      vi.mocked(PluginManager.registerPlugin)
        .mockResolvedValueOnce(mockPlugin1)
        .mockResolvedValueOnce(mockPlugin2);
      vi.mocked(PluginRegistry.register).mockResolvedValue(undefined);

      await registerPlugins();

      expect(PluginManager.registerPlugin).toHaveBeenCalledTimes(2);
      expect(PluginManager.registerPlugin).toHaveBeenCalledWith({
        name: 'test-plugin-1',
        pluginPath: '/path/to/plugin1',
        manifestPath: '/path/to/manifest1',
      });
      expect(PluginManager.registerPlugin).toHaveBeenCalledWith({
        name: 'test-plugin-2',
        pluginPath: '/path/to/plugin2',
        manifestPath: '/path/to/manifest2',
      });
    });

    it('should register all plugins with PluginRegistry', async () => {
      vi.mocked(PluginManager.start).mockResolvedValue(undefined);
      vi.mocked(PluginManager.registerPlugin)
        .mockResolvedValueOnce(mockPlugin1)
        .mockResolvedValueOnce(mockPlugin2);
      vi.mocked(PluginRegistry.register).mockResolvedValue(undefined);

      await registerPlugins();

      expect(PluginRegistry.register).toHaveBeenCalledTimes(2);
      expect(PluginRegistry.register).toHaveBeenCalledWith(mockPlugin1);
      expect(PluginRegistry.register).toHaveBeenCalledWith(mockPlugin2);
    });

    it('should handle plugin manager start errors', async () => {
      const error = new Error('Failed to start');
      vi.mocked(PluginManager.start).mockRejectedValue(error);

      await expect(registerPlugins()).rejects.toThrow('Failed to start');
    });

    it('should handle plugin registration errors', async () => {
      const error = new Error('Failed to register');
      vi.mocked(PluginManager.start).mockResolvedValue(undefined);
      vi.mocked(PluginManager.registerPlugin).mockRejectedValue(error);

      await expect(registerPlugins()).rejects.toThrow('Failed to register');
    });

    it('should handle plugin registry registration errors', async () => {
      const error = new Error('Failed to add to registry');
      vi.mocked(PluginManager.start).mockResolvedValue(undefined);
      vi.mocked(PluginManager.registerPlugin).mockResolvedValue(mockPlugin1);
      vi.mocked(PluginRegistry.register).mockRejectedValue(error);

      await expect(registerPlugins()).rejects.toThrow('Failed to add to registry');
    });

    it('should process plugins in order', async () => {
      const callOrder: string[] = [];

      vi.mocked(PluginManager.start).mockImplementation(async () => {
        callOrder.push('start');
      });
      vi.mocked(PluginManager.registerPlugin).mockImplementation(async (config) => {
        callOrder.push(`register-${config.name}`);
        return config.name === 'test-plugin-1' ? mockPlugin1 : mockPlugin2;
      });
      vi.mocked(PluginRegistry.register).mockImplementation(async (plugin) => {
        callOrder.push(`registry-${plugin.manifest.name}`);
      });

      await registerPlugins();

      expect(callOrder).toEqual([
        'start',
        'register-test-plugin-1',
        'registry-test-plugin-1',
        'register-test-plugin-2',
        'registry-test-plugin-2',
      ]);
    });
  });

  describe('disposePlugins', () => {
    it('should dispose plugins and stop manager', async () => {
      vi.mocked(PluginManager.disposePlugins).mockResolvedValue(undefined);
      vi.mocked(PluginManager.stop).mockResolvedValue(undefined);

      await disposePlugins();

      expect(PluginManager.disposePlugins).toHaveBeenCalled();
      expect(PluginManager.stop).toHaveBeenCalled();
    });

    it('should dispose before stopping', async () => {
      const callOrder: string[] = [];

      vi.mocked(PluginManager.disposePlugins).mockImplementation(async () => {
        callOrder.push('dispose');
      });
      vi.mocked(PluginManager.stop).mockImplementation(async () => {
        callOrder.push('stop');
      });

      await disposePlugins();

      expect(callOrder).toEqual(['dispose', 'stop']);
    });

    it('should handle dispose errors', async () => {
      const error = new Error('Failed to dispose');
      vi.mocked(PluginManager.disposePlugins).mockRejectedValue(error);

      await expect(disposePlugins()).rejects.toThrow('Failed to dispose');
    });

    it('should handle stop errors', async () => {
      const error = new Error('Failed to stop');
      vi.mocked(PluginManager.disposePlugins).mockResolvedValue(undefined);
      vi.mocked(PluginManager.stop).mockRejectedValue(error);

      await expect(disposePlugins()).rejects.toThrow('Failed to stop');
    });
  });
});
