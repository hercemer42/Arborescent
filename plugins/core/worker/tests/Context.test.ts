import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginContext } from '../Context';
import { PluginAPI } from '../API';

// Mock PluginAPI
vi.mock('../API');

describe('PluginContext', () => {
  let mockPluginAPI: PluginAPI;
  let context: PluginContext;

  beforeEach(() => {
    mockPluginAPI = {
      invokeIPC: vi.fn(),
    } as unknown as PluginAPI;

    context = new PluginContext(mockPluginAPI);
  });

  describe('invokeIPC', () => {
    it('should delegate to pluginAPI.invokeIPC', async () => {
      vi.mocked(mockPluginAPI.invokeIPC).mockResolvedValue('test-result');

      const result = await context.invokeIPC('test-channel', 'arg1', 'arg2');

      expect(mockPluginAPI.invokeIPC).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
      expect(result).toBe('test-result');
    });

    it('should handle no arguments', async () => {
      vi.mocked(mockPluginAPI.invokeIPC).mockResolvedValue('result');

      const result = await context.invokeIPC('channel');

      expect(mockPluginAPI.invokeIPC).toHaveBeenCalledWith('channel');
      expect(result).toBe('result');
    });

    it('should handle multiple arguments', async () => {
      vi.mocked(mockPluginAPI.invokeIPC).mockResolvedValue('result');

      await context.invokeIPC('channel', 1, 'two', { three: 3 }, [4]);

      expect(mockPluginAPI.invokeIPC).toHaveBeenCalledWith('channel', 1, 'two', { three: 3 }, [4]);
    });

    it('should return typed result', async () => {
      interface TestData {
        id: number;
        name: string;
      }

      vi.mocked(mockPluginAPI.invokeIPC).mockResolvedValue({ id: 1, name: 'test' });

      const result = await context.invokeIPC<TestData>('get-data');

      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
    });

    it('should propagate errors from pluginAPI', async () => {
      const error = new Error('IPC error');
      vi.mocked(mockPluginAPI.invokeIPC).mockRejectedValue(error);

      await expect(context.invokeIPC('channel')).rejects.toThrow('IPC error');
    });

    it('should handle null/undefined arguments', async () => {
      vi.mocked(mockPluginAPI.invokeIPC).mockResolvedValue('result');

      await context.invokeIPC('channel', null, undefined);

      expect(mockPluginAPI.invokeIPC).toHaveBeenCalledWith('channel', null, undefined);
    });
  });
});
