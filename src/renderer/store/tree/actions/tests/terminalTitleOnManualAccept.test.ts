import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { extractFeedbackContent } from '../../../../services/feedback/feedbackService';
import { logger } from '../../../../services/logger';
import { useTerminalStore } from '../../../terminal/terminalStore';

// Bug: a terminal bound to a node keeps a STALE tab title after a *manual*
// review accept renames the bound root. finishAccept runs AcceptFeedbackCommand
// but — unlike the autonomous path (handleAutonomousFeedback, which resyncs at
// workflowExecutionActions.ts:1268) — never resyncs bound terminal titles from
// the settled tree. These tests pin the contract that a manual accept refreshes
// bound terminal titles, reusing the same extractor and the same empty/whitespace
// guard as the rename and autonomous paths.

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: vi.fn(),
  parseFeedbackContentWithReason: vi.fn(),
  initializeFeedbackStore: vi.fn(),
  extractFeedbackContent: vi.fn(),
  cleanupFeedbackForNode: vi.fn().mockResolvedValue(undefined),
  cleanupFeedbackForFile: vi.fn().mockResolvedValue(undefined),
  findCollaboratingNode: vi.fn(),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForNode: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearForFile: vi.fn(),
    clearForNode: vi.fn(),
  },
}));

const FILE_PATH = '/tmp/file.arbo';

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
    fileStates: { [FILE_PATH]: { terminals, activeTerminalId: seeds[0]?.id ?? null } },
  });
}

function titleOf(terminalId: string): string | undefined {
  return useTerminalStore.getState().terminals.find((t) => t.id === terminalId)?.title;
}

describe('terminal title syncs on manual review accept', () => {
  let mockState: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  // Settling the tree is AcceptFeedbackCommand's job (covered by its own tests);
  // here executeCommand is stubbed to drop the accepted root line onto the reviewed
  // node IN PLACE — the reconciled-in-place shape a single-root feedback accept
  // produces — so each test isolates finishAccept's own responsibility: resync the
  // bound terminal titles from the settled tree once the command has run.
  let onExecuteCommand: () => void;

  beforeEach(() => {
    vi.clearAllMocks();

    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: FILE_PATH,
      fileStates: { [FILE_PATH]: { terminals: [], activeTerminalId: null } },
    });

    global.window = {
      electron: {
        terminalWrite: vi.fn().mockResolvedValue(undefined),
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/feedback.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
        notifyManualCollabResolved: vi.fn().mockResolvedValue(undefined),
        saveSession: vi.fn().mockResolvedValue(undefined),
      },
      dispatchEvent: vi.fn(),
    } as unknown as Window & typeof globalThis;

    const root: TreeNode = { id: 'root', content: 'Root', children: ['child1'], metadata: { plugins: {} } };
    const child1: TreeNode = { id: 'child1', content: 'Child 1', children: [], metadata: { plugins: {} } };

    mockState = {
      nodes: { root, child1 },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], child1: ['root'] },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: FILE_PATH,
      fileMeta: null,
      flashingNodeIds: new Set(),
      flashingIntensity: 'light',
      scrollToNodeId: null,
      deletingNodeIds: new Set(),
      deleteAnimationCallback: null,
      reviews: {},
      pendingProposals: {},
      feedbackFadingNodeIds: new Set(),
      contextDeclarations: [],
      blueprintModeEnabled: false,
      isFileBlueprintFile: false,
      summaryModeEnabled: false,
      summaryDateFrom: null,
      summaryDateTo: null,
      summaryVisibleNodeIds: null,
      workflowExecutionStates: {},
      workflowSessionMap: {},
      terminalNodeAssignments: {},
      actions: {} as TreeState['actions'],
      sessionRegistry: {},
    };

    const get = vi.fn(() => mockState);
    const set = vi.fn((partial: Partial<TreeState> | ((s: TreeState) => Partial<TreeState>)) => {
      const update = typeof partial === 'function' ? partial(mockState) : partial;
      Object.assign(mockState, update);
    });

    onExecuteCommand = () => {};
    const executeCommand = vi.fn(() => onExecuteCommand());

    actions = createSendActions(
      get,
      set,
      { flashNode: vi.fn(), scrollToNode: vi.fn(), startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn() },
      vi.fn(),
      executeCommand,
    );
  });

  // Stub the proposition being accepted and make the accept settle the reviewed
  // node ('child1') to the accepted root line, reconciled in place.
  function acceptRenames(newRootLine: string): void {
    vi.mocked(extractFeedbackContent).mockReturnValue({
      rootNodeId: 'new-child1',
      rootNodeIds: ['new-child1'],
      nodes: { 'new-child1': { id: 'new-child1', content: newRootLine, children: [], metadata: { plugins: {} } } },
    });
    onExecuteCommand = () => {
      mockState.nodes = {
        ...mockState.nodes,
        child1: { ...mockState.nodes.child1, content: newRootLine },
      };
    };
  }

  it('updates the bound terminal title to the accepted first non-blank line', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([{ id: 'term-1', title: 'Child 1', originNodeId: 'child1' }]);
    acceptRenames('Renamed task');

    await actions.finishAccept('child1');

    expect(titleOf('term-1')).toBe('Renamed task');
  });

  it('uses the first non-blank line when the accepted root has leading blank lines and trailing space', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([{ id: 'term-1', title: 'Child 1', originNodeId: 'child1' }]);
    acceptRenames('\n\n  Real title  \nbody');

    await actions.finishAccept('child1');

    expect(titleOf('term-1')).toBe('Real title');
  });

  it('retitles only the terminal bound to the accepted node, leaving other bound terminals alone', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([
      { id: 'term-1', title: 'Child 1', originNodeId: 'child1' },
      { id: 'term-2', title: 'Root', originNodeId: 'root' },
    ]);
    acceptRenames('Renamed task');

    await actions.finishAccept('child1');

    expect(titleOf('term-1')).toBe('Renamed task');
    expect(titleOf('term-2')).toBe('Root');
  });

  it('retitles a bound terminal even when the accept migrates its originNodeId to a new node id', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([{ id: 'term-1', title: 'Child 1', originNodeId: 'child1' }]);
    // The multi-root accept settles a NEW node id and migrates the bound terminal's
    // originNodeId onto it before setState (as AcceptFeedbackCommand does). A per-node
    // sync keyed on the reviewed 'child1' would miss the migrated terminal; the by-map
    // resync re-derives off the terminal's current (migrated) originNodeId.
    vi.mocked(extractFeedbackContent).mockReturnValue({
      rootNodeId: 'migrated-node',
      rootNodeIds: ['migrated-node'],
      nodes: { 'migrated-node': { id: 'migrated-node', content: 'Migrated title', children: [], metadata: { plugins: {} } } },
    });
    onExecuteCommand = () => {
      mockState.nodes = {
        ...mockState.nodes,
        'migrated-node': { id: 'migrated-node', content: 'Migrated title', children: [], metadata: { plugins: {} } },
      };
      const store = useTerminalStore.getState();
      useTerminalStore.setState({
        terminals: store.terminals.map((t) =>
          t.id === 'term-1' ? { ...t, originNodeId: 'migrated-node' } : t,
        ),
      });
    };

    await actions.finishAccept('child1');

    expect(titleOf('term-1')).toBe('Migrated title');
  });

  it('leaves the prior title intact when the accepted root line is empty or whitespace-only', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([{ id: 'term-1', title: 'Child 1', originNodeId: 'child1' }]);
    acceptRenames('   \n\t  ');

    await actions.finishAccept('child1');

    expect(titleOf('term-1')).toBe('Child 1');
  });

  it('does not touch terminals that have no originNodeId set', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([{ id: 'term-free', title: 'Free terminal' }]);
    acceptRenames('Renamed task');

    await actions.finishAccept('child1');

    expect(titleOf('term-free')).toBe('Free terminal');
  });

  it('does not retitle on the open-review path where extractFeedbackContent is nullish', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    setTerminals([{ id: 'term-1', title: 'Child 1', originNodeId: 'child1' }]);
    vi.mocked(extractFeedbackContent).mockReturnValue(null);

    await actions.finishAccept('child1');

    expect(titleOf('term-1')).toBe('Child 1');
  });

  it('is a safe no-op when there are no terminals at all — the accept still settles', async () => {
    mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
    acceptRenames('Renamed task');

    await actions.finishAccept('child1');

    expect(mockState.nodes.child1.content).toBe('Renamed task');
    expect(logger.error).not.toHaveBeenCalled();
  });
});
