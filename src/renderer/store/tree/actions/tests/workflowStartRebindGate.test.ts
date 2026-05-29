import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import { useRebindPreflightStore } from '@/store/rebindPreflightStore';
import { usePendingRebindDialogStore } from '@/store/pendingRebindDialogStore';

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/nodeHelpers', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nodeHelpers')>('@/utils/nodeHelpers');
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => undefined,
    getContextDeclarations: () => [],
  };
});

vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: true,
      hasLaunchedWorkflow: true,
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

// The bug: starting a workflow on a terminal whose live session is bound to a
// DIFFERENT node renames the tab and sends the prompt up front, defeating the
// rebind confirmation. A terminal bound via a manual send / session capture has
// no terminalNodeAssignments entry — only a live session — so the running guard
// does not block it, and the start used to reassign + dispatch before any
// confirmation could be accepted.
describe('startWorkflow — rebind confirmation gate (start onto a terminal whose live session belongs to another node)', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
    terminalNodeAssignments: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: never[];
  };

  let state: TestState;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let autonomousCollaborate: Mock;

  function makeState(): TestState {
    return {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow', 'node-a'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
        // Node A owns the live session running on terminal-1 (the "previously bound" node).
        'node-a': { id: 'node-a', content: 'Node A', children: [], metadata: { sessionId: 'sess-A' } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
        'node-a': ['root'],
      },
      workflowExecutionStates: {},
      // terminal-1 has a live session, and that session belongs to node-a — but
      // there is NO terminalNodeAssignments entry, mirroring a manually-bound terminal.
      workflowSessionMap: { 'sess-A': 'terminal-1' },
      terminalNodeAssignments: {},
      sessionRegistry: {},
      contextDeclarations: [],
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useRebindPreflightStore.getState().clear();
    usePendingRebindDialogStore.getState().clear();

    state = makeState();

    const setState = (partial: Partial<TestState>) => {
      state = { ...state, ...partial };
    };

    autonomousCollaborate = vi.fn().mockResolvedValue('');

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      autonomousCollaborate,
    );
  });

  it('does NOT dispatch the prompt before the rebind confirmation is accepted', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    expect(autonomousCollaborate).not.toHaveBeenCalled();
  });

  it('does NOT eagerly reassign the terminal to the new node before confirmation', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    expect(state.terminalNodeAssignments['terminal-1']).not.toBe('task-a');
  });

  it('does NOT mark the new node running or acquire keep-awake before confirmation', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    expect(window.electron.startKeepAwake).not.toHaveBeenCalled();
  });

  it('does NOT write /clear into the prior session before confirmation, even for a clearSession step', async () => {
    state.nodes['step-1'].metadata.clearSession = true;

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(useRebindPreflightStore.getState().current).not.toBeNull();
    expect(window.electron.terminalWrite).not.toHaveBeenCalledWith('terminal-1', '/clear\r');
  });

  it('queues a rebind confirmation carrying the previous node, the new node, and the terminal', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    const pending = useRebindPreflightStore.getState().current;
    expect(pending).not.toBeNull();
    expect(pending?.terminalId).toBe('terminal-1');
    expect(pending?.previousNodeId).toBe('node-a');
    expect(pending?.newNodeId).toBe('task-a');
    expect(typeof pending?.replay).toBe('function');
  });

  it('marks the terminal pending so a concurrent send is blocked by the existing rebind-dialog gate', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    expect(usePendingRebindDialogStore.getState().isPending('terminal-1')).toBe(true);
  });

  it('accepting the confirmation (replay) reassigns the terminal, marks the node running, acquires keep-awake, and dispatches exactly once', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    const replay = useRebindPreflightStore.getState().current?.replay;
    expect(replay).toBeDefined();

    // Mirror onPreflightConfirm: finalize the dialog state, then replay.
    usePendingRebindDialogStore.getState().clearPending('terminal-1');
    useRebindPreflightStore.getState().clear();
    await replay?.();

    expect(state.terminalNodeAssignments['terminal-1']).toBe('task-a');
    expect(state.workflowExecutionStates['task-a']).toEqual({ state: 'running', terminalTabId: 'terminal-1' });
    expect(window.electron.startKeepAwake).toHaveBeenCalledTimes(1);
    expect(autonomousCollaborate).toHaveBeenCalledTimes(1);
    // The user authorized the rebind, so the replay dispatches as 'workflow-advance'
    // (5th arg) — the main process auto-confirms it and does not raise a second dialog.
    expect(autonomousCollaborate.mock.calls[0][4]).toBe('workflow-advance');
  });

  it('ignores a repeat start while a preflight rebind is already pending on the terminal (does not re-queue or dispatch)', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');
    const firstRequest = useRebindPreflightStore.getState().current;
    expect(firstRequest).not.toBeNull();

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(useRebindPreflightStore.getState().current).toBe(firstRequest);
    expect(autonomousCollaborate).not.toHaveBeenCalled();
  });

  it('cancelling the confirmation is a true no-op: prior binding, running state, and keep-awake all untouched, nothing sent', async () => {
    await actions.startWorkflow('task-a', 'terminal-1');

    // Mirror onPreflightCancel: finalize the dialog state, never replay.
    usePendingRebindDialogStore.getState().clearPending('terminal-1');
    useRebindPreflightStore.getState().clear();

    expect(state.terminalNodeAssignments['terminal-1']).toBeUndefined();
    expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    expect(window.electron.startKeepAwake).not.toHaveBeenCalled();
    expect(autonomousCollaborate).not.toHaveBeenCalled();
  });

  it('does NOT gate when the terminal session already belongs to the SAME node being started', async () => {
    // task-a itself owns the live session on terminal-1 — a resume, not a rebind.
    state.nodes['task-a'].metadata.sessionId = 'sess-A';
    delete state.nodes['node-a'];

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(useRebindPreflightStore.getState().current).toBeNull();
    expect(autonomousCollaborate).toHaveBeenCalledTimes(1);
    expect(state.terminalNodeAssignments['terminal-1']).toBe('task-a');
  });

  it('does NOT gate a start onto a terminal with no live session bound to any node', async () => {
    state.workflowSessionMap = {};

    await actions.startWorkflow('task-a', 'terminal-1');

    expect(useRebindPreflightStore.getState().current).toBeNull();
    expect(state.workflowExecutionStates['task-a']).toEqual({ state: 'running', terminalTabId: 'terminal-1' });
    expect(state.terminalNodeAssignments['terminal-1']).toBe('task-a');
    expect(window.electron.startKeepAwake).toHaveBeenCalledTimes(1);
  });
});
