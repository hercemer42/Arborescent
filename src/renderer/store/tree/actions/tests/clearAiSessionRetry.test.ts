import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockTerminalWrite } = vi.hoisted(() => ({
  mockTerminalWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('window', {
  electron: {
    terminalWrite: mockTerminalWrite,
    startKeepAwake: vi.fn(),
    stopKeepAwake: vi.fn(),
  },
});

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: '', nodeContent: 'prompt text' }),
    getAppliedContextIdWithInheritance: () => null,
    resolveContextMode: () => 'execute',
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

vi.mock('@/services/feedback/feedbackService', () => ({ parseFeedbackContent: vi.fn() }));

vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({ execute: vi.fn(), undo: vi.fn() })),
}));

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({ mockNotifyWorkflowEvent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: mockNotifyWorkflowEvent }));

describe('Clear AI session — retry behaviour', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, {
      state: 'running' | 'awaiting-validation' | 'stuck';
      terminalTabId: string;
      needsReview?: boolean;
      collaborating?: boolean;
      stopReceived?: boolean;
      clearing?: boolean;
    }>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: unknown[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockTerminalWrite.mockClear();
    mockTerminalWrite.mockResolvedValue(undefined);

    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': {
          id: 'step-1',
          content: 'Step 1',
          children: ['task-a'],
          metadata: { isBlueprint: true, stepType: 'autonomous', clearSession: true },
        },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-1': 'terminal-1' },
      contextDeclarations: [],
      sessionRegistry: {},
    };
    setState = (partial) => { state = { ...state, ...partial }; };

    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback-task-a.md');
    mockExecuteCommand = vi.fn((cmd: { execute: () => void }) => cmd.execute());

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      {
        flashNode: vi.fn(),
        scrollToNode: vi.fn(),
        startDeleteAnimation: vi.fn(),
        clearDeleteAnimation: vi.fn(),
      },
      mockAutonomousCollaborate,
      mockExecuteCommand,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Retry on confirmation timeout', () => {
    it('re-writes /clear to the terminal when the SessionStart source:"clear" confirmation does not arrive within the timeout window', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      const writesBefore = mockTerminalWrite.mock.calls.filter(
        ([, p]) => typeof p === 'string' && p.includes('/clear'),
      ).length;

      vi.advanceTimersByTime(30000);

      const writesAfter = mockTerminalWrite.mock.calls.filter(
        ([, p]) => typeof p === 'string' && p.includes('/clear'),
      ).length;

      expect(writesAfter).toBeGreaterThan(writesBefore);
    });

    it('uses a retry counter separate from the prompt-ACK retry counter — a prior prompt-retry history does not reduce the clear budget');
  });

  describe('Retry cap', () => {
    it('stops the workflow and does not send the prompt after the maximum clear-retry count has been exhausted without confirmation');

    it('fires an error toast naming the step when the clear retry cap is hit');

    it('clears any pending retry timer once the cap has errored the step — no further /clear writes after the cap');
  });

  describe('Idempotence on late / duplicate confirmation', () => {
    it('advances to prompt-send on the first SessionStart source:"clear" and ignores subsequent duplicates — no double-send of the prompt');

    it('ignores SessionStart source:"clear" that arrives after the step has already been errored by the cap');
  });

  describe('Disruption during the clearing phase', () => {
    it('stopWorkflow during clearing cancels pending retries and does not subsequently send the prompt');

    it('handleTerminalClosed during clearing cancels pending retries and does not subsequently send the prompt');

    it('handleNodeDeleted during clearing cancels pending retries and does not subsequently send the prompt');
  });

  describe('Hard write failure vs. timeout', () => {
    it('marks the step errored and does not schedule a retry when the terminal write itself rejects (hard failure, distinct from a confirmation timeout)');
  });
});
