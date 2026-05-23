import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({ executeInTerminal: mockExecuteInTerminal }));

vi.mock('@/utils/nodeHelpers', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nodeHelpers')>('@/utils/nodeHelpers');
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getAppliedContextIdWithInheritance: () => undefined,
    resolveContextMode: () => 'execute',
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({ buildExecutePrompt: () => 'mock prompt' }));

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

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({ mockNotifyWorkflowEvent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: mockNotifyWorkflowEvent }));

type ExecState = { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean };

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, ExecState>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
  contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
}

// Two concurrent decomposition groups on the same shared workflow tree:
//   workflow
//     step-1 (decomposition: true) — both groups parented here
//       task-A1, task-A2 — output roots of one decomposition, groupId=group-A
//       task-B1, task-B2 — output roots of another decomposition, groupId=group-B
//     step-2 — decompose+1, the handoff destination
//     step-3 (recurse: true) — where the recurse fires
//     step-4 — recurse+1
function makeState(): TestState {
  return {
    nodes: {
      'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
      'workflow': { id: 'workflow', content: 'WF', children: ['step-1', 'step-2', 'step-3', 'step-4'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step-1': { id: 'step-1', content: 'Step 1', children: ['task-A1', 'task-A2', 'task-B1', 'task-B2'], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
      'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      'step-3': { id: 'step-3', content: 'Step 3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous', recurse: true } },
      'step-4': { id: 'step-4', content: 'Step 4', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      'task-A1': { id: 'task-A1', content: 'A1', children: [], metadata: { isBlueprint: true, groupId: 'group-A', sessionId: 'session-A' } },
      'task-A2': { id: 'task-A2', content: 'A2', children: [], metadata: { isBlueprint: true, groupId: 'group-A' } },
      'task-B1': { id: 'task-B1', content: 'B1', children: [], metadata: { isBlueprint: true, groupId: 'group-B', sessionId: 'session-B' } },
      'task-B2': { id: 'task-B2', content: 'B2', children: [], metadata: { isBlueprint: true, groupId: 'group-B' } },
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      'root': [],
      'workflow': ['root'],
      'step-1': ['root', 'workflow'],
      'step-2': ['root', 'workflow'],
      'step-3': ['root', 'workflow'],
      'step-4': ['root', 'workflow'],
      'task-A1': ['root', 'workflow', 'step-1'],
      'task-A2': ['root', 'workflow', 'step-1'],
      'task-B1': ['root', 'workflow', 'step-1'],
      'task-B2': ['root', 'workflow', 'step-1'],
    },
    workflowExecutionStates: {},
    workflowSessionMap: { 'session-A': 'terminal-A', 'session-B': 'terminal-B' },
    sessionRegistry: {},
    terminalNodeAssignments: {},
    contextDeclarations: [],
  };
}

describe('recurse + decomposition terminal scoping — cross-session group isolation', () => {
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  beforeEach(() => {
    state = makeState();
    setState = (partial) => { state = { ...state, ...partial }; };
    vi.clearAllMocks();
    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback.md'),
    );
  });

  function placeTaskOnRecurseStepRunning(taskId: string, terminalId: string): void {
    state.nodes['step-1'].children = state.nodes['step-1'].children.filter((id) => id !== taskId);
    state.nodes['step-3'].children = [...state.nodes['step-3'].children, taskId];
    state.ancestorRegistry[taskId] = ['root', 'workflow', 'step-3'];
    state.workflowExecutionStates[taskId] = { state: 'running', terminalTabId: terminalId };
    state.terminalNodeAssignments[terminalId] = taskId;
  }

  it('session B passing the recurse step does not advance session A\'s pending sibling', () => {
    vi.useFakeTimers();
    placeTaskOnRecurseStepRunning('task-B1', 'terminal-B');

    actions.handleHookEvent({ session_id: 'session-B', hook_event_name: 'Stop' });
    vi.advanceTimersByTime(4000);

    expect(state.nodes['step-2'].children).toContain('task-B2');
    expect(state.nodes['step-2'].children).not.toContain('task-A1');
    expect(state.nodes['step-2'].children).not.toContain('task-A2');
    expect(state.nodes['step-1'].children).toEqual(expect.arrayContaining(['task-A1', 'task-A2']));

    vi.useRealTimers();
  });

  it('session A passing the recurse step does not advance session B\'s pending sibling', () => {
    vi.useFakeTimers();
    placeTaskOnRecurseStepRunning('task-A1', 'terminal-A');

    actions.handleHookEvent({ session_id: 'session-A', hook_event_name: 'Stop' });
    vi.advanceTimersByTime(4000);

    expect(state.nodes['step-2'].children).toContain('task-A2');
    expect(state.nodes['step-2'].children).not.toContain('task-B1');
    expect(state.nodes['step-2'].children).not.toContain('task-B2');
    expect(state.nodes['step-1'].children).toEqual(expect.arrayContaining(['task-B1', 'task-B2']));

    vi.useRealTimers();
  });

  it('a session with no remaining group-mates does not steal another group\'s pending sibling', () => {
    vi.useFakeTimers();
    state.nodes['step-1'].children = ['task-A1', 'task-A2']; // remove group B entirely
    state.nodes['task-B1'] = { ...state.nodes['task-B1'], metadata: { ...state.nodes['task-B1'].metadata } };
    state.nodes['step-3'].children = ['task-B1'];
    state.ancestorRegistry['task-B1'] = ['root', 'workflow', 'step-3'];
    state.workflowExecutionStates['task-B1'] = { state: 'running', terminalTabId: 'terminal-B' };
    state.terminalNodeAssignments['terminal-B'] = 'task-B1';

    actions.handleHookEvent({ session_id: 'session-B', hook_event_name: 'Stop' });
    vi.advanceTimersByTime(4000);

    expect(state.nodes['step-2'].children).not.toContain('task-A1');
    expect(state.nodes['step-2'].children).not.toContain('task-A2');
    expect(state.nodes['step-1'].children).toEqual(['task-A1', 'task-A2']);

    vi.useRealTimers();
  });
});

describe('recurse + decomposition terminal scoping — first-child auto-advance pin', () => {
  it.todo('after an automated decompose, the first decomposed child auto-plays in the orchestrator\'s originating terminal');
  it.todo('a second concurrently-open terminal hosting a different session does not pick up the first decomposed child');
  it.todo('the first decomposed child inherits the orchestrator\'s sessionId rather than any other live session\'s sessionId');
  it.todo('when the orchestrator\'s terminal has been closed at advance time, auto-advance falls back to broken-chain handling instead of routing to a foreign terminal');
  it.todo('the orchestrator\'s sessionId being empty or whitespace is treated as no-pin and falls through to fresh spawn, not to another session\'s terminal');
});

describe('recurse + decomposition terminal scoping — subsequent-sibling handoff', () => {
  it.todo('repeated recurse handoffs in session A stay pinned to session A\'s terminal across the full chain, not just the first hop');
});

describe('recurse without a decomposed-sibling group — hard no-op', () => {
  it.todo('a recurse-marked step whose workflow has no decomposition step at all no-ops without dispatching to any terminal');
  it.todo('a recurse-marked step whose decomposition group has been exhausted no-ops without dispatching');
  it.todo('the existing "recurse without decomposition" warning toast still fires once per terminal under this no-op path');
  it.todo('the warning toast does not re-fire on every recurse traversal on the same terminal');
  it.todo('the recurse counter for the chain is cleared so a later decomposition still receives its full iteration budget');
});

describe('recurse + decomposition terminal scoping — regression guard', () => {
  it.todo('existing single-session recurse handoff still routes the next decomposed sibling to the same terminal (no regression of recurseHandoff Case B)');
  it.todo('existing post-decompose auto-advance to step N+1 still works when only one session is open (no regression of decomposedChildrenAutoAdvance)');
  it.todo('manual (non-automated) decomposition path is unchanged — no new terminal pinning is forced on manual decompose flows');
  it.todo('the existing 50-iteration recurse safety limit still fires under the new terminal-pinned dispatch');
});
