import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createSendActions } from '../sendActions';
import { TreeState } from '../../treeStore';
import type { ReviewMap } from '../../reviews';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

const mockParseFeedbackContent = vi.fn();
const mockInitializeFeedbackStore = vi.fn();
const mockExtractFeedbackContent = vi.fn();
const mockCleanupFeedbackForNode = vi.fn().mockResolvedValue(undefined);
const mockFindCollaboratingNode = vi.fn();

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
  initializeFeedbackStore: (...args: unknown[]) => mockInitializeFeedbackStore(...args),
  extractFeedbackContent: (...args: unknown[]) => mockExtractFeedbackContent(...args),
  cleanupFeedbackForNode: (...args: unknown[]) => mockCleanupFeedbackForNode(...args),
  findCollaboratingNode: (...args: unknown[]) => mockFindCollaboratingNode(...args),
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

const { mockAddToast, mockGetAllStores } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockGetAllStores: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

vi.mock('../../../panel/panelStore', () => ({
  usePanelStore: { getState: () => ({ showBrowser: vi.fn() }) },
}));

// A remote store as seen through getAllStores: the cross-file browser guard reads its reviews map.
function remoteStore(reviews: ReviewMap, currentFilePath: string) {
  return { getState: () => ({ reviews, currentFilePath }) };
}

describe('browser collaboration guard across files', () => {
  let mockState: TreeState;
  let mockSet: Mock;
  let actions: ReturnType<typeof createSendActions>;
  let mockClipboardWriteText: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockClipboardWriteText },
      writable: true,
    });

    global.window = {
      electron: {
        startClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/feedback.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    mockState = {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['child1', 'child2', 'ctx'], metadata: {} },
        child1: { id: 'child1', content: 'Child 1', children: [], metadata: { appliedContextId: 'ctx' } },
        child2: { id: 'child2', content: 'Child 2', children: [], metadata: { appliedContextId: 'ctx' } },
        ctx: { id: 'ctx', content: 'Review', children: [], metadata: { isContextDeclaration: true, collaborate: true, execute: false } },
      },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: { root: [], child1: ['root'], child2: ['root'], ctx: ['root'] },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: '/file-b.arbo',
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

    const mockGet = vi.fn(() => mockState);
    mockSet = vi.fn((partial) => {
      if (typeof partial === 'function') {
        const updates = partial(mockState);
        Object.assign(mockState, updates);
      } else {
        Object.assign(mockState, partial);
      }
    });

    const mockExecuteCommand = vi.fn((command: { execute: () => void }) => command.execute());

    const mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    mockGetAllStores.mockReturnValue([]);
    actions = createSendActions(mockGet, mockSet, mockVisualEffects, vi.fn(), mockExecuteCommand, mockGetAllStores);
  });

  describe('review source tracking', () => {
    it('should record a browser review when collaborate() starts', async () => {
      await actions.collaborate('child1');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          reviews: expect.objectContaining({ child1: expect.objectContaining({ source: 'browser' }) }),
        })
      );
    });

    it('should record a terminal review when collaborateInTerminal() starts', async () => {
      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          reviews: expect.objectContaining({
            child1: expect.objectContaining({ source: 'terminal', terminalId: 'terminal-1' }),
          }),
        })
      );
    });

    it('should clear the review on finishAccept', async () => {
      mockState.reviews = { child1: { source: 'browser', terminalId: null } };
      mockState.currentFilePath = '/test.arbo';

      mockExtractFeedbackContent.mockReturnValue({
        rootNodeId: 'new-root',
        rootNodeIds: ['new-root'],
        nodes: { 'new-root': { id: 'new-root', content: 'New', children: [], metadata: {} } },
      });

      await actions.finishAccept('child1');

      // The action sets reviews to a map WITHOUT the reviewed node's key.
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ reviews: expect.not.objectContaining({ child1: expect.anything() }) })
      );
      expect(mockState.reviews).not.toHaveProperty('child1');
    });

    it('should clear the review on finishCancel', async () => {
      mockState.reviews = { child1: { source: 'browser', terminalId: null } };
      mockState.currentFilePath = '/test.arbo';

      await actions.finishCancel('child1');

      expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ reviews: {} }));
      expect(mockState.reviews).toEqual({});
    });
  });

  describe('cross-file browser guard', () => {
    it('should block collaborate() when another store has an active browser review', async () => {
      mockGetAllStores.mockReturnValue([
        remoteStore({ 'other-node': { source: 'browser', terminalId: null } }, '/file-a.arbo'),
      ]);

      await actions.collaborate('child1');

      // Guard should have been called
      expect(mockGetAllStores).toHaveBeenCalled();
      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('Browser collaboration already in progress'),
        'error'
      );
    });

    it('should NOT block collaborate() when another store has an active terminal review', async () => {
      mockGetAllStores.mockReturnValue([
        remoteStore({ 'other-node': { source: 'terminal', terminalId: 't' } }, '/file-a.arbo'),
      ]);

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).toHaveBeenCalled();
    });

    it('should proceed when no other store has an active review', async () => {
      mockGetAllStores.mockReturnValue([remoteStore({}, '/file-a.arbo')]);

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).toHaveBeenCalled();
    });

    it('should include the blocking file name in the toast', async () => {
      mockGetAllStores.mockReturnValue([
        remoteStore({ 'other-node': { source: 'browser', terminalId: null } }, '/projects/file-a.arbo'),
      ]);

      await actions.collaborate('child1');

      expect(mockAddToast).toHaveBeenCalledWith(
        expect.stringContaining('file-a.arbo'),
        'error'
      );
    });
  });

  describe('guard lifecycle', () => {
    it('should allow browser collaboration after blocking file finishes', async () => {
      const otherStoreReviews: ReviewMap = { 'other-node': { source: 'browser', terminalId: null } };

      mockGetAllStores.mockReturnValue([{ getState: () => ({ reviews: otherStoreReviews, currentFilePath: '/file-a.arbo' }) }]);

      await actions.collaborate('child1');
      expect(mockClipboardWriteText).not.toHaveBeenCalled();

      delete otherStoreReviews['other-node'];

      await actions.collaborate('child1');
      expect(mockClipboardWriteText).toHaveBeenCalled();
    });

    it('should still block a within-file browser review while a terminal review is active', async () => {
      // Browser reviews are exclusive: with any review in progress (here a terminal review on the
      // same node), starting a browser review is blocked.
      mockState.reviews = { child1: { source: 'terminal', terminalId: 't' } };
      mockGetAllStores.mockReturnValue([]);

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
    });
  });

  describe('terminal collaboration vs browser exclusivity', () => {
    it('should block collaborateInTerminal when another file has an active browser review', async () => {
      // BEHAVIOR CHANGED: a browser review is now exclusive across files — while it runs, every
      // other review start (terminal included) is blocked. The old model treated terminal
      // collaboration as independent of a cross-file browser collaboration; it no longer is.
      mockGetAllStores.mockReturnValue([
        remoteStore({ 'other-node': { source: 'browser', terminalId: null } }, '/file-a.arbo'),
      ]);

      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(mockState.reviews).not.toHaveProperty('child1');
    });

    it('should start collaborateInTerminal when no browser review is active anywhere', async () => {
      mockGetAllStores.mockReturnValue([
        remoteStore({ 'other-node': { source: 'terminal', terminalId: 't' } }, '/file-a.arbo'),
      ]);

      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          reviews: expect.objectContaining({ child1: expect.objectContaining({ source: 'terminal' }) }),
        })
      );
    });

    it('should ALLOW a second non-overlapping terminal review (single-collaboration guard removed)', async () => {
      // BEHAVIOR CHANGED: the single-collaboration guard is gone. With one terminal review already
      // in progress on child1, starting a terminal review on the unrelated child2 is now allowed.
      mockState.reviews = { child1: { source: 'terminal', terminalId: 'terminal-1' } };
      mockGetAllStores.mockReturnValue([]);

      await actions.collaborateInTerminal('child2', 'terminal-2');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          reviews: expect.objectContaining({
            child2: expect.objectContaining({ source: 'terminal', terminalId: 'terminal-2' }),
          }),
        })
      );
    });
  });
});
