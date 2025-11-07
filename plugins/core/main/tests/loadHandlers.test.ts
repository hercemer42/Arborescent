import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPluginHandlers } from '../loadHandlers';

vi.mock('../../../plugins.config', () => ({
  PLUGINS: [
    {
      name: 'test-plugin-1',
      pluginPath: '/path/to/plugin1',
      manifestPath: '/path/to/manifest1',
      mainHandlersPath: '/path/to/handlers1',
    },
    {
      name: 'test-plugin-2',
      pluginPath: '/path/to/plugin2',
      manifestPath: '/path/to/manifest2',
      mainHandlersPath: '/path/to/handlers2',
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegisterIpcHandlers1 = vi.fn();
    mockRegisterIpcHandlers2 = vi.fn();

    // Mock dynamic imports
    vi.doMock('/path/to/handlers1', () => ({
      registerIpcHandlers: mockRegisterIpcHandlers1,
    }));

    vi.doMock('/path/to/handlers2', () => ({
      registerIpcHandlers: mockRegisterIpcHandlers2,
    }));
  });

  it('should load handlers for plugins with mainHandlersPath', async () => {
    await loadPluginHandlers();

    expect(mockRegisterIpcHandlers1).toHaveBeenCalled();
    expect(mockRegisterIpcHandlers2).toHaveBeenCalled();
  });

  it('should skip plugins without mainHandlersPath', async () => {
    await loadPluginHandlers();

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

    await loadPluginHandlers();

    expect(callOrder).toEqual(['plugin1', 'plugin2']);
  });

  it('should propagate errors from handler registration', async () => {
    const error = new Error('Failed to register handlers');
    mockRegisterIpcHandlers1.mockImplementation(() => {
      throw error;
    });

    await expect(loadPluginHandlers()).rejects.toThrow('Failed to register handlers');
  });

  it('should handle missing registerIpcHandlers export', async () => {
    // Mock a plugin that doesn't export registerIpcHandlers
    vi.doMock('/path/to/handlers1', () => ({}));

    // Should throw when trying to call undefined function
    await expect(loadPluginHandlers()).rejects.toThrow();
  });
});
