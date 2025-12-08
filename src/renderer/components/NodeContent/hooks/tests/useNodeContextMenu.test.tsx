import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';
import * as pluginStore from '../../../../store/plugins/pluginStore';
import * as spellcheck from '../../../../services/spellcheck';

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

  // Helper to open context menu and wait for items to be populated
  async function openContextMenu(result: { current: ReturnType<typeof useNodeContextMenu> }) {
    const mockEvent = createMockContextMenuEvent(100, 200);
    await act(async () => {
      await result.current.handleContextMenu(mockEvent);
    });
  }

  it('should initialize with no context menu', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    expect(result.current.contextMenu).toBe(null);
  });

  it('should return empty contextMenuItems array before menu is opened', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    expect(result.current.contextMenuItems).toBeInstanceOf(Array);
    expect(result.current.contextMenuItems.length).toBe(0);
  });

  it('should populate contextMenuItems after handleContextMenu', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    expect(result.current.contextMenuItems.length).toBeGreaterThan(0);
  });

  it('should have Edit submenu with Delete item', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
    expect(editMenu).toBeDefined();
    expect(editMenu?.submenu).toBeDefined();

    const deleteItem = editMenu?.submenu?.find(item => item.label === 'Delete');
    expect(deleteItem).toBeDefined();
    expect(deleteItem?.danger).toBe(true);
  });

  it('should have Edit submenu with Select, Copy, Cut, Paste items', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
    expect(editMenu?.submenu?.find(item => item.label === 'Select')).toBeDefined();
    expect(editMenu?.submenu?.find(item => item.label === 'Copy')).toBeDefined();
    expect(editMenu?.submenu?.find(item => item.label === 'Cut')).toBeDefined();
    expect(editMenu?.submenu?.find(item => item.label === 'Paste')).toBeDefined();
  });

  it('should have Blueprint submenu with Declare as Context when parent is blueprint', async () => {
    // Set up a tree where test-node has a blueprint parent
    const parentNode: TreeNode = {
      id: 'parent-node',
      content: 'Parent',
      children: ['test-node'],
      metadata: { isBlueprint: true },
    };

    store.setState({
      nodes: { 'parent-node': parentNode, 'test-node': mockNode },
      rootNodeId: 'parent-node',
      ancestorRegistry: {
        'parent-node': [],
        'test-node': ['parent-node'],
      },
    });

    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    const blueprintMenu = result.current.contextMenuItems.find(item => item.label === 'Blueprint');
    expect(blueprintMenu).toBeDefined();

    const declareItem = blueprintMenu?.submenu?.find(item => item.label === 'Declare as Context');
    expect(declareItem).toBeDefined();
  });

  it('should not show Declare as Context in Blueprint menu when parent is not a blueprint', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    // Blueprint menu should exist (for Add to Blueprint) but not have Declare as Context
    const blueprintMenu = result.current.contextMenuItems.find(item => item.label === 'Blueprint');
    expect(blueprintMenu).toBeDefined();
    const declareItem = blueprintMenu?.submenu?.find(item => item.label === 'Declare as Context');
    expect(declareItem).toBeUndefined();
  });

  it('should show Remove Context Declaration in Blueprint submenu when node is a context', async () => {
    const contextNode: TreeNode = {
      ...mockNode,
      metadata: { isContextDeclaration: true, contextIcon: 'lightbulb' },
    };

    store.setState({
      nodes: { 'test-node': contextNode },
    });

    const { result } = renderHook(() => useNodeContextMenu(contextNode), { wrapper });

    await openContextMenu(result);

    const blueprintMenu = result.current.contextMenuItems.find(item => item.label === 'Blueprint');
    const removeItem = blueprintMenu?.submenu?.find(item => item.label === 'Remove Context Declaration');
    const declareItem = blueprintMenu?.submenu?.find(item => item.label === 'Declare as Context');
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

  it('should have Collaborate submenu with In browser and In terminal options', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    const collaborateMenu = result.current.contextMenuItems.find(item => item.label === 'Collaborate');
    expect(collaborateMenu).toBeDefined();
    expect(collaborateMenu?.submenu?.find(item => item.label === 'In browser')).toBeDefined();
    expect(collaborateMenu?.submenu?.find(item => item.label === 'In terminal')).toBeDefined();
  });

  it('should have correct menu order: Execute, Collaborate, Edit, Copy to Clipboard', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    const labels = result.current.contextMenuItems.map(item => item.label);
    const executeIndex = labels.indexOf('Execute');
    const collaborateIndex = labels.indexOf('Collaborate');
    const editIndex = labels.indexOf('Edit');
    const copyIndex = labels.indexOf('Copy to Clipboard');

    expect(executeIndex).toBeLessThan(collaborateIndex);
    expect(collaborateIndex).toBeLessThan(editIndex);
    expect(editIndex).toBeLessThan(copyIndex);
  });

  describe('context selection in execute/collaborate', () => {
    it('should show available contexts in Execute submenu', async () => {
      const contextNode: TreeNode = {
        id: 'context-node',
        content: 'My Context',
        children: [],
        metadata: { isContextDeclaration: true, blueprintIcon: 'star' },
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

      await openContextMenu(result);

      const executeMenu = result.current.contextMenuItems.find(item => item.label === 'Execute');
      // Should have base actions + separator + heading + context
      expect(executeMenu?.submenu?.length).toBeGreaterThan(2);
      expect(executeMenu?.submenu?.find(item => item.label === 'Available contexts')).toBeDefined();
      expect(executeMenu?.submenu?.find(item => item.label === 'My Context')).toBeDefined();
    });

    it('should show available contexts in Collaborate submenu', async () => {
      const contextNode: TreeNode = {
        id: 'context-node',
        content: 'My Context',
        children: [],
        metadata: { isContextDeclaration: true, blueprintIcon: 'star' },
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

      await openContextMenu(result);

      const collaborateMenu = result.current.contextMenuItems.find(item => item.label === 'Collaborate');
      // Should have base actions + separator + heading + context
      expect(collaborateMenu?.submenu?.length).toBeGreaterThan(2);
      expect(collaborateMenu?.submenu?.find(item => item.label === 'Available contexts')).toBeDefined();
      expect(collaborateMenu?.submenu?.find(item => item.label === 'My Context')).toBeDefined();
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

  describe('spellcheck integration', () => {
    beforeEach(() => {
      // Mock window.getSelection
      vi.spyOn(window, 'getSelection').mockReturnValue(null);
    });

    it('should show full context menu when no word is selected', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      // Should have normal menu items
      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

    it('should show full context menu when word is spelled correctly', async () => {
      // Mock selection with a correctly spelled word
      const mockTextNode = document.createTextNode('hello world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 2, // In the middle of 'hello'
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({ misspelled: false, suggestions: [] });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      // Should have normal menu items
      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

    it('should show only spell suggestions when word is misspelled', async () => {
      // Mock selection with a misspelled word
      const mockTextNode = document.createTextNode('helllo world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 3, // In the middle of 'helllo'
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: ['hello', 'hallo'],
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      // Should ONLY have spell suggestions
      expect(result.current.contextMenuItems.length).toBe(2);
      expect(result.current.contextMenuItems[0].label).toBe('hello');
      expect(result.current.contextMenuItems[1].label).toBe('hallo');

      // Should NOT have normal menu items
      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeUndefined();
    });

    it('should show "No suggestions" when misspelled word has no suggestions', async () => {
      const mockTextNode = document.createTextNode('xyzabc');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 3,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: [],
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      expect(result.current.contextMenuItems.length).toBe(1);
      expect(result.current.contextMenuItems[0].label).toBe('No suggestions');
      expect(result.current.contextMenuItems[0].disabled).toBe(true);
    });

    it('should replace misspelled word when suggestion is clicked', async () => {
      const mockTextNode = document.createTextNode('helllo world');
      const mockRange = {
        startContainer: mockTextNode,
        startOffset: 3,
      };
      vi.spyOn(window, 'getSelection').mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => mockRange,
      } as unknown as Selection);

      vi.spyOn(spellcheck, 'checkWord').mockReturnValue({
        misspelled: true,
        suggestions: ['hello'],
      });

      // Create a parent element to receive the input event
      const parent = document.createElement('div');
      parent.appendChild(mockTextNode);
      const dispatchSpy = vi.spyOn(parent, 'dispatchEvent');

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      // Click the suggestion
      act(() => {
        result.current.contextMenuItems[0].onClick?.();
      });

      // Check that the text was replaced
      expect(mockTextNode.textContent).toBe('hello world');
      expect(dispatchSpy).toHaveBeenCalled();
    });
  });
});
