import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginProxy } from '../Proxy';
import { PluginManifest, PluginContextMenuItem } from '../../shared/interface';
import { TreeNode } from '../../../../src/shared/types';
import { logger } from '../../../../src/renderer/services/logger';

vi.mock('../../../../src/renderer/services/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('PluginProxy', () => {
  const mockManifest: PluginManifest = {
    name: 'test-plugin',
    version: '1.0.0',
    displayName: 'Test Plugin',
    apiVersion: '1.0.0',
    enabled: true,
    builtin: false,
  };

  const mockNode: TreeNode = {
    id: '1',
    content: 'Test Node',
    children: [],
    metadata: {},
  };

  let mockPluginInvokeExtension: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPluginInvokeExtension = vi.fn();

    // Mock window.electron
    global.window = {
      electron: {
        pluginInvokeExtension: mockPluginInvokeExtension,
      } as unknown as Window['electron'],
    } as Window & typeof globalThis;
  });

  describe('constructor', () => {
    it('should store manifest and plugin name', () => {
      const proxy = new PluginProxy('test-plugin', mockManifest);

      expect(proxy.manifest).toBe(mockManifest);
      expect(proxy['pluginName']).toBe('test-plugin');
    });

    it('should bind extension points', () => {
      const proxy = new PluginProxy('test-plugin', mockManifest);

      expect(proxy.extensionPoints.provideNodeContextMenuItems).toBeDefined();
      expect(proxy.extensionPoints.provideNodeIndicator).toBeDefined();
      expect(typeof proxy.extensionPoints.provideNodeContextMenuItems).toBe('function');
      expect(typeof proxy.extensionPoints.provideNodeIndicator).toBe('function');
    });
  });

  describe('initialize', () => {
    it('should be a no-op', async () => {
      const proxy = new PluginProxy('test-plugin', mockManifest);

      await expect(proxy.initialize()).resolves.toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should be a no-op', () => {
      const proxy = new PluginProxy('test-plugin', mockManifest);

      expect(() => proxy.dispose()).not.toThrow();
    });
  });

  describe('provideNodeContextMenuItems', () => {
    it('should forward call to worker and return result', async () => {
      const mockItems: PluginContextMenuItem[] = [
        { id: 'test:action', label: 'Test Action' },
      ];
      mockPluginInvokeExtension.mockResolvedValue({
        success: true,
        result: { result: mockItems },
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const context = { hasAncestorSession: false };
      const result = await proxy.provideNodeContextMenuItems(mockNode, context);

      expect(result).toEqual(mockItems);
      expect(mockPluginInvokeExtension).toHaveBeenCalledWith(
        'test-plugin',
        'provideNodeContextMenuItems',
        [mockNode, context]
      );
    });

    it('should return empty array when plugin system not started', async () => {
      mockPluginInvokeExtension.mockResolvedValue({
        success: false,
        error: 'Plugin system not started',
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeContextMenuItems(mockNode, { hasAncestorSession: false });

      expect(result).toEqual([]);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log error and return empty array on failure', async () => {
      mockPluginInvokeExtension.mockResolvedValue({
        success: false,
        error: 'Plugin failed',
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeContextMenuItems(mockNode, { hasAncestorSession: false });

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Error invoking provideNodeContextMenuItems for test-plugin: Plugin failed',
        undefined,
        'Plugin Proxy'
      );
    });

    it('should catch and log exceptions', async () => {
      const error = new Error('IPC error');
      mockPluginInvokeExtension.mockRejectedValue(error);

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeContextMenuItems(mockNode, { hasAncestorSession: false });

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Error invoking provideNodeContextMenuItems for test-plugin',
        error,
        'Plugin Proxy'
      );
    });

    it('should handle missing result field', async () => {
      mockPluginInvokeExtension.mockResolvedValue({
        success: true,
        result: {},
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeContextMenuItems(mockNode, { hasAncestorSession: false });

      expect(result).toEqual([]);
    });
  });

  describe('provideNodeIndicator', () => {
    it('should forward call to worker and return result', async () => {
      const mockIndicator = { text: 'Test', color: 'blue' };
      mockPluginInvokeExtension.mockResolvedValue({
        success: true,
        result: { result: mockIndicator },
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeIndicator(mockNode);

      expect(result).toEqual(mockIndicator);
      expect(mockPluginInvokeExtension).toHaveBeenCalledWith(
        'test-plugin',
        'provideNodeIndicator',
        [mockNode]
      );
    });

    it('should return null when plugin system not started', async () => {
      mockPluginInvokeExtension.mockResolvedValue({
        success: false,
        error: 'Plugin system not started',
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeIndicator(mockNode);

      expect(result).toBeNull();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should log error and return null on failure', async () => {
      mockPluginInvokeExtension.mockResolvedValue({
        success: false,
        error: 'Plugin failed',
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeIndicator(mockNode);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error invoking provideNodeIndicator for test-plugin: Plugin failed',
        undefined,
        'Plugin Proxy'
      );
    });

    it('should catch and log exceptions', async () => {
      const error = new Error('IPC error');
      mockPluginInvokeExtension.mockRejectedValue(error);

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeIndicator(mockNode);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(
        'Error invoking provideNodeIndicator for test-plugin',
        error,
        'Plugin Proxy'
      );
    });

    it('should handle missing result field', async () => {
      mockPluginInvokeExtension.mockResolvedValue({
        success: true,
        result: {},
      });

      const proxy = new PluginProxy('test-plugin', mockManifest);
      const result = await proxy.provideNodeIndicator(mockNode);

      expect(result).toBeNull();
    });
  });
});
