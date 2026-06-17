import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import { useTerminalStore } from '../../../terminal/terminalStore';

// TDD for the "Start workflow in new session" action.
//
// Assumed API (defines it for the implementation step): a new store action
//   actions.startWorkflowInNewSession(nodeId, terminalId)
// that, on an ELIGIBLE node, clears the node's sessionId (so decideWorkflowStartRoute
// yields spawn-fresh) and — when present — removes its groupId, then starts the
// workflow. The confirmation dialog lives in the UI layer and is gated on the route
// the node would otherwise take (focus/resume ⇒ prompt; spawn-fresh ⇒ silent).
//
// The concrete tests below are RED until the action exists. The title-only tests
// cover behaviour whose post-fix shape is still uncertain (UI dialog, the 2s
// hand-off race guard, multi-root anchor, persistence/exclusivity).

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

describe('startWorkflowInNewSession', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  // Resolve the action regardless of whether it exists yet, so the concrete tests
  // fail loudly (TypeError) rather than the file failing to load.
  const startInNewSession = (nodeId: string, terminalId: string | null): Promise<void> =>
    (actions as unknown as {
      startWorkflowInNewSession: (n: string, t: string | null) => Promise<void> | void;
    }).startWorkflowInNewSession(nodeId, terminalId) as Promise<void>;

  beforeEach(() => {
    // root → workflow(isWorkflow) → step-1(autonomous) → task-a, task-b
    state = {
      nodes: {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'Workflow', children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a', 'task-b'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
        'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: {} },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
        'task-b': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-pre': 'terminal-1' },
      terminalNodeAssignments: {},
      contextDeclarations: [],
      sessionRegistry: {},
    };

    setState = (partial) => { state = { ...state, ...partial }; };

    vi.clearAllMocks();
    useTerminalStore.setState({ terminals: [] });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback.md'),
    );
  });

  it('clears the bound session and starts a fresh spawn on a bound, non-decomposed node', async () => {
    state.nodes['task-a'].metadata.sessionId = 'session-pre';

    await startInNewSession('task-a', 'terminal-1');

    expect(state.nodes['task-a'].metadata.sessionId).toBeUndefined();
    expect(state.workflowExecutionStates['task-a']).toEqual(
      expect.objectContaining({ state: 'running', terminalTabId: 'terminal-1' }),
    );
  });

  it('removes the groupId of a decomposed sibling and starts a fresh spawn', async () => {
    state.nodes['task-a'].metadata.sessionId = 'session-pre';
    state.nodes['task-a'].metadata.groupId = 'group-A';

    await startInNewSession('task-a', 'terminal-1');

    expect(state.nodes['task-a'].metadata.groupId).toBeUndefined();
    expect(state.nodes['task-a'].metadata.sessionId).toBeUndefined();
    expect(state.workflowExecutionStates['task-a']).toEqual(
      expect.objectContaining({ state: 'running', terminalTabId: 'terminal-1' }),
    );
  });

  it('does not mutate an ineligible (already-running) node — eligibility is checked before clearing sessionId/groupId', async () => {
    state.nodes['task-a'].metadata.sessionId = 'session-pre';
    state.nodes['task-a'].metadata.groupId = 'group-A';
    state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

    await startInNewSession('task-a', 'terminal-2');

    expect(state.nodes['task-a'].metadata.sessionId).toBe('session-pre');
    expect(state.nodes['task-a'].metadata.groupId).toBe('group-A');
  });

  it('on an un-played grouped sibling (no prior session) removes the groupId and starts fresh', async () => {
    state.nodes['task-a'].metadata.groupId = 'group-A';

    await startInNewSession('task-a', 'terminal-1');

    expect(state.nodes['task-a'].metadata.groupId).toBeUndefined();
    expect(state.workflowExecutionStates['task-a']).toEqual(
      expect.objectContaining({ state: 'running', terminalTabId: 'terminal-1' }),
    );
  });

  // Confirmation gating + menu visibility are covered in
  // useNodeContextMenu.test.tsx; the 2s hand-off race guard in
  // recurseHandoff.test.ts; the detach/anchor selection in workflowHelpersDetach.test.ts.
});
