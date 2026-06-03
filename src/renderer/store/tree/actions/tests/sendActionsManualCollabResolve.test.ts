import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: vi.fn(),
  parseFeedbackContentWithReason: vi.fn(),
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

describe('sendActions — manual collab resolve trigger', () => {
  let mockGet: Mock<() => TreeState>;
  let mockSet: Mock<(partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void>;
  let actions: ReturnType<typeof createSendActions>;
  let mockState: TreeState;
  let notifyManualCollabResolvedMock: Mock<(sessionId: string) => Promise<void>>;

  beforeEach(() => {
    vi.clearAllMocks();

    notifyManualCollabResolvedMock = vi.fn().mockResolvedValue(undefined);
    global.window = {
      electron: {
        terminalWrite: vi.fn().mockResolvedValue(undefined),
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/feedback.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
        notifyManualCollabResolved: notifyManualCollabResolvedMock,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const rootNode: TreeNode = {
      id: 'root',
      content: 'Root',
      children: ['child1'],
      metadata: { plugins: {} },
    };
    const child1: TreeNode = {
      id: 'child1',
      content: 'Child 1',
      children: [],
      metadata: { plugins: {} },
    };

    mockState = {
      nodes: { root: rootNode, child1 },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], child1: ['root'] },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
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
      workflowSessionMap: {},
      terminalNodeAssignments: {},
      actions: {} as TreeState['actions'],
      sessionRegistry: {},
    };

    mockGet = vi.fn(() => mockState);
    mockSet = vi.fn((partial) => {
      const update = typeof partial === 'function' ? partial(mockState) : partial;
      Object.assign(mockState, update);
    });

    actions = createSendActions(mockGet, mockSet, {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    }, vi.fn(), vi.fn());
  });

  describe('cancelCollaboration', () => {
    it('fires notifyManualCollabResolved for the session backing the collaborating terminal', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = 'term-1';
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };

      actions.cancelCollaboration();

      expect(notifyManualCollabResolvedMock).toHaveBeenCalledWith('sess-A');
    });

    it('does NOT fire when collaboratingTerminalId is null (e.g. browser-source collab)', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = null;
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };

      actions.cancelCollaboration();

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    it('does NOT fire when the terminal has no entry in the workflowSessionMap (foreign terminal)', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = 'term-unknown';
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };

      actions.cancelCollaboration();

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    it('still clears local panel state regardless of IPC outcome', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = 'term-1';
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };

      actions.cancelCollaboration();

      expect(mockSet).toHaveBeenCalledWith({
        collaboratingNodeId: null,
        collaborationSource: null,
        collaboratingTerminalId: null,
      });
    });
  });

  describe('finishCancel', () => {
    it('fires notifyManualCollabResolved for the session backing the collaborating terminal', async () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = 'term-1';
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-B': 'term-1' };

      await actions.finishCancel();

      expect(notifyManualCollabResolvedMock).toHaveBeenCalledWith('sess-B');
    });

    it('does nothing (no IPC, no clear) when there is no active collaboration', async () => {
      mockState.collaboratingNodeId = null;
      mockState.collaboratingTerminalId = null;

      await actions.finishCancel();

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });
  });

  describe('finishAccept', () => {
    it('does NOT fire when extractFeedbackContent returns nullish — IPC must not clear the MCP route on a path that leaves the panel open', async () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = 'term-1';
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-D': 'term-1' };

      await actions.finishAccept();

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });
  });

  describe('acceptFeedback', () => {
    it('fires notifyManualCollabResolved before the accept command executes', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = 'term-1';
      mockState.workflowSessionMap = { 'sess-C': 'term-1' };

      const newRoot: TreeNode = {
        id: 'new-child1',
        content: 'Updated',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptFeedback('new-child1', { 'new-child1': newRoot });

      expect(notifyManualCollabResolvedMock).toHaveBeenCalledWith('sess-C');
    });

    it('does NOT fire when no terminal owns the panel (browser-source accept)', () => {
      mockState.collaboratingNodeId = 'child1';
      mockState.collaboratingTerminalId = null;
      mockState.workflowSessionMap = {};

      const newRoot: TreeNode = {
        id: 'new-child1',
        content: 'Updated',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptFeedback('new-child1', { 'new-child1': newRoot });

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    // executeCommand is a required constructor dependency, so there is no
    // unavailable path to guard against here.
  });
});
