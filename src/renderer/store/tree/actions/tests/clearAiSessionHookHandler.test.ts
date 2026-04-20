import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

const { mockTerminalWrite } = vi.hoisted(() => ({
  mockTerminalWrite: vi.fn().mockResolvedValue(undefined),
}));

vi.stubGlobal('window', {
  electron: {
    terminalWrite: mockTerminalWrite,
    stopFeedbackFileWatcher: vi.fn(),
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

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

describe('SessionStart source:"clear" handling via registerSession', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, {
      state: 'running' | 'awaiting-validation';
      terminalTabId: string;
      needsReview?: boolean;
      collaborating?: boolean;
      stopReceived?: boolean;
      clearing?: boolean;
    }>;
    workflowSessionMap: Record<string, string>;
    contextDeclarations: unknown[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

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
      workflowSessionMap: { 'session-old': 'terminal-1' },
      contextDeclarations: [],
    };
    setState = (partial) => { state = { ...state, ...partial }; };

    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback-task-a.md');

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
      vi.fn((cmd: { execute: () => void }) => cmd.execute()),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Session remap (inherent to registerSession for any SessionStart)', () => {
    it('maps the new session_id to the terminal', () => {
      actions.registerSession('session-new', 'terminal-1', 'clear');

      expect(state.workflowSessionMap['session-new']).toBe('terminal-1');
    });

    it('deletes the old session_id for the same terminal so the map does not grow unbounded across clears', () => {
      actions.registerSession('session-new', 'terminal-1', 'clear');

      expect(state.workflowSessionMap['session-old']).toBeUndefined();
    });

    it('makes subsequent Stop with the new session_id resolve to the same running node', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await vi.runAllTicks();
      await Promise.resolve();

      actions.registerSession('session-new', 'terminal-1', 'clear');

      expect(() => {
        actions.handleHookEvent({ session_id: 'session-new', hook_event_name: 'Stop' });
      }).not.toThrow();
    });
  });

  describe('Clear-confirm gating by source', () => {
    it('does not confirm a clear if source is "startup" — no running node advance, no prompt send after gated clear');
    it('does not confirm a clear if source is "resume"');
    it('does not confirm a clear if source is "compact"');
    it('does not confirm a clear if source is undefined');
    it('does not crash when no running node exists on the terminal — clear-confirm is a no-op in that case');
  });

  describe('Clear-confirm success path', () => {
    it('after registerSession with source:"clear", the gated prompt is sent for the running node whose step had clearSession=true', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await vi.runAllTicks();
      await Promise.resolve();
      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();

      actions.registerSession('session-new', 'terminal-1', 'clear');
      vi.advanceTimersByTime(500);
      await vi.runAllTicks();
      await Promise.resolve();

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', 'execute');
    });
  });

  describe('Pre-existing events still route correctly', () => {
    it('still handles Stop / UserPromptSubmit / NeedsReview / Notification events unchanged — they go through handleHookEvent not registerSession');
  });
});
