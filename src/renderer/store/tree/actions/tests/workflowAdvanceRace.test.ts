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

const { mockParseFeedbackContent } = vi.hoisted(() => ({ mockParseFeedbackContent: vi.fn() }));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

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
      workflow: {
        id: 'workflow',
        content: 'Workflow',
        children: ['step-1', 'step-2'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'step-1': {
        id: 'step-1',
        content: 'Step 1',
        children: ['task-a'],
        metadata: { isBlueprint: true, stepType: 'autonomous' },
      },
      'step-2': {
        id: 'step-2',
        content: 'Step 2',
        children: [],
        metadata: { isBlueprint: true, stepType: 'autonomous' },
      },
      'task-a': {
        id: 'task-a',
        content: 'Task A',
        children: [],
        metadata: { isBlueprint: true },
      },
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      root: [],
      workflow: ['root'],
      'step-1': ['root', 'workflow'],
      'step-2': ['root', 'workflow'],
      'task-a': ['root', 'workflow', 'step-1'],
    },
    workflowExecutionStates: {
      'task-a': { state: 'running', terminalTabId: 'terminal-1', collaborating: true },
    },
    workflowSessionMap: { 'session-1': 'terminal-1' },
    sessionRegistry: {},
    contextDeclarations: [],
  };
}

describe('advanceOrClearCollaborating idempotent advance gate', () => {
  let state: TestState;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = makeBaseState();
    mockParseFeedbackContent.mockImplementation((content: string) => {
      if (!content || !content.startsWith('#')) return null;
      return {
        nodes: { 'new-root': { id: 'new-root', content: 'replaced', children: [], metadata: {} } },
        rootNodeId: 'new-root',
        rootNodeIds: ['new-root'],
        nodeCount: 1,
      };
    });

    actions = createWorkflowExecutionActions(
      () => state,
      (partial) => { state = { ...state, ...partial }; },
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback-task-a.md'),
      vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute()),
    );
  });

  describe('idempotency', () => {
    it('a duplicate Stop on the terminal step still completes only once (entry deleted, no double toast)', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      actions.handleAutonomousFeedback('task-a', '# Task A');
      // Initial advance lands task-a in the terminal step-2. completeWorkflow
      // ran and the entry is gone; a duplicate Stop arriving after the
      // terminal-step boundary must not crash and must not re-emit success.
      mockAddToast.mockClear();
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      const completeCalls = mockAddToast.mock.calls.filter(
        (call) => typeof call[0] === 'string' && /Workflow complete/i.test(call[0]),
      );
      expect(completeCalls).toHaveLength(0);
    });

    it('known gap — duplicate Stop after feedback-before-Stop ordering over-advances on a non-terminal step (per-step gate deferred to follow-up PR)', () => {
      // Stop-before-feedback has implicit idempotency: the `collaborating`
      // flag stays true through the advance, so a duplicate Stop falls into
      // the "defer to stopReceived" branch and does not re-advance. The gap
      // only appears in feedback-before-Stop ordering, where feedback clears
      // collaborating=false before the first Stop arrives, leaving the
      // post-advance entry vulnerable to a stale duplicate Stop.
      state.nodes['step-3'] = {
        id: 'step-3',
        content: 'Step 3',
        children: [],
        metadata: { isBlueprint: true, stepType: 'autonomous' },
      } as never;
      state.nodes['workflow'].children = ['step-1', 'step-2', 'step-3'];
      state.ancestorRegistry['step-3'] = ['root', 'workflow'];

      // Feedback first → collaborating cleared, no advance yet.
      actions.handleAutonomousFeedback('task-a', '# Task A');
      expect(state.workflowExecutionStates['task-a']?.collaborating).toBeFalsy();

      // First Stop advances task-a into step-2.
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state.nodes['step-2'].children).toContain('task-a');

      // Duplicate Stop now sees collaborating=false on step-2's entry and
      // hits advanceNode again, pushing task-a into step-3 (the gap). A
      // follow-up PR will track step-boundary identity per entry so the
      // duplicate becomes a no-op.
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-3'].children).toContain('task-a');
    });
  });

  describe('arrival ordering — happy paths', () => {
    it('Stop-before-feedback: Stop is deferred, feedback triggers advance', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      expect(state.workflowExecutionStates['task-a'].stopReceived).toBe(true);
      expect(state.nodes['step-2'].children).not.toContain('task-a');

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('feedback-before-Stop: feedback accepts and clears collaborating, Stop triggers advance', () => {
      actions.handleAutonomousFeedback('task-a', '# Task A');
      expect(state.workflowExecutionStates['task-a']?.collaborating).toBeFalsy();
      expect(state.nodes['step-2'].children).not.toContain('task-a');

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(state.nodes['step-2'].children).toContain('task-a');
    });
  });

  describe('user-stop short-circuits', () => {
    it('does not advance after the user stops the workflow before either signal completes the gate', () => {
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      actions.stopWorkflow('task-a');

      actions.handleAutonomousFeedback('task-a', '# Task A');

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.nodes['step-1'].children).toContain('task-a');
      expect(state.nodes['step-2'].children).not.toContain('task-a');
    });
  });
});
