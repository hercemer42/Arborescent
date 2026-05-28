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

describe('useNodeContextMenu — Manual step bind-aware Start/Resume entries', () => {
  let store: TreeStore;
  let mockStartWorkflow: ReturnType<typeof vi.fn>;
  let mockResendStep: ReturnType<typeof vi.fn>;
  let mockStopWorkflow: ReturnType<typeof vi.fn>;
  let mockSetActiveTerminal: ReturnType<typeof vi.fn>;
  let mockOpenTerminal: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useToastStore.setState({ toasts: [] });

    mockStartWorkflow = vi.fn().mockResolvedValue(undefined);
    mockResendStep = vi.fn();
    mockStopWorkflow = vi.fn();
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
      workflowExecutionStates: {},
      actions: {
        startWorkflow: mockStartWorkflow,
        resendStep: mockResendStep,
        stopWorkflow: mockStopWorkflow,
        deleteNode: vi.fn(),
        copyNodes: vi.fn(),
        cutNodes: vi.fn(),
        pasteNodes: vi.fn(),
        toggleNodeSelection: vi.fn(),
        selectNode: vi.fn(),
        clearSelection: vi.fn(),
        setRememberedVisualX: vi.fn(),
        moveToNextStep: vi.fn(),
        moveToPreviousStep: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  function seedTerminals(opts: { boundPresent: boolean; activeTerminalId: string | null }) {
    const terminals = opts.boundPresent
      ? [
          { id: 'bound-terminal', title: 'A', cwd: '/', shellCommand: '/bin/zsh', shellArgs: [], pinnedToBottom: false },
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

  it('shows "Start Workflow" and not "Resume Workflow" on a manual-step node with no bound session', async () => {
    seedTerminals({ boundPresent: false, activeTerminalId: 'focused-terminal' });

    const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });
    await openContextMenu(result);

    const labels = result.current.contextMenuItems.map(item => item.label);
    expect(labels).toContain('Start Workflow');
    expect(labels).not.toContain('Resume Workflow');
  });

  it('shows "Resume Workflow" and not "Start Workflow" on a manual-step node with a bound session', async () => {
    store.setState({
      workflowExecutionStates: {
        task: { state: 'awaiting-validation', terminalTabId: 'bound-terminal' },
      },
    });
    seedTerminals({ boundPresent: true, activeTerminalId: 'focused-terminal' });

    const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });
    await openContextMenu(result);

    const labels = result.current.contextMenuItems.map(item => item.label);
    expect(labels).toContain('Resume Workflow');
    expect(labels).not.toContain('Start Workflow');
  });

  it('clicking "Start Workflow" on an unbound manual-step node invokes the workflow-step binding flow', async () => {
    seedTerminals({ boundPresent: false, activeTerminalId: 'focused-terminal' });

    const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });
    await openContextMenu(result);

    const startItem = result.current.contextMenuItems.find(item => item.label === 'Start Workflow');
    expect(startItem).toBeDefined();
    await act(async () => {
      await startItem!.onClick!();
    });

    expect(mockStartWorkflow).toHaveBeenCalledTimes(1);
    expect(mockStartWorkflow).toHaveBeenCalledWith('task', expect.any(String));
  });

  it('clicking "Resume Workflow" on a bound manual-step node focuses the bound terminal, not the active one', async () => {
    store.setState({
      workflowExecutionStates: {
        task: { state: 'awaiting-validation', terminalTabId: 'bound-terminal' },
      },
    });
    seedTerminals({ boundPresent: true, activeTerminalId: 'focused-terminal' });

    const { result } = renderHook(() => useNodeContextMenu(taskNode), { wrapper });
    await openContextMenu(result);

    const resumeItem = result.current.contextMenuItems.find(item => item.label === 'Resume Workflow');
    expect(resumeItem).toBeDefined();
    await act(async () => {
      await resumeItem!.onClick!();
    });

    expect(mockSetActiveTerminal).toHaveBeenCalledWith('bound-terminal');
    expect(mockSetActiveTerminal).not.toHaveBeenCalledWith('focused-terminal');
  });

  it.todo('clicking "Resume Workflow" when the bound terminal is closed produces the same outcome (toast + focused-terminal fallback) as Resend step in the same situation');

  it.todo('clicking "Start Workflow" on a manual-step node whose parent workflow is the workflow root (root manual step) still launches the workflow');

  it.todo('existing per-session "Send to <session>" entries remain in the menu and target their chosen session — they do not trigger any post-send pause');
});
