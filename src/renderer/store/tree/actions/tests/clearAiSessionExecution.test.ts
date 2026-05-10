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
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

describe('Clear AI session — runtime clearing phase', () => {
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
  sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  function buildState(stepMetadata: Record<string, unknown>): TestState {
    return {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, ...stepMetadata } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
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
      workflowSessionMap: { 'session-1': 'terminal-1' },
      contextDeclarations: [],
      sessionRegistry: {},
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockTerminalWrite.mockClear();
    mockTerminalWrite.mockResolvedValue(undefined);

    state = buildState({ stepType: 'autonomous', clearSession: true });
    setState = (partial) => { state = { ...state, ...partial }; };

    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockResolvedValue('/tmp/feedback-response-task-a.md');
    mockExecuteCommand = vi.fn((cmd: { execute: () => void }) => cmd.execute());
    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      mockTriggerAutosave,
      mockVisualEffects,
      mockAutonomousCollaborate,
      mockExecuteCommand,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function flushMicrotasks(): Promise<void> {
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  }

  describe('Dispatch with clearSession=true', () => {
    it('writes /clear to the step\'s bound terminal before the prompt is sent', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      const terminalWrites = mockTerminalWrite.mock.calls.map((call) => call as [string, string]);
      const clearWrite = terminalWrites.find(([, payload]) => payload.includes('/clear'));

      expect(clearWrite).toBeDefined();
      expect(clearWrite?.[0]).toBe('terminal-1');
    });

    it('does not send the prompt before the clear has been confirmed', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });

    it('sends the prompt after SessionStart source:"clear" confirmation arrives', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      actions.registerSession('session-new', 'terminal-1', 'clear');
      vi.advanceTimersByTime(500);
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', { collaborate: true, execute: false });
    });

    it('does not send the prompt synchronously with the clear confirmation — there is a small cushion delay first', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      actions.registerSession('session-new', 'terminal-1', 'clear');
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).not.toHaveBeenCalled();
    });

    it('marks the execution entry with a clearing indicator while awaiting confirmation');
  });

  describe('Dispatch with clearSession=false (regression baseline)', () => {
    beforeEach(() => {
      state = buildState({ stepType: 'autonomous' });
      actions = createWorkflowExecutionActions(
        () => state,
        setState,
        mockTriggerAutosave,
        mockVisualEffects,
        mockAutonomousCollaborate,
        mockExecuteCommand,
      );
    });

    it('does NOT write /clear to the terminal when the flag is not set', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      const clearWrite = mockTerminalWrite.mock.calls.find(([, payload]) =>
        typeof payload === 'string' && payload.includes('/clear'),
      );

      expect(clearWrite).toBeUndefined();
    });

    it('sends the prompt immediately as today (no new wait, no clearing state)', async () => {
      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      expect(mockAutonomousCollaborate).toHaveBeenCalledWith('task-a', 'terminal-1', { collaborate: true, execute: false });
    });
  });

  describe('Terminal targeting with multiple terminals open', () => {
    it('writes /clear only to the terminal bound to the running step, not to sibling terminals', async () => {
      state.workflowSessionMap = { 'session-1': 'terminal-1', 'session-2': 'terminal-2' };

      actions.startWorkflow('task-a', 'terminal-1');
      await flushMicrotasks();

      const terminalsWrittenTo = new Set(
        mockTerminalWrite.mock.calls
          .filter(([, payload]) => typeof payload === 'string' && payload.includes('/clear'))
          .map(([tid]) => tid),
      );

      expect(terminalsWrittenTo).toEqual(new Set(['terminal-1']));
    });
  });

  describe('Step-type coverage with clearSession=true', () => {
    it('clears before the prompt for an autonomous step');
    it('clears before the prompt for a checkpoint step');
    it('clears before the prompt for a manual step (if manual steps dispatch content)');
  });

  describe('Re-running the same step with clearSession=true', () => {
    it('fires a fresh /clear on each run — not deduped across invocations');
  });

  describe('Inherited context with clearSession=true', () => {
    it('attaches inherited context to the post-clear prompt (context not dropped by the clear)');
  });
});
