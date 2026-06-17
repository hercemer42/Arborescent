import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions, type WorkflowExecutionActions } from '@/store/tree/actions/workflowExecutionActions';
import { useTerminalStore, type TerminalInfo } from '@/store/terminal/terminalStore';

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('@/store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('@/services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

// The decomposition step itself is collaborate, but a child's recurse start is
// asserted via execution state, not prompt mode — resolve flags to execute so the
// started child does not defer behind the collaborating flag.
vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/nodeHelpers')>();
  return {
    ...actual,
    buildContentWithContext: () => ({ contextPrefix: 'mock context', nodeContent: 'mock content' }),
    getInheritedContextId: () => undefined,
    getAppliedContextIdWithInheritance: () => undefined,
    resolveContextFlags: () => ({ collaborate: false, execute: true }),
    getContextDeclarations: () => [],
  };
});

vi.mock('@/utils/promptBuilder', () => ({ buildExecutePrompt: () => 'mock prompt' }));

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

vi.mock('@/services/workflowNotification', () => ({ notifyWorkflowEvent: vi.fn() }));

const { mockParseFeedbackContent } = vi.hoisted(() => ({ mockParseFeedbackContent: vi.fn() }));
vi.mock('@/services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
}));

// AcceptFeedbackCommand is its own tested unit; mock it at the module boundary and
// have execute() reproduce the documented effect of a multi-root decomposition
// (executeMultiRootStrategy): the orchestrator node is deleted and replaced in the
// step by fresh root children that all share one new groupId.
const { mockAcceptFeedbackExecute } = vi.hoisted(() => ({ mockAcceptFeedbackExecute: vi.fn() }));
vi.mock('@/store/tree/commands/AcceptFeedbackCommand', () => ({
  AcceptFeedbackCommand: vi.fn().mockImplementation(() => ({
    execute: mockAcceptFeedbackExecute,
    undo: vi.fn(),
    description: 'Accept feedback',
  })),
}));

describe('integration — decomposed children auto-advance to the next workflow step', () => {
  it.todo('an Nth-step decomposition lands each new child at step N+1, not at step N');
  it.todo('the decomposing step does not re-execute on any child it just produced within the same recurse pass');
  it.todo('when the decomposing step is the final step, children are created but no further step is scheduled — no loop, no re-fire, no error');
  it.todo('non-decomposition steps continue to advance the same node, unchanged by this rule');
  it.todo('workflow resume after app restart places previously decomposed children at the correct downstream step, not back at the decomposition step');
  it.todo('no regression in autonomous-collaborate / AI-call count for workflows that already terminated correctly before the fix');
});

describe('integration — decomposition session group affinity', () => {
  // Tree (decompose on step-1; a later recurse step is irrelevant to the FIRST
  // hand-off, which fires straight from handleAutonomousFeedback):
  //   root → workflow → [ step-1 (decomposition, autonomous), step-2 (autonomous) ]
  // The orchestrator is bound to step-1 and running on terminal-1 / session-1.
  const GROUP = 'grp-decomp-1';

  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments?: Record<string, string>;
    activeNodeId?: string | null;
  };

  const liveTerminal: TerminalInfo = {
    id: 'terminal-1',
    title: 'Terminal 1',
    cwd: '/tmp',
    shellCommand: 'bash',
    shellArgs: [],
    pinnedToBottom: false,
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: WorkflowExecutionActions;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({ terminals: [liveTerminal], fileStates: {}, currentFilePath: null });

    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['orchestrator'], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        orchestrator: { id: 'orchestrator', content: 'Decompose me', children: [], metadata: { isBlueprint: true, sessionId: 'session-1' } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        orchestrator: ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: { orchestrator: { state: 'running', terminalTabId: 'terminal-1' } },
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
      terminalNodeAssignments: { 'terminal-1': 'orchestrator' },
      activeNodeId: null,
    };
    setState = (partial) => { state = { ...state, ...partial }; };

    mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) => Promise.resolve(`/tmp/feedback-${nodeId}.md`));

    // Two decomposed roots from the orchestrator's submission.
    mockParseFeedbackContent.mockReturnValue({
      nodes: {
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
        'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: {} },
      },
      rootNodeId: 'task-a',
      rootNodeIds: ['task-a', 'task-b'],
      nodeCount: 2,
    });

    // Faithful executeMultiRootStrategy: orchestrator deleted, both roots spliced
    // into step-1 carrying the same fresh groupId; registry updated.
    mockAcceptFeedbackExecute.mockImplementation(() => {
      const nodes = { ...state.nodes };
      delete nodes.orchestrator;
      nodes['task-a'] = { id: 'task-a', content: 'Task A', children: [], metadata: { groupId: GROUP } };
      nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { groupId: GROUP } };
      nodes['step-1'] = { ...nodes['step-1'], children: ['task-a', 'task-b'] };
      const ancestorRegistry = { ...state.ancestorRegistry };
      delete ancestorRegistry.orchestrator;
      ancestorRegistry['task-a'] = ['root', 'workflow', 'step-1'];
      ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
      setState({ nodes, ancestorRegistry });
    });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      mockAutonomousCollaborate,
      (cmd) => cmd.execute(),
      vi.fn(),
    );
  });

  it('after a decomposition step finishes, the first child auto-plays in the same terminal session that ran the parent', async () => {
    vi.useFakeTimers();
    try {
      actions.handleAutonomousFeedback('orchestrator', '# decompose\n## Task A\n## Task B');
      await vi.advanceTimersByTimeAsync(2500);

      // first child advanced off the decomposition step to decompose+1
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-1'].children).not.toContain('task-a');
      // ...and was actually started on the parent's terminal, not left parked
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      expect(state.workflowExecutionStates['task-a']?.terminalTabId).toBe('terminal-1');
      const taskACall = mockAutonomousCollaborate.mock.calls.find((call) => call[0] === 'task-a');
      expect(taskACall?.[1]).toBe('terminal-1');
      // ...on the same session the orchestrator ran, not a broken-chain fresh start
      expect(state.nodes['task-a']?.metadata.sessionId).toBe('session-1');
      expect(state.nodes['task-a']?.metadata.brokenChain).not.toBe(true);

      // the remaining sibling stays parked at the decomposition step awaiting its turn
      expect(state.nodes['step-1'].children).toContain('task-b');
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    } finally {
      useTerminalStore.setState({ terminals: [], fileStates: {}, currentFilePath: null });
      vi.useRealTimers();
    }
  });

  it.todo('subsequent siblings play in the same session in deterministic order after each previous siblings downstream step completes');
  it.todo('manually triggering play on any decomposed child in the originating session succeeds and does not raise "session already assigned"');
  it.todo('a session cannot be bound to children from a decomposition group it did not produce — foreign nodes still raise the existing assignment error');
  it.todo('after app restart, the session active-child pointer is restored from saved state, not silently reset to the parent');
});

describe('integration — focus follows the active decomposed child', () => {
  it.todo('only the currently active child of the group shows the blue focus bar and tints its bound terminal tab');
  it.todo('when a step completes on the active child and the runner advances to the next sibling, the previous child loses the blue bar and tab tint');
  it.todo('focus state and runtime active-child pointer share a single source of truth — the rendered focus never disagrees with the runner');
});

describe('integration — final-step decomposition edge case', () => {
  it.todo('children created by a final-step decomposition stay terminal with no execution state entry');
  it.todo('the runner does not loop on the producing step after producing final-step children');
  it.todo('no toast or error is raised when final-step decomposition completes');
});

describe('integration — pre-fix saved state migration', () => {
  it.todo('saved workflows from before the fix resume without phantom or duplicate steps on decomposed children');
  it.todo('children carrying the producing-step index in saved state are coerced forward to N+1 on resume, deterministically');
  it.todo('saved session bindings that pointed at the decomposition parent do not strand the group after resume');
});

describe('integration — mis-credited orchestrator Stop does not double-advance the first child', () => {
  // Tree with three autonomous steps so the bug has somewhere to over-advance to:
  //   root → workflow → [ step-1 (decomposition), step-2, step-3 ]
  // The orchestrator runs step-1 on terminal-1 / session-1. After it decomposes,
  // the first child (task-a) is promoted to step-2 (N+1) and bound to terminal-1.
  // The orchestrator's own turn-ending Stop then lands on terminal-1 — it must NOT
  // be credited to task-a and push it to step-3 (N+2) before step-2 was ever run.
  const GROUP = 'grp-decomp-handoff';

  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments?: Record<string, string>;
    activeNodeId?: string | null;
  };

  const liveTerminal: TerminalInfo = {
    id: 'terminal-1',
    title: 'Terminal 1',
    cwd: '/tmp',
    shellCommand: 'bash',
    shellArgs: [],
    pinnedToBottom: false,
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: WorkflowExecutionActions;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({ terminals: [liveTerminal], fileStates: {}, currentFilePath: null });

    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1', 'step-2', 'step-3'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['orchestrator'], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
        'step-2': { id: 'step-2', content: 'Step 2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'step-3': { id: 'step-3', content: 'Step 3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        orchestrator: { id: 'orchestrator', content: 'Decompose me', children: [], metadata: { isBlueprint: true, sessionId: 'session-1' } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-3': ['root', 'workflow'],
        orchestrator: ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: { orchestrator: { state: 'running', terminalTabId: 'terminal-1' } },
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
      terminalNodeAssignments: { 'terminal-1': 'orchestrator' },
      activeNodeId: null,
    };
    setState = (partial) => { state = { ...state, ...partial }; };

    mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) => Promise.resolve(`/tmp/feedback-${nodeId}.md`));

    mockParseFeedbackContent.mockReturnValue({
      nodes: {
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
        'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: {} },
      },
      rootNodeId: 'task-a',
      rootNodeIds: ['task-a', 'task-b'],
      nodeCount: 2,
    });

    mockAcceptFeedbackExecute.mockImplementation(() => {
      const nodes = { ...state.nodes };
      delete nodes.orchestrator;
      nodes['task-a'] = { id: 'task-a', content: 'Task A', children: [], metadata: { groupId: GROUP } };
      nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { groupId: GROUP } };
      nodes['step-1'] = { ...nodes['step-1'], children: ['task-a', 'task-b'] };
      const ancestorRegistry = { ...state.ancestorRegistry };
      delete ancestorRegistry.orchestrator;
      ancestorRegistry['task-a'] = ['root', 'workflow', 'step-1'];
      ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
      setState({ nodes, ancestorRegistry });
    });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      mockAutonomousCollaborate,
      (cmd) => cmd.execute(),
      vi.fn(),
    );
  });

  it('a Stop on the terminal after the hand-off leaves the first child at N+1, not pushed to N+2', async () => {
    vi.useFakeTimers();
    try {
      actions.handleAutonomousFeedback('orchestrator', '# decompose\n## Task A\n## Task B');
      await vi.advanceTimersByTimeAsync(2500);

      // Hand-off precondition: task-a advanced exactly one step (to step-2) and is
      // running on the parent's terminal, with its step-2 prompt just sent.
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      const sendsAfterHandoff = mockAutonomousCollaborate.mock.calls.filter((c) => c[0] === 'task-a').length;

      // The orchestrator's own turn-ending Stop (explicit submit happened this turn)
      // arrives on the same terminal, now bound to task-a.
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      await vi.advanceTimersByTimeAsync(1500);

      // task-a must stay at step-2 awaiting its real work — not advanced to step-3.
      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-3'].children).not.toContain('task-a');
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      // ...and no second step prompt was injected for the child.
      expect(mockAutonomousCollaborate.mock.calls.filter((c) => c[0] === 'task-a').length).toBe(sendsAfterHandoff);

      // The parked sibling is untouched either way.
      expect(state.nodes['step-1'].children).toContain('task-b');
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
    } finally {
      useTerminalStore.setState({ terminals: [], fileStates: {}, currentFilePath: null });
      vi.useRealTimers();
    }
  });

  it('stays idempotent across the turn\'s duplicate Stop pair (a declaration then none)', async () => {
    vi.useFakeTimers();
    try {
      actions.handleAutonomousFeedback('orchestrator', '# decompose\n## Task A\n## Task B');
      await vi.advanceTimersByTimeAsync(2500);
      const sendsAfterHandoff = mockAutonomousCollaborate.mock.calls.filter((c) => c[0] === 'task-a').length;

      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop', declared_node_id: null });
      await vi.advanceTimersByTimeAsync(1500);

      expect(state.nodes['step-2'].children).toContain('task-a');
      expect(state.nodes['step-3'].children).not.toContain('task-a');
      expect(state.workflowExecutionStates['task-a']?.state).toBe('running');
      expect(mockAutonomousCollaborate.mock.calls.filter((c) => c[0] === 'task-a').length).toBe(sendsAfterHandoff);
    } finally {
      useTerminalStore.setState({ terminals: [], fileStates: {}, currentFilePath: null });
      vi.useRealTimers();
    }
  });

  // Behavior for the other interleaving — the Stop landing inside the 2s recurse
  // window, before the child is bound (orchestrator state already deleted, so the
  // Stop resolves to no running node) — is not yet pinned by the fix. Title-only
  // until the implementation decides whether the ack guard or the durable-recovery
  // path owns that case.
  it.todo('a Stop that arrives during the 2s recurse window (before the child binds) does not later cause a double-advance once the child binds');
});

describe('integration — final-step decomposition retains children with no re-fire or loop', () => {
  // The decomposition step is the FINAL step (no N+1), so after it produces
  // children there is nothing to advance to. They must be retained at the step
  // with no execution entry, nothing scheduled, and the orchestrator's own Stop
  // must not bind or advance anything.
  const GROUP = 'grp-decomp-final';

  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string; collaborating?: boolean; stopReceived?: boolean }>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
    terminalNodeAssignments?: Record<string, string>;
    activeNodeId?: string | null;
  };

  const liveTerminal: TerminalInfo = {
    id: 'terminal-1',
    title: 'Terminal 1',
    cwd: '/tmp',
    shellCommand: 'bash',
    shellArgs: [],
    pinnedToBottom: false,
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: WorkflowExecutionActions;
  let mockAutonomousCollaborate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({ terminals: [liveTerminal], fileStates: {}, currentFilePath: null });

    state = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        workflow: { id: 'workflow', content: 'Workflow', children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } },
        'step-1': { id: 'step-1', content: 'Step 1', children: ['orchestrator'], metadata: { isBlueprint: true, stepType: 'autonomous', decomposition: true } },
        orchestrator: { id: 'orchestrator', content: 'Decompose me', children: [], metadata: { isBlueprint: true, sessionId: 'session-1' } },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        orchestrator: ['root', 'workflow', 'step-1'],
      },
      workflowExecutionStates: { orchestrator: { state: 'running', terminalTabId: 'terminal-1' } },
      workflowSessionMap: { 'session-1': 'terminal-1' },
      sessionRegistry: {},
      terminalNodeAssignments: { 'terminal-1': 'orchestrator' },
      activeNodeId: null,
    };
    setState = (partial) => { state = { ...state, ...partial }; };

    mockAutonomousCollaborate = vi.fn().mockImplementation((nodeId: string) => Promise.resolve(`/tmp/feedback-${nodeId}.md`));

    mockParseFeedbackContent.mockReturnValue({
      nodes: {
        'task-a': { id: 'task-a', content: 'Task A', children: [], metadata: {} },
        'task-b': { id: 'task-b', content: 'Task B', children: [], metadata: {} },
      },
      rootNodeId: 'task-a',
      rootNodeIds: ['task-a', 'task-b'],
      nodeCount: 2,
    });

    mockAcceptFeedbackExecute.mockImplementation(() => {
      const nodes = { ...state.nodes };
      delete nodes.orchestrator;
      nodes['task-a'] = { id: 'task-a', content: 'Task A', children: [], metadata: { groupId: GROUP } };
      nodes['task-b'] = { id: 'task-b', content: 'Task B', children: [], metadata: { groupId: GROUP } };
      nodes['step-1'] = { ...nodes['step-1'], children: ['task-a', 'task-b'] };
      const ancestorRegistry = { ...state.ancestorRegistry };
      delete ancestorRegistry.orchestrator;
      ancestorRegistry['task-a'] = ['root', 'workflow', 'step-1'];
      ancestorRegistry['task-b'] = ['root', 'workflow', 'step-1'];
      setState({ nodes, ancestorRegistry });
    });

    actions = createWorkflowExecutionActions(
      () => state,
      setState,
      vi.fn(),
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      mockAutonomousCollaborate,
      (cmd) => cmd.execute(),
      vi.fn(),
    );
  });

  it('leaves both children parked at the final step with no execution entry, schedules nothing, and the orchestrator Stop does not advance them', async () => {
    vi.useFakeTimers();
    try {
      actions.handleAutonomousFeedback('orchestrator', '# decompose\n## Task A\n## Task B');
      await vi.advanceTimersByTimeAsync(2500);

      // Both children retained at the decomposition step, neither promoted.
      expect(state.nodes['step-1'].children).toEqual(expect.arrayContaining(['task-a', 'task-b']));
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      // No downstream prompt was sent to either child (nothing was scheduled).
      expect(mockAutonomousCollaborate.mock.calls.some((c) => c[0] === 'task-a' || c[0] === 'task-b')).toBe(false);

      // The orchestrator's own Stop on the (now unbound) terminal must not bind or
      // advance a child — no re-fire, no loop.
      actions.handleHookEvent({ session_id: 'session-1', hook_event_name: 'Stop' });
      await vi.advanceTimersByTimeAsync(2500);

      expect(state.nodes['step-1'].children).toEqual(expect.arrayContaining(['task-a', 'task-b']));
      expect(state.workflowExecutionStates['task-a']).toBeUndefined();
      expect(state.workflowExecutionStates['task-b']).toBeUndefined();
      expect(mockAutonomousCollaborate.mock.calls.some((c) => c[0] === 'task-a' || c[0] === 'task-b')).toBe(false);
    } finally {
      useTerminalStore.setState({ terminals: [], fileStates: {}, currentFilePath: null });
      vi.useRealTimers();
    }
  });
});
