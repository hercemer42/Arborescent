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

// Guards the most reviewer-surprising risk of the ack-manager extraction: the
// pending-ack maps are closure-local per createWorkflowExecutionActions call.
// If the extraction accidentally hoists them to module scope, independent
// store instances would share ack state. These tests pin the per-instance
// isolation and the clear-all semantics through the public action surface, so
// they must pass identically before and after the refactor.
describe('Ack factory wiring: per-instance isolation and clearAll', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  type Harness = {
    getState: () => TestState;
    actions: ReturnType<typeof createWorkflowExecutionActions>;
    mockAutonomousCollaborate: ReturnType<typeof vi.fn>;
  };

  // Both harnesses deliberately use the same node/session/terminal ids: if the
  // extraction leaks ack state to module scope, identical keys collide across
  // instances and the isolation assertions below fail.
  function makeHarness(): Harness {
    let state: TestState = {
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
      sessionRegistry: {},
    };

    const mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) =>
      Promise.resolve(`/tmp/feedback-response-${nodeId}.md`),
    );

    const actions = createWorkflowExecutionActions(
      () => state,
      (partial) => {
        state = { ...state, ...partial };
      },
      vi.fn(),
      {
        flashNode: vi.fn(),
        scrollToNode: vi.fn(),
        startDeleteAnimation: vi.fn(),
        clearDeleteAnimation: vi.fn(),
      },
      mockAutonomousCollaborate,
      vi.fn().mockImplementation((cmd: { execute: () => void }) => cmd.execute()),
    );

    return { getState: () => state, actions, mockAutonomousCollaborate };
  }

  async function primeRunningStep(harness: Harness, nodeId = 'task-a', terminalId = 'terminal-1'): Promise<void> {
    void harness.actions.startWorkflow(nodeId, terminalId);
    // Flush the autonomousCollaborate promise so the ACK registration runs.
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Per-instance isolation between two action factories', () => {
    it("initializeExecutionState on instance B does not cancel instance A's pending ack: A's retry still fires on timeout", async () => {
      const a = makeHarness();
      const b = makeHarness();

      await primeRunningStep(a);
      const sendsBefore = a.mockAutonomousCollaborate.mock.calls.length;

      // If the ack maps were module-shared, B's clear-all would cancel A's timer.
      b.actions.initializeExecutionState();
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(a.mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsBefore);
    });

    it("consuming an ack on instance B for the same node id does not consume instance A's pending ack", async () => {
      const a = makeHarness();
      const b = makeHarness();

      await primeRunningStep(a);
      await primeRunningStep(b);
      const sendsBeforeOnA = a.mockAutonomousCollaborate.mock.calls.length;

      // B consumes its own ack for 'task-a'. A's entry under the same key must survive.
      b.actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });
      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(a.mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsBeforeOnA);
    });

    it("a preconsumed ack on instance B does not suppress instance A's ack registration for the same node id", async () => {
      const a = makeHarness();
      const b = makeHarness();

      // B: ack arrives before its registration resolves → lands in B's preconsumed set.
      b.mockAutonomousCollaborate.mockImplementation(() => new Promise<string>(() => {}));
      void b.actions.startWorkflow('task-a', 'terminal-1');
      await Promise.resolve();
      b.actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });

      // A: full registration for the same node id. If the preconsumed set were
      // module-shared, A's registerPendingAck would swallow B's flag and skip
      // its timer — so A would never retry.
      await primeRunningStep(a);
      const sendsAfterPrime = a.mockAutonomousCollaborate.mock.calls.length;

      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(a.mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsAfterPrime);
    });
  });

  describe('clearAll semantics via initializeExecutionState', () => {
    it('clears every pending ack when multiple are registered: no retry fires for any of them', async () => {
      const a = makeHarness();
      a.getState().nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } };
      a.getState().ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
      a.getState().nodes['step-1'].children = ['task-a', 'task-b'];
      a.getState().workflowSessionMap['session-2'] = 'terminal-2';

      await primeRunningStep(a, 'task-a', 'terminal-1');
      await primeRunningStep(a, 'task-b', 'terminal-2');
      const sendsBefore = a.mockAutonomousCollaborate.mock.calls.length;

      a.actions.initializeExecutionState();
      vi.advanceTimersByTime(30000);
      await vi.runAllTicks();

      expect(a.mockAutonomousCollaborate.mock.calls.length).toBe(sendsBefore);
    });

    it('also drops the preconsumed set: a preconsumed flag does not survive initializeExecutionState to swallow a later registration', async () => {
      const a = makeHarness();

      // Park an ack in the preconsumed set (arrives before registration resolves).
      let resolveCollaborate!: (value: string) => void;
      a.mockAutonomousCollaborate.mockImplementationOnce(() =>
        new Promise<string>((resolve) => {
          resolveCollaborate = resolve;
        }),
      );
      void a.actions.startWorkflow('task-a', 'terminal-1');
      await Promise.resolve();
      a.actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'UserPromptSubmit' });

      a.actions.initializeExecutionState();
      resolveCollaborate('/tmp/feedback-response-task-a.md');
      await vi.runAllTicks();
      await Promise.resolve();
      await Promise.resolve();

      // A fresh workflow after the reset must register a live ack: with no
      // UserPromptSubmit delivered, its retry fires on timeout.
      await primeRunningStep(a);
      const sendsAfterPrime = a.mockAutonomousCollaborate.mock.calls.length;

      vi.advanceTimersByTime(10000);
      await vi.runAllTicks();

      expect(a.mockAutonomousCollaborate.mock.calls.length).toBeGreaterThan(sendsAfterPrime);
    });

    it('is a safe no-op with nothing pending, including when called repeatedly', () => {
      const a = makeHarness();

      expect(() => {
        a.actions.initializeExecutionState();
        a.actions.initializeExecutionState();
      }).not.toThrow();

      expect(mockAddToast).not.toHaveBeenCalled();
      expect(mockNotifyWorkflowEvent).not.toHaveBeenCalled();
    });
  });
});
