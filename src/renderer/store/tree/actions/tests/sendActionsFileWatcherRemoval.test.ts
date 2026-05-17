import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSendActions } from '../sendActions';
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

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window.electron as any).createTempFile = vi.fn().mockResolvedValue('/tmp/feedback-test.md');
});

describe('collaborateInTerminal — file watcher is no longer started', () => {
  it('the electron API no longer exposes startFeedbackFileWatcher (type-level removal)', () => {
    expect('startFeedbackFileWatcher' in window.electron).toBe(false);
  });

  it('a collaborate-mode manual send does NOT create a feedback temp file (the file is no longer needed)', async () => {
    const state = makeState({ collaborate: true, execute: false });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    expect(window.electron.createTempFile).not.toHaveBeenCalled();
  });

  it('a collaborate-and-execute manual send does NOT create a feedback temp file', async () => {
    const state = makeState({ collaborate: true, execute: true });
    const actions = makeActions(state);
    await actions.collaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: true, execute: true });
    expect(window.electron.createTempFile).not.toHaveBeenCalled();
  });
});

describe('autonomousCollaborateInTerminal — file watcher is no longer started', () => {
  it('an autonomous collaborate step does NOT create a feedback temp file', async () => {
    const state = makeState({ collaborate: true, execute: false });
    const actions = makeActions(state);
    await actions.autonomousCollaborateInTerminal(NODE_CHILD, TERMINAL_ID);
    expect(window.electron.createTempFile).not.toHaveBeenCalled();
  });

  it('an autonomous collaborate-and-execute step does NOT create a feedback temp file', async () => {
    const state = makeState({ collaborate: true, execute: true });
    const actions = makeActions(state);
    await actions.autonomousCollaborateInTerminal(NODE_CHILD, TERMINAL_ID, { collaborate: true, execute: true });
    expect(window.electron.createTempFile).not.toHaveBeenCalled();
  });
});
