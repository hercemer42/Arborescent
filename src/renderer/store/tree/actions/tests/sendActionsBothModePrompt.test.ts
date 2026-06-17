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
  cleanupFeedbackForFile: vi.fn().mockResolvedValue(undefined),
  cleanupFeedbackForNode: vi.fn().mockResolvedValue(undefined),
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

// The collaborate & execute terminal prompt broadcasts the incremental
// channel while every other mode's copy is unchanged. Prompt broadcast and
// gate must enforce the same channel — drift between them steers agents into
// a completion path the server refuses.

const CTX_ID = 'collab-ctx';
const NODE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';

function makeState(): TreeState {
  const root: TreeNode = {
    id: 'root',
    content: 'Root',
    children: [NODE_ID, CTX_ID],
    metadata: { plugins: {} },
  };
  const node: TreeNode = {
    id: NODE_ID,
    content: 'Step',
    children: [],
    metadata: { plugins: {}, appliedContextId: CTX_ID },
  };
  const ctx: TreeNode = {
    id: CTX_ID,
    content: 'Review context',
    children: [],
    metadata: { isContextDeclaration: true, collaborate: true, execute: false },
  };
  return {
    nodes: { root, [NODE_ID]: node, [CTX_ID]: ctx },
    rootNodeId: 'root',
    treeType: 'workspace',
    ancestorRegistry: { root: [], [NODE_ID]: ['root'], [CTX_ID]: ['root'] },
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

describe('sendActions — collaborate & execute prompt broadcasts the incremental channel', () => {
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

  async function sentPrompt(flags: { collaborate: boolean; execute: boolean }): Promise<string> {
    await actions.autonomousCollaborateInTerminal(NODE_ID, 'term-1', flags);
    expect(executeMock).toHaveBeenCalledTimes(1);
    return executeMock.mock.calls[0][1] as string;
  }

  it('both-mode prompt instructs the incremental tools and announce completion', async () => {
    const sent = await sentPrompt({ collaborate: true, execute: true });
    expect(sent).toContain('mark_step_complete');
    expect(sent).toContain('add_child_node');
    expect(sent).toContain('announce_step_done');
  });

  it('both-mode prompt instructs id resolution via get_tree before ticking items', async () => {
    const sent = await sentPrompt({ collaborate: true, execute: true });
    expect(sent).toContain('get_tree');
  });

  it('both-mode prompt contains no reference to submit_step_output', async () => {
    const sent = await sentPrompt({ collaborate: true, execute: true });
    expect(sent).not.toContain('submit_step_output');
  });

  it('pure-collaborate prompt is unchanged: submit_step_output with the drift-guard token, no announce', async () => {
    const sent = await sentPrompt({ collaborate: true, execute: false });
    expect(sent).toContain('submit_step_output');
    expect(sent).toContain(`target_node_id="${NODE_ID}"`);
    expect(sent).not.toContain('announce_step_done');
  });

  it('execute-only autonomous prompt is unchanged: announce completion, no submit', async () => {
    const sent = await sentPrompt({ collaborate: false, execute: true });
    expect(sent).toContain('announce_step_done');
    expect(sent).not.toContain('submit_step_output');
  });

  it('action-mode autonomous prompt is unchanged: announce completion, no submit', async () => {
    const sent = await sentPrompt({ collaborate: false, execute: false });
    expect(sent).toContain('announce_step_done');
    expect(sent).not.toContain('submit_step_output');
  });

  // Issue-recording guidance must steer toward a separate node per distinct
  // issue, not one node holding all of them (which reads as a wall of prose).
  // The exact copy is not pinned, so the positive assertion matches tolerantly
  // (plural nodes, a "separate/own/new node", or per-issue phrasing) rather
  // than a fixed string.
  it('both-mode prompt no longer tells Claude to record all issues in a single node', async () => {
    const sent = await sentPrompt({ collaborate: true, execute: true });
    expect(sent).not.toMatch(/record them once/i);
  });

  it('both-mode prompt invites a separate node per distinct issue', async () => {
    const sent = await sentPrompt({ collaborate: true, execute: true });
    expect(sent).toMatch(
      /\bnodes\b|(?:separate|own|individual|distinct|new)\s+(?:child\s+)?node\b|\b(?:per|for each)\b[\s\S]{0,20}\bissue|\beach\s+issue\b/i,
    );
  });

  // The phrasing for the explicit "may be called more than once" clause is not
  // settled, so this facet stays title-only rather than pinning a string.
  it.todo('both-mode prompt states add_child_node may be called more than once (one call per issue)');
});
