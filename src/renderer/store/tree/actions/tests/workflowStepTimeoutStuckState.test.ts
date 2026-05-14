import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createStepTimeoutManager, isNodeRunning } from '../workflowStepTimeouts';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';

describe('createStepTimeoutManager primitives', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('invokes onTimeout for a node that is still running at fire time', () => {
    const onTimeout = vi.fn();
    const mgr = createStepTimeoutManager({
      getTimeoutMinutes: () => 1,
      isStillRunning: () => true,
      onTimeout,
    });

    mgr.start('task-a');
    vi.advanceTimersByTime(60 * 1000);

    expect(onTimeout).toHaveBeenCalledWith('task-a');
  });

  it('does not invoke onTimeout when the node finished before the timer fired', () => {
    const onTimeout = vi.fn();
    const mgr = createStepTimeoutManager({
      getTimeoutMinutes: () => 1,
      isStillRunning: () => false,
      onTimeout,
    });

    mgr.start('task-a');
    vi.advanceTimersByTime(60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('clear() prevents a pending timer from firing', () => {
    const onTimeout = vi.fn();
    const mgr = createStepTimeoutManager({
      getTimeoutMinutes: () => 1,
      isStillRunning: () => true,
      onTimeout,
    });

    mgr.start('task-a');
    mgr.clear('task-a');
    vi.advanceTimersByTime(60 * 1000);

    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('a non-positive timeout disables the timer entirely', () => {
    const onTimeout = vi.fn();
    const mgr = createStepTimeoutManager({
      getTimeoutMinutes: () => 0,
      isStillRunning: () => true,
      onTimeout,
    });

    mgr.start('task-a');
    vi.advanceTimersByTime(60 * 1000 * 60);

    expect(onTimeout).not.toHaveBeenCalled();
  });
});

describe('isNodeRunning predicate', () => {
  it('returns true when the entry state is "running"', () => {
    expect(isNodeRunning({ 'task-a': { state: 'running', terminalTabId: 't' } }, 'task-a')).toBe(true);
  });

  it('returns false for awaiting-validation entries', () => {
    expect(isNodeRunning({ 'task-a': { state: 'awaiting-validation', terminalTabId: 't' } }, 'task-a')).toBe(false);
  });

  it('returns false for absent entries', () => {
    expect(isNodeRunning({}, 'task-a')).toBe(false);
  });

  it('returns false when the entry has transitioned to the new stuck state', () => {
    expect(
      isNodeRunning({ 'task-a': { state: 'stuck', terminalTabId: 't' } }, 'task-a'),
    ).toBe(false);
  });
});

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: '', nodeContent: 'prompt' }),
    getAppliedContextIdWithInheritance: () => null,
    resolveContextFlags: () => ({ collaborate: true, execute: false }),
    resolveContextMode: () => 'collaborate',
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: () => 'mock prompt',
}));

vi.mock('@/store/preferences/preferencesStore', () => ({
  usePreferencesStore: {
    getState: () => ({
      hasReceivedHookEvent: true,
      hasLaunchedWorkflow: true,
      stepTimeoutMinutes: 1,
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

vi.mock('@/services/feedback/feedbackService', () => ({ parseFeedbackContent: vi.fn() }));

vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn(), undo: vi.fn() })),
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

vi.stubGlobal('window', {
  electron: {
    stopKeepAwake: vi.fn().mockResolvedValue(undefined),
    stopFeedbackFileWatcher: vi.fn().mockResolvedValue(undefined),
    startKeepAwake: vi.fn().mockResolvedValue(undefined),
    terminalWrite: vi.fn().mockResolvedValue(undefined),
  },
});

type ExecState = {
  state: 'running' | 'awaiting-validation' | 'stuck';
  terminalTabId: string;
  needsReview?: boolean;
  collaborating?: boolean;
  stopReceived?: boolean;
};

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, ExecState>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  contextDeclarations: unknown[];
};

function makeBaseState(): TestState {
  return {
    nodes: {
      root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
      workflow: { id: 'workflow', content: 'W', children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } },
      'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      root: [],
      workflow: ['root'],
      'step-1': ['root', 'workflow'],
      'task-a': ['root', 'workflow', 'step-1'],
    },
    workflowExecutionStates: {
      'task-a': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
    },
    workflowSessionMap: { 'session-1': 'terminal-1' },
    sessionRegistry: {},
    contextDeclarations: [],
  };
}

describe('stuck-state surfacing — reaper wiring', () => {
  let state: TestState;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    state = makeBaseState();
    actions = createWorkflowExecutionActions(
      () => state,
      (partial) => { state = { ...state, ...partial }; },
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback-task-a.md'),
      vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute()),
    );
    // The startWorkflow path also starts the timer; here we mimic the running state
    // already established and have the actions registered. To exercise the reaper,
    // call advanceNode-equivalent setup by directly triggering an action that starts the timer.
    // resendStep transitions awaiting-validation → running on the supplied terminal and
    // starts the step-timeout reaper. Test harness uses it as the public hook that
    // populates the running state + timer in one call.
    actions.resendStep('task-a', 'terminal-1');
  });

  it('transitions the node from running to stuck when the timeout fires', () => {
    vi.advanceTimersByTime(60 * 1000);

    expect(state.workflowExecutionStates['task-a']?.state).toBe('stuck');
  });

  it('clears the green playing indicator (state !== running) when the timeout fires', () => {
    vi.advanceTimersByTime(60 * 1000);

    expect(state.workflowExecutionStates['task-a']?.state).not.toBe('running');
  });

  it('shows a persistent toast with Resume and Stop actions when transitioning to stuck', () => {
    vi.advanceTimersByTime(60 * 1000);

    const stuckCalls = mockAddToast.mock.calls.filter((call) => /stuck/i.test(String(call[0])));
    expect(stuckCalls.length).toBeGreaterThan(0);
    const toastOptions = stuckCalls[0][2] as { actions?: { label: string }[] } | undefined;
    const labels = toastOptions?.actions?.map((a) => a.label) ?? [];
    expect(labels).toContain('Resume');
    expect(labels).toContain('Stop');
  });

  it('resumeStuckNode unsticks the entry and advances the workflow', () => {
    vi.advanceTimersByTime(60 * 1000);
    expect(state.workflowExecutionStates['task-a']?.state).toBe('stuck');

    actions.resumeStuckNode('task-a');

    // Fixture has only step-1, so advancing past the terminal step completes
    // the workflow and removes the execution entry. The key invariant is that
    // resume did NOT leave the node parked at 'stuck'.
    expect(state.workflowExecutionStates['task-a']?.state).not.toBe('stuck');
  });

  it('resumeStuckNode is a no-op on a running node (only stuck nodes resume)', () => {
    expect(state.workflowExecutionStates['task-a']?.state).toBe('running');

    actions.resumeStuckNode('task-a');

    expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
  });

  it('stopWorkflow removes a stuck node from the execution states', () => {
    vi.advanceTimersByTime(60 * 1000);
    expect(state.workflowExecutionStates['task-a']?.state).toBe('stuck');

    actions.stopWorkflow('task-a');

    expect(state.workflowExecutionStates['task-a']).toBeUndefined();
  });
});
