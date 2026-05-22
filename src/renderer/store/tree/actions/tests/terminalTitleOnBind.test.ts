import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import { useTerminalStore } from '../../../terminal/terminalStore';

// Bug: when a Claude session first binds a node to a terminal via the
// SessionStart hook (capture path or origin-reattach path), the terminal
// tab title stayed at "Terminal N" instead of switching to the node's
// task title — that only happened for the resume path because the title
// is set at createNewTerminal time via resumeTabTitle.
//
// Contract under test: when registerSession establishes a binding
// between a node and a terminal — either by capturing the sessionId onto
// a node (running workflow node, or unbookmarked origin node) or by
// reattaching an origin node via sessionId match — the terminal tab
// title is synced to extractTaskTitle(boundNode).

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

vi.mock('../../../services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

vi.mock('@/utils/nodeHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/nodeHelpers')>();
  return { ...actual, resolveContextMode: () => 'execute' };
});

const FILE_PATH = '/project.arbo';

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
};

function buildTree(): TestState {
  return {
    nodes: {
      root: { id: 'root', content: 'Root', children: ['nodeA', 'nodeB'], metadata: {} },
      nodeA: { id: 'nodeA', content: 'Fix terminal title on bind', children: [], metadata: {} },
      nodeB: { id: 'nodeB', content: 'Refactor session capture', children: [], metadata: {} },
    },
    rootNodeId: 'root',
    ancestorRegistry: { root: [], nodeA: ['root'], nodeB: ['root'] },
    workflowExecutionStates: {},
    workflowSessionMap: {},
    sessionRegistry: {},
    terminalNodeAssignments: {},
  };
}

function createActions(stateRef: { current: TestState }) {
  const get = () => stateRef.current;
  const set = (partial: Partial<TestState>) => {
    stateRef.current = { ...stateRef.current, ...partial };
  };
  return createWorkflowExecutionActions(
    get,
    set,
    vi.fn(),
    {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    },
    vi.fn().mockResolvedValue('/tmp/feedback.md'),
  );
}

type TerminalSeed = { id: string; title: string; originNodeId?: string };

function setTerminals(seeds: TerminalSeed[]): void {
  const terminals = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    cwd: '/tmp',
    originNodeId: s.originNodeId,
  })) as unknown as ReturnType<typeof useTerminalStore.getState>['terminals'];

  useTerminalStore.setState({
    terminals,
    activeTerminalId: seeds[0]?.id ?? null,
    currentFilePath: FILE_PATH,
    fileStates: {
      [FILE_PATH]: {
        terminals,
        activeTerminalId: seeds[0]?.id ?? null,
      },
    },
  });
}

function titleOf(terminalId: string): string | undefined {
  return useTerminalStore.getState().terminals.find((t) => t.id === terminalId)?.title;
}

describe('terminal title sync on first bind — capture path (running workflow node)', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildTree() };
    actions = createActions(stateRef);
    setTerminals([{ id: 'term-1', title: 'Terminal 1', originNodeId: 'nodeA' }]);
  });

  it('updates the terminal title to the running node\'s task title on SessionStart capture', () => {
    stateRef.current.workflowExecutionStates['nodeA'] = {
      state: 'running',
      terminalTabId: 'term-1',
    };

    actions.registerSession('session-new', 'term-1');

    expect(titleOf('term-1')).toBe('Fix terminal title on bind');
  });

  it('uses the first non-blank line when the node content has leading whitespace lines', () => {
    stateRef.current.nodes['nodeA'].content = '\n\n   \nFirst real line\nsecond line';
    stateRef.current.workflowExecutionStates['nodeA'] = {
      state: 'running',
      terminalTabId: 'term-1',
    };

    actions.registerSession('session-new', 'term-1');

    expect(titleOf('term-1')).toBe('First real line');
  });
});

describe('terminal title sync on first bind — capture path (origin-node fallback)', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildTree() };
    actions = createActions(stateRef);
    setTerminals([{ id: 'term-1', title: 'Terminal 1', originNodeId: 'nodeA' }]);
  });

  it('updates the terminal title to the origin node\'s task title when capture writes to an unbookmarked origin', () => {
    actions.registerSession('session-new', 'term-1');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-new');
    expect(titleOf('term-1')).toBe('Fix terminal title on bind');
  });

  it('does NOT change the terminal title when capture is suppressed by the bookmark guard', () => {
    stateRef.current.nodes['nodeA'].metadata.sessionId = 'session-existing';

    actions.registerSession('session-different', 'term-1');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-existing');
    expect(titleOf('term-1')).toBe('Terminal 1');
  });

  it('updates the title on brokenChain recovery (bookmark loses to recovery, title follows)', () => {
    stateRef.current.nodes['nodeA'].metadata.sessionId = 'session-existing';
    stateRef.current.nodes['nodeA'].metadata.brokenChain = true;

    actions.registerSession('session-different', 'term-1');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-different');
    expect(titleOf('term-1')).toBe('Fix terminal title on bind');
  });
});

describe('terminal title sync on first bind — reattach path (sessionId match)', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildTree() };
    actions = createActions(stateRef);
  });

  it('updates the terminal title to the reattached node\'s task title when SessionStart matches a bookmark on a different node', () => {
    stateRef.current.nodes['nodeB'].metadata.sessionId = 'session-B';
    setTerminals([{ id: 'term-1', title: 'Terminal 1' }]);

    actions.registerSession('session-B', 'term-1');

    expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('nodeB');
    expect(titleOf('term-1')).toBe('Refactor session capture');
  });
});

describe('terminal title sync on first bind — edge cases', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildTree() };
    actions = createActions(stateRef);
  });

  it('does not blank out the existing title when the bound node\'s content is empty', () => {
    stateRef.current.nodes['nodeA'].content = '';
    setTerminals([{ id: 'term-1', title: 'Terminal 1', originNodeId: 'nodeA' }]);

    actions.registerSession('session-new', 'term-1');

    expect(titleOf('term-1')).toBe('Terminal 1');
  });

  it('does not blank out the existing title when the bound node\'s content is whitespace-only', () => {
    stateRef.current.nodes['nodeA'].content = '   \n\t\n  ';
    setTerminals([{ id: 'term-1', title: 'Terminal 1', originNodeId: 'nodeA' }]);

    actions.registerSession('session-new', 'term-1');

    expect(titleOf('term-1')).toBe('Terminal 1');
  });

  it('does not touch the title of an unrelated terminal in the same file', () => {
    setTerminals([
      { id: 'term-1', title: 'Terminal 1', originNodeId: 'nodeA' },
      { id: 'term-2', title: 'Terminal 2', originNodeId: 'nodeB' },
    ]);

    actions.registerSession('session-new', 'term-1');

    expect(titleOf('term-1')).toBe('Fix terminal title on bind');
    expect(titleOf('term-2')).toBe('Terminal 2');
  });

  it('ignores an empty / whitespace-only sessionId — title is left alone', () => {
    setTerminals([{ id: 'term-1', title: 'Terminal 1', originNodeId: 'nodeA' }]);

    actions.registerSession('   ', 'term-1');

    expect(titleOf('term-1')).toBe('Terminal 1');
  });

  it('does not re-write the title when SessionStart fires with the already-bookmarked sessionId (idempotent capture)', () => {
    stateRef.current.nodes['nodeA'].metadata.sessionId = 'session-existing';
    setTerminals([{ id: 'term-1', title: 'Old user-chosen label', originNodeId: 'nodeA' }]);

    actions.registerSession('session-existing', 'term-1');

    expect(titleOf('term-1')).toBe('Old user-chosen label');
  });
});
