import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const executeInTerminal = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: (...args: unknown[]) => executeInTerminal(...args),
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

interface Harness {
  state: TreeState;
  actions: ReturnType<typeof createSendActions>;
  mockSet: Mock;
}

const baseElectronMock = () => ({
  terminalWrite: vi.fn().mockResolvedValue(undefined),
  startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
  stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
  createTempFile: vi.fn().mockResolvedValue('/tmp/arborescent/feedback-response.md'),
  readTempFile: vi.fn().mockResolvedValue(null),
});

const buildHarness = (
  nodes: Record<string, TreeNode>,
  rootId: string,
  ancestorRegistry: Record<string, string[]>,
  overrides: Partial<TreeState> = {},
): Harness => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.window = { electron: baseElectronMock() } as any;

  const state: TreeState = {
    nodes,
    rootNodeId: rootId,
    treeType: 'workspace',
    ancestorRegistry,
    activeNodeId: null,
    multiSelectedNodeIds: new Set(),
    lastSelectedNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    currentFilePath: null,
    fileMeta: null,
    flashingNodeIds: new Set<string>(),
    flashingIntensity: 'light',
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
    actions: { executeCommand: vi.fn() } as any,
    ...overrides,
    sessionRegistry: {},
  } as TreeState;

  const get = () => state;
  const mockSet: Mock = vi.fn((partial: Partial<TreeState> | ((s: TreeState) => Partial<TreeState>)) => {
    if (typeof partial === 'function') {
      Object.assign(state, partial(state));
    } else {
      Object.assign(state, partial);
    }
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visualEffects: any = {
    flashNode: vi.fn(),
    scrollToNode: vi.fn(),
    startDeleteAnimation: vi.fn(),
    clearDeleteAnimation: vi.fn(),
  };
  const actions = createSendActions(get, mockSet, visualEffects, vi.fn(), vi.fn());
  return { state, actions, mockSet };
};

const node = (id: string, content: string, overrides: Partial<TreeNode> = {}): TreeNode => ({
  id,
  content,
  children: [],
  metadata: { plugins: {} },
  ...overrides,
});

describe('collaborateInTerminal — code-node execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeInTerminal.mockResolvedValue(undefined);
  });

  describe('happy path — single backtick-wrapped node, no children, no context', () => {
    it('sends the raw command with wrapping backticks stripped (acceptance: backticks stripped)', async () => {
      const codeNode = node('n1', '`npm install`');
      const { actions } = buildHarness({ n1: codeNode }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).toHaveBeenCalledTimes(1);
      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toBe('npm install');
      expect(sent).not.toContain('`');
      expect(sent).not.toMatch(/^#/);
    });

    it('strips fenced triple backticks (multi-line command)', async () => {
      const codeNode = node('n1', '```\nnpm install\nnpm test\n```');
      const { actions } = buildHarness({ n1: codeNode }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).toHaveBeenCalledWith('term-1', 'npm install\nnpm test');
    });
  });

  describe('rule 1 — backtick span mixed with other text is NOT executed', () => {
    it('falls through to existing markdown send path when the content has prose around the backticked span', async () => {
      const mixedNode = node('n1', 'Run `npm install` first');
      const { actions } = buildHarness({ n1: mixedNode }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).toHaveBeenCalledTimes(1);
      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toContain('Run `npm install` first');
    });

    it('falls through to markdown when the content is two backticked spans joined by prose (regression: must not be silently skipped)', async () => {
      const twoSpanNode = node('n1', '`first` and `second`');
      const { actions } = buildHarness({ n1: twoSpanNode }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).toHaveBeenCalledTimes(1);
      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toContain('`first` and `second`');
    });
  });

  describe('rule 2 — code candidate with children is NOT executed', () => {
    it('sends as markdown when the backticked node has a child', async () => {
      const parent = node('p1', '`npm install`', { children: ['c1'] });
      const child = node('c1', 'optional follow-up');
      const { actions } = buildHarness(
        { p1: parent, c1: child },
        'p1',
        { p1: [], c1: ['p1'] },
      );

      await actions.collaborateInTerminal('p1', 'term-1');

      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toContain('`npm install`');
      expect(sent).toContain('optional follow-up');
    });
  });

  describe('rule 2 — code candidate with applied context is NOT executed', () => {
    it('sends through the existing prompt-building path when the node has its own appliedContextId', async () => {
      const ctx = node('ctx1', 'Review carefully', {
        metadata: { isContextDeclaration: true, plugins: {} },
      });
      const codeNode = node('n1', '`npm install`', {
        metadata: { plugins: {}, appliedContextId: 'ctx1' },
      });
      const { actions } = buildHarness(
        { n1: codeNode, ctx1: ctx },
        'n1',
        { n1: [], ctx1: [] },
      );

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).toHaveBeenCalledTimes(1);
      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toContain('`npm install`');
      expect(sent).toContain('Review carefully');
    });

    it('sends through the existing prompt-building path when the node inherits context from an ancestor', async () => {
      const ctx = node('ctx1', 'Review carefully', {
        metadata: { isContextDeclaration: true, plugins: {} },
      });
      const ancestor = node('a1', 'Ancestor', {
        children: ['n1'],
        metadata: { plugins: {}, appliedContextId: 'ctx1' },
      });
      const codeNode = node('n1', '`npm install`');
      const { actions } = buildHarness(
        { a1: ancestor, n1: codeNode, ctx1: ctx },
        'a1',
        { a1: [], n1: ['a1'], ctx1: [] },
      );

      await actions.collaborateInTerminal('n1', 'term-1');

      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toContain('`npm install`');
      expect(sent).toContain('Review carefully');
    });
  });

  describe('rule 5 — normal nodes still emit markdown (regression guard)', () => {
    it('preserves existing markdown serialization for non-code nodes', async () => {
      const normalNode = node('n1', 'Plain prose, no backticks');
      const { actions } = buildHarness({ n1: normalNode }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      const sent = executeInTerminal.mock.calls[0][1] as string;
      expect(sent).toContain('Plain prose, no backticks');
    });
  });

  describe('rule 7 — empty / whitespace nodes', () => {
    it('does not dispatch a terminal write for an empty-content node', async () => {
      const empty = node('n1', '');
      const { actions } = buildHarness({ n1: empty }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
    });

    it('does not dispatch a terminal write for a whitespace-only node', async () => {
      const ws = node('n1', '   \n  \t  ');
      const { actions } = buildHarness({ n1: ws }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
    });

    it('does not dispatch a terminal write when a code-node candidate wraps only whitespace', async () => {
      const wsCommand = node('n1', '`   `');
      const { actions } = buildHarness({ n1: wsCommand }, 'n1', { n1: [] });

      await actions.collaborateInTerminal('n1', 'term-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
    });
  });

  describe('rule 8 — no terminal connected', () => {
    it('throws a user-visible error when terminalId is empty for a code node', async () => {
      const codeNode = node('n1', '`npm install`');
      const { actions } = buildHarness({ n1: codeNode }, 'n1', { n1: [] });

      await expect(actions.collaborateInTerminal('n1', '')).rejects.toThrow(/terminal/i);
      expect(executeInTerminal).not.toHaveBeenCalled();
    });
  });

  describe('error handling — consecutive code-node sends', () => {
    it('does not leak state between two consecutive single-code-node sends', async () => {
      const first = node('n1', '`npm install`');
      const second = node('n2', '`npm test`');
      const { actions } = buildHarness(
        { n1: first, n2: second },
        'n1',
        { n1: [], n2: [] },
      );

      await actions.collaborateInTerminal('n1', 'term-1');
      await actions.collaborateInTerminal('n2', 'term-1');

      expect(executeInTerminal).toHaveBeenCalledTimes(2);
      expect(executeInTerminal).toHaveBeenNthCalledWith(1, 'term-1', 'npm install');
      expect(executeInTerminal).toHaveBeenNthCalledWith(2, 'term-1', 'npm test');
    });
  });

  describe('non-existent node', () => {
    it('does nothing and does not throw when the nodeId is unknown', async () => {
      const { actions } = buildHarness({}, 'missing', {});

      await actions.collaborateInTerminal('missing', 'term-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
    });
  });
});

describe('multi-node selection gate (rule 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeInTerminal.mockResolvedValue(undefined);
  });

  it('sends as markdown when the user has multiple nodes selected — even if the target node is individually a code candidate', async () => {
    const codeNode = node('n1', '`npm install`');
    const otherNode = node('n2', '`npm test`');
    const { actions } = buildHarness(
      { n1: codeNode, n2: otherNode },
      'n1',
      { n1: [], n2: [] },
      { multiSelectedNodeIds: new Set(['n1', 'n2']) },
    );

    await actions.collaborateInTerminal('n1', 'term-1');

    expect(executeInTerminal).toHaveBeenCalledTimes(1);
    const sent = executeInTerminal.mock.calls[0][1] as string;
    expect(sent).not.toBe('npm install');
    expect(sent).toContain('`npm install`');
  });

  it('still executes when only one node is multi-selected (equivalent to single-node mode)', async () => {
    const codeNode = node('n1', '`npm install`');
    const { actions } = buildHarness(
      { n1: codeNode },
      'n1',
      { n1: [] },
      { multiSelectedNodeIds: new Set(['n1']) },
    );

    await actions.collaborateInTerminal('n1', 'term-1');

    expect(executeInTerminal).toHaveBeenCalledWith('term-1', 'npm install');
  });
});

