import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { executeInTerminal } from '../../../../services/terminalExecution';
import { useToastStore } from '../../../toast/toastStore';
import { usePendingRebindDialogStore } from '../../../pendingRebindDialogStore';

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
const TERMINAL_ID = 'term-1';

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

describe('sendActions — sends blocked while a rebind dialog is pending for the target terminal (US-C)', () => {
  // While the rebind confirmation dialog is open for a given terminal, every
  // send to that terminal must short-circuit and surface a toast — otherwise
  // a prompt can be pasted into the terminal before the user resolves the
  // dialog and Claude submits against the still-stale binding.
  let state: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  let executeMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    makeEnv();
    state = makeState();
    usePendingRebindDialogStore.getState().clear();
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
    actions = createSendActions(mockGet, mockSet, noOpVisualEffects, vi.fn());
    executeMock = executeInTerminal as Mock;
  });

  it('collaborateInTerminal does NOT paste into the terminal when a rebind dialog is open on it', async () => {
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);

    await actions.collaborateInTerminal(NODE_ID, TERMINAL_ID);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('collaborateInTerminal surfaces a toast when a rebind dialog is open on the terminal', async () => {
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);

    await actions.collaborateInTerminal(NODE_ID, TERMINAL_ID);

    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBeGreaterThan(0);
    expect(toasts.some((t) => /rebind|confirmation|dialog/i.test(t.message))).toBe(true);
  });

  it('autonomousCollaborateInTerminal does NOT paste into the terminal when a rebind dialog is open on it', async () => {
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);

    await actions.autonomousCollaborateInTerminal(NODE_ID, TERMINAL_ID);

    expect(executeMock).not.toHaveBeenCalled();
  });

  it('a send to a DIFFERENT terminal (no pending rebind on it) is unaffected', async () => {
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);

    await actions.collaborateInTerminal(NODE_ID, 'other-term');

    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it('a send to the previously-blocked terminal works again after clearPending', async () => {
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);
    usePendingRebindDialogStore.getState().clearPending(TERMINAL_ID);

    await actions.collaborateInTerminal(NODE_ID, TERMINAL_ID);

    expect(executeMock).toHaveBeenCalledTimes(1);
  });
});
