import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';
import * as pluginStore from '../../../../store/plugins/pluginStore';

// Helper to find item in submenu
function findInSubmenu(items: { label: string; submenu?: { label: string }[] }[], parentLabel: string, childLabel: string) {
  const parent = items.find(item => item.label === parentLabel);
  return parent?.submenu?.find(sub => sub.label === childLabel);
}

// Helper to create mock event with DOM elements
function createMockContextMenuEvent(x: number, y: number) {
  const mockContentEditable = document.createElement('div');
  mockContentEditable.className = 'node-text';
  mockContentEditable.textContent = 'Test Content';

  const mockWrapper = document.createElement('div');
  mockWrapper.appendChild(mockContentEditable);

  return {
    preventDefault: vi.fn(),
    clientX: x,
    clientY: y,
    currentTarget: mockWrapper,
  } as unknown as React.MouseEvent;
}

describe('useNodeContextMenu', () => {
  let store: TreeStore;
  const mockDeleteNode = vi.fn();
  const mockCopyNodes = vi.fn();
  const mockCutNodes = vi.fn();
  const mockPasteNodes = vi.fn();
  const mockToggleNodeSelection = vi.fn();
  const mockSelectNode = vi.fn();
  const mockClearSelection = vi.fn();
  const mockSetRememberedVisualX = vi.fn();

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
        copyNodes: mockCopyNodes,
        cutNodes: mockCutNodes,
        pasteNodes: mockPasteNodes,
        toggleNodeSelection: mockToggleNodeSelection,
        selectNode: mockSelectNode,
        clearSelection: mockClearSelection,
        setRememberedVisualX: mockSetRememberedVisualX,
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

  it('should have Edit submenu with Delete item', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
    expect(editMenu).toBeDefined();
    expect(editMenu?.submenu).toBeDefined();

    const deleteItem = editMenu?.submenu?.find(item => item.label === 'Delete');
    expect(deleteItem).toBeDefined();
    expect(deleteItem?.danger).toBe(true);
  });

  it('should have Edit submenu with Select, Copy, Cut, Paste items', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
    expect(editMenu?.submenu?.find(item => item.label === 'Select')).toBeDefined();
    expect(editMenu?.submenu?.find(item => item.label === 'Copy')).toBeDefined();
    expect(editMenu?.submenu?.find(item => item.label === 'Cut')).toBeDefined();
    expect(editMenu?.submenu?.find(item => item.label === 'Paste')).toBeDefined();
  });

  it('should have Context submenu with Declare as context', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const contextMenu = result.current.contextMenuItems.find(item => item.label === 'Context');
    expect(contextMenu).toBeDefined();

    const declareItem = contextMenu?.submenu?.find(item => item.label === 'Declare as context');
    expect(declareItem).toBeDefined();
  });

  it('should show Remove context declaration in Context submenu when node is a context', () => {
    const contextNode: TreeNode = {
      ...mockNode,
      metadata: { isContextDeclaration: true, contextIcon: 'lightbulb' },
    };

    store.setState({
      nodes: { 'test-node': contextNode },
    });

    const { result } = renderHook(() => useNodeContextMenu(contextNode), { wrapper });

    const contextMenu = result.current.contextMenuItems.find(item => item.label === 'Context');
    const removeItem = contextMenu?.submenu?.find(item => item.label === 'Remove context declaration');
    const declareItem = contextMenu?.submenu?.find(item => item.label === 'Declare as context');
    expect(removeItem).toBeDefined();
    expect(declareItem).toBeUndefined();
  });

  it('should set context menu position on handleContextMenu', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = createMockContextMenuEvent(100, 200);

    await act(async () => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });
  });

  it('should focus node when right-clicking', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = createMockContextMenuEvent(100, 200);

    await act(async () => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(mockClearSelection).toHaveBeenCalled();
    expect(mockSetRememberedVisualX).toHaveBeenCalledWith(null);
    expect(mockSelectNode).toHaveBeenCalled();
  });

  it('should close context menu', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = createMockContextMenuEvent(100, 200);

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

  it('should have Collaborate submenu with In browser and In terminal options', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const collaborateMenu = result.current.contextMenuItems.find(item => item.label === 'Collaborate');
    expect(collaborateMenu).toBeDefined();
    expect(collaborateMenu?.submenu?.find(item => item.label === 'In browser')).toBeDefined();
    expect(collaborateMenu?.submenu?.find(item => item.label === 'In terminal')).toBeDefined();
  });

  it('should have correct menu order: Execute, Collaborate, Context, Edit, Copy to Clipboard', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const labels = result.current.contextMenuItems.map(item => item.label);
    const executeIndex = labels.indexOf('Execute');
    const collaborateIndex = labels.indexOf('Collaborate');
    const contextIndex = labels.indexOf('Context');
    const editIndex = labels.indexOf('Edit');
    const copyIndex = labels.indexOf('Copy to Clipboard');

    expect(executeIndex).toBeLessThan(collaborateIndex);
    expect(collaborateIndex).toBeLessThan(contextIndex);
    expect(contextIndex).toBeLessThan(editIndex);
    expect(editIndex).toBeLessThan(copyIndex);
  });

  describe('context application', () => {
    it('should show "Apply context" in Context submenu when node has no context', () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const applyContextItem = findInSubmenu(result.current.contextMenuItems, 'Context', 'Apply context');
      expect(applyContextItem).toBeDefined();
    });

    it('should show "Remove context" in Context submenu when node has context applied', () => {
      const nodeWithContext: TreeNode = {
        ...mockNode,
        metadata: { appliedContextIds: ['context-node'] },
      };

      store.setState({
        nodes: { 'test-node': nodeWithContext },
      });

      const { result } = renderHook(() => useNodeContextMenu(nodeWithContext), { wrapper });

      const removeContextItem = findInSubmenu(result.current.contextMenuItems, 'Context', 'Remove context');
      expect(removeContextItem).toBeDefined();
    });

    it('should show "Apply context" in Context submenu for a context declaration (for bundling)', () => {
      const contextDeclarationNode: TreeNode = {
        ...mockNode,
        metadata: { isContextDeclaration: true, contextIcon: 'star' },
      };
      const otherContextNode: TreeNode = {
        id: 'other-context',
        content: 'Other Context',
        children: [],
        metadata: { isContextDeclaration: true, contextIcon: 'flag' },
      };

      store.setState({
        nodes: { 'test-node': contextDeclarationNode, 'other-context': otherContextNode },
        contextDeclarations: [
          { nodeId: 'test-node', content: 'Test', icon: 'star' },
          { nodeId: 'other-context', content: 'Other Context', icon: 'flag' },
        ],
      });

      const { result } = renderHook(() => useNodeContextMenu(contextDeclarationNode), { wrapper });

      const applyContextItem = findInSubmenu(result.current.contextMenuItems, 'Context', 'Apply context');
      expect(applyContextItem).toBeDefined();
    });

    it('should show available context declarations in Apply context submenu', () => {
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

      const contextMenu = result.current.contextMenuItems.find(item => item.label === 'Context');
      const applyContextItem = contextMenu?.submenu?.find(item => item.label === 'Apply context');
      expect(applyContextItem?.submenu).toBeDefined();
      expect(applyContextItem?.submenu?.length).toBe(1);
      expect(applyContextItem?.submenu?.[0].label).toBe('My Context');
    });

    it('should disable Apply context when no context declarations exist', () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const contextMenu = result.current.contextMenuItems.find(item => item.label === 'Context');
      const applyContextItem = contextMenu?.submenu?.find(item => item.label === 'Apply context');
      expect(applyContextItem?.disabled).toBe(true);
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

      const mockEvent = createMockContextMenuEvent(100, 200);

      await act(async () => {
        result.current.handleContextMenu(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.contextMenuItems.length).toBeGreaterThan(1);
      });

      expect(result.current.contextMenuItems[0].label).toBe('Plugin Action');
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

      const mockEvent = createMockContextMenuEvent(100, 200);

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

      const mockEvent = createMockContextMenuEvent(100, 200);

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

      const mockEvent = createMockContextMenuEvent(100, 200);

      await act(async () => {
        result.current.handleContextMenu(mockEvent);
      });

      await waitFor(() => {
        expect(result.current.contextMenuItems.length).toBeGreaterThan(1);
      });

      const actionLabels = result.current.contextMenuItems.map(item => item.label);
      expect(actionLabels).toContain('Action 1');
      expect(actionLabels).toContain('Action 2');
    });
  });
});
