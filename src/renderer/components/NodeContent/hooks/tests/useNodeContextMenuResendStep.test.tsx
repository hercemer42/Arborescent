import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeContextMenu } from '../useNodeContextMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import { useTerminalStore } from '../../../../store/terminal/terminalStore';
import { useToastStore } from '../../../../store/toast/toastStore';
import type { TreeNode } from '@shared/types';

function createMockContextMenuEvent(x: number, y: number) {
  const mockContentEditable = document.createElement('div');
  mockContentEditable.className = 'node-text';
  mockContentEditable.textContent = 'Task';

  const mockWrapper = document.createElement('div');
  mockWrapper.appendChild(mockContentEditable);

  return {
    preventDefault: vi.fn(),
    clientX: x,
    clientY: y,
    currentTarget: mockWrapper,
  } as unknown as React.MouseEvent;
}

async function openContextMenu(result: { current: ReturnType<typeof useNodeContextMenu> }) {
  vi.useFakeTimers();
  const mockEvent = createMockContextMenuEvent(100, 200);
  await act(async () => {
    void result.current.handleContextMenu(mockEvent);
    await vi.advanceTimersByTimeAsync(550);
  });
  vi.useRealTimers();
}

const taskNode: TreeNode = {
  id: 'task',
  content: 'Task',
  children: [],
  metadata: { isBlueprint: true },
};

const baseNodes: Record<string, TreeNode> = {
  root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
  workflow: { id: 'workflow', content: 'Workflow', children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } },
  'step-1': { id: 'step-1', content: 'Step 1', children: ['task'], metadata: { isBlueprint: true, stepType: 'manual' } },
  task: taskNode,
};

const baseAncestors = {
  root: [],
  workflow: ['root'],
  'step-1': ['root', 'workflow'],
  task: ['root', 'workflow', 'step-1'],
};

describe('useNodeContextMenu — Resend step terminal binding', () => {
  let store: TreeStore;
  let mockResendStep: ReturnType<typeof vi.fn>;
  let mockSetActiveTerminal: ReturnType<typeof vi.fn>;
  let mockOpenTerminal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });

    mockResendStep = vi.fn();
    mockSetActiveTerminal = vi.fn();
    mockOpenTerminal = vi.fn().mockResolvedValue('focused-terminal');

    store = createTreeStore();
    store.setState({
      nodes: baseNodes,
      rootNodeId: 'root',
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry: baseAncestors,
      workflowExecutionStates: {
        task: { state: 'awaiting-validation', terminalTabId: 'assigned-terminal' },
      },
      actions: {
        resendStep: mockResendStep,
        deleteNode: vi.fn(),
        copyNodes: vi.fn(),
        cutNodes: vi.fn(),
        pasteNodes: vi.fn(),
        toggleNodeSelection: vi.fn(),
        selectNode: vi.fn(),
        clearSelection: vi.fn(),
        setRememberedVisualX: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  function seedTerminals(opts: { assignedPresent: boolean; activeTerminalId: string | null }) {
    const terminals = opts.assignedPresent
      ? [
          { id: 'assigned-terminal', title: 'A', cwd: '/', shellCommand: '/bin/zsh', shellArgs: [], pinnedToBottom: false },
          { id: 'focused-terminal', title: 'B', cwd: '/', shellCommand: '/bin/zsh', shellArgs: [], pinnedToBottom: false },
        ]
      : [
          { id: 'focused-terminal', title: 'B', cwd: '/', shellCommand: '/bin/zsh', shellArgs: [], pinnedToBottom: false },
        ];

    const originalState = useTerminalStore.getState();
    useTerminalStore.setState({
      ...originalState,
      terminals,
      activeTerminalId: opts.activeTerminalId,
      openTerminal: mockOpenTerminal,
      setActiveTerminal: mockSetActiveTerminal,
    });
  }

  async function clickResendStep() {
    const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });
    await openContextMenu(result);
    const resendItem = result.current.contextMenuItems.find(item => item.label === 'Resend step');
    expect(resendItem).toBeDefined();
    await act(async () => {
      await resendItem!.onClick!();
    });
  }

  it('routes Resend step to the terminal bound to the awaiting-validation entry, not the focused terminal', async () => {
    seedTerminals({ assignedPresent: true, activeTerminalId: 'focused-terminal' });

    await clickResendStep();

    expect(mockResendStep).toHaveBeenCalledTimes(1);
    expect(mockResendStep).toHaveBeenCalledWith('task', 'assigned-terminal');
  });

  it('focuses the assigned terminal tab before resending the step', async () => {
    seedTerminals({ assignedPresent: true, activeTerminalId: 'focused-terminal' });

    await clickResendStep();

    expect(mockSetActiveTerminal).toHaveBeenCalledWith('assigned-terminal');
  });

  it('falls back to the focused terminal and surfaces a toast when the assigned terminal tab was closed', async () => {
    seedTerminals({ assignedPresent: false, activeTerminalId: 'focused-terminal' });

    await clickResendStep();

    expect(mockResendStep).toHaveBeenCalledWith('task', 'focused-terminal');
    expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
  });

  it('does not call setActiveTerminal when falling back to the focused terminal', async () => {
    seedTerminals({ assignedPresent: false, activeTerminalId: 'focused-terminal' });

    await clickResendStep();

    expect(mockSetActiveTerminal).not.toHaveBeenCalledWith('assigned-terminal');
  });
});
