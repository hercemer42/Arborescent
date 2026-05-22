import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSendActions } from '../sendActions';
import {
  ARBORESCENT_MARKER_PREFIX,
  ARBORESCENT_MARKER_REGEX,
  ARBORESCENT_TARGET_MARKER_PREFIX,
  ARBORESCENT_TARGET_MARKER_REGEX,
} from '../../../../../shared/utils/arborescentMarker';
import { TreeState } from '../../treeStore';

// These tests pin the outbound delivery behaviour after the marker-grammar split:
// manual sends carry the one-shot ARBORESCENT_TARGET marker (no binding swap),
// autonomous workflow sends carry the ARBORESCENT_NODE binding marker, and
// action-mode sends carry neither. UserPromptSubmit (out of scope for this unit
// test) consumes the marker on the paste itself, so the renderer never needs to
// gate sends on an in-memory binding check.

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const NODE_ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const NODE_CHILD = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const CONTEXT_NODE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const TERMINAL_ID = 'term-1';
const SESSION_ID = 'sess-1';

function makeState(
  contextOverrides: Partial<{ collaborate: boolean; execute: boolean }> = {},
  sessionMap: Record<string, string> = { [SESSION_ID]: TERMINAL_ID },
): TreeState {
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
    workflowSessionMap: sessionMap,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Manual send — direct paste (post-revert outbound delivery)', () => {
  it('collaborateInTerminal pastes via executeInTerminal, not via window.electron.enqueuePrompt', async () => {
    const state = makeState();
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    expect(executeInTerminal).toHaveBeenCalledTimes(1);
    // The outbound MCP queue is gone — enqueuePrompt must not appear on the electron API.
    expect('enqueuePrompt' in window.electron).toBe(false);
  });

  it('the pasted content begins with the one-shot TARGET marker so the next submit lands on this node without changing the workflow binding', async () => {
    const state = makeState({ collaborate: true, execute: false });
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(true);
    const match = String(content).match(ARBORESCENT_TARGET_MARKER_REGEX);
    expect(match?.[1]).toBe(NODE_CHILD);
  });

  it('execute-only manual sends paste with the one-shot TARGET marker', async () => {
    const state = makeState({ collaborate: false, execute: true });
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: false, execute: true });

    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(true);
  });

  it('collaborate + execute manual sends paste with the one-shot TARGET marker', async () => {
    const state = makeState({ collaborate: true, execute: true });
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: true, execute: true });

    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(true);
  });
});

describe('Manual send — unbound terminal (Arborescent restart, user-spawned Claude)', () => {
  it('still pastes the marker-prefixed prompt when the in-memory session map has no entry for this terminal', async () => {
    const state = makeState({ collaborate: true, execute: false }, {});
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    expect(executeInTerminal).toHaveBeenCalledTimes(1);
    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(true);
  });

  it('does NOT surface a "No Claude session bound to this terminal yet" toast when the session map is empty', async () => {
    const state = makeState({ collaborate: true, execute: false }, {});
    const actions = makeActions(state);

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    const toastMessages = mockAddToast.mock.calls.map((call) => String(call[0]));
    expect(toastMessages.some((m) => /no claude session bound/i.test(m))).toBe(false);
    expect(toastMessages.some((m) => /start claude before sending/i.test(m))).toBe(false);
  });
});

describe('Manual send — action mode (post-revert)', () => {
  it('pastes the bare content directly with no marker', async () => {
    const state = makeState({ collaborate: false, execute: false });
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: false, execute: false });

    expect(executeInTerminal).toHaveBeenCalledTimes(1);
    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(false);
    expect(String(content).startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(false);
    expect(String(content)).not.toMatch(/===BEGIN INSTRUCTIONS===/);
  });
});

describe('Autonomous workflow send — direct paste (post-revert outbound delivery)', () => {
  it('autonomousCollaborateInTerminal pastes via executeInTerminal, not via window.electron.enqueuePrompt', async () => {
    const state = makeState({ collaborate: true, execute: false });
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.autonomousCollaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    expect(executeInTerminal).toHaveBeenCalledTimes(1);
    expect('enqueuePrompt' in window.electron).toBe(false);
  });

  it('the pasted autonomous prompt begins with the UUID marker', async () => {
    const state = makeState({ collaborate: true, execute: false });
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.autonomousCollaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(true);
    const match = String(content).match(ARBORESCENT_MARKER_REGEX);
    expect(match?.[1]).toBe(NODE_CHILD);
  });

  it('autonomous action mode (no applied context) pastes the bare content with no marker', async () => {
    const state = makeState({ collaborate: false, execute: false });
    state.nodes[NODE_CHILD].metadata.appliedContextId = undefined;
    const actions = makeActions(state);
    const { executeInTerminal } = await import('../../../../services/terminalExecution');

    await actions.autonomousCollaborateInTerminal(NODE_CHILD, TERMINAL_ID);

    expect(executeInTerminal).toHaveBeenCalledTimes(1);
    const [, content] = (executeInTerminal as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(content).startsWith(ARBORESCENT_MARKER_PREFIX)).toBe(false);
    expect(String(content).startsWith(ARBORESCENT_TARGET_MARKER_PREFIX)).toBe(false);
  });
});
