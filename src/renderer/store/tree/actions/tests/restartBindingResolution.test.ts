import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createWorkflowExecutionActions } from '../workflowExecutionActions';
import { useActivityLogStore } from '../../../activityLog/activityLogStore';
import { logger } from '@/services/logger';
import { useTerminalStore } from '../../../terminal/terminalStore';

// Contract under test:
//  - The terminal's persisted originNodeId is the authoritative source
//    for the bound node on restart.
//  - When originNodeId is set, SessionStart-time resolution must
//    return that node and must never silently substitute another node
//    that happens to carry the same sessionId.
//  - When originNodeId is set but the referenced node no longer
//    exists, the terminal is left unbound — the resolver does not
//    silently rebind to a sibling carrying the same sessionId.
//  - When originNodeId is absent (legacy terminal), the resolver
//    falls back to the existing sessionId metadata scan, and the
//    scan is deterministic across repeated calls.

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

function buildSharedSessionTree(): TestState {
  return {
    nodes: {
      root: { id: 'root', content: 'Root', children: ['usH', 'highlighted'], metadata: {} } as unknown as TreeNode,
      usH: { id: 'usH', content: 'US-H: stale earlier bind', children: [], metadata: { sessionId: 'sess-shared' } } as unknown as TreeNode,
      highlighted: { id: 'highlighted', content: 'Bug — Highlighted: current bind', children: [], metadata: { sessionId: 'sess-shared' } } as unknown as TreeNode,
    },
    rootNodeId: 'root',
    ancestorRegistry: { root: [], usH: ['root'], highlighted: ['root'] },
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

const TEST_FILE_PATH = '/tmp/restart-binding.arbo';

function setTerminals(terminals: Array<{ id: string; originNodeId?: string; title?: string }>): void {
  const mapped = terminals.map((t) => ({
    id: t.id,
    title: t.title ?? t.id,
    cwd: '/tmp',
    originNodeId: t.originNodeId,
  })) as unknown as ReturnType<typeof useTerminalStore.getState>['terminals'];
  useTerminalStore.setState({
    terminals: mapped,
    activeTerminalId: terminals[0]?.id ?? null,
    currentFilePath: TEST_FILE_PATH,
    fileStates: {
      [TEST_FILE_PATH]: {
        terminals: mapped,
        activeTerminalId: terminals[0]?.id ?? null,
      },
    } as unknown as ReturnType<typeof useTerminalStore.getState>['fileStates'],
  });
}

describe('SessionStart resolution prefers terminal\'s persisted originNodeId', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>['actions'];

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildSharedSessionTree() };
    actions = createActions(stateRef).actions;
    setTerminals([]);
  });

  it('does not change a terminal\'s originNodeId to a sibling that carries the same sessionId', () => {
    setTerminals([{ id: 'term-X', originNodeId: 'highlighted' }]);

    actions.registerSession('sess-shared', 'term-X');

    const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'term-X');
    expect(terminal?.originNodeId).toBe('highlighted');
  });

  it('does not silently substitute another sessionId-carrying node when originNodeId points at a deleted node', () => {
    setTerminals([{ id: 'term-X', originNodeId: 'gone-node' }]);

    actions.registerSession('sess-shared', 'term-X');

    const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'term-X');
    expect(terminal?.originNodeId).not.toBe('usH');
    expect(terminal?.originNodeId).not.toBe('highlighted');
  });

  it('surfaces a "previously-bound node no longer exists" state when originNodeId points at a deleted node', () => {
    setTerminals([{ id: 'term-X', originNodeId: 'gone-node' }]);

    actions.registerSession('sess-shared', 'term-X');

    const messages = useActivityLogStore.getState().entries.map((e) => e.message);
    expect(messages.some((m) => m.includes('Previously-bound node no longer exists'))).toBe(true);
  });

  it('writes originNodeId via the sessionId scan when the terminal has no originNodeId (legacy terminal, single match)', () => {
    stateRef.current.nodes['usH'].metadata.sessionId = undefined;
    setTerminals([{ id: 'term-X', originNodeId: undefined }]);

    actions.registerSession('sess-shared', 'term-X');

    const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'term-X');
    expect(terminal?.originNodeId).toBe('highlighted');
  });

  it('picks the same node deterministically across repeated calls when multiple nodes share a sessionId on the legacy fallback path', () => {
    setTerminals([{ id: 'term-X', originNodeId: undefined }]);
    actions.registerSession('sess-shared', 'term-X');
    const firstPick = useTerminalStore.getState().terminals.find((t) => t.id === 'term-X')?.originNodeId;

    setTerminals([{ id: 'term-Y', originNodeId: undefined }]);
    actions.registerSession('sess-shared', 'term-Y');
    const secondPick = useTerminalStore.getState().terminals.find((t) => t.id === 'term-Y')?.originNodeId;

    expect(firstPick).toBeDefined();
    expect(secondPick).toBe(firstPick);
  });

  it('logs the resolution path on each restart resolve — distinguishing originNodeId from the legacy fallback', () => {
    stateRef.current.nodes['highlighted'].metadata.sessionId = 'sess-bookmark-different';
    setTerminals([{ id: 'term-with-origin', originNodeId: 'highlighted' }]);
    actions.registerSession('sess-shared', 'term-with-origin');
    const originPathLogged = (logger.info as ReturnType<typeof vi.fn>).mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes('retained originNodeId'),
    );
    expect(originPathLogged).toBe(true);

    setTerminals([{ id: 'term-legacy', originNodeId: undefined }]);
    actions.registerSession('sess-shared', 'term-legacy');
    const fallbackPathLogged = (logger.info as ReturnType<typeof vi.fn>).mock.calls.some(
      ([message]) => typeof message === 'string' && message.includes('legacy fallback'),
    );
    expect(fallbackPathLogged).toBe(true);
  });
});

describe('SessionStart resolution — multiple terminals each resolve to their own originNodeId', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>['actions'];

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildSharedSessionTree() };
    actions = createActions(stateRef).actions;
    setTerminals([]);
  });

  it('two terminals with distinct originNodeIds both keep their respective originNodeIds even when the underlying sessionIds collide on metadata', () => {
    setTerminals([
      { id: 'term-A', originNodeId: 'usH' },
      { id: 'term-B', originNodeId: 'highlighted' },
    ]);

    actions.registerSession('sess-shared', 'term-A');
    actions.registerSession('sess-shared', 'term-B');

    const terminals = useTerminalStore.getState().terminals;
    expect(terminals.find((t) => t.id === 'term-A')?.originNodeId).toBe('usH');
    expect(terminals.find((t) => t.id === 'term-B')?.originNodeId).toBe('highlighted');
  });
});

describe('Tab title sync after legacy-fallback reattach', () => {
  let stateRef: { current: TestState };
  let actions: ReturnType<typeof createActions>['actions'];

  beforeEach(() => {
    vi.clearAllMocks();
    stateRef = { current: buildSharedSessionTree() };
    actions = createActions(stateRef).actions;
    setTerminals([]);
  });

  it('after legacy-fallback resolution, the terminal tab title is synced from the resolved node', () => {
    stateRef.current.nodes['usH'].metadata.sessionId = undefined;
    setTerminals([{ id: 'term-X', originNodeId: undefined, title: 'placeholder' }]);

    actions.registerSession('sess-shared', 'term-X');

    const terminal = useTerminalStore.getState().terminals.find((t) => t.id === 'term-X');
    expect(terminal?.title).not.toBe('placeholder');
    expect(terminal?.title).toContain('Bug — Highlighted');
  });
});

// The user-visible "rebind dialog naming the wrong node" originates from
// the file-open seed path: extractSessionBindings emits one pair per node
// carrying a sessionId; when two nodes share one, SessionBindingRegistry
// sees the second pair as a rebind and fires the dialog. The dedup is
// covered in src/renderer/utils/tests/extractSessionBindings.test.ts.
