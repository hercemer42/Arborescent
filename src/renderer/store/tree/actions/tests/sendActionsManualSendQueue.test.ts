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
const TERMINAL_ID = 'term-1';
const SESSION_ID = 'sess-1';

function makeState(contextOverrides: Partial<{ collaborate: boolean; execute: boolean }> = {}): TreeState {
  const { collaborate = true, execute = false } = contextOverrides;
  const nodes = {
    [NODE_ROOT]: { id: NODE_ROOT, content: 'Root', children: [NODE_CHILD], metadata: {} },
    [NODE_CHILD]: { id: NODE_CHILD, content: 'Child content', children: [], metadata: { appliedContextId: CONTEXT_NODE_ID } },
    [CONTEXT_NODE_ID]: {
      id: CONTEXT_NODE_ID,
      content: 'Context body',
      children: [],
      metadata: { isContextDeclaration: true, collaborate, execute },
    },
  };
  return {
    nodes,
    rootNodeId: NODE_ROOT,
    ancestorRegistry: { [NODE_ROOT]: [], [NODE_CHILD]: [NODE_ROOT], [CONTEXT_NODE_ID]: [NODE_ROOT] },
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
    workflowSessionMap: { [SESSION_ID]: TERMINAL_ID },
    sessionRegistry: {},
    terminalNodeAssignments: {},
    treeType: 'workspace',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: { executeCommand: vi.fn() } as any,
  };
}

function makeActions(state: TreeState) {
  const mockGet = vi.fn(() => state);
  const mockSet = vi.fn();
  const mockVisualEffects = { flashNode: vi.fn(), scrollToNode: vi.fn() };
  return createSendActions(
    mockGet,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSet as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockVisualEffects as any,
    vi.fn(),
  );
}

let enqueuePromptMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  enqueuePromptMock = vi.fn().mockResolvedValue(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window.electron as any).enqueuePrompt = enqueuePromptMock;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window.electron.createTempFile as any) = vi.fn().mockResolvedValue('/tmp/feedback-test.md');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
});

describe('Manual send — terminal target routes through the MCP queue', () => {
  it('collaborateInTerminal enqueues the prompt instead of pasting directly into the terminal', async () => {
    const state = makeState();
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    expect(enqueuePromptMock).toHaveBeenCalledTimes(1);
  });

  it('the enqueued payload carries the bound session_id resolved from the terminal', async () => {
    const state = makeState();
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    const [sessionId] = enqueuePromptMock.mock.calls[0];
    expect(sessionId).toBe(SESSION_ID);
  });

  it('the enqueued content has the node UUID marker prepended on a collaborate send', async () => {
    const state = makeState({ collaborate: true, execute: false });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    const [, content] = enqueuePromptMock.mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(true);
    const match = String(content).match(ARBORESCENT_MARKER_REGEX);
    expect(match?.[1]).toBe(NODE_CHILD);
  });

  it('the source on the enqueued payload identifies a manual send', async () => {
    const state = makeState();
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    const [, , source] = enqueuePromptMock.mock.calls[0];
    expect(source).toBe('manual');
  });

  it('no direct terminal paste is issued when routing through the queue', async () => {
    const state = makeState();
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    expect(executeInTerminal).not.toHaveBeenCalled();
  });
});

describe('Manual send — action mode (no execute, no collaborate)', () => {
  it('enqueues with NO UUID marker and NO instruction-wrapping preamble in action mode (context body is the prompt)', async () => {
    const state = makeState({ collaborate: false, execute: false });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: false, execute: false });
    expect(enqueuePromptMock).toHaveBeenCalledTimes(1);
    const [, content] = enqueuePromptMock.mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(false);
    expect(String(content)).not.toMatch(/===BEGIN INSTRUCTIONS===/);
    expect(String(content)).not.toMatch(/IMPORTANT:/);
  });

  it('action mode source flag distinguishes it from non-action manual sends so UserPromptSubmit can preserve the binding', async () => {
    const state = makeState({ collaborate: false, execute: false });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: false, execute: false });
    const [, , source] = enqueuePromptMock.mock.calls[0];
    expect(source).toBe('manual-action');
  });
});

describe('Manual send — mode authority (execute / collaborate booleans)', () => {
  it('execute-only sends still prepend the UUID marker (binding is desired)', async () => {
    const state = makeState({ collaborate: false, execute: true });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: false, execute: true });
    const [, content] = enqueuePromptMock.mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(true);
  });

  it('collaborate + execute sends prepend the UUID marker', async () => {
    const state = makeState({ collaborate: true, execute: true });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: true, execute: true });
    const [, content] = enqueuePromptMock.mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(true);
  });
});

describe('Manual send — browser target is unaffected', () => {
  it.todo('collaborate (browser) continues to write the formatted prompt to the clipboard, not to the queue');
  it.todo('collaborate (browser) does NOT call window.electron.enqueuePrompt');
});

describe('Manual send — feedback panel routing in non-action mode', () => {
  it.todo('a non-action manual send does NOT start a file watcher when the MCP path is the only feedback channel');
  it.todo('Claude\'s submit_step_output proposal for a manual-send bound node lands in the feedback panel');
});
