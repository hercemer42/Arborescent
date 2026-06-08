import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { cleanupFeedbackForNode, extractFeedbackContent } from '../../../../services/feedback/feedbackService';
import { useFilesStore } from '../../../files/filesStore';

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
  cleanupFeedbackForNode: vi.fn().mockResolvedValue(undefined),
  cleanupFeedbackForFile: vi.fn().mockResolvedValue(undefined),
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
        saveSession: vi.fn().mockResolvedValue(undefined),
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
      reviews: {},
      pendingProposals: {},
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

  describe('finishCancel', () => {
    it('fires notifyManualCollabResolved for the session backing the collaborating terminal', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-B': 'term-1' };

      await actions.finishCancel('child1');

      expect(notifyManualCollabResolvedMock).toHaveBeenCalledWith('sess-B');
    });

    it('resolving from the main tree closes the background zoom tab, clears its highlight, and keeps focus in the main tree', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      mockState.currentFilePath = '/tmp/file.arbo';

      useFilesStore.setState({ files: [], activeFilePath: null, reviewPendingNodeIds: new Set() });
      useFilesStore.getState().openFile('/tmp/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/tmp/file.arbo', 'child1', 'Child 1', { background: true });
      // Background open leaves focus on the source file (the user is resolving from the main tree).

      await actions.finishCancel('child1');

      const filesState = useFilesStore.getState();
      expect(filesState.files.some((f) => f.zoomSource?.zoomedNodeId === 'child1')).toBe(false);
      expect(filesState.reviewPendingNodeIds.has('child1')).toBe(false);
      expect(filesState.activeFilePath).toBe('/tmp/file.arbo');
    });

    it('resolving from inside the zoom tab closes it and returns focus to the source main tree', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      mockState.currentFilePath = '/tmp/file.arbo';

      useFilesStore.setState({ files: [], activeFilePath: null, reviewPendingNodeIds: new Set() });
      useFilesStore.getState().openFile('/tmp/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/tmp/file.arbo', 'child1', 'Child 1'); // foreground: the zoom tab is active
      expect(useFilesStore.getState().activeFilePath).toBe('zoom:///tmp/file.arbo#child1');

      await actions.finishCancel('child1');

      const filesState = useFilesStore.getState();
      expect(filesState.files.some((f) => f.zoomSource?.zoomedNodeId === 'child1')).toBe(false);
      expect(filesState.activeFilePath).toBe('/tmp/file.arbo');
    });

    it('does NOT fire when terminalId is null (e.g. browser-source collab)', async () => {
      mockState.reviews = { child1: { source: 'browser', terminalId: null } };
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };

      await actions.finishCancel('child1');

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    it('does NOT fire when the terminal has no entry in the workflowSessionMap (foreign terminal)', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-unknown' } };
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };

      await actions.finishCancel('child1');

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    it('tears the review down: clears the entry, drops the pending proposition and cleans up the node', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-A': 'term-1' };
      mockState.pendingProposals = {
        child1: { id: 'p1', capturedAt: 'now', reviewedNodeId: 'child1', rootNodeId: 'r1', nodes: {} },
      };

      await actions.finishCancel('child1');

      expect(notifyManualCollabResolvedMock).toHaveBeenCalledWith('sess-A');
      expect(mockState.reviews).toEqual({});
      expect(mockState.pendingProposals).toEqual({});
      expect(cleanupFeedbackForNode).toHaveBeenCalledWith('child1');
    });

    it('does nothing (no IPC, no clear) when there is no active collaboration', async () => {
      mockState.reviews = {};
      mockState.currentFilePath = null;

      await actions.finishCancel('child1');

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });
  });

  describe('finishAccept', () => {
    it('does NOT fire when extractFeedbackContent returns nullish — IPC must not clear the MCP route on a path that leaves the review open', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      mockState.currentFilePath = '/tmp/file.arbo';
      mockState.workflowSessionMap = { 'sess-D': 'term-1' };

      await actions.finishAccept('child1');

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    function stubProposition(): void {
      mockState.currentFilePath = '/tmp/file.arbo';
      vi.mocked(extractFeedbackContent).mockReturnValue({
        rootNodeId: 'new-child1',
        rootNodeIds: ['new-child1'],
        nodes: { 'new-child1': { id: 'new-child1', content: 'Updated', children: [], metadata: { plugins: {} } } },
      });
    }

    it('fires notifyManualCollabResolved for the session backing the collaborating terminal', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      mockState.workflowSessionMap = { 'sess-C': 'term-1' };
      stubProposition();

      await actions.finishAccept('child1');

      expect(notifyManualCollabResolvedMock).toHaveBeenCalledWith('sess-C');
    });

    it('does NOT fire when no terminal owns the review (browser-source accept)', async () => {
      mockState.reviews = { child1: { source: 'browser', terminalId: null } };
      mockState.workflowSessionMap = {};
      stubProposition();

      await actions.finishAccept('child1');

      expect(notifyManualCollabResolvedMock).not.toHaveBeenCalled();
    });

    it('closes the background review zoom tab keyed on the pre-accept node id, even though accept mints a new node id', async () => {
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'term-1' } };
      stubProposition(); // proposition root is 'new-child1' — a different id from the reviewed 'child1'

      useFilesStore.setState({ files: [], activeFilePath: null, reviewPendingNodeIds: new Set() });
      useFilesStore.getState().openFile('/tmp/file.arbo', 'file.arbo');
      useFilesStore.getState().openZoomTab('/tmp/file.arbo', 'child1', 'Child 1', { background: true });

      await actions.finishAccept('child1');

      const filesState = useFilesStore.getState();
      expect(filesState.files.some((f) => f.zoomSource?.zoomedNodeId === 'child1')).toBe(false);
      expect(filesState.reviewPendingNodeIds.has('child1')).toBe(false);
    });
  });
});
