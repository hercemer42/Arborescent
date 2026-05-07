import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

vi.mock('../../../services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

const { mockResolveContextMode } = vi.hoisted(() => ({
  mockResolveContextMode: vi.fn().mockReturnValue('execute'),
}));
vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock prompt text' }),
    getAppliedContextIdWithInheritance: () => 'context-1',
    resolveContextMode: (...args: unknown[]) => mockResolveContextMode(...args), resolveContextFlags: (...args: unknown[]) => { const m = mockResolveContextMode(...args); return m === 'execute' ? { collaborate: false, execute: true } : { collaborate: true, execute: false }; },
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({
  buildExecutePrompt: () => 'mock prompt text',
}));

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

vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: vi.fn(),
}));

vi.mock('../commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({
  mockNotifyWorkflowEvent: vi.fn(),
}));
vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: mockNotifyWorkflowEvent,
}));


describe('UserPromptSubmit ACK handling with retry', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockVisualEffects: {
    flashNode: ReturnType<typeof vi.fn>;
    scrollToNode: ReturnType<typeof vi.fn>;
    startDeleteAnimation: ReturnType<typeof vi.fn>;
    clearDeleteAnimation: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    state = {
      nodes: {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'workflow': ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: { 'session-1': 'terminal-1' },
      contextDeclarations: [],
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    vi.clearAllMocks();
    mockTriggerAutosave = vi.fn();
    mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) =>
      Promise.resolve(`/tmp/feedback-response-${nodeId}.md`),
    );
    mockExecuteCommand = vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute());
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

  async function primeRunningStep(): Promise<void> {
    actions.startWorkflow('task-a', 'terminal-1');
    // Flush the autonomousCollaborate promise so the ACK registration runs.
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  }

  describe('ACK consumption on matching UserPromptSubmit', () => {
    it('clears the pending ACK when UserPromptSubmit arrives with matching session_id and signature, so no retry fires', async () => {
      await primeRunningStep();
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAck);
    });

    it('does not treat UserPromptSubmit with no pending entry as a miss (no-op, no errors)', () => {
      // No startWorkflow called first — no pending ACK exists.
      expect(() => {
        actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });
      }).not.toThrow();

      expect(mockAddToast).not.toHaveBeenCalled();
      expect(mockNotifyWorkflowEvent).not.toHaveBeenCalled();
    });

    it('tolerates trailing whitespace / newline differences between sent prompt and ACK payload signature');
  });

  describe('Retry on ACK timeout', () => {
    it('resends the prompt when the ACK timeout elapses with no UserPromptSubmit received', async () => {
      await primeRunningStep();
      const sendsBeforeTimeout = mockAutonomousCollaborate.mock.calls.length;

      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsBeforeTimeout);
    });

    it('restarts the timer after a retry so a second timeout can trigger another retry', async () => {
      await primeRunningStep();
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();
      const sendsAfterFirstRetry = mockAutonomousCollaborate.mock.calls.length;

      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsAfterFirstRetry);
    });
  });

  describe('Retry cap behavior', () => {
    it('stops the workflow via stopWorkflow after the retry cap is reached', async () => {
      await primeRunningStep();
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
        await vi.runAllTicks();
      }

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('fires an error toast naming the step when the retry cap is reached', async () => {
      await primeRunningStep();
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
        await vi.runAllTicks();
      }

      expect(mockAddToast).toHaveBeenCalledWith(expect.any(String), 'error');
    });

    it('calls notifyWorkflowEvent with "alert" severity when the retry cap is reached', async () => {
      await primeRunningStep();
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
        await vi.runAllTicks();
      }

      expect(mockNotifyWorkflowEvent).toHaveBeenCalledWith('alert', expect.any(String), expect.any(String));
    });

    it('does not continue retrying after the cap has stopped the workflow', async () => {
      await primeRunningStep();
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
        await vi.runAllTicks();
      }
      const sendsAtCap = mockAutonomousCollaborate.mock.calls.length;

      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsAtCap);
    });

    it('ignores a late-arriving UserPromptSubmit after the workflow has been stopped at the retry cap', async () => {
      await primeRunningStep();
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(10000);
        await vi.runAllTicks();
      }
      mockAddToast.mockClear();

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });

      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });

  describe('ACK cleanup on disruption', () => {
    it('clears the pending ACK on stopWorkflow, so no retry fires afterwards', async () => {
      await primeRunningStep();
      const sendsBefore = mockAutonomousCollaborate.mock.calls.length;

      actions.stopWorkflow('task-a');
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBefore);
    });

    it('clears the pending ACK on handleTerminalClosed, so no retry fires afterwards', async () => {
      await primeRunningStep();
      const sendsBefore = mockAutonomousCollaborate.mock.calls.length;

      actions.handleTerminalClosed('terminal-1');
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBefore);
    });

    it('clears the pending ACK on handleNodeDeleted, so no retry fires afterwards', async () => {
      await primeRunningStep();
      const sendsBefore = mockAutonomousCollaborate.mock.calls.length;

      actions.handleNodeDeleted('task-a');
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBefore);
    });

    it('clears the pending ACK on handleNodeMovedManually, so no retry fires afterwards', async () => {
      await primeRunningStep();
      const sendsBefore = mockAutonomousCollaborate.mock.calls.length;

      actions.handleNodeMovedManually('task-a');
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBefore);
    });

    it('clears all pending ACKs on initializeExecutionState (app restart semantics), so no retries fire for stopped workflows', async () => {
      await primeRunningStep();
      const sendsBefore = mockAutonomousCollaborate.mock.calls.length;

      actions.initializeExecutionState();
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBefore);
    });
  });

  describe('Isolation between terminals', () => {
    it("does not consume terminal-1's pending ACK when UserPromptSubmit arrives for an unrelated session on a different terminal", async () => {
      // Second workflow on terminal-2
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
      state.nodes['step-1'].children = ['task-a', 'task-b'];
      state.workflowSessionMap['session-2'] = 'terminal-2';

      await primeRunningStep();
      const sendsForTaskA = mockAutonomousCollaborate.mock.calls.filter(([id]) => id === 'task-a').length;

      // Unrelated session's UserPromptSubmit — should not clear task-a's pending ACK.
      actions.handleHookEvent({ session_id: 'session-2', hook_event_name: 'UserPromptSubmit' });
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.filter(([id]) => id === 'task-a').length).toBeGreaterThan(sendsForTaskA);
    });

    it('ignores UserPromptSubmit for a session_id that is not in workflowSessionMap', async () => {
      await primeRunningStep();
      const sendsBefore = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({ session_id: 'unknown-session', hook_event_name: 'UserPromptSubmit' });
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      // No ACK consumed → retry still fires on timeout, so send count increases.
      expect(mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsBefore);
    });
  });

  describe('Edge cases', () => {
    it('does not register a pending ACK for a node with no context applied (bare content sends skip the ACK loop)', () => {
      // When getAppliedContextIdWithInheritance returns null, autonomousCollaborateInTerminal
      // short-circuits and returns ''. No ACK should be set up.
      // Title-only since implementation hasn't decided whether this path stays out of the ACK loop
      // by construction (no feedback file) or needs an explicit guard.
    });

    it('does not explode when UserPromptSubmit arrives with an empty message field');
  });

  describe('Race: ACK arrives before registerPendingAck', () => {
    it('does not retry when UserPromptSubmit arrives before the autonomousCollaborate promise resolves', async () => {
      let resolveCollaborate!: (value: string) => void;
      mockAutonomousCollaborate.mockImplementationOnce(() =>
        new Promise<string>((resolve) => {
          resolveCollaborate = resolve;
        }),
      );

      actions.startWorkflow('task-a', 'terminal-1');
      await Promise.resolve();

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });

      resolveCollaborate('/tmp/feedback-response-task-a.md');
      await vi.runAllTicks();
      await Promise.resolve();
      await Promise.resolve();

      const sendsAfterPrime = mockAutonomousCollaborate.mock.calls.length;

      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsAfterPrime);
    });
  });
});
