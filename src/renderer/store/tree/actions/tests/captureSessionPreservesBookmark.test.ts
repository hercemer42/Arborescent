import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import { useTerminalStore } from '../../../terminal/terminalStore';

// Bug: Resume session on node N opened the wrong session because a
// SessionStart hook on a terminal whose originNodeId still pointed at
// N had been overwriting N.metadata.sessionId via the originNodeId
// fallback path in findCapturableNodeForTerminal.
//
// Contract under test (the bookmark wins on the origin-fallback path):
//   - A node's metadata.sessionId is a user-pinned bookmark. Once set,
//     it must not be silently overwritten by a different sessionId
//     coming from a SessionStart event on a terminal that references
//     the node only as its originNodeId.
//   - The pin only loses to a stronger signal: brokenChain recovery,
//     or the node being the *currently running* workflow node on the
//     terminal that fired the SessionStart.

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

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments: Record<string, string>;
};

function buildBookmarkedTree(): TestState {
  return {
    nodes: {
      root: { id: 'root', content: 'Root', children: ['nodeA', 'nodeB'], metadata: {} },
      nodeA: { id: 'nodeA', content: 'PR 8237', children: [], metadata: { sessionId: 'session-A' } },
      nodeB: { id: 'nodeB', content: 'PR 9675', children: [], metadata: { sessionId: 'session-B' } },
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
  const mockAutosave = vi.fn();
  const mockVisualEffects = {
    flashNode: vi.fn(),
    scrollToNode: vi.fn(),
    startDeleteAnimation: vi.fn(),
    clearDeleteAnimation: vi.fn(),
  };
  return {
    actions: createWorkflowExecutionActions(
      get,
      set,
      mockAutosave,
      mockVisualEffects,
      vi.fn().mockResolvedValue('/tmp/feedback.md'),
    ),
    mockAutosave,
  };
}

function setTerminals(terminals: Array<{ id: string; originNodeId?: string }>): void {
  useTerminalStore.setState({
    terminals: terminals.map((t) => ({
      id: t.id,
      title: t.id,
      cwd: '/tmp',
      originNodeId: t.originNodeId,
    })) as unknown as ReturnType<typeof useTerminalStore.getState>['terminals'],
    activeTerminalId: terminals[0]?.id ?? null,
    currentFilePath: null,
    fileStates: {},
  });
}

describe('captureSessionOnNode — bookmark preservation guard', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>['actions'];
  let mockAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildBookmarkedTree() };
    const created = createActions(stateRef);
    actions = created.actions;
    mockAutosave = created.mockAutosave;
    setTerminals([]);
  });

  it('is a no-op when capture target is selected via originNodeId fallback and the existing sessionId differs from the incoming one', () => {
    setTerminals([{ id: 'term-X', originNodeId: 'nodeA' }]);

    actions.registerSession('session-C', 'term-X');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-A');
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('writes the sessionId when the origin node has no prior bookmark', () => {
    stateRef.current.nodes['nodeA'].metadata.sessionId = undefined;
    setTerminals([{ id: 'term-X', originNodeId: 'nodeA' }]);

    actions.registerSession('session-C', 'term-X');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-C');
    expect(mockAutosave).toHaveBeenCalled();
  });

  it('overrides the bookmark when brokenChain=true (recovery path still wins)', () => {
    stateRef.current.nodes['nodeA'].metadata.brokenChain = true;
    setTerminals([{ id: 'term-X', originNodeId: 'nodeA' }]);

    actions.registerSession('session-C', 'term-X');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-C');
    expect(stateRef.current.nodes['nodeA'].metadata.brokenChain).toBeUndefined();
  });

  it('is idempotent when the incoming sessionId matches the stored bookmark', () => {
    setTerminals([{ id: 'term-X', originNodeId: 'nodeA' }]);

    actions.registerSession('session-A', 'term-X');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-A');
  });
});

describe('registerSession — capture target selection', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>['actions'];

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildBookmarkedTree() };
    actions = createActions(stateRef).actions;
    setTerminals([]);
  });

  it('still captures onto the currently-running workflow node even when its bookmarked sessionId differs (running signal beats bookmark)', () => {
    stateRef.current.workflowExecutionStates['nodeA'] = {
      state: 'running',
      terminalTabId: 'term-X',
    };
    setTerminals([{ id: 'term-X', originNodeId: 'nodeA' }]);

    actions.registerSession('session-C', 'term-X');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-C');
  });

  it('leaves sibling bookmarks untouched when origin-fallback capture is suppressed', () => {
    setTerminals([{ id: 'term-X', originNodeId: 'nodeA' }]);

    actions.registerSession('session-D', 'term-X');

    expect(stateRef.current.nodes['nodeA'].metadata.sessionId).toBe('session-A');
    expect(stateRef.current.nodes['nodeB'].metadata.sessionId).toBe('session-B');
  });
});

describe('resume bug regression — bookmark stays put across unrelated SessionStart events', () => {
  it.todo('resumeSession on node A still sends `claude --resume <bookmarked>` after an unrelated SessionStart has fired on a sibling terminal');
});
