import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { executeInTerminal } from '../../../../services/terminalExecution';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: vi.fn(),
  initializeFeedbackStore: vi.fn(),
  extractFeedbackContent: vi.fn(),
  cleanupFeedback: vi.fn().mockResolvedValue(undefined),
  findCollaboratingNode: vi.fn(),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForFile: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearFile: vi.fn(),
  },
}));

const COLLAB_CTX = 'collab-ctx';
const NODE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';

function makeState(): TreeState {
  const root: TreeNode = {
    id: 'root',
    content: 'Root',
    children: [NODE_ID, COLLAB_CTX],
    metadata: { plugins: {} },
  };
  const node: TreeNode = {
    id: NODE_ID,
    content: 'Step',
    children: [],
    metadata: { plugins: {}, appliedContextId: COLLAB_CTX },
  };
  const ctx: TreeNode = {
    id: COLLAB_CTX,
    content: 'Review context',
    children: [],
    metadata: { isContextDeclaration: true, collaborate: true, execute: false },
  };
  return {
    nodes: { root, [NODE_ID]: node, [COLLAB_CTX]: ctx },
    rootNodeId: 'root',
    treeType: 'workspace',
    ancestorRegistry: { root: [], [NODE_ID]: ['root'], [COLLAB_CTX]: ['root'] },
    activeNodeId: null,
    multiSelectedNodeIds: new Set(),
    lastSelectedNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    currentFilePath: null,
    fileMeta: null,
    flashingNodeIds: new Set<string>(),
    flashingIntensity: 'light' as const,
    scrollToNodeId: null,
    deletingNodeIds: new Set<string>(),
    deleteAnimationCallback: null,
    collaboratingNodeId: null,
    collaborationSource: null,
    collaboratingTerminalId: null,
    decomposition: false,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: {} as any,
    sessionRegistry: {},
  };
}

function makeEnv() {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.window = {
    electron: {
      terminalWrite: vi.fn().mockResolvedValue(undefined),
      startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
      stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
      createTempFile: vi.fn().mockResolvedValue('/tmp/feedback.md'),
      readTempFile: vi.fn().mockResolvedValue(null),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('sendActions — binding marker source token (US-C)', () => {
  // autonomousCollaborateInTerminal is the choke point that emits the binding
  // marker on workflow-driven sends. The caller (workflow execution layer)
  // passes a source flag distinguishing workflow-start from workflow-advance,
  // and the marker carries that flag through to the dispatcher.
  let state: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  let executeMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    makeEnv();
    state = makeState();
    const mockGet = vi.fn(() => state);
    const mockSet = vi.fn((partial: Partial<TreeState> | ((s: TreeState) => Partial<TreeState>)) => {
      const update = typeof partial === 'function' ? partial(state) : partial;
      Object.assign(state, update);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const noOpVisualEffects: any = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };
    actions = createSendActions(mockGet, mockSet, noOpVisualEffects, vi.fn(), vi.fn());
    executeMock = executeInTerminal as Mock;
  });

  it('autonomousCollaborateInTerminal emits the binding marker with source=workflow-advance when called with that source', async () => {
    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1', undefined, undefined, 'workflow-advance');

    expect(executeMock).toHaveBeenCalledTimes(1);
    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(`<!-- ARBORESCENT_NODE: ${NODE_ID} workflow-advance -->`)).toBe(true);
  });

  it('autonomousCollaborateInTerminal emits the binding marker with source=workflow-start when called with that source', async () => {
    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1', undefined, undefined, 'workflow-start');

    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(`<!-- ARBORESCENT_NODE: ${NODE_ID} workflow-start -->`)).toBe(true);
  });

  it('action-mode autonomous-terminal send carries NO marker regardless of source — neither flag set means action mode', async () => {
    // Drop the applied context so the path falls through to action mode.
    state.nodes[NODE_ID] = {
      ...state.nodes[NODE_ID],
      metadata: { ...state.nodes[NODE_ID].metadata, appliedContextId: undefined },
    };

    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1', undefined, undefined, 'workflow-advance');

    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent).not.toContain('<!-- ARBORESCENT_NODE:');
  });

  it('manual terminal collab still emits the TARGET marker only — source is a binding-marker concern and does not apply', async () => {
    // collaborateInTerminal (manual) is unrelated to US-C's source token —
    // it must continue to emit only ARBORESCENT_TARGET (one-shot routing),
    // never the binding marker, regardless of any workflow context.
    await actions.collaborateInTerminal(NODE_ID, 'term-1');

    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(`<!-- ARBORESCENT_TARGET: ${NODE_ID} -->`)).toBe(true);
    expect(sent).not.toContain('workflow-advance');
    expect(sent).not.toContain('workflow-start');
  });
});
