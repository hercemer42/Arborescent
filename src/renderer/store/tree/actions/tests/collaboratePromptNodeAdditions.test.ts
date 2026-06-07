import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';

// Guards the Collaborate OUTPUT FORMAT wording: the collaborate (review) prompt
// must tell the AI it MAY add new nodes, not only flip checkbox status, and that
// NEITHER action is mandatory. The permission is scoped to the collaborate
// single-root format only — the execute/both path (whose output target says "do
// NOT add items") and the decomposition format must NOT receive it, or the
// prompt would contradict itself. Assertions match on intent (add/introduce/
// create a node; optionality) rather than exact phrasing, since the precise
// bullet wording is not pinned down.

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
  findCollaboratingNode: vi.fn(),
}));

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForNode: vi.fn(),
    initialize: vi.fn(),
    setFilePath: vi.fn(),
    clearForFile: vi.fn(),
  },
}));

// Intent matchers — deliberately tolerant of wording.
const PERMITS_ADDING_NODES = /\b(add|adding|introduce|create)\b[^\n]*\bnodes?\b/i;
const NEITHER_MANDATORY = /\bneither\b|\bnot (required|mandatory)\b|\boptional(ly)?\b|\bdon'?t have to\b|\bwhichever\b|\beither or both\b/i;

describe('collaborate prompt — node additions are permitted, not just status edits', () => {
  let mockGet: Mock<() => TreeState>;
  let mockSet: Mock<(partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void>;
  let actions: ReturnType<typeof createSendActions>;
  let mockState: TreeState;

  beforeEach(() => {
    vi.clearAllMocks();

    global.window = {
      electron: {
        terminalWrite: vi.fn().mockResolvedValue(undefined),
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/arborescent/feedback.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const root: TreeNode = { id: 'root', content: 'Root', children: ['task', 'collab-ctx', 'both-ctx'], metadata: { plugins: {} } };
    const task: TreeNode = { id: 'task', content: 'Improve the list', children: [], metadata: { plugins: {} } };
    const collabCtx: TreeNode = {
      id: 'collab-ctx',
      content: 'Review context',
      children: [],
      metadata: { isContextDeclaration: true, collaborate: true, execute: false },
    };
    const bothCtx: TreeNode = {
      id: 'both-ctx',
      content: 'Collaborate and execute context',
      children: [],
      metadata: { isContextDeclaration: true, collaborate: true, execute: true },
    };

    mockState = {
      nodes: { root, task, 'collab-ctx': collabCtx, 'both-ctx': bothCtx },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], task: ['root'], 'collab-ctx': ['root'], 'both-ctx': ['root'] },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: '/project.arbo',
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

    mockGet = vi.fn(() => mockState);
    mockSet = vi.fn((partial) => {
      if (typeof partial === 'function') {
        Object.assign(mockState, partial(mockState));
      } else {
        Object.assign(mockState, partial);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockExecuteCommand = vi.fn((command: any) => command.execute());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockState.actions = { executeCommand: mockExecuteCommand } as any;

    const mockVisualEffects = {
      flashNode: vi.fn(), scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(), clearDeleteAnimation: vi.fn(),
    };

    actions = createSendActions(mockGet, mockSet, mockVisualEffects, vi.fn(), vi.fn());
  });

  async function promptFor(contextId: string, flags?: { collaborate: boolean; execute: boolean }): Promise<string> {
    const { executeInTerminal } = await import('../../../../services/terminalExecution');
    mockState.nodes.task.metadata.appliedContextId = contextId;
    await actions.collaborateInTerminal('task', 'terminal-1', flags);
    return vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
  }

  describe('collaborate mode', () => {
    it('tells the AI it may add new nodes, not only change checkbox status', async () => {
      const prompt = await promptFor('collab-ctx');
      expect(prompt).toMatch(PERMITS_ADDING_NODES);
    });

    it('conveys that neither status changes nor node additions are mandatory', async () => {
      const prompt = await promptFor('collab-ctx');
      expect(prompt).toMatch(NEITHER_MANDATORY);
    });

    it('keeps the single-root constraint intact so additions go under the existing root', async () => {
      const prompt = await promptFor('collab-ctx');
      expect(prompt).toMatch(/exactly one root node/i);
    });
  });

  // Both-mode works incrementally, so the prompt explicitly offers
  // add_child_node for issues instead of withholding additions behind a
  // full-list resubmit.
  describe('collaborate & execute mode — additions ride the incremental channel', () => {
    it('offers node additions via the add_child_node MCP tool', async () => {
      const prompt = await promptFor('both-ctx', { collaborate: true, execute: true });
      expect(prompt).toContain('add_child_node');
    });
  });

  describe('decomposition mode — additions wording is withheld (decomposition format unchanged)', () => {
    it('does not offer node additions when the collaborate step has decomposition enabled', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      // task → step (decomposition) → workflow, so isDecompositionEnabled(task) is true
      // and the collaborate prompt uses DECOMPOSITION_OUTPUT_FORMAT, not the single-root variant.
      mockState.nodes.wf = { id: 'wf', content: 'Workflow', children: ['step'], metadata: { isWorkflow: true } };
      mockState.nodes.step = { id: 'step', content: 'Step', children: ['task'], metadata: { decomposition: true } };
      mockState.nodes.root.children = ['wf', 'collab-ctx', 'both-ctx'];
      mockState.nodes.task.children = [];
      mockState.nodes.task.metadata.appliedContextId = 'collab-ctx';
      mockState.ancestorRegistry = {
        root: [], wf: ['root'], step: ['root', 'wf'], task: ['root', 'wf', 'step'],
        'collab-ctx': ['root'], 'both-ctx': ['root'],
      };

      await actions.collaborateInTerminal('task', 'terminal-1');

      const prompt = vi.mocked(executeInTerminal).mock.calls.at(-1)?.[1] as string;
      expect(prompt).not.toMatch(PERMITS_ADDING_NODES);
    });
  });

  // Non-deterministic LLM behaviour — verified by behavioural spot-check, not a
  // unit assertion. Title-only per the "post-fix behavior is uncertain" rule.
  it.todo('a status-only review context still yields status-only edits with no spurious additions');
});
