import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPluginHandlers, LoadHandlersDeps } from '../loadHandlers';

// Mock the plugins config
vi.mock('../../../plugins.config', () => ({
  PLUGINS: [
    {
      name: 'test-plugin-1',
      pluginPath: '/path/to/plugin1',
      manifestPath: '/path/to/manifest1',
      mainHandlersPath: 'plugins/plugin1/handlers.cjs',
    },
    {
      name: 'test-plugin-2',
      pluginPath: '/path/to/plugin2',
      manifestPath: '/path/to/manifest2',
      mainHandlersPath: 'plugins/plugin2/handlers.cjs',
    },
    {
      name: 'test-plugin-3',
      pluginPath: '/path/to/plugin3',
      manifestPath: '/path/to/manifest3',
      // No mainHandlersPath - should skip this plugin
    },
  ],
}));

describe('loadPluginHandlers', () => {
  let mockRegisterIpcHandlers1: ReturnType<typeof vi.fn>;
  let mockRegisterIpcHandlers2: ReturnType<typeof vi.fn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let mockDeps: LoadHandlersDeps;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRegisterIpcHandlers1 = vi.fn();
    mockRegisterIpcHandlers2 = vi.fn();

    // Create mock dependencies
    mockDeps = {
      getAppPath: vi.fn(() => '/app'),
      requireModule: vi.fn((modulePath: string) => {
        if (modulePath === '/app/plugins/plugin1/handlers.cjs') {
          return { registerIpcHandlers: mockRegisterIpcHandlers1 };
        }
        if (modulePath === '/app/plugins/plugin2/handlers.cjs') {
          return { registerIpcHandlers: mockRegisterIpcHandlers2 };
        }
        throw new Error(`Module not found: ${modulePath}`);
      }),
    };

    // Suppress console output during tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should load handlers for plugins with mainHandlersPath', async () => {
    await loadPluginHandlers(mockDeps);

    expect(mockRegisterIpcHandlers1).toHaveBeenCalled();
    expect(mockRegisterIpcHandlers2).toHaveBeenCalled();
  });

  it('should skip plugins without mainHandlersPath', async () => {
    await loadPluginHandlers(mockDeps);

    // Only plugins 1 and 2 should have been called (plugin 3 has no mainHandlersPath)
    expect(mockRegisterIpcHandlers1).toHaveBeenCalledTimes(1);
    expect(mockRegisterIpcHandlers2).toHaveBeenCalledTimes(1);
  });

  it('should load handlers in order', async () => {
    const callOrder: string[] = [];

    mockRegisterIpcHandlers1.mockImplementation(() => {
      callOrder.push('plugin1');
    });
    mockRegisterIpcHandlers2.mockImplementation(() => {
      callOrder.push('plugin2');
    });

    await loadPluginHandlers(mockDeps);

    expect(callOrder).toEqual(['plugin1', 'plugin2']);
  });

  it('should catch and log errors from handler registration', async () => {
    mockRegisterIpcHandlers1.mockImplementation(() => {
      throw new Error('Failed to register handlers');
    });

    // Should NOT throw - implementation catches errors
    await expect(loadPluginHandlers(mockDeps)).resolves.not.toThrow();

    // Should log the error
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Plugin Handlers] Failed to load handlers for test-plugin-1'),
      expect.any(Error)
    );
  });

  it('should warn and continue when registerIpcHandlers export is missing', async () => {
    // Mock a plugin that doesn't export registerIpcHandlers
    mockDeps.requireModule = vi.fn((modulePath: string) => {
      if (modulePath === '/app/plugins/plugin1/handlers.cjs') {
        return {}; // No registerIpcHandlers export
      }
      if (modulePath === '/app/plugins/plugin2/handlers.cjs') {
        return { registerIpcHandlers: mockRegisterIpcHandlers2 };
      }
      throw new Error(`Module not found: ${modulePath}`);
    });

    // Should NOT throw - implementation handles gracefully
    await expect(loadPluginHandlers(mockDeps)).resolves.not.toThrow();

    // Should warn about missing export
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Plugin Handlers] No registerIpcHandlers found in: test-plugin-1')
    );

    // But plugin 2 should still work
    expect(mockRegisterIpcHandlers2).toHaveBeenCalled();
  });

  it('should log success message when handlers are loaded', async () => {
    await loadPluginHandlers(mockDeps);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Plugin Handlers] Loaded handlers for: test-plugin-1'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Plugin Handlers] Loaded handlers for: test-plugin-2'
    );
  });

  it('should handle default export with registerIpcHandlers', async () => {
    const mockDefaultRegister = vi.fn();
    mockDeps.requireModule = vi.fn((modulePath: string) => {
      if (modulePath === '/app/plugins/plugin1/handlers.cjs') {
        return { default: { registerIpcHandlers: mockDefaultRegister } };
      }
      if (modulePath === '/app/plugins/plugin2/handlers.cjs') {
        return { registerIpcHandlers: mockRegisterIpcHandlers2 };
      }
      throw new Error(`Module not found: ${modulePath}`);
    });

    await loadPluginHandlers(mockDeps);

    expect(mockDefaultRegister).toHaveBeenCalled();
    expect(mockRegisterIpcHandlers2).toHaveBeenCalled();
  });
});
