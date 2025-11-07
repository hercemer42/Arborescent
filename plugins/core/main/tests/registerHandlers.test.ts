import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerPluginHandlers } from '../registerHandlers';
import { registerPluginIpcHandlers } from '../ipcSystemHandlers';
import { loadPluginHandlers } from '../loadHandlers';

vi.mock('../ipcSystemHandlers', () => ({
  registerPluginIpcHandlers: vi.fn(),
}));

vi.mock('../loadHandlers', () => ({
  loadPluginHandlers: vi.fn(),
}));

describe('registerPluginHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call registerPluginIpcHandlers', async () => {
    vi.mocked(loadPluginHandlers).mockResolvedValue(undefined);

    await registerPluginHandlers();

    expect(registerPluginIpcHandlers).toHaveBeenCalled();
  });

  it('should call loadPluginHandlers', async () => {
    vi.mocked(loadPluginHandlers).mockResolvedValue(undefined);

    await registerPluginHandlers();

    expect(loadPluginHandlers).toHaveBeenCalled();
  });

  it('should call registerPluginIpcHandlers before loadPluginHandlers', async () => {
    const callOrder: string[] = [];

    vi.mocked(registerPluginIpcHandlers).mockImplementation(() => {
      callOrder.push('system');
    });
    vi.mocked(loadPluginHandlers).mockImplementation(async () => {
      callOrder.push('plugin');
    });

    await registerPluginHandlers();

    expect(callOrder).toEqual(['system', 'plugin']);
  });

  it('should propagate errors from registerPluginIpcHandlers', async () => {
    const error = new Error('Failed to register system handlers');
    vi.mocked(registerPluginIpcHandlers).mockImplementation(() => {
      throw error;
    });

    await expect(registerPluginHandlers()).rejects.toThrow('Failed to register system handlers');
  });

  it('should propagate errors from loadPluginHandlers', async () => {
    const error = new Error('Failed to load plugin handlers');
    vi.mocked(registerPluginIpcHandlers).mockImplementation(() => {
      // Don't throw, allow loadPluginHandlers to be called
    });
    vi.mocked(loadPluginHandlers).mockRejectedValue(error);

    await expect(registerPluginHandlers()).rejects.toThrow('Failed to load plugin handlers');
  });
});
