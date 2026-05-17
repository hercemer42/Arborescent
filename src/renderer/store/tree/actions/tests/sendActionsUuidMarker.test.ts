import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSendActions } from '../sendActions';
import { ARBORESCENT_MARKER_PREFIX, ARBORESCENT_MARKER_REGEX } from '../../../../../shared/utils/arborescentMarker';
import { TreeState } from '../../treeStore';

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn(),
}));

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/feedback/feedbackTempFileService', () => ({
  createFeedbackTempFile: vi.fn(() => Promise.resolve('/tmp/feedback-test.md')),
  cleanupFeedbackTempFile: vi.fn(),
}));

const NODE_ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const NODE_CHILD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const CONTEXT_NODE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccc03';

function makeState(): TreeState {
  const nodes = {
    [NODE_ROOT]: { id: NODE_ROOT, content: 'Root', children: [NODE_CHILD], metadata: {} },
    [NODE_CHILD]: { id: NODE_CHILD, content: 'Child content', children: [], metadata: { appliedContextId: CONTEXT_NODE_ID } },
    [CONTEXT_NODE_ID]: {
      id: CONTEXT_NODE_ID,
      content: 'Context body',
      children: [],
      metadata: { isContextDeclaration: true, collaborate: true, execute: false },
    },
  };
  return {
    nodes,
    rootNodeId: NODE_ROOT,
    ancestorRegistry: {
      [NODE_ROOT]: [],
      [NODE_CHILD]: [NODE_ROOT],
      [CONTEXT_NODE_ID]: [NODE_ROOT],
    },
    activeNodeId: NODE_CHILD,
    multiSelectedNodeIds: new Set(),
    lastSelectedNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    currentFilePath: '/test.arbo',
    fileMeta: null,
    flashingNodeIds: new Set(),
    flashingIntensity: 'light',
    scrollToNodeId: null,
    deletingNodeIds: new Set(),
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
    workflowSessionMap: { 'sess-default': 'terminal-1' },
    sessionRegistry: {},
    terminalNodeAssignments: {},
    treeType: 'workspace',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: { executeCommand: vi.fn() } as any,
  };
}

describe('UUID marker — terminal sends', () => {
  let state: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  let enqueuePromptMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = makeState();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electron.createTempFile as any) = vi.fn().mockResolvedValue('/tmp/feedback-test.md');
    enqueuePromptMock = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electron as any).enqueuePrompt = enqueuePromptMock;
    const mockGet = vi.fn(() => state);
    const mockSet = vi.fn((partial: Partial<TreeState>) => { state = { ...state, ...partial }; });
    const mockVisualEffects = { flashNode: vi.fn(), scrollToNode: vi.fn() };
    actions = createSendActions(
      mockGet,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSet as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockVisualEffects as any,
      vi.fn(),
    );
  });

  function lastEnqueuedContent(): string {
    const calls = enqueuePromptMock.mock.calls;
    if (calls.length === 0) return '';
    return calls[calls.length - 1][1] as string;
  }

  it('prepends the marker on a collaborate-only terminal send', async () => {
    await actions.collaborateInTerminal(NODE_CHILD, 'terminal-1');
    const content = lastEnqueuedContent();
    expect(content.startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(true);
    expect(content).toMatch(ARBORESCENT_MARKER_REGEX);
  });

  it('the marker carries the node UUID of the sent node', async () => {
    await actions.collaborateInTerminal(NODE_CHILD, 'terminal-1');
    const content = lastEnqueuedContent();
    const match = content.match(ARBORESCENT_MARKER_REGEX);
    expect(match?.[1]).toBe(NODE_CHILD);
  });

  it('the body below the marker still contains the existing prompt content', async () => {
    await actions.collaborateInTerminal(NODE_CHILD, 'terminal-1');
    const content = lastEnqueuedContent();
    expect(content).toContain('Child content');
  });
});

describe('UUID marker — action mode', () => {
  let state: TreeState;
  let actions: ReturnType<typeof createSendActions>;
  let enqueuePromptMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = makeState();
    state.nodes[CONTEXT_NODE_ID].metadata.collaborate = false;
    state.nodes[CONTEXT_NODE_ID].metadata.execute = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electron.createTempFile as any) = vi.fn().mockResolvedValue('/tmp/feedback-test.md');
    enqueuePromptMock = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.electron as any).enqueuePrompt = enqueuePromptMock;

    const mockGet = vi.fn(() => state);
    const mockSet = vi.fn((partial: Partial<TreeState>) => { state = { ...state, ...partial }; });
    const mockVisualEffects = { flashNode: vi.fn(), scrollToNode: vi.fn() };
    actions = createSendActions(
      mockGet,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockSet as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockVisualEffects as any,
      vi.fn(),
    );
  });

  it('does NOT prepend the marker when neither execute nor collaborate is set (action mode)', async () => {
    await actions.collaborateInTerminal(NODE_CHILD, 'terminal-1', { collaborate: false, execute: false });
    const content = (enqueuePromptMock.mock.calls.at(-1)?.[1] as string) ?? '';
    expect(content.startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(false);
  });
});
