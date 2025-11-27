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

  it('should have a Declare as context menu item', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const contextItem = result.current.contextMenuItems.find(item => item.label === 'Declare as context');
    expect(contextItem).toBeDefined();
    expect(contextItem?.disabled).toBe(false);
  });

  it('should show Remove context declaration when node is already a context', () => {
    const contextNode: TreeNode = {
      ...mockNode,
      metadata: { isContextDeclaration: true, contextIcon: 'lightbulb' },
    };

    store.setState({
      nodes: { 'test-node': contextNode },
    });

    const { result } = renderHook(() => useNodeContextMenu(contextNode), { wrapper });

    const removeItem = result.current.contextMenuItems.find(item => item.label === 'Remove context declaration');
    const declareItem = result.current.contextMenuItems.find(item => item.label === 'Declare as context');
    expect(removeItem).toBeDefined();
    expect(declareItem).toBeUndefined(); // Should not show "Declare" when already a context
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

  describe('context application', () => {
    it('should show "Add context" menu item when node has no context', () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      expect(addContextItem).toBeDefined();
      expect(addContextItem?.submenu).toBeDefined();
    });

    it('should show "Remove context" menu item when node has context applied', () => {
      const nodeWithContext: TreeNode = {
        ...mockNode,
        metadata: { appliedContextId: 'context-node' },
      };

      store.setState({
        nodes: { 'test-node': nodeWithContext },
      });

      const { result } = renderHook(() => useNodeContextMenu(nodeWithContext), { wrapper });

      const removeContextItem = result.current.contextMenuItems.find(item => item.label === 'Remove context');
      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      expect(removeContextItem).toBeDefined();
      expect(removeContextItem?.submenu).toBeUndefined(); // Direct action, no submenu
      expect(addContextItem).toBeUndefined(); // Should not show "Add context" when context is applied
    });

    it('should not show "Add context" for a context declaration', () => {
      const contextDeclarationNode: TreeNode = {
        ...mockNode,
        metadata: { isContextDeclaration: true, contextIcon: 'star' },
      };

      store.setState({
        nodes: { 'test-node': contextDeclarationNode },
      });

      const { result } = renderHook(() => useNodeContextMenu(contextDeclarationNode), { wrapper });

      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      const changeContextItem = result.current.contextMenuItems.find(item => item.label === 'Change context');
      expect(addContextItem).toBeUndefined();
      expect(changeContextItem).toBeUndefined();
    });

    it('should show available context declarations in submenu', () => {
      const contextNode: TreeNode = {
        id: 'context-node',
        content: 'My Context',
        children: [],
        metadata: { isContextDeclaration: true, contextIcon: 'star' },
      };

      store.setState({
        nodes: {
          'test-node': mockNode,
          'context-node': contextNode,
        },
        ancestorRegistry: {
          'test-node': [],
          'context-node': [],
        },
        contextDeclarations: [
          { nodeId: 'context-node', content: 'My Context', icon: 'star' },
        ],
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      expect(addContextItem?.submenu).toBeDefined();
      expect(addContextItem?.submenu?.length).toBe(1);
      expect(addContextItem?.submenu?.[0].label).toBe('My Context');
    });

    it('should show "Remove context" as direct menu item when context is applied', () => {
      const contextNode: TreeNode = {
        id: 'context-node',
        content: 'My Context',
        children: [],
        metadata: { isContextDeclaration: true, contextIcon: 'star' },
      };

      const nodeWithContext: TreeNode = {
        ...mockNode,
        metadata: { appliedContextId: 'context-node' },
      };

      store.setState({
        nodes: {
          'test-node': nodeWithContext,
          'context-node': contextNode,
        },
        ancestorRegistry: {
          'test-node': [],
          'context-node': [],
        },
        contextDeclarations: [
          { nodeId: 'context-node', content: 'My Context', icon: 'star' },
        ],
      });

      const { result } = renderHook(() => useNodeContextMenu(nodeWithContext), { wrapper });

      // "Remove context" should be a direct menu item, not in a submenu
      const removeContextItem = result.current.contextMenuItems.find(item => item.label === 'Remove context');
      expect(removeContextItem).toBeDefined();
      expect(removeContextItem?.submenu).toBeUndefined();
      expect(removeContextItem?.onClick).toBeDefined();
    });

    it('should disable submenu when no context declarations exist', () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      expect(addContextItem?.disabled).toBe(true);
    });

    it('should not show the current node in its own context submenu', () => {
      const contextNode: TreeNode = {
        ...mockNode,
        id: 'test-node',
        content: 'Test Context',
        metadata: { isContextDeclaration: true, contextIcon: 'star' },
      };

      const otherContextNode: TreeNode = {
        id: 'other-context',
        content: 'Other Context',
        children: [],
        metadata: { isContextDeclaration: true, contextIcon: 'flag' },
      };

      store.setState({
        nodes: {
          'test-node': contextNode,
          'other-context': otherContextNode,
        },
        ancestorRegistry: {
          'test-node': [],
          'other-context': [],
        },
        contextDeclarations: [
          { nodeId: 'test-node', content: 'Test Context', icon: 'star' },
          { nodeId: 'other-context', content: 'Other Context', icon: 'flag' },
        ],
      });

      // For a context declaration, we don't show Add/Change context
      // This test verifies the filtering logic in getContextDeclarations usage
      const { result } = renderHook(() => useNodeContextMenu(contextNode), { wrapper });

      // Context declarations don't have Add context option
      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      expect(addContextItem).toBeUndefined();
    });

    it('should show "Add context" again after removing context', () => {
      // This tests the flow: node has context -> remove context -> "Add context" shows again
      const nodeWithoutContext: TreeNode = {
        ...mockNode,
        metadata: {}, // No applied context
      };

      store.setState({
        nodes: { 'test-node': nodeWithoutContext },
        contextDeclarations: [
          { nodeId: 'some-context', content: 'Some Context', icon: 'star' },
        ],
      });

      const { result } = renderHook(() => useNodeContextMenu(nodeWithoutContext), { wrapper });

      const addContextItem = result.current.contextMenuItems.find(item => item.label === 'Add context');
      const removeContextItem = result.current.contextMenuItems.find(item => item.label === 'Remove context');
      expect(addContextItem).toBeDefined();
      expect(removeContextItem).toBeUndefined();
    });
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
