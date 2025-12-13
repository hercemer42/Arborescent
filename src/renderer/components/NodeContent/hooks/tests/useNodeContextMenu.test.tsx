import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';
import { useSpellcheckStore } from '../../../../store/spellcheck/spellcheckStore';

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

  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  // Helper to open context menu and wait for items to be populated
  async function openContextMenu(result: { current: ReturnType<typeof useNodeContextMenu> }) {
    vi.useFakeTimers();
    const mockEvent = createMockContextMenuEvent(100, 200);
    await act(async () => {
      result.current.handleContextMenu(mockEvent);
      await vi.advanceTimersByTimeAsync(550);
    });
    vi.useRealTimers();
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
    vi.useFakeTimers();
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = createMockContextMenuEvent(100, 200);

    await act(async () => {
      result.current.handleContextMenu(mockEvent);
      // Advance timers to allow waitForSpellcheckUpdate to timeout
      await vi.advanceTimersByTimeAsync(550);
    });

    // Note: preventDefault is NOT called - we let Electron handle it
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });
    vi.useRealTimers();
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
    vi.useFakeTimers();
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = createMockContextMenuEvent(100, 200);

    await act(async () => {
      result.current.handleContextMenu(mockEvent);
      await vi.advanceTimersByTimeAsync(550);
    });

    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.closeContextMenu();
    });

    expect(result.current.contextMenu).toBe(null);
    vi.useRealTimers();
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

  it('should have correct menu order: Execute, Collaborate, Edit', async () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    await openContextMenu(result);

    const labels = result.current.contextMenuItems.map(item => item.label);
    const executeIndex = labels.indexOf('Execute');
    const collaborateIndex = labels.indexOf('Collaborate');
    const editIndex = labels.indexOf('Edit');

    expect(executeIndex).toBeLessThan(collaborateIndex);
    expect(collaborateIndex).toBeLessThan(editIndex);
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

  describe('spellcheck integration', () => {
    function mockCaretRangeFromPoint(range: Range | null) {
      Object.defineProperty(document, 'caretRangeFromPoint', {
        value: vi.fn().mockReturnValue(range),
        writable: true,
        configurable: true,
      });
    }

    function createMockRange(textNode: Text, offset: number): Range {
      const range = document.createRange();
      range.setStart(textNode, offset);
      range.collapse(true);
      return range;
    }

    beforeEach(() => {
      vi.useFakeTimers();
      mockCaretRangeFromPoint(null);
      useSpellcheckStore.getState().clear();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function openContextMenuWithTimers(result: { current: ReturnType<typeof useNodeContextMenu> }) {
      const mockEvent = createMockContextMenuEvent(100, 200);
      await act(async () => {
        result.current.handleContextMenu(mockEvent);
        await vi.advanceTimersByTimeAsync(550);
      });
    }

    it('should show full context menu when no word is selected', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenuWithTimers(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

    it('should show full context menu when no misspelled word in store', async () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 2);
      mockCaretRangeFromPoint(range);

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenuWithTimers(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

    it('should show spell suggestions and regular menu items when word is misspelled', async () => {
      const mockTextNode = document.createTextNode('helllo world');
      const range = createMockRange(mockTextNode, 3);
      mockCaretRangeFromPoint(range);

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const mockEvent = createMockContextMenuEvent(100, 200);
      await act(async () => {
        // Start context menu (this clears store and starts waiting)
        const menuPromise = result.current.handleContextMenu(mockEvent);

        // Simulate Electron IPC arriving after a short delay with spell suggestions
        await vi.advanceTimersByTimeAsync(50);
        useSpellcheckStore.getState().setSuggestions('helllo', ['hello', 'hallo']);

        // Let the wait complete
        await vi.advanceTimersByTimeAsync(500);
        await menuPromise;
      });

      const firstLabel = result.current.contextMenuItems[0].label;
      expect(['hello', 'hallo']).toContain(firstLabel);

      const separatorIndex = result.current.contextMenuItems.findIndex(item => item.separator);
      expect(separatorIndex).toBeGreaterThan(0);

      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

  });

  describe('feedback tree menu', () => {
    beforeEach(() => {
      store.setState({
        treeType: 'feedback',
      });
    });

    it('should only show Edit submenu in feedback tree', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      // Should have Edit submenu
      const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
      expect(editMenu).toBeDefined();

      // Should NOT have Execute, Collaborate, Blueprint, Status, Zoom
      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Collaborate')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Blueprint')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Status')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Zoom')).toBeUndefined();
    });

    it('should have Select, Copy, Cut, Paste, Delete in feedback Edit submenu', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
      expect(editMenu?.submenu?.find(item => item.label === 'Select')).toBeDefined();
      expect(editMenu?.submenu?.find(item => item.label === 'Copy')).toBeDefined();
      expect(editMenu?.submenu?.find(item => item.label === 'Cut')).toBeDefined();
      expect(editMenu?.submenu?.find(item => item.label === 'Paste')).toBeDefined();
      expect(editMenu?.submenu?.find(item => item.label === 'Delete')).toBeDefined();
    });

    it('should not have Copy as Hyperlink in feedback Edit submenu', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
      expect(editMenu?.submenu?.find(item => item.label === 'Copy as Hyperlink')).toBeUndefined();
    });

    it('should show spell suggestions before Edit submenu in feedback tree', async () => {
      vi.useFakeTimers();

      const mockTextNode = document.createTextNode('helllo world');
      const range = document.createRange();
      range.setStart(mockTextNode, 3);
      range.collapse(true);

      Object.defineProperty(document, 'caretRangeFromPoint', {
        value: vi.fn().mockReturnValue(range),
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      const mockEvent = createMockContextMenuEvent(100, 200);
      await act(async () => {
        const menuPromise = result.current.handleContextMenu(mockEvent);
        await vi.advanceTimersByTimeAsync(50);
        useSpellcheckStore.getState().setSuggestions('helllo', ['hello', 'hallo']);
        await vi.advanceTimersByTimeAsync(500);
        await menuPromise;
      });

      // First items should be spell suggestions
      const firstLabel = result.current.contextMenuItems[0].label;
      expect(['hello', 'hallo']).toContain(firstLabel);

      // Should have separator between spell items and Edit
      const separatorIndex = result.current.contextMenuItems.findIndex(item => item.separator);
      expect(separatorIndex).toBeGreaterThan(0);

      // Edit should come after separator
      const editIndex = result.current.contextMenuItems.findIndex(item => item.label === 'Edit');
      expect(editIndex).toBeGreaterThan(separatorIndex);

      // Still should not have Execute/Collaborate
      expect(result.current.contextMenuItems.find(item => item.label === 'Execute')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Collaborate')).toBeUndefined();

      vi.useRealTimers();
    });

    it('should mark Delete as danger in feedback Edit submenu', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
      const deleteItem = editMenu?.submenu?.find(item => item.label === 'Delete');
      expect(deleteItem?.danger).toBe(true);
    });
  });
});
