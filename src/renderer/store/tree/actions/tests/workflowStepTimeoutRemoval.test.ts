import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';

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
      markHookEventReceived: vi.fn(),
      markWorkflowLaunched: vi.fn(),
    }),
  },
}));

vi.mock('@/services/feedback/feedbackService', () => ({ parseFeedbackContent: vi.fn() }));

vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn(), undo: vi.fn() })),
}));

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({ mockNotifyWorkflowEvent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: mockNotifyWorkflowEvent }));

vi.stubGlobal('window', {
  electron: {
    stopKeepAwake: vi.fn().mockResolvedValue(undefined),
    startKeepAwake: vi.fn().mockResolvedValue(undefined),
    terminalWrite: vi.fn().mockResolvedValue(undefined),
  },
});

type ExecState = {
  state: 'running' | 'awaiting-validation';
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

describe('workflow step timeout removal — no stuck state, no timeout toast', () => {
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
    actions.resendStep('task-a', 'terminal-1');
  });

  it('keeps the node in running state after the legacy timeout interval elapses', () => {
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
  });

  it('never sets any execution entry to the removed stuck state', () => {
    vi.advanceTimersByTime(60 * 60 * 1000);

    const states = Object.values(state.workflowExecutionStates).map((entry) => entry?.state);
    expect(states).not.toContain('stuck');
  });

  it('does not surface a stuck toast through the toast store', () => {
    vi.advanceTimersByTime(60 * 60 * 1000);

    const stuckToastCalls = mockAddToast.mock.calls.filter((call) =>
      /stuck/i.test(String(call[0])),
    );
    expect(stuckToastCalls).toHaveLength(0);
  });

  it('does not raise a stuck workflow alert through the notification service', () => {
    vi.advanceTimersByTime(60 * 60 * 1000);

    const stuckAlertCalls = mockNotifyWorkflowEvent.mock.calls.filter(
      (call) => call[0] === 'alert' && /stuck/i.test(String(call[1])),
    );
    expect(stuckAlertCalls).toHaveLength(0);
  });

  it('exposes no resumeStuckNode action on the public surface', () => {
    expect((actions as unknown as Record<string, unknown>).resumeStuckNode).toBeUndefined();
  });
});
