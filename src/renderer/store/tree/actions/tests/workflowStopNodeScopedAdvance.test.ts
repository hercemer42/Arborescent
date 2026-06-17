import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Stop hook advances the node that declared done THIS turn, identified by
// the node-scoped `declared_node_id` the dispatcher threads onto the event —
// not a session-global flag.
//
// Bug it fixes: a manual send/revise on a DIFFERENT node submits for that node
// and used to set a session-global flag, so the bound node (the only entry the
// terminal resolver sees) advanced even though it never finished. Now a Stop
// only advances when its declared node matches the resolved running node.
//
// Field semantics: a string id gates to that node; null means the dispatcher
// saw no declaration this turn (e.g. the turn stopped to ask a question) and is
// gated; an absent field is a non-dispatcher caller (tests / no MCP server) and
// stays permissive.

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: loggerMocks,
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('../../../../services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

import { createHookEventHandler } from '../workflowHookEventHandler';

type DepArgs = Parameters<typeof createHookEventHandler>[0];

// Root -> workflow -> step-1 (autonomous) -> task-a, plus a downstream step-2 so
// there is somewhere to advance to. task-a is the bound node running on
// terminal-1; session-1 maps to that terminal.
function makeState() {
  return {
    nodes: {
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
        children: ['task-a'],
        metadata: { stepType: 'autonomous' },
      },
      'step-2': {
        id: 'step-2',
        content: 'Step 2',
        children: [],
        metadata: { stepType: 'autonomous' },
      },
      'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
    },
    ancestorRegistry: {
      root: [],
      workflow: ['root'],
      'step-1': ['root', 'workflow'],
      'step-2': ['root', 'workflow'],
      'task-a': ['root', 'workflow', 'step-1'],
    },
    workflowExecutionStates: { 'task-a': { state: 'running', terminalTabId: 'terminal-1' } },
    workflowSessionMap: { 'session-1': 'terminal-1' },
  };
}

function makeDeps(overrides: Partial<DepArgs> = {}): DepArgs {
  return {
    get: () => makeState() as never,
    set: vi.fn(),
    findRunningNodeOnTerminal: vi.fn(() => 'task-a'),
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

describe('Stop-hook advance is gated per declared node', () => {
  beforeEach(() => {
    Object.values(loggerMocks).forEach((m) => m.mockClear());
  });

  it('does NOT advance the bound node when the Stop names a different node as the declarer (manual-send-elsewhere bug)', () => {
    const deps = makeDeps();
    const handler = createHookEventHandler(deps);

    handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: 'other-node' });

    expect(deps.advanceNode).not.toHaveBeenCalled();
  });

  it('does NOT advance when the dispatcher saw no declaration this turn (clarifying-question Stop carries null)', () => {
    const deps = makeDeps();
    const handler = createHookEventHandler(deps);

    handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: null });

    expect(deps.advanceNode).not.toHaveBeenCalled();
  });

  it('advances the bound node when the Stop names it as the declarer', () => {
    const deps = makeDeps();
    const handler = createHookEventHandler(deps);

    handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: 'task-a' });

    expect(deps.advanceNode).toHaveBeenCalledWith('task-a');
  });

  it('does not advance across repeated Stops that declare no node (multiple clarifying questions in one interruption)', () => {
    const deps = makeDeps();
    const handler = createHookEventHandler(deps);

    handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: null });
    handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: null });
    handler({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: 'other-node' });

    expect(deps.advanceNode).not.toHaveBeenCalled();
  });

  it('stays permissive for a non-dispatcher Stop with no declared_node_id field (tests / no MCP server fallback)', () => {
    const deps = makeDeps();
    const handler = createHookEventHandler(deps);

    handler({ session_id: 'session-1', hook_event_name: 'Stop' });

    expect(deps.advanceNode).toHaveBeenCalledWith('task-a');
  });
});
