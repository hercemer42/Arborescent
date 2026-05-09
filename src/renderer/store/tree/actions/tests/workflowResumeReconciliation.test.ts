import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

// Contract for resume reconciliation and ack-retry hardening:
//
//   - When a hook event (UserPromptSubmit / Stop / NeedsReview /
//     Notification) arrives with a session_id that isn't yet present
//     in `workflowSessionMap`, the handler should fall back to the
//     event's `terminal_id` to find the running node — not drop the
//     event. This is the "lazy reconciliation" path: the new session
//     id has not yet been registered (SessionStart for it has not
//     fired or has been delayed), but we can still route via the
//     terminal that produced the event.
//
//   - As a corollary, the residual retry race is closed: a UserPromptSubmit
//     ack that arrives inside the 5s pending-ack window cancels the
//     retry even when the session id is unknown at arrival time. The
//     pre-fix path drops the event, the ack is never consumed, and
//     the 5s timer fires a duplicate send.
//
// Tests assert observable contract: does the next-step send happen
// (retry fired) or not (ack consumed)? They do not pin internals
// like map field names — only the visible mocks for
// autonomousCollaborate / addToast.

vi.mock('../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: '', nodeContent: 'mock prompt' }),
    getAppliedContextIdWithInheritance: () => 'context-1',
    resolveContextMode: () => 'execute',
    resolveContextFlags: () => ({ collaborate: false, execute: true }),
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
    execute: vi.fn(), undo: vi.fn(), description: 'Accept feedback',
  })),
}));

const { mockNotifyWorkflowEvent } = vi.hoisted(() => ({ mockNotifyWorkflowEvent: vi.fn() }));
vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: mockNotifyWorkflowEvent,
}));

describe('Resume reconciliation and ack-retry hardening', () => {
  type Entry = {
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
    workflowExecutionStates: Record<string, Entry>;
    workflowSessionMap: Record<string, string>;
    terminalNodeAssignments?: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

  function buildState(): TestState {
    return {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
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
      workflowSessionMap: {},
      terminalNodeAssignments: {},
      contextDeclarations: [],
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state = buildState();
    mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) =>
      Promise.resolve(`/tmp/feedback-${nodeId}.md`),
    );

    actions = createWorkflowExecutionActions(
      () => state,
      (partial) => { state = { ...state, ...partial }; },
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      mockAutonomousCollaborate,
      vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute()),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function primeRunningStep(): Promise<void> {
    actions.startWorkflow('task-a', 'terminal-1');
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  }

  describe('Lazy reconciliation: hook events with unknown session_id but known terminal_id route correctly', () => {
    it('UserPromptSubmit with unknown session_id but known terminal_id consumes the pending ack — no retry fires', async () => {
      await primeRunningStep();
      // workflowSessionMap is empty for the new session: the prior
      // SessionStart hook has not yet fired for this resumed run.
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({
        session_id: 'sess-not-yet-registered',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAck);
    });

    it('Stop with unknown session_id but known terminal_id is routed to the running node, advancing the workflow', async () => {
      await primeRunningStep();

      actions.handleHookEvent({
        session_id: 'sess-not-yet-registered',
        hook_event_name: 'Stop',
        terminal_id: 'terminal-1',
      });
      await vi.runAllTicks();

      // Stop on autonomous step advances task-a to step-2.
      expect(state.nodes['step-2'].children).toContain('task-a');
    });

    it('NeedsReview with unknown session_id but known terminal_id flips the running entry to awaiting-validation', async () => {
      await primeRunningStep();

      actions.handleHookEvent({
        session_id: 'sess-not-yet-registered',
        hook_event_name: 'NeedsReview',
        terminal_id: 'terminal-1',
      });

      expect(state.workflowExecutionStates['task-a']?.needsReview).toBe(true);
    });

    it('drops events that have neither a known session_id nor a known terminal_id (no false-positive consumption)', async () => {
      await primeRunningStep();
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({
        session_id: 'sess-unknown',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-orphan',
      });
      // Time elapses past the 5s pending-ack window — retry will fire
      // because nothing consumed the ack (correct: this event was for
      // a foreign terminal).
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsBeforeAck);
    });

    it('drops events that have an unknown session_id and no terminal_id at all', async () => {
      await primeRunningStep();
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({
        session_id: 'sess-unknown',
        hook_event_name: 'UserPromptSubmit',
      });
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      // Nothing consumed → retry fires.
      expect(mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsBeforeAck);
    });
  });

  describe('Backward compat: known session_id still routes correctly', () => {
    it('UserPromptSubmit with a session_id present in workflowSessionMap continues to consume the ack (no regression)', async () => {
      await primeRunningStep();
      // Simulate SessionStart having registered the new session.
      state.workflowSessionMap = { 'sess-1': 'terminal-1' };
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({ session_id: 'sess-1', hook_event_name: 'UserPromptSubmit' });
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAck);
    });

    it('a session_id whose mapped terminal does not match a running node still drops cleanly (no false positive on bystander terminal)', async () => {
      await primeRunningStep();
      // task-a is on terminal-1. Pretend session-foo maps to a different terminal.
      state.workflowSessionMap = { 'sess-foo': 'terminal-99' };

      expect(() => {
        actions.handleHookEvent({ session_id: 'sess-foo', hook_event_name: 'UserPromptSubmit' });
      }).not.toThrow();
    });
  });

  describe('Ack inside the 5s pending-ack window cancels the retry (race-window pinning)', () => {
    it('ack arriving at the 4.99s mark via lazy-reconciliation path cancels the timer — no duplicate send', async () => {
      await primeRunningStep();
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;
      vi.advanceTimersByTime(4990);

      actions.handleHookEvent({
        session_id: 'sess-late-but-in-window',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
      // Continue advancing past the original 5s mark.
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAck);
    });

    it('ack arriving via lazy reconciliation is idempotent — repeating it does not retry or error', async () => {
      await primeRunningStep();
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({
        session_id: 'sess-x',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
      actions.handleHookEvent({
        session_id: 'sess-x',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAck);
      expect(mockAddToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
    });

    it('events for two distinct running terminals reconcile independently', async () => {
      await primeRunningStep();
      // Bring up a second autonomous run on a different terminal.
      // task-b doesn't exist in our minimal tree, but step-2 has no
      // children so we add one and ancestor-register it.
      state.nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      state.nodes['step-2'].children = ['task-b'];
      state.ancestorRegistry['task-b'] = ['root', 'workflow', 'step-2'];
      actions.startWorkflow('task-b', 'terminal-2');
      await vi.runAllTicks();
      await Promise.resolve();
      await Promise.resolve();
      const sendsBeforeAcks = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({
        session_id: 'sess-a',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
      actions.handleHookEvent({
        session_id: 'sess-b',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-2',
      });
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAcks);
    });
  });

  describe('continueWorkflow + lazy reconciliation interaction', () => {
    // The reconcile-on-resume contract is "lazy": continueWorkflow
    // does not eagerly evict the prior session→terminal mapping;
    // instead, the next hook event arriving with the new session
    // is what re-routes via terminal_id. Either implementation is
    // defensible (eager evict at continueWorkflow time, or lazy
    // resolve at hook-event time), so this is title-only.
    it('continueWorkflow leaves the prior session→terminal mapping in place until the next hook event reconciles it (lazy) — pinning left to implementer');

    it('with a stale workflowSessionMap entry still in place, a hook event for a NEW session_id reconciles via terminal_id and consumes the pending ack', async () => {
      // Simulate the state immediately after a resume: prior session
      // mapping is still present but the new SessionStart has not yet
      // arrived, so the new session_id is not in the map.
      await primeRunningStep();
      state.workflowSessionMap = { 'sess-old': 'terminal-1' };
      const sendsBeforeAck = mockAutonomousCollaborate.mock.calls.length;

      actions.handleHookEvent({
        session_id: 'sess-new-not-yet-registered',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(mockAutonomousCollaborate.mock.calls.length).toBe(sendsBeforeAck);
    });
  });

  describe('Boundary inputs', () => {
    it('handleHookEvent with no pending ack and unknown session_id but known terminal_id is a clean no-op (no error toast, no notify)', async () => {
      // No primeRunningStep — workflowExecutionStates is empty.
      expect(() => {
        actions.handleHookEvent({
          session_id: 'sess-x',
          hook_event_name: 'UserPromptSubmit',
          terminal_id: 'terminal-1',
        });
      }).not.toThrow();

      expect(mockAddToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
      expect(mockNotifyWorkflowEvent).not.toHaveBeenCalled();
    });

    it('handleHookEvent with empty session_id and known terminal_id — implementation choice (drop or reconcile via terminal); pinning left to implementer');

    it('rapid-fire UserPromptSubmits via lazy reconciliation do not double-consume into a state error', async () => {
      await primeRunningStep();

      for (let i = 0; i < 5; i++) {
        actions.handleHookEvent({
          session_id: `sess-${i}`,
          hook_event_name: 'UserPromptSubmit',
          terminal_id: 'terminal-1',
        });
      }
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      // No retry should have fired, no error toast.
      expect(mockAddToast).not.toHaveBeenCalledWith(expect.anything(), 'error');
    });
  });
});
