import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ipcMain } from 'electron';
import { registerPluginIpcHandlers } from '../ipcSystemHandlers';
import { PluginWorkerConnection } from '../WorkerConnection';
import { logger } from '../../../../src/main/services/logger';
import { MessageType } from '../../worker/types/messages';

// Mock dependencies
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  app: {
    getAppPath: vi.fn(() => '/app/path'),
  },
}));

vi.mock('../WorkerConnection', () => ({
  PluginWorkerConnection: vi.fn(),
}));

vi.mock('../../../../src/main/services/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return {
    ...actual,
    resolve: vi.fn((...args: string[]) => args.join('/')),
    isAbsolute: vi.fn((p: string) => p.startsWith('/')),
  };
});

describe('ipcSystemHandlers', () => {
  let mockWorker: {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    sendMessage: ReturnType<typeof vi.fn>;
  };

  let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();

    // Create mock worker instance
    mockWorker = {
      start: vi.fn(),
      stop: vi.fn(),
      sendMessage: vi.fn(),
    };

    // Mock PluginWorkerConnection constructor
    vi.mocked(PluginWorkerConnection).mockImplementation(() => mockWorker as unknown as PluginWorkerConnection);

    // Capture IPC handlers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
      handlers.set(channel, handler);
    });

    // Register handlers - this must be done after mocking
    // to ensure the handlers capture the mocked ipcMain
    registerPluginIpcHandlers();
  });

  afterEach(async () => {
    // Stop the worker if it was started (to reset module state)
    const stopHandler = handlers.get('plugin:stop')!;
    if (stopHandler) {
      mockWorker.stop.mockResolvedValue(undefined);
      await stopHandler();
    }
  });

  describe('plugin:start', () => {
    it('should start plugin worker', async () => {
      const handler = handlers.get('plugin:start')!;
      mockWorker.start.mockResolvedValue(undefined);

      const result = await handler();

      expect(PluginWorkerConnection).toHaveBeenCalled();
      expect(mockWorker.start).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should return success if worker already started', async () => {
      const handler = handlers.get('plugin:start')!;
      mockWorker.start.mockResolvedValue(undefined);

      // Start first time
      await handler();
      vi.clearAllMocks();

      // Start second time
      const result = await handler();

      expect(PluginWorkerConnection).not.toHaveBeenCalled();
      expect(mockWorker.start).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Plugin system already started', 'Plugin IPC');
      expect(result).toEqual({ success: true });
    });

    it('should handle start errors', async () => {
      const handler = handlers.get('plugin:start')!;
      const error = new Error('Worker failed to start');
      mockWorker.start.mockRejectedValue(error);

      const result = await handler();

      expect(result).toEqual({
        success: false,
        error: 'Worker failed to start',
      });
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start plugin system',
        error,
        'Plugin IPC'
      );
    });
  });

  describe('plugin:stop', () => {
    it('should stop plugin worker', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const stopHandler = handlers.get('plugin:stop')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.stop.mockResolvedValue(undefined);

      // Start worker first
      await startHandler();

      // Then stop it
      const result = await stopHandler();

      expect(mockWorker.stop).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should return success if worker not started', async () => {
      const handler = handlers.get('plugin:stop')!;

      const result = await handler();

      expect(result).toEqual({ success: true });
    });

    it('should handle stop errors', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const stopHandler = handlers.get('plugin:stop')!;
      mockWorker.start.mockResolvedValue(undefined);
      const error = new Error('Worker failed to stop');
      mockWorker.stop.mockRejectedValue(error);

      await startHandler();
      const result = await stopHandler();

      expect(result).toEqual({
        success: false,
        error: 'Worker failed to stop',
      });
    });
  });

  describe('plugin:register', () => {
    it('should register plugin with absolute paths', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const registerHandler = handlers.get('plugin:register')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.sendMessage.mockResolvedValue({
        manifest: { name: 'test-plugin', version: '1.0.0', enabled: true, builtin: false },
      });

      await startHandler();
      const result = await registerHandler(
        {},
        'test-plugin',
        '/absolute/path/plugin',
        '/absolute/path/manifest.json'
      );

      expect(mockWorker.sendMessage).toHaveBeenCalledWith(
        MessageType.RegisterPlugin,
        {
          pluginName: 'test-plugin',
          pluginPath: '/absolute/path/plugin',
          manifestPath: '/absolute/path/manifest.json',
        }
      );
      expect(result).toEqual({
        success: true,
        manifest: { name: 'test-plugin', version: '1.0.0', enabled: true, builtin: false },
      });
    });

    it('should resolve relative paths to absolute', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const registerHandler = handlers.get('plugin:register')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.sendMessage.mockResolvedValue({
        manifest: { name: 'test-plugin', version: '1.0.0', enabled: true, builtin: false },
      });

      await startHandler();
      await registerHandler(
        {},
        'test-plugin',
        'plugins/test',
        'plugins/test/manifest.json'
      );

      expect(mockWorker.sendMessage).toHaveBeenCalledWith(
        MessageType.RegisterPlugin,
        {
          pluginName: 'test-plugin',
          pluginPath: '/app/path/plugins/test',
          manifestPath: '/app/path/plugins/test/manifest.json',
        }
      );
    });

    it('should return error if plugin system not started', async () => {
      const handler = handlers.get('plugin:register')!;

      const result = await handler({}, 'test-plugin', '/path', '/manifest');

      expect(result).toEqual({
        success: false,
        error: 'Plugin system not started',
      });
    });

    it('should handle registration errors', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const registerHandler = handlers.get('plugin:register')!;
      mockWorker.start.mockResolvedValue(undefined);
      const error = new Error('Plugin registration failed');
      mockWorker.sendMessage.mockRejectedValue(error);

      await startHandler();
      const result = await registerHandler({}, 'test-plugin', '/path', '/manifest');

      expect(result).toEqual({
        success: false,
        error: 'Plugin registration failed',
      });
    });
  });

  describe('plugin:unregister', () => {
    it('should unregister plugin', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const unregisterHandler = handlers.get('plugin:unregister')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.sendMessage.mockResolvedValue(undefined);

      await startHandler();
      const result = await unregisterHandler({}, 'test-plugin');

      expect(mockWorker.sendMessage).toHaveBeenCalledWith(
        MessageType.UnregisterPlugin,
        { pluginName: 'test-plugin' }
      );
      expect(result).toEqual({ success: true });
    });

    it('should return success if plugin system not started', async () => {
      const handler = handlers.get('plugin:unregister')!;

      const result = await handler({}, 'test-plugin');

      expect(result).toEqual({ success: true });
    });

    it('should handle unregister errors', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const unregisterHandler = handlers.get('plugin:unregister')!;
      mockWorker.start.mockResolvedValue(undefined);
      const error = new Error('Unregister failed');
      mockWorker.sendMessage.mockRejectedValue(error);

      await startHandler();
      const result = await unregisterHandler({}, 'test-plugin');

      expect(result).toEqual({
        success: false,
        error: 'Unregister failed',
      });
    });
  });

  describe('plugin:initialize-all', () => {
    it('should initialize all plugins', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const initHandler = handlers.get('plugin:initialize-all')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.sendMessage.mockResolvedValue(undefined);

      await startHandler();
      const result = await initHandler();

      expect(mockWorker.sendMessage).toHaveBeenCalledWith(
        MessageType.InitializePlugins,
        {}
      );
      expect(result).toEqual({ success: true });
    });

    it('should return error if plugin system not started', async () => {
      const handler = handlers.get('plugin:initialize-all')!;

      const result = await handler();

      expect(result).toEqual({
        success: false,
        error: 'Plugin system not started',
      });
    });

    it('should handle initialization errors', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const initHandler = handlers.get('plugin:initialize-all')!;
      mockWorker.start.mockResolvedValue(undefined);
      const error = new Error('Init failed');
      mockWorker.sendMessage.mockRejectedValue(error);

      await startHandler();
      const result = await initHandler();

      expect(result).toEqual({
        success: false,
        error: 'Init failed',
      });
    });
  });

  describe('plugin:dispose-all', () => {
    it('should dispose all plugins', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const disposeHandler = handlers.get('plugin:dispose-all')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.sendMessage.mockResolvedValue(undefined);

      await startHandler();
      const result = await disposeHandler();

      expect(mockWorker.sendMessage).toHaveBeenCalledWith(
        MessageType.DisposePlugins,
        {}
      );
      expect(result).toEqual({ success: true });
    });

    it('should return success if plugin system not started', async () => {
      const handler = handlers.get('plugin:dispose-all')!;

      const result = await handler();

      expect(result).toEqual({ success: true });
    });

    it('should handle dispose errors', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const disposeHandler = handlers.get('plugin:dispose-all')!;
      mockWorker.start.mockResolvedValue(undefined);
      const error = new Error('Dispose failed');
      mockWorker.sendMessage.mockRejectedValue(error);

      await startHandler();
      const result = await disposeHandler();

      expect(result).toEqual({
        success: false,
        error: 'Dispose failed',
      });
    });
  });

  describe('plugin:invoke-extension', () => {
    it('should invoke plugin extension point', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const invokeHandler = handlers.get('plugin:invoke-extension')!;
      mockWorker.start.mockResolvedValue(undefined);
      mockWorker.sendMessage.mockResolvedValue({
        result: [{ id: 'test:action', label: 'Test' }],
      });

      await startHandler();
      const result = await invokeHandler(
        {},
        'test-plugin',
        'provideNodeContextMenuItems',
        [{ id: '1' }, { hasAncestorSession: false }]
      );

      expect(mockWorker.sendMessage).toHaveBeenCalledWith(
        MessageType.InvokeExtension,
        {
          pluginName: 'test-plugin',
          extensionPoint: 'provideNodeContextMenuItems',
          args: [{ id: '1' }, { hasAncestorSession: false }],
        }
      );
      expect(result).toEqual({
        success: true,
        result: { result: [{ id: 'test:action', label: 'Test' }] },
      });
    });

    it('should return error if plugin system not started', async () => {
      const handler = handlers.get('plugin:invoke-extension')!;

      const result = await handler({}, 'test-plugin', 'someExtension', []);

      expect(result).toEqual({
        success: false,
        error: 'Plugin system not started',
      });
    });

    it('should handle invocation errors', async () => {
      const startHandler = handlers.get('plugin:start')!;
      const invokeHandler = handlers.get('plugin:invoke-extension')!;
      mockWorker.start.mockResolvedValue(undefined);
      const error = new Error('Extension failed');
      mockWorker.sendMessage.mockRejectedValue(error);

      await startHandler();
      const result = await invokeHandler({}, 'test-plugin', 'someExtension', []);

      expect(result).toEqual({
        success: false,
        error: 'Extension failed',
      });
    });
  });
});
