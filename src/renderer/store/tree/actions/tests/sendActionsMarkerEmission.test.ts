import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import {
  ARBORESCENT_MARKER_PREFIX,
  ARBORESCENT_TARGET_MARKER_PREFIX,
} from '../../../../../shared/utils/arborescentMarker';
import { executeInTerminal } from '../../../../services/terminalExecution';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContentWithReason: vi.fn(),
  initializeFeedbackStore: vi.fn(),
  extractFeedbackContent: vi.fn(),
  cleanupFeedbackForNode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForNode: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearForFile: vi.fn(),
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
    reviews: {},
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

function makeClipboardEnv() {
  // executeInTerminal is mocked, and the actions only use navigator.clipboard
  // for the 'web' path. Stub both so action and autonomous-terminal flows
  // don't blow up on missing globals.
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

describe('sendActions — marker emission per target (US-B)', () => {
  let state: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  let executeMock: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    makeClipboardEnv();
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

  it('autonomous-terminal collab prepends the BINDING marker (ARBORESCENT_NODE) — the workflow owns the session binding', async () => {
    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1');

    expect(executeMock).toHaveBeenCalledTimes(1);
    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(ARBORESCENT_MARKER_PREFIX + NODE_ID)).toBe(true);
    // It must NOT also carry the one-shot target marker — the workflow
    // binding marker is the only marker on workflow sends.
    expect(sent).not.toContain(ARBORESCENT_TARGET_MARKER_PREFIX);
  });

  it('autonomous-terminal execute mode also prepends the BINDING marker (workflow exec turn)', async () => {
    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1', { collaborate: false, execute: true });

    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(ARBORESCENT_MARKER_PREFIX + NODE_ID)).toBe(true);
    expect(sent).not.toContain(ARBORESCENT_TARGET_MARKER_PREFIX);
  });

  it('manual terminal collab prepends the TARGET marker (ARBORESCENT_TARGET) — one-shot routing, no binding change', async () => {
    // Acceptance: "Manual collab sends — right-click Send, Revise after
    // discussion — carry the target marker only".
    await actions.collaborateInTerminal(NODE_ID, 'term-1');

    expect(executeMock).toHaveBeenCalledTimes(1);
    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(ARBORESCENT_TARGET_MARKER_PREFIX + NODE_ID)).toBe(true);
    expect(sent).not.toContain(ARBORESCENT_MARKER_PREFIX);
  });

  it('manual terminal execute mode also prepends the TARGET marker — still a one-shot, not a binding swap', async () => {
    await actions.collaborateInTerminal(NODE_ID, 'term-1', { collaborate: false, execute: true });

    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent.startsWith(ARBORESCENT_TARGET_MARKER_PREFIX + NODE_ID)).toBe(true);
    expect(sent).not.toContain(ARBORESCENT_MARKER_PREFIX);
  });

  it('action-mode terminal send (no context) carries NEITHER marker — preserves the current binding by design', async () => {
    // Clear appliedContextId so no resolvedContextId → bare nodeContent path.
    state.nodes[NODE_ID] = {
      ...state.nodes[NODE_ID],
      metadata: { ...state.nodes[NODE_ID].metadata, appliedContextId: undefined },
    };

    await actions.collaborateInTerminal(NODE_ID, 'term-1');

    expect(executeMock).toHaveBeenCalledTimes(1);
    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent).not.toContain(ARBORESCENT_MARKER_PREFIX);
    expect(sent).not.toContain(ARBORESCENT_TARGET_MARKER_PREFIX);
  });

  it('action-mode autonomous-terminal send (no context) carries NEITHER marker — same rule, autonomous variant', async () => {
    state.nodes[NODE_ID] = {
      ...state.nodes[NODE_ID],
      metadata: { ...state.nodes[NODE_ID].metadata, appliedContextId: undefined },
    };

    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1');

    expect(executeMock).toHaveBeenCalledTimes(1);
    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent).not.toContain(ARBORESCENT_MARKER_PREFIX);
    expect(sent).not.toContain(ARBORESCENT_TARGET_MARKER_PREFIX);
  });

  it('manual terminal collab prompt instructs the assistant to pass target_node_id on submit (so the server can detect drift)', async () => {
    await actions.collaborateInTerminal(NODE_ID, 'term-1');

    const sent = executeMock.mock.calls[0][1] as string;
    expect(sent).toContain(`target_node_id="${NODE_ID}"`);
  });

  it('web collab — clipboard payload carries NEITHER marker (web has no MCP hook to register against)', async () => {
    await actions.collaborate(NODE_ID);

    const clipboardCalls = (navigator.clipboard.writeText as Mock).mock.calls;
    expect(clipboardCalls.length).toBeGreaterThan(0);
    const payload = clipboardCalls[clipboardCalls.length - 1][0] as string;
    expect(payload).not.toContain(ARBORESCENT_MARKER_PREFIX);
    expect(payload).not.toContain(ARBORESCENT_TARGET_MARKER_PREFIX);
  });
});
