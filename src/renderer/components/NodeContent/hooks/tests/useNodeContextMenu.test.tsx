import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';
import * as pluginStore from '../../../../store/plugins/pluginStore';

describe('useNodeContextMenu', () => {
  let store: TreeStore;
  const mockDeleteNode = vi.fn();
  const mockNode: TreeNode = {
    id: 'test-node',
    content: 'Test Content',
    children: [],
    metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: { 'test-node': mockNode },
      rootNodeId: 'test-node',
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry: {
        'test-node': [],
      },
      actions: {
        deleteNode: mockDeleteNode,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
      const state = {
        plugins: [],
        enabledPlugins: [],
        registerPlugin: vi.fn(),
        unregisterPlugin: vi.fn(),
        enablePlugin: vi.fn(),
        disablePlugin: vi.fn(),
      };
      return selector ? selector(state) : state;
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should initialize with no context menu', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    expect(result.current.contextMenu).toBe(null);
  });

  it('should return contextMenuItems array', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    expect(result.current.contextMenuItems).toBeInstanceOf(Array);
    expect(result.current.contextMenuItems.length).toBeGreaterThan(0);
  });

  it('should have a Delete menu item', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const deleteItem = result.current.contextMenuItems.find(item => item.label === 'Delete');
    expect(deleteItem).toBeDefined();
    expect(deleteItem?.danger).toBe(true);
  });

  it('should set context menu position on handleContextMenu', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 200,
    } as unknown as React.MouseEvent;

    await act(async () => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });
  });

  it('should close context menu', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 200,
    } as unknown as React.MouseEvent;

    await act(async () => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.closeContextMenu();
    });

    expect(result.current.contextMenu).toBe(null);
  });

  it('should delete node without children', () => {
    mockDeleteNode.mockReturnValue(true);
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    act(() => {
      result.current.handleDelete();
    });

    expect(mockDeleteNode).toHaveBeenCalledWith('test-node');
    expect(mockDeleteNode).toHaveBeenCalledTimes(1);
  });

  it('should show confirmation for nodes with children', () => {
    mockDeleteNode.mockReturnValueOnce(false);
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    act(() => {
      result.current.handleDelete();
    });

    expect(mockDeleteNode).toHaveBeenCalledWith('test-node');
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDeleteNode).toHaveBeenCalledWith('test-node', true);
    expect(mockDeleteNode).toHaveBeenCalledTimes(2);

    mockConfirm.mockRestore();
  });

  it('should not delete if user cancels confirmation', () => {
    mockDeleteNode.mockReturnValueOnce(false);
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    act(() => {
      result.current.handleDelete();
    });

    expect(mockDeleteNode).toHaveBeenCalledWith('test-node');
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDeleteNode).toHaveBeenCalledTimes(1);

    mockConfirm.mockRestore();
  });

  describe('plugin integration', () => {
    it('should include plugin menu items before base items', async () => {
      const provideNodeContextMenuItems = vi.fn(() => [
        { id: 'plugin:action', label: 'Plugin Action' },
      ]);

      const mockPlugin = {
        manifest: { name: 'test-plugin', version: '1.0.0', displayName: 'Test', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensionPoints: {
          provideNodeContextMenuItems,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin],
          enabledPlugins: [mockPlugin],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      await act(async () => {
        result.current.handleContextMenu(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.contextMenuItems.length).toBeGreaterThan(1);
      });

      expect(result.current.contextMenuItems[0].label).toBe('Plugin Action');
      expect(result.current.contextMenuItems.find(item => item.label === 'Delete')).toBeDefined();
    });

    it('should pass hasAncestorSession=false when no ancestor has session', async () => {
      const provideNodeContextMenuItems = vi.fn(() => []);

      const mockPlugin = {
        manifest: { name: 'test-plugin', version: '1.0.0', displayName: 'Test', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensionPoints: {
          provideNodeContextMenuItems,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin],
          enabledPlugins: [mockPlugin],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      await act(async () => {
        result.current.handleContextMenu(mockEvent);
      });

      expect(provideNodeContextMenuItems).toHaveBeenCalledWith(mockNode, { hasAncestorSession: false });
    });

    it('should pass hasAncestorSession=true when ancestor has plugin metadata', async () => {
      const ancestorNode: TreeNode = {
        id: 'ancestor-node',
        content: 'Ancestor',
        children: ['test-node'],
        metadata: {
          plugins: {
            'test-plugin': { sessionId: 'session-123' },
          },
        },
      };

      store.setState({
        nodes: {
          'test-node': mockNode,
          'ancestor-node': ancestorNode,
        },
        ancestorRegistry: {
          'test-node': ['ancestor-node'],
        },
      });

      const provideNodeContextMenuItems = vi.fn(() => []);

      const mockPlugin = {
        manifest: { name: 'test-plugin', version: '1.0.0', displayName: 'Test', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensionPoints: {
          provideNodeContextMenuItems,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin],
          enabledPlugins: [mockPlugin],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      await act(async () => {
        result.current.handleContextMenu(mockEvent);
      });

      expect(provideNodeContextMenuItems).toHaveBeenCalledWith(mockNode, { hasAncestorSession: true });
    });

    it('should handle multiple plugins', async () => {
      const provideNodeContextMenuItems1 = vi.fn(() => [
        { id: 'plugin1:action1', label: 'Action 1' },
      ]);

      const provideNodeContextMenuItems2 = vi.fn(() => [
        { id: 'plugin2:action2', label: 'Action 2' },
      ]);

      const mockPlugin1 = {
        manifest: { name: 'plugin1', version: '1.0.0', displayName: 'Plugin 1', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensionPoints: {
          provideNodeContextMenuItems: provideNodeContextMenuItems1,
        },
      };

      const mockPlugin2 = {
        manifest: { name: 'plugin2', version: '1.0.0', displayName: 'Plugin 2', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensionPoints: {
          provideNodeContextMenuItems: provideNodeContextMenuItems2,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin1, mockPlugin2],
          enabledPlugins: [mockPlugin1, mockPlugin2],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const mockEvent = {
        preventDefault: vi.fn(),
        clientX: 100,
        clientY: 200,
      } as unknown as React.MouseEvent;

      await act(async () => {
        result.current.handleContextMenu(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.contextMenuItems.length).toBeGreaterThan(1);
      });

      const actionLabels = result.current.contextMenuItems.map(item => item.label);
      expect(actionLabels).toContain('Action 1');
      expect(actionLabels).toContain('Action 2');
      expect(actionLabels).toContain('Delete');
    });
  });
});
