import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TreeNode } from '@shared/types';

// Spec for "Completed autonomous steps stall instead of advancing".
//
// The advance is performed only by the Stop hook → handleHookEvent →
// advanceNode, and previously the handler dropped the event the moment
// findRunningNodeOnTerminal returned null (transient run-state lost to a
// reload/restart/rebind). The durable-binding fallback resolves the
// session-owning live node from persisted metadata (sessionId +
// status==='completed'), re-seeds the running entry advanceNode needs, and
// reuses the normal Stop routing. When the bound terminal is gone it surfaces
// a persistent, actionable stuck indicator instead of advancing into a dead tab.
//
// Assertions target the OBSERVABLE contract (advanceNode called / not called,
// drop-warning suppressed, toast, reveal) rather than internal field names.

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));
vi.mock('../../../../services/logger', () => ({ logger: loggerMocks }));

const toastMocks = vi.hoisted(() => ({ addToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: toastMocks.addToast }) },
}));

const notifyMocks = vi.hoisted(() => ({ notifyWorkflowEvent: vi.fn() }));
vi.mock('../../../../services/workflowNotification', () => ({
  notifyWorkflowEvent: notifyMocks.notifyWorkflowEvent,
}));

import { createHookEventHandler } from '../workflowHookEventHandler';

type DepArgs = Parameters<typeof createHookEventHandler>[0];
type HookState = ReturnType<DepArgs['get']>;

// Minimal valid workflow tree (same shape proven in
// workflowExecutionAuthoritativeMapping.test.ts so getWorkflowStepPosition
// resolves):
//   root → workflow → step-1 (autonomous) → task-a, task-b
//                   → step-2 (autonomous, empty advance target)
function buildTree(): Pick<HookState, 'nodes' | 'ancestorRegistry'> {
  const nodes: Record<string, TreeNode> = {
    root: { id: 'root', content: 'Root', children: ['workflow'], metadata: {} },
    workflow: {
      id: 'workflow',
      content: 'Workflow',
      children: ['step-1', 'step-2'],
      metadata: { isWorkflow: true },
    },
    'step-1': {
      id: 'step-1',
      content: 'Step 1',
      children: ['task-a', 'task-b'],
      metadata: { stepType: 'autonomous' },
    },
    'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { stepType: 'autonomous' } },
    'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
    'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: {} },
  };
  return {
    nodes,
    ancestorRegistry: {
      root: [],
      workflow: ['root'],
      'step-1': ['root', 'workflow'],
      'step-2': ['root', 'workflow'],
      'task-a': ['root', 'workflow', 'step-1'],
      'task-b': ['root', 'workflow', 'step-1'],
    },
  };
}

function makeState(overrides: Partial<HookState> = {}): HookState {
  const { nodes, ancestorRegistry } = buildTree();
  return {
    nodes,
    ancestorRegistry,
    workflowExecutionStates: {},
    workflowSessionMap: {},
    ...overrides,
  };
}

function makeDeps(state: HookState, overrides: Partial<DepArgs> = {}): DepArgs {
  return {
    get: () => state,
    set: vi.fn(),
    findRunningNodeOnTerminal: vi.fn(() => null),
    consumePendingAck: vi.fn(),
    isAckPending: vi.fn(() => false),
    advanceNode: vi.fn(),
    completeWorkflow: vi.fn(),
    stopWorkflow: vi.fn(),
    isTerminalLive: vi.fn(() => true),
    revealNode: vi.fn(),
    ...overrides,
  };
}

// Stamp the durable session→node binding the fix relies on: the bound node
// carries its session id and is marked complete by announce_step_done.
function markCompletedAndBound(
  tree: Pick<HookState, 'nodes' | 'ancestorRegistry'>,
  nodeId = 'task-a',
  sessionId = 'session-1',
): void {
  tree.nodes[nodeId].metadata = {
    ...tree.nodes[nodeId].metadata,
    sessionId,
    status: 'completed',
  };
}

describe('durable session→node advance fallback (handleHookEvent)', () => {
  beforeEach(() => {
    Object.values(loggerMocks).forEach((m) => m.mockClear());
    toastMocks.addToast.mockClear();
    notifyMocks.notifyWorkflowEvent.mockClear();
  });

  describe('transient run-state cleared by reload/restart', () => {
    it('advances the session-owning completed node when the Stop arrives with no running node', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowExecutionStates: {}, // wiped by initializeExecutionState
        workflowSessionMap: { 'session-1': 'terminal-1' }, // repopulated post-reload
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).toHaveBeenCalledWith('task-a');
    });

    it('does not emit the "no running node" drop warning once a durable binding resolves', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null) }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      const warns = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(warns.some((m) => /no running node/i.test(m))).toBe(false);
    });

    it('resolves via event.terminal_id when workflowSessionMap was reset to empty on reload', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: {}, // reset by initializeExecutionState; handler falls back to event.terminal_id
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({
        session_id: 'session-1',
        hook_event_name: 'Stop',
        terminal_id: 'terminal-1',
      });

      expect(advanceNode).toHaveBeenCalledWith('task-a');
    });

    it('re-seeds a running entry for the node before advancing (advanceNode no-ops without it)', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const set = vi.fn();
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), set, advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowExecutionStates: expect.objectContaining({
            'task-a': expect.objectContaining({ state: 'running', terminalTabId: 'terminal-1' }),
          }),
        }),
      );
      expect(advanceNode).toHaveBeenCalledWith('task-a');
    });

    it('successful fallback advance is silent — no stuck toast, no node reveal', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const revealNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode, revealNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).toHaveBeenCalledWith('task-a'); // readiness-gated path, not a direct paste
      expect(revealNode).not.toHaveBeenCalled();
      expect(toastMocks.addToast).not.toHaveBeenCalled();
    });
  });

  describe('positive-evidence gate (never resurrect an intentionally-stopped workflow)', () => {
    it('does not advance when the session-owning node is not marked complete', () => {
      const tree = buildTree();
      tree.nodes['task-a'].metadata = { sessionId: 'session-1', status: 'pending' };
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).not.toHaveBeenCalled();
    });

    it('still logs the drop warning distinctly when no durable binding exists for the session', () => {
      const state = makeState({
        nodes: {},
        ancestorRegistry: {},
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null) }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      const warns = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(warns.some((m) => /no running node/i.test(m))).toBe(true);
    });
  });

  describe('transient run-state is authoritative when present', () => {
    it('advances the live running node and never overrides it with a different durable binding', () => {
      const tree = buildTree();
      // durable binding points at task-b, but task-a is the LIVE transient running node
      markCompletedAndBound(tree, 'task-b', 'session-1');
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowExecutionStates: {
          'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => 'task-a'), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).toHaveBeenCalledWith('task-a');
      expect(advanceNode).not.toHaveBeenCalledWith('task-b');
    });

    it('regression baseline: with run-state intact the autonomous Stop advances exactly as today', () => {
      const tree = buildTree();
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowExecutionStates: {
          'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => 'task-a'), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).toHaveBeenCalledWith('task-a');
    });
  });

  describe('idempotency (derived from tree state)', () => {
    it('a duplicate Stop in the same turn (no declaration this turn) does not advance', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowExecutionStates: {
          'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => 'task-a'), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: null });

      expect(advanceNode).not.toHaveBeenCalled();
    });

    it('does not double-advance via the fallback when transient run-state still exists for the node', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        // run-state repopulated (SessionStart/register-binding) concurrently with the Stop
        workflowExecutionStates: {
          'task-a': { state: 'running', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        // resolver momentarily misses the entry, but the fallback must still
        // defer to tree state and not re-advance
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).not.toHaveBeenCalled();
    });

    it('does not re-recover the same completion on a duplicate Stop (terminal-completion shape: advance deletes the entry)', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      // Same handler instance across both Stops; `set` is a no-op mock so the
      // re-seeded entry never persists — exactly the terminal case where
      // advanceNode → completeWorkflow deletes the entry, leaving a
      // still-`completed` node resolvable. The per-completion guard must block
      // the second recovery so completeWorkflow does not run twice.
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });
      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).toHaveBeenCalledTimes(1);
    });

    it('does not re-fire on a step already parked awaiting-validation (e.g. a recovered checkpoint)', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        // the step was already routed to awaiting-validation on a prior Stop
        workflowExecutionStates: {
          'task-a': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).not.toHaveBeenCalled();
    });
  });

  describe('step-type routing of the durable fallback', () => {
    it('does not auto-advance a manual step via the fallback path', () => {
      const tree = buildTree();
      tree.nodes['step-1'].metadata = { stepType: 'manual' };
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).not.toHaveBeenCalled();
    });

    it('routes a recovered checkpoint step to awaiting-validation rather than auto-advancing', () => {
      const tree = buildTree();
      tree.nodes['step-1'].metadata = { stepType: 'checkpoint' };
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).not.toHaveBeenCalled();
      const toastMessages = toastMocks.addToast.mock.calls.map((c) => String(c[0]));
      expect(toastMessages.some((m) => /review/i.test(m))).toBe(true);
    });
  });

  describe('duplicate metadata.sessionId across a chain', () => {
    it('resolves the completed-but-parked frontier node when multiple nodes share the session id', () => {
      const tree = buildTree();
      // task-a (earlier in the chain) is not the frontier; task-b is the completed one.
      tree.nodes['task-a'].metadata = { sessionId: 'session-1', status: 'pending' };
      tree.nodes['task-b'].metadata = { sessionId: 'session-1', status: 'completed' };
      const advanceNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, { findRunningNodeOnTerminal: vi.fn(() => null), advanceNode }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).toHaveBeenCalledWith('task-b');
      expect(advanceNode).not.toHaveBeenCalledWith('task-a');
    });
  });

  describe('stuck indicator (binding resolves but terminal is gone)', () => {
    it('surfaces a persistent, actionable stuck indicator and does not advance into a dead tab', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const advanceNode = vi.fn();
      const revealNode = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, {
          findRunningNodeOnTerminal: vi.fn(() => null),
          isTerminalLive: vi.fn(() => false),
          advanceNode,
          revealNode,
        }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(advanceNode).not.toHaveBeenCalled();
      expect(revealNode).toHaveBeenCalledWith('task-a'); // deep-links the stalled node
      expect(toastMocks.addToast).toHaveBeenCalledTimes(1);
      const [message, level, options] = toastMocks.addToast.mock.calls[0];
      expect(String(message)).toMatch(/terminal/i); // reason class
      expect(level).toBe('warning');
      expect(options?.persistent).toBe(true);
      expect(options?.actions?.[0]?.label).toBeTruthy(); // actionable + labelled
      expect(typeof options?.actions?.[0]?.onClick).toBe('function');
      const warns = loggerMocks.warn.mock.calls.map((c) => String(c[0]));
      expect(warns.some((m) => /no running node/i.test(m))).toBe(false);
      // the stuck branch logs a distinct WARN so it is diagnosable in the file log
      expect(warns.some((m) => /parked.*terminal .* not live/i.test(m))).toBe(true);
    });

    it('parks the stalled step as awaiting-validation so the existing continue affordance can recover it', () => {
      const tree = buildTree();
      markCompletedAndBound(tree);
      const set = vi.fn();
      const state = makeState({
        nodes: tree.nodes,
        ancestorRegistry: tree.ancestorRegistry,
        workflowSessionMap: { 'session-1': 'terminal-1' },
      });
      const handler = createHookEventHandler(
        makeDeps(state, {
          findRunningNodeOnTerminal: vi.fn(() => null),
          isTerminalLive: vi.fn(() => false),
          set,
        }),
      );

      handler({ session_id: 'session-1', hook_event_name: 'Stop' });

      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowExecutionStates: expect.objectContaining({
            'task-a': expect.objectContaining({ state: 'awaiting-validation' }),
          }),
        }),
      );
    });
  });
});
