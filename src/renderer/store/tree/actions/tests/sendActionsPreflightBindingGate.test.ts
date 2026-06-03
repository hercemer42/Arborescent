import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { executeInTerminal } from '../../../../services/terminalExecution';
import { useToastStore } from '../../../toast/toastStore';
import { usePendingRebindDialogStore } from '../../../pendingRebindDialogStore';
import { useRebindPreflightStore } from '../../../rebindPreflightStore';

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
const OTHER_NODE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const TERMINAL_ID = 'term-1';

function makeState(): TreeState {
  const root: TreeNode = {
    id: 'root',
    content: 'Root',
    children: [NODE_ID, OTHER_NODE_ID, COLLAB_CTX],
    metadata: { plugins: {} },
  };
  const node: TreeNode = {
    id: NODE_ID,
    content: 'Step B',
    children: [],
    metadata: { plugins: {}, appliedContextId: COLLAB_CTX },
  };
  const otherNode: TreeNode = {
    id: OTHER_NODE_ID,
    content: 'Step A (already bound)',
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
    nodes: { root, [NODE_ID]: node, [OTHER_NODE_ID]: otherNode, [COLLAB_CTX]: ctx },
    rootNodeId: 'root',
    treeType: 'workspace',
    ancestorRegistry: {
      root: [],
      [NODE_ID]: ['root'],
      [OTHER_NODE_ID]: ['root'],
      [COLLAB_CTX]: ['root'],
    },
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

function makeEnv(): void {
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

describe('sendActions — preflight rebind gate: do not paste before confirmation when a DIFFERENT node is already bound to the terminal', () => {
  let state: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  let executeMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    makeEnv();
    state = makeState();
    usePendingRebindDialogStore.getState().clear();
    useRebindPreflightStore.getState().clear();
    useToastStore.setState({ toasts: [] });
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

  it('collaborateInTerminal (manual send) pastes immediately regardless of terminalNodeAssignments — manual sends use one-shot TARGET routing and never rebind the session', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };
    await actions.collaborateInTerminal(NODE_ID, TERMINAL_ID);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('autonomousCollaborateInTerminal pastes immediately when the target terminal has no prior node bound', async () => {
    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('autonomousCollaborateInTerminal pastes immediately when the terminal is already bound to the SAME node (no dialog)', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: NODE_ID };
    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('autonomousCollaborateInTerminal does NOT paste when terminalNodeAssignments shows a DIFFERENT node bound to the target terminal', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('queues a preflight rebind request with previous/new node IDs and the target terminal', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);

    const current = useRebindPreflightStore.getState().current;
    expect(current).not.toBeNull();
    expect(current?.terminalId).toBe(TERMINAL_ID);
    expect(current?.previousNodeId).toBe(OTHER_NODE_ID);
    expect(current?.newNodeId).toBe(NODE_ID);
    expect(typeof current?.replay).toBe('function');
  });

  it('marks the target terminal as pending so the existing rebind-dialog gate also blocks new sends', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);

    expect(usePendingRebindDialogStore.getState().isPending(TERMINAL_ID)).toBe(true);
  });

  it('invoking the queued replay pastes exactly once even while the stale binding is still in terminalNodeAssignments (replay bypasses the gate via the inner runAutonomousCollaborateInTerminal)', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);
    expect(executeMock).not.toHaveBeenCalled();

    const replay = useRebindPreflightStore.getState().current?.replay;
    expect(replay).toBeDefined();

    await replay?.();

    expect(executeMock).toHaveBeenCalledTimes(1);
    expect(state.terminalNodeAssignments[TERMINAL_ID]).toBe(OTHER_NODE_ID);
  });

  it('while a preflight rebind is awaiting confirmation, a second autonomous send to the same terminal is blocked', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);
    expect(executeMock).not.toHaveBeenCalled();

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);
    expect(executeMock).not.toHaveBeenCalled();
  });

  it('collaborateInTerminal handles an unknown terminalId (no assignment, no binding) by pasting normally', async () => {
    await actions.collaborateInTerminal(NODE_ID, 'never-seen-terminal');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('a binding on one terminal does not block an autonomous send to a different unbound terminal', async () => {
    state.terminalNodeAssignments = { [TERMINAL_ID]: OTHER_NODE_ID };
    await actions.autonomousCollaborateInTerminal(NODE_ID, 'unrelated-terminal');
    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
