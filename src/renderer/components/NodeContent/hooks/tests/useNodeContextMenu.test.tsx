import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';
import { useSpellcheckStore } from '../../../../store/spellcheck/spellcheckStore';
import { useTerminalStore } from '../../../../store/terminal/terminalStore';
import { useFilesStore } from '../../../../store/files/filesStore';
import { usePendingNewSessionStartStore } from '../../../../store/pendingNewSessionStartStore';
import { REVISE_AFTER_DISCUSSION_CONTEXT_ID } from '../../../../utils/nodeHelpers';
import type { StepHistoryEntry } from '../../../../store/tree/stepHistory/stepHistory';

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
      void result.current.handleContextMenu(mockEvent);
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
      void result.current.handleContextMenu(mockEvent);
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
      void result.current.handleContextMenu(mockEvent);
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
      void result.current.handleContextMenu(mockEvent);
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

  it('warns that a contained active review will be discarded when confirming a subtree delete', () => {
    // test-node has an in-review child, so the delete confirmation must note the proposition loss.
    // The returned handleDelete must use the same review-discard warning the menu builders do.
    store.setState({
      nodes: {
        'test-node': { ...mockNode, children: ['child'] },
        child: { id: 'child', content: 'Child', children: [], metadata: {} },
      },
      ancestorRegistry: { 'test-node': [], child: ['test-node'] },
      reviews: { child: { source: 'terminal', terminalId: null } },
    });
    mockDeleteNode.mockImplementation((_id: string, confirmed?: boolean) => Boolean(confirmed));
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
    act(() => {
      result.current.handleDelete();
    });

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.stringContaining('active review, which will be discarded'),
    );

    mockConfirm.mockRestore();
  });

  describe('Send action', () => {
    it('should have Send as a direct menu item with mode tooltip, not a submenu', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const sendItem = result.current.contextMenuItems.find(item => item.label === 'Send');
      expect(sendItem).toBeDefined();
      expect(sendItem?.tooltip).toBe('Collaborate');
      expect(sendItem?.onClick).toBeDefined();
      expect(sendItem?.submenu).toBeUndefined();
    });

    it('should show execute mode and context tooltip when execute context is applied', async () => {
      const contextNode: TreeNode = {
        id: 'exec-ctx',
        content: 'My Deploy Script',
        children: [],
        metadata: { isContextDeclaration: true, collaborate: true, execute: true },
      };

      store.setState({
        nodes: {
          'test-node': { ...mockNode, metadata: { appliedContextId: 'exec-ctx' } },
          'exec-ctx': contextNode,
        },
        ancestorRegistry: {
          'test-node': [],
          'exec-ctx': [],
        },
        contextDeclarations: [
          { nodeId: 'exec-ctx', content: 'My Deploy Script', icon: 'zap', collaborate: true, execute: true },
        ],
      });

      const { result } = renderHook(
        () => useNodeContextMenu({ ...mockNode, metadata: { appliedContextId: 'exec-ctx' } }),
        { wrapper },
      );

      await openContextMenu(result);

      const sendItem = result.current.contextMenuItems.find(item => item.label === 'Send');
      expect(sendItem?.label).toBe('Send');
      expect(sendItem?.tooltip).toBe('Collaborate & Execute: My Deploy Script');
    });

    it('should not have "In terminal" or "In browser" as menu items', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const allLabels = result.current.contextMenuItems.flatMap(item =>
        [item.label, ...(item.submenu?.map(sub => sub.label) ?? [])]
      );
      expect(allLabels).not.toContain('In terminal');
      expect(allLabels).not.toContain('In browser');
    });

    it('should route to terminal when terminal panel is active', async () => {
      const mockCollaborateInTerminal = vi.fn().mockResolvedValue(undefined);
      store.setState({
        actions: {
          ...store.getState().actions,
          collaborateInTerminal: mockCollaborateInTerminal,
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

      const { usePanelStore } = await import('../../../../store/panel/panelStore');
      usePanelStore.setState({ activeContent: 'terminal' });

      const originalState = useTerminalStore.getState();
      useTerminalStore.setState({
        ...originalState,
        openTerminal: vi.fn().mockResolvedValue('terminal-1'),
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const sendItem = result.current.contextMenuItems.find(item => item.label === 'Send');
      await act(async () => {
        sendItem!.onClick!();
      });

      expect(mockCollaborateInTerminal).toHaveBeenCalledWith('test-node', 'terminal-1', { collaborate: true, execute: false }, undefined);
    });

    it('should show toast when no panel is open', async () => {
      const { usePanelStore } = await import('../../../../store/panel/panelStore');
      usePanelStore.setState({ activeContent: null });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const sendItem = result.current.contextMenuItems.find(item => item.label === 'Send');
      await act(async () => {
        sendItem!.onClick!();
      });

      // Toast shown — no crash, no action called
    });

    it('should have correct menu order: Send before Edit', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const labels = result.current.contextMenuItems.map(item => item.label);
      const sendIndex = labels.indexOf('Send');
      const editIndex = labels.indexOf('Edit');

      expect(sendIndex).toBeGreaterThanOrEqual(0);
      expect(sendIndex).toBeLessThan(editIndex);
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
        void result.current.handleContextMenu(mockEvent);
        await vi.advanceTimersByTimeAsync(550);
      });
    }

    it('should show full context menu when no word is selected', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenuWithTimers(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Send')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

    it('should show full context menu when no misspelled word in store', async () => {
      const mockTextNode = document.createTextNode('hello world');
      const range = createMockRange(mockTextNode, 2);
      mockCaretRangeFromPoint(range);

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenuWithTimers(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Send')).toBeDefined();
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

      expect(result.current.contextMenuItems.find(item => item.label === 'Send')).toBeDefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Edit')).toBeDefined();
    });

  });

  describe('workflow submenu for step nodes', () => {
    const stepNode: TreeNode = {
      id: 'step-node',
      content: 'Step 1',
      children: [],
      metadata: { isBlueprint: true },
    };

    beforeEach(() => {
      store.setState({
        nodes: {
          'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
          'workflow': { id: 'workflow', content: 'Workflow', children: ['step-node'], metadata: { isBlueprint: true, isWorkflow: true } },
          'step-node': stepNode,
        },
        rootNodeId: 'root',
        ancestorRegistry: {
          'root': [],
          'workflow': ['root'],
          'step-node': ['root', 'workflow'],
        },
        actions: {
          ...store.getState().actions,
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

    it('should show Configure Step in the Workflow submenu for step nodes', async () => {
      const { result } = renderHook(() => useNodeContextMenu(stepNode), { wrapper });

      await openContextMenu(result);

      const workflowMenu = result.current.contextMenuItems.find(item => item.label === 'Workflow');
      expect(workflowMenu).toBeDefined();
      const configureItem = workflowMenu!.submenu!.find(item => item.label === 'Configure Step');
      expect(configureItem).toBeDefined();
    });

    function makeHistoryEntry(id: string, parentLabel: string): StepHistoryEntry {
      return {
        id,
        capturedAt: '2026-05-25T10:00:00.000Z',
        parentLabel,
        rootNodeId: `snap-${id}`,
        nodes: { [`snap-${id}`]: { id: `snap-${id}`, content: 'snap', children: [], metadata: {} } },
        position: 0,
      };
    }

    it('surfaces Step History as a top-level item, not nested inside the Workflow submenu', async () => {
      store.setState({ stepHistory: { 'step-node': [makeHistoryEntry('e1', 'Problem statement')] } });

      const { result } = renderHook(() => useNodeContextMenu(stepNode), { wrapper });
      await openContextMenu(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Step History')).toBeDefined();
      const workflowMenu = result.current.contextMenuItems.find(item => item.label === 'Workflow');
      expect(workflowMenu?.submenu?.find(item => item.label === 'Step History')).toBeUndefined();
    });

    it('lists captured history entries under the top-level Step History item', async () => {
      store.setState({
        stepHistory: { 'step-node': [makeHistoryEntry('e1', 'Alpha'), makeHistoryEntry('e2', 'Beta')] },
      });

      const { result } = renderHook(() => useNodeContextMenu(stepNode), { wrapper });
      await openContextMenu(result);

      const stepHistoryItem = result.current.contextMenuItems.find(item => item.label === 'Step History');
      expect(stepHistoryItem?.submenu).toHaveLength(2);
      expect(stepHistoryItem?.submenu?.[0].label).toBe('Alpha');
    });

    it('disables the top-level Step History item with a no-history tooltip when the step has no history', async () => {
      store.setState({ stepHistory: {} });

      const { result } = renderHook(() => useNodeContextMenu(stepNode), { wrapper });
      await openContextMenu(result);

      const stepHistoryItem = result.current.contextMenuItems.find(item => item.label === 'Step History');
      expect(stepHistoryItem?.disabled).toBe(true);
      expect(stepHistoryItem?.disabledTooltip).toBeTruthy();
    });

    it('does not surface a Step History item for a workflow-root node', async () => {
      store.setState({ stepHistory: { 'step-node': [makeHistoryEntry('e1', 'Alpha')] } });
      const workflowNode = store.getState().nodes['workflow'];

      const { result } = renderHook(() => useNodeContextMenu(workflowNode), { wrapper });
      await openContextMenu(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Step History')).toBeUndefined();
    });
  });

  describe('auto-start after manual step navigation', () => {
    const taskNode: TreeNode = {
      id: 'task-node',
      content: 'Task',
      children: [],
      metadata: { isBlueprint: true },
    };

    let mockStartWorkflow: ReturnType<typeof vi.fn>;
    let mockMoveToNextStep: ReturnType<typeof vi.fn>;
    let mockMoveToPreviousStep: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockStartWorkflow = vi.fn();
      mockMoveToNextStep = vi.fn();
      mockMoveToPreviousStep = vi.fn();

      const originalState = useTerminalStore.getState();
      useTerminalStore.setState({
        ...originalState,
        openTerminal: vi.fn().mockResolvedValue('terminal-1'),
      });

      store.setState({
        nodes: {
          'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
          'workflow': { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
          'step-1': { id: 'step-1', content: 'Step 1', children: ['task-node'], metadata: { isBlueprint: true, stepType: 'manual' } },
          'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
          'task-node': taskNode,
        },
        rootNodeId: 'root',
        ancestorRegistry: {
          'root': [],
          'workflow': ['root'],
          'step-1': ['root', 'workflow'],
          'step-2': ['root', 'workflow'],
          'task-node': ['root', 'workflow', 'step-1'],
        },
        workflowExecutionStates: {},
        actions: {
          ...store.getState().actions,
          startWorkflow: mockStartWorkflow,
          moveToNextStep: mockMoveToNextStep,
          moveToPreviousStep: mockMoveToPreviousStep,
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

    it('should show Next step for task inside a workflow step', async () => {
      const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });

      await openContextMenu(result);

      const nextStepItem = result.current.contextMenuItems.find(item => item.label === 'Next step');
      expect(nextStepItem).toBeDefined();
    });

    it('should auto-start workflow after moving to an autonomous step', async () => {
      mockMoveToNextStep.mockImplementation(() => {
        store.setState({
          nodes: {
            ...store.getState().nodes,
            'step-1': { ...store.getState().nodes['step-1'], children: [] },
            'step-2': { ...store.getState().nodes['step-2'], children: ['task-node'] },
          },
          ancestorRegistry: {
            ...store.getState().ancestorRegistry,
            'task-node': ['root', 'workflow', 'step-2'],
          },
        });
      });

      const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });

      await openContextMenu(result);

      const nextStepItem = result.current.contextMenuItems.find(item => item.label === 'Next step');
      act(() => {
        nextStepItem!.onClick!();
      });

      expect(mockMoveToNextStep).toHaveBeenCalledWith('task-node');
      await waitFor(() => {
        expect(mockStartWorkflow).toHaveBeenCalled();
      });
    });

    it('should not auto-start workflow after moving to a manual step', async () => {
      store.setState({
        nodes: {
          ...store.getState().nodes,
          'step-2': { ...store.getState().nodes['step-2'], metadata: { isBlueprint: true } },
        },
      });

      mockMoveToNextStep.mockImplementation(() => {
        store.setState({
          nodes: {
            ...store.getState().nodes,
            'step-1': { ...store.getState().nodes['step-1'], children: [] },
            'step-2': { ...store.getState().nodes['step-2'], children: ['task-node'] },
          },
          ancestorRegistry: {
            ...store.getState().ancestorRegistry,
            'task-node': ['root', 'workflow', 'step-2'],
          },
        });
      });

      const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });

      await openContextMenu(result);

      const nextStepItem = result.current.contextMenuItems.find(item => item.label === 'Next step');
      act(() => {
        nextStepItem!.onClick!();
      });

      expect(mockMoveToNextStep).toHaveBeenCalledWith('task-node');
      // Allow any pending promises to settle
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockStartWorkflow).not.toHaveBeenCalled();
    });

    it('should auto-start workflow after moving to a checkpoint step', async () => {
      store.setState({
        nodes: {
          ...store.getState().nodes,
          'step-2': { ...store.getState().nodes['step-2'], metadata: { isBlueprint: true, stepType: 'checkpoint' } },
        },
      });

      mockMoveToNextStep.mockImplementation(() => {
        store.setState({
          nodes: {
            ...store.getState().nodes,
            'step-1': { ...store.getState().nodes['step-1'], children: [] },
            'step-2': { ...store.getState().nodes['step-2'], children: ['task-node'] },
          },
          ancestorRegistry: {
            ...store.getState().ancestorRegistry,
            'task-node': ['root', 'workflow', 'step-2'],
          },
        });
      });

      const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });

      await openContextMenu(result);

      const nextStepItem = result.current.contextMenuItems.find(item => item.label === 'Next step');
      act(() => {
        nextStepItem!.onClick!();
      });

      expect(mockMoveToNextStep).toHaveBeenCalledWith('task-node');
      await waitFor(() => {
        expect(mockStartWorkflow).toHaveBeenCalled();
      });
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

      // Should NOT have Send, Blueprint, Status, Zoom
      expect(result.current.contextMenuItems.find(item => item.label === 'Send')).toBeUndefined();
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

      // Still should not have Send
      expect(result.current.contextMenuItems.find(item => item.label === 'Send')).toBeUndefined();

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

  describe('external link menu', () => {
    const externalLinkNode: TreeNode = {
      id: 'external-link-node',
      content: 'https://example.com',
      children: [],
      metadata: {
        isExternalLink: true,
        externalUrl: 'https://example.com',
      },
    };

    beforeEach(() => {
      store.setState({
        nodes: { 'external-link-node': externalLinkNode },
        rootNodeId: 'external-link-node',
        ancestorRegistry: {
          'external-link-node': [],
        },
      });
    });

    it('should show Open in external browser option for external links', async () => {
      const { result } = renderHook(() => useNodeContextMenu(externalLinkNode), { wrapper });

      await openContextMenu(result);

      const openExternalItem = result.current.contextMenuItems.find(
        item => item.label === 'Open in external browser'
      );
      expect(openExternalItem).toBeDefined();
    });

    it('should not show Send or Blueprint for external links', async () => {
      const { result } = renderHook(() => useNodeContextMenu(externalLinkNode), { wrapper });

      await openContextMenu(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Send')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Blueprint')).toBeUndefined();
    });

    it('should not show Status or Zoom for external links', async () => {
      const { result } = renderHook(() => useNodeContextMenu(externalLinkNode), { wrapper });

      await openContextMenu(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Status')).toBeUndefined();
      expect(result.current.contextMenuItems.find(item => item.label === 'Zoom')).toBeUndefined();
    });

    it('should still show Edit submenu for external links', async () => {
      const { result } = renderHook(() => useNodeContextMenu(externalLinkNode), { wrapper });

      await openContextMenu(result);

      const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
      expect(editMenu).toBeDefined();
      expect(editMenu?.submenu?.find(item => item.label === 'Delete')).toBeDefined();
    });
  });

  describe("'Revise after discussion' menu item", () => {
    it('should be present on a normal workspace node', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const reviseItem = result.current.contextMenuItems.find(
        item => item.label === 'Revise after discussion',
      );
      expect(reviseItem).toBeDefined();
      expect(reviseItem?.onClick).toBeDefined();
      expect(reviseItem?.submenu).toBeUndefined();
    });

    it('should be placed directly under Send', async () => {
      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

      await openContextMenu(result);

      const labels = result.current.contextMenuItems.map(item => item.label);
      const sendIndex = labels.indexOf('Send');
      const reviseIndex = labels.indexOf('Revise after discussion');

      expect(sendIndex).toBeGreaterThanOrEqual(0);
      expect(reviseIndex).toBe(sendIndex + 1);
    });

    it('should not appear on hyperlink nodes', async () => {
      const hyperlinkNode: TreeNode = {
        id: 'hyperlink-node',
        content: 'Linked',
        children: [],
        metadata: { isHyperlink: true, linkedNodeId: 'test-node' },
      };

      store.setState({
        nodes: { 'hyperlink-node': hyperlinkNode, 'test-node': mockNode },
        rootNodeId: 'test-node',
        ancestorRegistry: { 'hyperlink-node': [], 'test-node': [] },
      });

      const { result } = renderHook(() => useNodeContextMenu(hyperlinkNode), { wrapper });
      await openContextMenu(result);

      expect(
        result.current.contextMenuItems.find(item => item.label === 'Revise after discussion'),
      ).toBeUndefined();
    });

    it('should not appear on external-link nodes', async () => {
      const externalLinkNode: TreeNode = {
        id: 'external-link-node',
        content: 'https://example.com',
        children: [],
        metadata: { isExternalLink: true, externalUrl: 'https://example.com' },
      };

      store.setState({
        nodes: { 'external-link-node': externalLinkNode },
        rootNodeId: 'external-link-node',
        ancestorRegistry: { 'external-link-node': [] },
      });

      const { result } = renderHook(() => useNodeContextMenu(externalLinkNode), { wrapper });
      await openContextMenu(result);

      expect(
        result.current.contextMenuItems.find(item => item.label === 'Revise after discussion'),
      ).toBeUndefined();
    });

    it('should not appear in the feedback tree', async () => {
      store.setState({ treeType: 'feedback' });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      expect(
        result.current.contextMenuItems.find(item => item.label === 'Revise after discussion'),
      ).toBeUndefined();
    });

    it('should route to collaborateInTerminal with the synthetic override id when terminal is active', async () => {
      const mockCollaborateInTerminal = vi.fn().mockResolvedValue(undefined);
      const mockSetAppliedContext = vi.fn();
      store.setState({
        actions: {
          ...store.getState().actions,
          collaborateInTerminal: mockCollaborateInTerminal,
          setAppliedContext: mockSetAppliedContext,
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

      const { usePanelStore } = await import('../../../../store/panel/panelStore');
      usePanelStore.setState({ activeContent: 'terminal' });

      const originalState = useTerminalStore.getState();
      useTerminalStore.setState({
        ...originalState,
        openTerminal: vi.fn().mockResolvedValue('terminal-1'),
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const reviseItem = result.current.contextMenuItems.find(
        item => item.label === 'Revise after discussion',
      );
      await act(async () => {
        await reviseItem!.onClick!();
      });

      expect(mockCollaborateInTerminal).toHaveBeenCalledWith(
        'test-node',
        'terminal-1',
        { collaborate: true, execute: false },
        REVISE_AFTER_DISCUSSION_CONTEXT_ID,
      );
      expect(mockSetAppliedContext).not.toHaveBeenCalled();
    });

    it('should route to collaborate (browser) with the synthetic override id when browser is active', async () => {
      const mockCollaborate = vi.fn().mockResolvedValue(undefined);
      const mockSetAppliedContext = vi.fn();
      store.setState({
        actions: {
          ...store.getState().actions,
          collaborate: mockCollaborate,
          setAppliedContext: mockSetAppliedContext,
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

      const { usePanelStore } = await import('../../../../store/panel/panelStore');
      usePanelStore.setState({ activeContent: 'browser' });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const reviseItem = result.current.contextMenuItems.find(
        item => item.label === 'Revise after discussion',
      );
      await act(async () => {
        await reviseItem!.onClick!();
      });

      expect(mockCollaborate).toHaveBeenCalledWith(
        'test-node',
        { collaborate: true, execute: false },
        REVISE_AFTER_DISCUSSION_CONTEXT_ID,
      );
      expect(mockSetAppliedContext).not.toHaveBeenCalled();
    });

    it('should not invoke any send when no terminal and no browser is open', async () => {
      const mockCollaborate = vi.fn().mockResolvedValue(undefined);
      const mockCollaborateInTerminal = vi.fn().mockResolvedValue(undefined);
      store.setState({
        actions: {
          ...store.getState().actions,
          collaborate: mockCollaborate,
          collaborateInTerminal: mockCollaborateInTerminal,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      const { usePanelStore } = await import('../../../../store/panel/panelStore');
      usePanelStore.setState({ activeContent: null });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const reviseItem = result.current.contextMenuItems.find(
        item => item.label === 'Revise after discussion',
      );
      await act(async () => {
        await reviseItem!.onClick!();
      });

      expect(mockCollaborate).not.toHaveBeenCalled();
      expect(mockCollaborateInTerminal).not.toHaveBeenCalled();
    });

    it('is disabled when the node is currently being collaborated on, and Cancel collaboration is visible', async () => {
      store.setState({ reviews: { 'test-node': { source: 'terminal', terminalId: null } } });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const reviseItem = result.current.contextMenuItems.find(
        item => item.label === 'Revise after discussion',
      );
      expect(reviseItem).toBeDefined();
      expect(reviseItem?.disabled).toBe(true);

      const cancelItem = result.current.contextMenuItems.find(
        item => item.label === 'Cancel collaboration',
      );
      expect(cancelItem).toBeDefined();
    });
  });

  describe('Delete confirmation with active review in subtree', () => {
    const parentNode: TreeNode = {
      id: 'parent-node',
      content: 'Parent',
      children: ['child-node'],
      metadata: {},
    };
    const childNode: TreeNode = {
      id: 'child-node',
      content: 'Child',
      children: [],
      metadata: {},
    };

    beforeEach(() => {
      store.setState({
        nodes: { 'parent-node': parentNode, 'child-node': childNode },
        rootNodeId: 'parent-node',
        ancestorRegistry: {
          'parent-node': [],
          'child-node': ['parent-node'],
        },
        reviews: {},
      });
    });

    async function findDeleteItem(node: TreeNode) {
      const { result } = renderHook(() => useNodeContextMenu(node), { wrapper });
      await openContextMenu(result);
      const editMenu = result.current.contextMenuItems.find(item => item.label === 'Edit');
      const deleteItem = editMenu?.submenu?.find(item => item.label === 'Delete');
      expect(deleteItem).toBeDefined();
      return deleteItem!;
    }

    it('appends the active-review warning when a descendant is under review', async () => {
      store.setState({ reviews: { 'child-node': { source: 'terminal', terminalId: null } } });
      mockDeleteNode.mockReturnValue(false);
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const deleteItem = await findDeleteItem(parentNode);
      act(() => {
        deleteItem.onClick!();
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.stringContaining('active review, which will be discarded'),
      );

      mockConfirm.mockRestore();
    });

    it('omits the active-review warning when no review is in the subtree', async () => {
      mockDeleteNode.mockReturnValue(false);
      const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

      const deleteItem = await findDeleteItem(parentNode);
      act(() => {
        deleteItem.onClick!();
      });

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.not.stringContaining('active review, which will be discarded'),
      );

      mockConfirm.mockRestore();
    });
  });

  describe('Zoom menu item', () => {
    const sourceFilePath = '/path/project.arbo';
    const zoomPath = `zoom://${sourceFilePath}#parent-node`;
    const realOpenZoomTab = useFilesStore.getState().openZoomTab;
    const mockOpenZoomTab = vi.fn();

    afterEach(() => {
      useFilesStore.setState({ files: [], activeFilePath: null, openZoomTab: realOpenZoomTab });
    });

    it('shows Zoom and opens a tab against the file path on a regular (non-zoom) file', async () => {
      useFilesStore.setState({
        files: [{ path: sourceFilePath, displayName: 'project.arbo' }],
        activeFilePath: sourceFilePath,
        openZoomTab: mockOpenZoomTab,
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const zoomItem = result.current.contextMenuItems.find(item => item.label === 'Zoom');
      expect(zoomItem).toBeDefined();

      act(() => {
        zoomItem!.onClick!();
      });
      expect(mockOpenZoomTab).toHaveBeenCalledWith(sourceFilePath, 'test-node', 'Test Content');
    });

    it('shows Zoom inside a zoom tab so the user can zoom within a zoom', async () => {
      useFilesStore.setState({
        files: [
          { path: sourceFilePath, displayName: 'project.arbo' },
          { path: zoomPath, displayName: 'parent', zoomSource: { sourceFilePath, zoomedNodeId: 'parent-node' } },
        ],
        activeFilePath: zoomPath,
        openZoomTab: mockOpenZoomTab,
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Zoom')).toBeDefined();
    });

    it('opens the nested zoom against the source file path, never the zoom path', async () => {
      useFilesStore.setState({
        files: [
          { path: sourceFilePath, displayName: 'project.arbo' },
          { path: zoomPath, displayName: 'parent', zoomSource: { sourceFilePath, zoomedNodeId: 'parent-node' } },
        ],
        activeFilePath: zoomPath,
        openZoomTab: mockOpenZoomTab,
      });

      const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });
      await openContextMenu(result);

      const zoomItem = result.current.contextMenuItems.find(item => item.label === 'Zoom');
      act(() => {
        zoomItem!.onClick!();
      });

      expect(mockOpenZoomTab).toHaveBeenCalledWith(sourceFilePath, 'test-node', 'Test Content');
      expect(mockOpenZoomTab).not.toHaveBeenCalledWith(
        expect.stringContaining('zoom://'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('does not offer Zoom for hyperlink nodes even inside a zoom tab', async () => {
      const hyperlinkNode: TreeNode = {
        id: 'hyperlink-node',
        content: 'Linked',
        children: [],
        metadata: { isHyperlink: true, linkedNodeId: 'test-node' },
      };
      store.setState({
        nodes: { 'hyperlink-node': hyperlinkNode, 'test-node': mockNode },
        rootNodeId: 'test-node',
        ancestorRegistry: { 'hyperlink-node': [], 'test-node': [] },
      });
      useFilesStore.setState({
        files: [
          { path: sourceFilePath, displayName: 'project.arbo' },
          { path: zoomPath, displayName: 'parent', zoomSource: { sourceFilePath, zoomedNodeId: 'parent-node' } },
        ],
        activeFilePath: zoomPath,
        openZoomTab: mockOpenZoomTab,
      });

      const { result } = renderHook(() => useNodeContextMenu(hyperlinkNode), { wrapper });
      await openContextMenu(result);

      expect(result.current.contextMenuItems.find(item => item.label === 'Zoom')).toBeUndefined();
    });
  });

  describe('Start workflow in new session', () => {
    const NEW_SESSION_LABEL = 'Start workflow in new session';

    function setupWorkflowTask(taskMeta: Record<string, unknown>, startSpy = vi.fn()): TreeNode {
      const task: TreeNode = { id: 'wf-task', content: 'Task', children: [], metadata: taskMeta };
      store.setState({
        nodes: {
          'wf-root': { id: 'wf-root', content: 'WF', children: ['wf-step'], metadata: { isWorkflow: true } },
          'wf-step': { id: 'wf-step', content: 'Step', children: ['wf-task'], metadata: { stepType: 'autonomous' } },
          'wf-task': task,
        },
        rootNodeId: 'wf-root',
        ancestorRegistry: { 'wf-root': [], 'wf-step': ['wf-root'], 'wf-task': ['wf-root', 'wf-step'] },
        workflowExecutionStates: {},
        workflowSessionMap: {},
        sessionRegistry: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: { ...store.getState().actions, startWorkflowInNewSession: startSpy } as any,
      });
      return task;
    }

    beforeEach(() => {
      usePendingNewSessionStartStore.setState({ current: null });
    });

    it('offers the action on a bound node', async () => {
      const task = setupWorkflowTask({ sessionId: 's1' });
      const { result } = renderHook(() => useNodeContextMenu(task), { wrapper });
      await openContextMenu(result);
      expect(result.current.contextMenuItems.find(item => item.label === NEW_SESSION_LABEL)).toBeDefined();
    });

    it('offers the action on a decomposed sibling', async () => {
      const task = setupWorkflowTask({ groupId: 'g1' });
      const { result } = renderHook(() => useNodeContextMenu(task), { wrapper });
      await openContextMenu(result);
      expect(result.current.contextMenuItems.find(item => item.label === NEW_SESSION_LABEL)).toBeDefined();
    });

    it('hides the action on an unbound, ungrouped node', async () => {
      const task = setupWorkflowTask({});
      const { result } = renderHook(() => useNodeContextMenu(task), { wrapper });
      await openContextMenu(result);
      expect(result.current.contextMenuItems.find(item => item.label === NEW_SESSION_LABEL)).toBeUndefined();
    });

    it('requests a confirmation dialog when the node has a live session to abandon', async () => {
      const startSpy = vi.fn();
      const task = setupWorkflowTask({ sessionId: 's1' }, startSpy);
      store.setState({ workflowSessionMap: { s1: 'term1' } });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useTerminalStore.setState({ terminals: [{ id: 'term1' }] } as any);

      const { result } = renderHook(() => useNodeContextMenu(task), { wrapper });
      await openContextMenu(result);

      const item = result.current.contextMenuItems.find(menuItem => menuItem.label === NEW_SESSION_LABEL);
      act(() => { item?.onClick?.(); });

      expect(usePendingNewSessionStartStore.getState().current?.nodeId).toBe('wf-task');
      expect(startSpy).not.toHaveBeenCalled();

      // Cancelling clears the dialog and changes nothing.
      const pending = usePendingNewSessionStartStore.getState().current;
      act(() => pending?.onCancel());
      expect(usePendingNewSessionStartStore.getState().current).toBeNull();
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('starts directly without a dialog when the node would already spawn fresh', async () => {
      const startSpy = vi.fn();
      const task = setupWorkflowTask({ groupId: 'g1' }, startSpy);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useTerminalStore.setState({ terminals: [], openTerminal: vi.fn().mockResolvedValue('term-x') } as any);

      const { result } = renderHook(() => useNodeContextMenu(task), { wrapper });
      await openContextMenu(result);

      const item = result.current.contextMenuItems.find(menuItem => menuItem.label === NEW_SESSION_LABEL);
      act(() => { item?.onClick?.(); });

      expect(usePendingNewSessionStartStore.getState().current).toBeNull();
      await waitFor(() => expect(startSpy).toHaveBeenCalledWith('wf-task', 'term-x'));
    });
  });
});
