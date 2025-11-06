import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginManager } from '../Manager';
import { logger } from '../../../../src/renderer/services/logger';

vi.mock('../../../../src/renderer/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

interface MockElectron {
  pluginStart: ReturnType<typeof vi.fn>;
  pluginStop: ReturnType<typeof vi.fn>;
  pluginRegister: ReturnType<typeof vi.fn>;
  pluginUnregister: ReturnType<typeof vi.fn>;
  pluginInitializeAll: ReturnType<typeof vi.fn>;
  pluginDisposeAll: ReturnType<typeof vi.fn>;
}

describe('PluginManager', () => {
  let mockPluginStart: ReturnType<typeof vi.fn>;
  let mockPluginStop: ReturnType<typeof vi.fn>;
  let mockPluginRegister: ReturnType<typeof vi.fn>;
  let mockPluginUnregister: ReturnType<typeof vi.fn>;
  let mockPluginInitializeAll: ReturnType<typeof vi.fn>;
  let mockPluginDisposeAll: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset PluginManager state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginManager as any).started = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginManager as any).pluginProxies.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginManager as any).startPromise = null;

    mockPluginStart = vi.fn();
    mockPluginStop = vi.fn();
    mockPluginRegister = vi.fn();
    mockPluginUnregister = vi.fn();
    mockPluginInitializeAll = vi.fn();
    mockPluginDisposeAll = vi.fn();

    // Mock window.electron
    global.window = {
      electron: {
        pluginStart: mockPluginStart,
        pluginStop: mockPluginStop,
        pluginRegister: mockPluginRegister,
        pluginUnregister: mockPluginUnregister,
        pluginInitializeAll: mockPluginInitializeAll,
        pluginDisposeAll: mockPluginDisposeAll,
      } as unknown as Window['electron'],
    } as Window & typeof globalThis;
  });

  afterEach(() => {
    // Clean up after each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginManager as any).started = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginManager as any).pluginProxies.clear();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (PluginManager as any).startPromise = null;
  });

  describe('start', () => {
    it('should start plugin system successfully', async () => {
      mockPluginStart.mockResolvedValue({ success: true });

      await PluginManager.start();

      expect(mockPluginStart).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Plugin manager started', 'Plugin Manager');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).started).toBe(true);
    });

    it('should warn when already started', async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();

      await PluginManager.start();

      expect(logger.warn).toHaveBeenCalledWith(
        'Plugin system already started',
        'Plugin Manager'
      );
      expect(mockPluginStart).toHaveBeenCalledTimes(1);
    });

    it('should wait for in-progress start', async () => {
      mockPluginStart.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
      );

      const start1 = PluginManager.start();
      const start2 = PluginManager.start();

      await Promise.all([start1, start2]);

      expect(logger.info).toHaveBeenCalledWith(
        'Plugin system start already in progress, waiting...',
        'Plugin Manager'
      );
      expect(mockPluginStart).toHaveBeenCalledTimes(1);
    });

    it('should throw error on start failure', async () => {
      mockPluginStart.mockResolvedValue({
        success: false,
        error: 'Worker failed to start'
      });

      await expect(PluginManager.start()).rejects.toThrow('Worker failed to start');
      expect(logger.error).toHaveBeenCalledWith(
        'Plugin system failed to start',
        expect.any(Error),
        'Plugin Manager'
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).started).toBe(false);
    });

    it('should use default error message when none provided', async () => {
      mockPluginStart.mockResolvedValue({ success: false });

      await expect(PluginManager.start()).rejects.toThrow('Failed to start plugin system');
    });

    it('should clear startPromise after completion', async () => {
      mockPluginStart.mockResolvedValue({ success: true });

      await PluginManager.start();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).startPromise).toBeNull();
    });

    it('should clear startPromise after error', async () => {
      mockPluginStart.mockResolvedValue({ success: false, error: 'Error' });

      await expect(PluginManager.start()).rejects.toThrow();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).startPromise).toBeNull();
    });
  });

  describe('stop', () => {
    it('should stop plugin system', async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();

      await PluginManager.stop();

      expect(mockPluginStop).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).started).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).pluginProxies.size).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('Plugin manager stopped', 'Plugin Manager');
    });

    it('should wait for start to complete before stopping', async () => {
      mockPluginStart.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
      );

      const startPromise = PluginManager.start();
      const stopPromise = PluginManager.stop();

      await Promise.all([startPromise, stopPromise]);

      expect(logger.info).toHaveBeenCalledWith(
        'Waiting for start to complete before stopping',
        'Plugin Manager'
      );
      expect(mockPluginStop).toHaveBeenCalled();
    });

    it('should handle stop when not started', async () => {
      await PluginManager.stop();

      expect(mockPluginStop).not.toHaveBeenCalled();
    });

    it('should clear plugin proxies on stop', async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      mockPluginRegister.mockResolvedValue({
        success: true,
        manifest: { name: 'test', version: '1.0.0', displayName: 'Test', apiVersion: '1.0.0', enabled: true },
      });

      await PluginManager.start();
      await PluginManager.registerPlugin({
        name: 'test',
        pluginPath: '/path/to/plugin',
        manifestPath: '/path/to/manifest',
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).pluginProxies.size).toBe(1);

      await PluginManager.stop();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).pluginProxies.size).toBe(0);
    });
  });

  describe('registerPlugin', () => {
    beforeEach(async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();
    });

    it('should register a plugin successfully', async () => {
      const manifest = {
        name: 'test-plugin',
        version: '1.0.0',
        displayName: 'Test Plugin',
        apiVersion: '1.0.0',
        enabled: true,
      };
      mockPluginRegister.mockResolvedValue({ success: true, manifest });

      const plugin = await PluginManager.registerPlugin({
        name: 'test-plugin',
        pluginPath: '/path/to/plugin',
        manifestPath: '/path/to/manifest',
      });

      expect(mockPluginRegister).toHaveBeenCalledWith(
        'test-plugin',
        '/path/to/plugin',
        '/path/to/manifest'
      );
      expect(plugin).toBeDefined();
      expect(plugin.manifest.name).toBe('test-plugin');
      expect(PluginManager.getPluginProxy('test-plugin')).toBe(plugin);
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin test-plugin registered',
        'Plugin Manager'
      );
    });

    it('should throw error when plugin system not started', async () => {
      await PluginManager.stop();

      await expect(
        PluginManager.registerPlugin({
          name: 'test',
          pluginPath: '/path',
          manifestPath: '/manifest',
        })
      ).rejects.toThrow('Plugin system not started');
    });

    it('should wait for start to complete before registering', async () => {
      // Reset and create a slow start
      await PluginManager.stop();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PluginManager as any).started = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PluginManager as any).startPromise = null;

      mockPluginStart.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
      );
      mockPluginRegister.mockResolvedValue({
        success: true,
        manifest: { name: 'test', version: '1.0.0', displayName: 'Test', apiVersion: '1.0.0', enabled: true },
      });

      const startPromise = PluginManager.start();
      const registerPromise = PluginManager.registerPlugin({
        name: 'test',
        pluginPath: '/path',
        manifestPath: '/manifest',
      });

      await Promise.all([startPromise, registerPromise]);

      expect(logger.info).toHaveBeenCalledWith(
        'Waiting for start to complete before registering plugin',
        'Plugin Manager'
      );
    });

    it('should throw error on registration failure', async () => {
      mockPluginRegister.mockResolvedValue({
        success: false,
        error: 'Invalid manifest',
      });

      await expect(
        PluginManager.registerPlugin({
          name: 'test',
          pluginPath: '/path',
          manifestPath: '/manifest',
        })
      ).rejects.toThrow('Invalid manifest');

      expect(logger.error).toHaveBeenCalledWith(
        'Plugin registration failed: test',
        expect.any(Error),
        'Plugin Manager'
      );
    });

    it('should throw error when manifest is missing', async () => {
      mockPluginRegister.mockResolvedValue({ success: true });

      await expect(
        PluginManager.registerPlugin({
          name: 'test',
          pluginPath: '/path',
          manifestPath: '/manifest',
        })
      ).rejects.toThrow('Failed to register plugin test');
    });

    it('should use default error message when none provided', async () => {
      mockPluginRegister.mockResolvedValue({ success: false });

      await expect(
        PluginManager.registerPlugin({
          name: 'my-plugin',
          pluginPath: '/path',
          manifestPath: '/manifest',
        })
      ).rejects.toThrow('Failed to register plugin my-plugin');
    });
  });

  describe('unregisterPlugin', () => {
    beforeEach(async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();
    });

    it('should unregister a plugin', async () => {
      mockPluginRegister.mockResolvedValue({
        success: true,
        manifest: { name: 'test', version: '1.0.0', displayName: 'Test', apiVersion: '1.0.0', enabled: true },
      });
      await PluginManager.registerPlugin({
        name: 'test',
        pluginPath: '/path',
        manifestPath: '/manifest',
      });

      await PluginManager.unregisterPlugin('test');

      expect(mockPluginUnregister).toHaveBeenCalledWith('test');
      expect(PluginManager.getPluginProxy('test')).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith('Plugin test unregistered', 'Plugin Manager');
    });

    it('should handle unregistering when not started', async () => {
      await PluginManager.stop();

      await PluginManager.unregisterPlugin('test');

      expect(mockPluginUnregister).not.toHaveBeenCalled();
    });
  });

  describe('initializePlugins', () => {
    beforeEach(async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();
    });

    it('should initialize all plugins', async () => {
      mockPluginInitializeAll.mockResolvedValue({ success: true });

      await PluginManager.initializePlugins();

      expect(mockPluginInitializeAll).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'All plugins initialized',
        'Plugin Manager'
      );
    });

    it('should throw error when plugin system not started', async () => {
      await PluginManager.stop();

      await expect(PluginManager.initializePlugins()).rejects.toThrow(
        'Plugin system not started'
      );
    });

    it('should wait for start to complete', async () => {
      // Reset and create a slow start
      await PluginManager.stop();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PluginManager as any).started = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (PluginManager as any).startPromise = null;

      mockPluginStart.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ success: true }), 50))
      );
      mockPluginInitializeAll.mockResolvedValue({ success: true });

      const startPromise = PluginManager.start();
      const initPromise = PluginManager.initializePlugins();

      await Promise.all([startPromise, initPromise]);

      expect(mockPluginInitializeAll).toHaveBeenCalled();
    });

    it('should throw error on initialization failure', async () => {
      mockPluginInitializeAll.mockResolvedValue({
        success: false,
        error: 'Plugin init failed',
      });

      await expect(PluginManager.initializePlugins()).rejects.toThrow('Plugin init failed');
    });

    it('should use default error message when none provided', async () => {
      mockPluginInitializeAll.mockResolvedValue({ success: false });

      await expect(PluginManager.initializePlugins()).rejects.toThrow(
        'Failed to initialize plugins'
      );
    });
  });

  describe('disposePlugins', () => {
    beforeEach(async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();
    });

    it('should dispose all plugins', async () => {
      mockPluginRegister.mockResolvedValue({
        success: true,
        manifest: { name: 'test', version: '1.0.0', displayName: 'Test', apiVersion: '1.0.0', enabled: true },
      });
      await PluginManager.registerPlugin({
        name: 'test',
        pluginPath: '/path',
        manifestPath: '/manifest',
      });

      await PluginManager.disposePlugins();

      expect(mockPluginDisposeAll).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((PluginManager as any).pluginProxies.size).toBe(0);
      expect(logger.info).toHaveBeenCalledWith('All plugins disposed', 'Plugin Manager');
    });

    it('should handle dispose when not started', async () => {
      await PluginManager.stop();

      await PluginManager.disposePlugins();

      expect(mockPluginDisposeAll).not.toHaveBeenCalled();
    });
  });

  describe('getPluginProxy', () => {
    beforeEach(async () => {
      mockPluginStart.mockResolvedValue({ success: true });
      await PluginManager.start();
    });

    it('should return plugin proxy by name', async () => {
      mockPluginRegister.mockResolvedValue({
        success: true,
        manifest: { name: 'test', version: '1.0.0', displayName: 'Test', apiVersion: '1.0.0', enabled: true },
      });
      const plugin = await PluginManager.registerPlugin({
        name: 'test',
        pluginPath: '/path',
        manifestPath: '/manifest',
      });

      expect(PluginManager.getPluginProxy('test')).toBe(plugin);
    });

    it('should return undefined for non-existent plugin', () => {
      expect(PluginManager.getPluginProxy('non-existent')).toBeUndefined();
    });
  });
});
