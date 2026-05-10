import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
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
      stepTimeoutMinutes: 10,
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

describe('workflow runner keep-awake integration', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: never[];
  };

  let state: TestState;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  beforeEach(() => {
    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
      contextDeclarations: [],
      sessionRegistry: {},
    };

    const setState = (partial: Partial<TestState>) => {
      state = { ...state, ...partial };
    };

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback.md'),
    );
  });

  it('startWorkflow acquires keep-awake when the node enters the running state', () => {
    actions.startWorkflow('task-a', 'terminal-1');
    expect(window.electron.startKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('startWorkflow does not acquire keep-awake when no terminal is available (early return)', () => {
    actions.startWorkflow('task-a', null);
    expect(window.electron.startKeepAwake).not.toHaveBeenCalled();
  });

  it('startWorkflow does not acquire keep-awake when the node is ineligible (e.g. not inside an autonomous step)', () => {
    actions.startWorkflow('workflow', 'terminal-1');
    expect(window.electron.startKeepAwake).not.toHaveBeenCalled();
  });

  it('startWorkflow does not acquire keep-awake when the terminal is already running another node', () => {
    state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
    actions.startWorkflow('task-b', 'terminal-1');
    expect(window.electron.startKeepAwake).not.toHaveBeenCalled();
  });

  it('stopWorkflow releases keep-awake when the node was running', () => {
    state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
    actions.stopWorkflow('task-a');
    expect(window.electron.stopKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('stopWorkflow does not release keep-awake when there was no running entry (early return)', () => {
    actions.stopWorkflow('task-a');
    expect(window.electron.stopKeepAwake).not.toHaveBeenCalled();
  });

  it('completeWorkflow releases keep-awake when an entry existed for the node', () => {
    state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };
    actions.completeWorkflow('task-a');
    expect(window.electron.stopKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('completeWorkflow does not release keep-awake when no entry existed (defensive — never paired a start)', () => {
    actions.completeWorkflow('task-a');
    expect(window.electron.stopKeepAwake).not.toHaveBeenCalled();
  });

  it('start/stop pair emits exactly one start and one stop end-to-end', () => {
    actions.startWorkflow('task-a', 'terminal-1');
    actions.stopWorkflow('task-a');
    expect(window.electron.startKeepAwake).toHaveBeenCalledTimes(1);
    expect(window.electron.stopKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('concurrent workflows on different terminals each emit their own start (ref-count handled in main)', () => {
    state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
    state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
    state.nodes['step-1'].children.push('task-b');

    actions.startWorkflow('task-a', 'terminal-1');
    actions.startWorkflow('task-b', 'terminal-2');

    expect(window.electron.startKeepAwake).toHaveBeenCalledTimes(2);
  });
});
