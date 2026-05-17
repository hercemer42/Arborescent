import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createWorkflowExecutionActions } from '../workflowExecutionActions';

// Contract for the authoritative terminal↔node mapping:
//
//   - Each terminal is bound to at most one workflow node at any time.
//     The binding is tracked explicitly, not derived from
//     `workflowExecutionStates` by scanning for `state === 'running'`.
//   - The binding is held while the node is in `running` OR
//     `awaiting-validation` (so a checkpointed node still owns its
//     terminal and a freshly started sibling cannot steal it).
//   - The binding is released as soon as the node leaves both states
//     (stopWorkflow / completeWorkflow / advanceNode that exits the
//     workflow). Stale `terminalTabId` entries cannot collide.
//   - `continueWorkflow(A, T)` clears any prior binding on both `A`
//     and `T` in one transition, so the contract is self-repairing
//     when the map and the execution states ever drift apart.
//
// Assertions target the observable contract (start/continue rejected
// vs accepted, toasts, resulting workflowExecutionStates) rather than
// the internal map's field name.

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockExecuteInTerminal } = vi.hoisted(() => ({
  mockExecuteInTerminal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: mockExecuteInTerminal,
}));

vi.mock('@/utils/nodeHelpers', async () => {
  const actual = await vi.importActual<typeof import('@/utils/nodeHelpers')>('@/utils/nodeHelpers');
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: '', nodeContent: 'mock' }),
    getAppliedContextIdWithInheritance: () => undefined,
    resolveContextMode: () => 'execute',
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

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

vi.stubGlobal('window', {
  electron: {
    startKeepAwake: vi.fn().mockResolvedValue(undefined),
    stopKeepAwake: vi.fn().mockResolvedValue(undefined),
    terminalWrite: vi.fn().mockResolvedValue(undefined),
  },
});

describe('Authoritative terminal↔node mapping', () => {
  type Entry = { state: 'running' | 'awaiting-validation' | 'stuck'; terminalTabId: string; needsReview?: boolean };
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, Entry>;
    workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments: Record<string, string>;
    contextDeclarations: { nodeId: string; content: string; icon: string; color?: string; mode: 'collaborate' | 'execute' }[];
  };

  let state: TestState;
  let actions: ReturnType<typeof createWorkflowExecutionActions>;

  // Build a minimal valid workflow tree with TWO autonomous steps so
  // that `advanceNode` moves a node to step-2 (keeping the
  // workflowExecutionStates entry alive in 'running') rather than
  // completing the workflow and deleting the entry. That distinction
  // matters for tests that observe state immediately after
  // continueWorkflow — continueWorkflow internally calls advanceNode.
  //   root → workflow → step-1 (autonomous) → task-a, task-b, task-c
  //                   → step-2 (autonomous) — empty
  function buildState(): TestState {
    return {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['task-a', 'task-b', 'task-c'], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: { isBlueprint: true } },
        'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: { isBlueprint: true } },
        'task-c': { id: 'task-c', content: 'Task C', children: [], metadata: { isBlueprint: true } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'task-a': ['root', 'workflow', 'step-1'],
        'task-b': ['root', 'workflow', 'step-1'],
        'task-c': ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: {},
      workflowSessionMap: {},
      terminalNodeAssignments: {},
      contextDeclarations: [],
      sessionRegistry: {},
    };
  }

  function alreadyAssignedToastFired(): boolean {
    return mockAddToast.mock.calls.some(
      (args) => typeof args[0] === 'string' && args[0].includes('already assigned'),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    state = buildState();
    actions = createWorkflowExecutionActions(
      () => state,
      (partial) => { state = { ...state, ...partial }; },
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn().mockResolvedValue('/tmp/feedback.md'),
    );
  });

  describe('the binding holds while the node is awaiting-validation', () => {
    it('blocks startWorkflow on the same terminal once the original node is awaiting-validation', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      // Simulate NeedsReview transition: A moves from running → awaiting-validation.
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(true);
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    });

    it('keeps the binding through running → awaiting-validation → running transitions (no false positive on re-continue)', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
    });
  });

  describe('the binding is released when the node exits running/awaiting-validation', () => {
    it('frees the terminal after stopWorkflow', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']).toEqual({ state: 'running', terminalTabId: 'terminal-1' });
    });

    it('frees the terminal after completeWorkflow', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.completeWorkflow('task-a');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']).toEqual({ state: 'running', terminalTabId: 'terminal-1' });
    });

    it('frees the terminal when completeWorkflow is called from awaiting-validation', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      actions.completeWorkflow('task-a');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
    });

    it('after stopWorkflow + restart, the terminal is correctly re-bound to the new node and not the old one', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });
  });

  describe('continueWorkflow transitions the binding atomically', () => {
    it('repairs a stale terminal→node mapping when continuing a different node onto the same terminal', () => {
      // Set up a state where the ground truth is "terminal-1 was used
      // by task-a but task-a was stopped"; meanwhile the user wants
      // to continue task-b which legitimately owns the same terminal.
      state.workflowExecutionStates['task-b'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
      expect(state.workflowExecutionStates['task-b']?.terminalTabId).toBe('terminal-1');
    });

    it('does not raise "already assigned" when continuing onto the same terminal the node already owned', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
    });

    it('atomic swap: continueWorkflow(A, T2) when A was awaiting on T1 and T2 is free — A now owns T2, T1 is freed', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-2');

      expect(alreadyAssignedToastFired()).toBe(false);
      // T1 is free for a different node to start on it.
      actions.startWorkflow('task-b', 'terminal-1');
      expect(alreadyAssignedToastFired()).toBe(false);
    });

    it('rejection: continueWorkflow(A, T2) when T2 is held by another running node — fires toast, no binding mutated', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-2');

      expect(alreadyAssignedToastFired()).toBe(true);
      // task-b's binding on T2 must be intact, task-a's awaiting state on T1 unchanged.
      expect(state.workflowExecutionStates['task-b']).toEqual({ state: 'running', terminalTabId: 'terminal-2' });
      expect(state.workflowExecutionStates['task-a']?.state).toBe('awaiting-validation');
    });
  });

  describe('two nodes legitimately on two terminals do not interfere', () => {
    it('start A on terminal-1 and start B on terminal-2 — neither sees a false positive', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-a']).toEqual({ state: 'running', terminalTabId: 'terminal-1' });
      expect(state.workflowExecutionStates['task-b']).toEqual({ state: 'running', terminalTabId: 'terminal-2' });
    });

    it('continue A on terminal-1 while B is still running on terminal-2 — no false positive', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
    });

    it('both awaiting-validation on different terminals — continuing each does not collide', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      state.workflowExecutionStates['task-b'] = { state: 'awaiting-validation', terminalTabId: 'terminal-2' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-1');
      actions.continueWorkflow('task-b', 'terminal-2');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
    });
  });

  describe('boundary inputs', () => {
    it('startWorkflow with a null terminalId raises the existing toast and does not record a binding', () => {
      actions.startWorkflow('task-a', null);

      const toastFired = mockAddToast.mock.calls.some(
        (args) => typeof args[0] === 'string' && args[0].includes('No terminal tab available'),
      );
      expect(toastFired).toBe(true);
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('continueWorkflow with a null terminalId raises the existing toast and leaves the node awaiting-validation', () => {
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', null);

      const toastFired = mockAddToast.mock.calls.some(
        (args) => typeof args[0] === 'string' && args[0].includes('No terminal tab available'),
      );
      expect(toastFired).toBe(true);
      expect(state.workflowExecutionStates['task-a']?.state).toBe('awaiting-validation');
    });

    it('repeated startWorkflow on the same node + terminal is idempotent (no warning)', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      mockAddToast.mockClear();

      actions.startWorkflow('task-a', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
    });

    it('continueWorkflow on a node that is not in awaiting-validation is a no-op (no warning, no state change)', () => {
      // task-a is not running and not awaiting; continue should be a no-op.
      mockAddToast.mockClear();

      actions.continueWorkflow('task-a', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
    });

    it('startWorkflow on a non-existent node is a silent no-op', () => {
      actions.startWorkflow('does-not-exist', 'terminal-1');

      expect(state.workflowExecutionStates['does-not-exist']).toBeUndefined();
    });
  });

  describe('repeated and rapid transitions', () => {
    it('start → stop → start cycle on the same terminal does not leave a stale binding', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.stopWorkflow('task-a');
      actions.startWorkflow('task-b', 'terminal-1');
      actions.stopWorkflow('task-b');
      mockAddToast.mockClear();

      actions.startWorkflow('task-c', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-c']?.state).toBe('running');
    });

    it('rapid start of a second node on a busy terminal is rejected, not silently overwritten', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(true);
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      // task-a's binding survives intact.
      expect(state.workflowExecutionStates['task-a']).toEqual({ state: 'running', terminalTabId: 'terminal-1' });
    });
  });

  describe('initializeExecutionState rebuilds the map from surviving entries', () => {
    it('rebuilds terminal→node bindings for awaiting-validation entries that survive restart, so a fresh start on the same terminal is blocked', () => {
      // Simulate persisted post-restart state: an awaiting-validation
      // entry exists in workflowExecutionStates but the explicit map
      // is empty (the new field would be empty after de-serialising
      // pre-this-fix data, or after a fresh app boot before any
      // production action ran).
      state.workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };
      // intentionally NOT setting state.terminalNodeAssignments

      actions.initializeExecutionState();
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(true);
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    });

    it('drops running entries on restart and does not rebuild bindings for them', () => {
      state.workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      actions.initializeExecutionState();
      mockAddToast.mockClear();

      // task-a's running entry was cleared by initializeExecutionState
      // (existing contract — running on restart is treated as
      // dropped). Therefore terminal-1 is free for a fresh start.
      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
    });
  });

  describe('disruption reactions release the binding', () => {
    it('handleTerminalClosed releases the binding so a new workflow can use the (re-created) terminal', () => {
      actions.startWorkflow('task-a', 'terminal-1');

      actions.handleTerminalClosed('terminal-1');
      mockAddToast.mockClear();

      // Pretend a new terminal happens to reuse the same id (defensive
      // coverage even if today's IDs are timestamp-unique).
      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
    });

    it('handleNodeDeleted releases the binding so a sibling can immediately start on the freed terminal', () => {
      actions.startWorkflow('task-a', 'terminal-1');

      actions.handleNodeDeleted('task-a');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
    });

    it('handleStepDeleted releases bindings for all running children of the removed step', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');

      actions.handleStepDeleted('step-1');
      mockAddToast.mockClear();

      // Both terminals should now be free.
      actions.startWorkflow('task-c', 'terminal-1');
      expect(alreadyAssignedToastFired()).toBe(false);
    });

    it('handleAllStepsRemoved releases bindings for every node under the workflow', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');

      actions.handleAllStepsRemoved('workflow');
      mockAddToast.mockClear();

      // Repurpose terminal-1 — must not see "already assigned".
      actions.startWorkflow('task-c', 'terminal-1');
      expect(alreadyAssignedToastFired()).toBe(false);
    });

    it('handleNodeMovedManually releases the binding when a workflow node is dragged out', () => {
      actions.startWorkflow('task-a', 'terminal-1');

      actions.handleNodeMovedManually('task-a');
      mockAddToast.mockClear();

      actions.startWorkflow('task-b', 'terminal-1');

      expect(alreadyAssignedToastFired()).toBe(false);
      expect(state.workflowExecutionStates['task-b']?.state).toBe('running');
    });
  });

  describe('cross-cutting symptoms the fix must eliminate', () => {
    // These pin the user-story symptoms. They are independent
    // observations of the same authoritative-mapping invariant —
    // worth keeping as named tests so a regression on any of them
    // is reported with the right vocabulary.
    it('does not raise the "already assigned to another node" warning when each running node has its own terminal', () => {
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');
      mockAddToast.mockClear();

      // Re-trigger the same starts to mimic UI re-issuing them under
      // some refresh path — must remain silent.
      actions.startWorkflow('task-a', 'terminal-1');
      actions.startWorkflow('task-b', 'terminal-2');

      expect(alreadyAssignedToastFired()).toBe(false);
    });

    // Post-fix behavior is uncertain: when handleTerminalClosed is
    // invoked on a terminal that owns a binding, does the binding get
    // cleared explicitly, or only via the cascading stopWorkflow
    // already in handleTerminalClosed today? The end-state should be
    // identical (terminal free, node stopped) — pinning the path is
    // left to the implementer.
    it('handleTerminalClosed releases the binding (path: explicit clear or via stopWorkflow cascade)');

    // Same uncertainty for advanceNode that ends up in completeWorkflow:
    // does advanceNode itself touch the map, or only completeWorkflow?
    // End-state is what matters; pinning the path is left to the implementer.
    it('advanceNode that exits the workflow releases the binding');
  });
});
