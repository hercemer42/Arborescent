import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createReviewActions } from '../reviewActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { logger } from '../../../../services/logger';

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../services/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
}));

// Mock the reviewService
const mockParseReviewContent = vi.fn();
const mockInitializeReviewStore = vi.fn();
const mockExtractReviewContent = vi.fn();
const mockCleanupReview = vi.fn().mockResolvedValue(undefined);
const mockFindReviewingNode = vi.fn();

vi.mock('../../../../services/review/reviewService', () => ({
  parseReviewContent: (...args: unknown[]) => mockParseReviewContent(...args),
  initializeReviewStore: (...args: unknown[]) => mockInitializeReviewStore(...args),
  extractReviewContent: (...args: unknown[]) => mockExtractReviewContent(...args),
  cleanupReview: (...args: unknown[]) => mockCleanupReview(...args),
  findReviewingNode: (...args: unknown[]) => mockFindReviewingNode(...args),
}));

// Mock reviewTreeStore
const mockReviewTreeStoreGetStoreForFile = vi.fn();
const mockReviewTreeStoreInitialize = vi.fn();
const mockReviewTreeStoreSetFilePath = vi.fn();

vi.mock('../../../review/reviewTreeStore', () => ({
  reviewTreeStore: {
    getStoreForFile: (...args: unknown[]) => mockReviewTreeStoreGetStoreForFile(...args),
    initialize: (...args: unknown[]) => mockReviewTreeStoreInitialize(...args),
    setFilePath: (...args: unknown[]) => mockReviewTreeStoreSetFilePath(...args),
    clearFile: vi.fn(),
  },
}));

describe('reviewActions', () => {
  let mockGet: Mock<() => TreeState>;
  let mockSet: Mock<(partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void>;
  let actions: ReturnType<typeof createReviewActions>;
  let mockState: TreeState;
  let mockTerminalWrite: Mock;
  let mockStartClipboardMonitor: Mock;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClipboardWriteText: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock clipboard API
    mockClipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockClipboardWriteText,
      },
      writable: true,
    });

    // Mock window.electron
    mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
    mockStartClipboardMonitor = vi.fn().mockResolvedValue(undefined);
    global.window = {
      electron: {
        terminalWrite: mockTerminalWrite,
        startClipboardMonitor: mockStartClipboardMonitor,
        stopClipboardMonitor: vi.fn().mockResolvedValue(undefined),
        createTempFile: vi.fn().mockResolvedValue('/tmp/arborescent/review-response.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
        startReviewFileWatcher: vi.fn().mockResolvedValue(undefined),
        stopReviewFileWatcher: vi.fn().mockResolvedValue(undefined),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Create mock state
    const rootNode: TreeNode = {
      id: 'root',
      content: 'Root',
      children: ['child1', 'child2'],
      metadata: { plugins: {} },
    };

    const child1: TreeNode = {
      id: 'child1',
      content: 'Child 1',
      children: ['grandchild1'],
      metadata: { plugins: {} },
    };

    const grandchild1: TreeNode = {
      id: 'grandchild1',
      content: 'Grandchild 1',
      children: [],
      metadata: { plugins: {} },
    };

    const child2: TreeNode = {
      id: 'child2',
      content: 'Child 2',
      children: [],
      metadata: { plugins: {} },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any

    mockState = {
      nodes: {
        root: rootNode,
        child1: child1,
        grandchild1: grandchild1,
        child2: child2,
      },
      rootNodeId: 'root',
      treeType: 'workspace',
      ancestorRegistry: {
        root: [],
        child1: ['root'],
        grandchild1: ['root', 'child1'],
        child2: ['root'],
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      lastSelectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      flashingNode: null,
      scrollToNodeId: null,
      deletingNodeIds: new Set<string>(),
      deleteAnimationCallback: null,
      reviewingNodeId: null,
      reviewFadingNodeIds: new Set(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: {} as any,
    };

    mockGet = vi.fn(() => mockState);
    mockSet = vi.fn((partial) => {
      if (typeof partial === 'function') {
        const updates = partial(mockState);
        Object.assign(mockState, updates);
      } else {
        Object.assign(mockState, partial);
      }
    });

    // Mock executeCommand that executes the command immediately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockExecuteCommand = vi.fn((command: any) => {
      command.execute();
    });

    // Add executeCommand to the mock state's actions
    mockState.actions = {
      executeCommand: mockExecuteCommand,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    const mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    const mockAutoSave = vi.fn();

    actions = createReviewActions(mockGet, mockSet, mockVisualEffects, mockAutoSave);
  });

  describe('startReview', () => {
    it('should set reviewingNodeId', () => {
      actions.startReview('child1');

      expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
    });

    it('should not start review if one is already in progress', () => {
      mockState.reviewingNodeId = 'child1';

      actions.startReview('child2');

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('cancelReview', () => {
    it('should clear reviewingNodeId', () => {
      mockState.reviewingNodeId = 'child1';

      actions.cancelReview();

      expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: null });
    });
  });

  describe('acceptReview', () => {
    it('should replace reviewing node with new nodes', () => {
      mockState.reviewingNodeId = 'child1';

      const newRootNode: TreeNode = {
        id: 'new-child1',
        content: 'Updated Child 1',
        children: ['new-grandchild1'],
        metadata: { plugins: {} },
      };

      const newGrandchild: TreeNode = {
        id: 'new-grandchild1',
        content: 'Updated Grandchild 1',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptReview('new-child1', {
        'new-child1': newRootNode,
        'new-grandchild1': newGrandchild,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewingNodeId: null,
        })
      );

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.nodes!['new-child1']).toEqual(newRootNode);
      expect(setCall.nodes!['new-grandchild1']).toEqual(newGrandchild);
      expect(setCall.nodes!['child1']).toBeUndefined();
      expect(setCall.nodes!['grandchild1']).toBeUndefined();
    });

    it('should update parent children to reference new root node', () => {
      mockState.reviewingNodeId = 'child1';

      const newRootNode: TreeNode = {
        id: 'new-child1',
        content: 'Updated Child 1',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptReview('new-child1', {
        'new-child1': newRootNode,
      });

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.nodes!.root.children).toContain('new-child1');
      expect(setCall.nodes!.root.children).not.toContain('child1');
    });

    it('should rebuild ancestor registry', () => {
      mockState.reviewingNodeId = 'child1';

      const newRootNode: TreeNode = {
        id: 'new-child1',
        content: 'Updated Child 1',
        children: ['new-grandchild1'],
        metadata: { plugins: {} },
      };

      const newGrandchild: TreeNode = {
        id: 'new-grandchild1',
        content: 'Updated Grandchild 1',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptReview('new-child1', {
        'new-child1': newRootNode,
        'new-grandchild1': newGrandchild,
      });

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.ancestorRegistry!['new-child1']).toEqual(['root']);
      expect(setCall.ancestorRegistry!['new-grandchild1']).toEqual(['root', 'new-child1']);
      expect(setCall.ancestorRegistry!['child1']).toBeUndefined();
      expect(setCall.ancestorRegistry!['grandchild1']).toBeUndefined();
    });

    it('should replace root node if reviewing root', () => {
      mockState.reviewingNodeId = 'root';

      const newRootNode: TreeNode = {
        id: 'new-root',
        content: 'New Root',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptReview('new-root', {
        'new-root': newRootNode,
      });

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.rootNodeId).toBe('new-root');
      expect(setCall.nodes!['new-root']).toEqual(newRootNode);
      expect(setCall.nodes!['root']).toBeUndefined();
    });

    it('should not do anything if no review in progress', () => {
      mockState.reviewingNodeId = null;

      actions.acceptReview('new-node', {});

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should not do anything if reviewing node does not exist', () => {
      mockState.reviewingNodeId = 'nonexistent';

      actions.acceptReview('new-node', {});

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('requestReview', () => {
    it('should copy content to clipboard and start review', async () => {
      await actions.requestReview('child1');

      expect(mockClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining('Child 1'));
      expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
      // Clipboard monitor is managed by useReviewClipboard, not reviewActions
      expect(logger.info).toHaveBeenCalledWith('Started review for node: child1', 'ReviewActions');
    });

    it('should not start review if one is already in progress', async () => {
      mockState.reviewingNodeId = 'child2';

      await actions.requestReview('child1');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      // Clipboard monitor is managed by useReviewClipboard, not reviewActions
      expect(logger.error).toHaveBeenCalledWith(
        'Review already in progress',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should not start review if node does not exist', async () => {
      await actions.requestReview('nonexistent');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      // Clipboard monitor is managed by useReviewClipboard, not reviewActions
      expect(logger.error).toHaveBeenCalledWith(
        'Node not found',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should handle clipboard write errors', async () => {
      const error = new Error('Clipboard error');
      mockClipboardWriteText.mockRejectedValue(error);

      await expect(actions.requestReview('child1')).rejects.toThrow('Clipboard error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to request review',
        error,
        'ReviewActions'
      );
    });
  });

  describe('requestReviewInTerminal', () => {
    it('should write to terminal, execute, and start file watcher', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');

      await actions.requestReviewInTerminal('child1', 'terminal-1');

      expect(executeInTerminal).toHaveBeenCalledWith(
        'terminal-1',
        expect.stringContaining('Write your reviewed/updated list to this file:')
      );
      expect(executeInTerminal).toHaveBeenCalledWith(
        'terminal-1',
        expect.stringContaining('Child 1')
      );
      expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
      expect(window.electron.startReviewFileWatcher).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started terminal review for node: child1'),
        'ReviewActions'
      );
    });

    it('should not start review if one is already in progress', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.reviewingNodeId = 'child2';

      await actions.requestReviewInTerminal('child1', 'terminal-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(window.electron.startReviewFileWatcher).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Review already in progress',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should throw error if no terminal ID provided', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');

      await expect(actions.requestReviewInTerminal('child1', '')).rejects.toThrow(
        'No terminal selected'
      );

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Cannot request review in terminal',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should not start review if node does not exist', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');

      await actions.requestReviewInTerminal('nonexistent', 'terminal-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(window.electron.startReviewFileWatcher).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Node not found',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should handle terminal execution errors', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      const error = new Error('Terminal error');
      vi.mocked(executeInTerminal).mockRejectedValue(error);

      await expect(actions.requestReviewInTerminal('child1', 'terminal-1')).rejects.toThrow(
        'Terminal error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to request review in terminal',
        error,
        'ReviewActions'
      );
    });
  });

  describe('review persistence', () => {
    describe('startReview', () => {
      it('should set reviewingNodeId without saving metadata', () => {
        mockState.currentFilePath = '/test/file.arbo';

        actions.startReview('child1');

        // Metadata is only saved when content is received via processIncomingReviewContent
        expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
      });
    });

    describe('finishCancel', () => {
      it('should cleanup review state and metadata', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.reviewingNodeId = 'child1';
        mockState.nodes.child1.metadata.reviewTempFile = '/tmp/review.arbo';

        await actions.finishCancel();

        // Should clear node metadata and reviewingNodeId together
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
          reviewingNodeId: null,
        }));
      });

      it('should clear reviewingNodeId', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.reviewingNodeId = 'child1';

        await actions.finishCancel();

        expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: null });
      });
    });

    describe('finishAccept', () => {
      it('should complete accept workflow and cleanup', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.reviewingNodeId = 'child1';

        // Mock extractReviewContent to return valid content
        mockExtractReviewContent.mockReturnValue({
          rootNodeId: 'new-child1',
          nodes: {
            'new-child1': { id: 'new-child1', content: 'Updated', children: [], metadata: { plugins: {} } },
          },
        });

        await actions.finishAccept();

        // Should cleanup the review
        expect(mockCleanupReview).toHaveBeenCalledWith('/test/file.arbo', undefined);
      });
    });

    describe('restoreReviewState', () => {
      it('should NOT restore when findReviewingNode returns null', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockFindReviewingNode.mockReturnValue(null);

        await actions.restoreReviewState();

        expect(mockSet).not.toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
        // Clipboard monitor is managed by useReviewClipboard, not reviewActions
      });

      it('should restore reviewingNodeId and content when temp file exists', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        const nodeWithReview = { ...mockState.nodes.child1, metadata: { ...mockState.nodes.child1.metadata, reviewTempFile: '/tmp/review.arbo' } };
        mockFindReviewingNode.mockReturnValue(['child1', nodeWithReview]);

        // Mock temp file exists
        (window.electron.readTempFile as ReturnType<typeof vi.fn>).mockResolvedValue('file content');

        const mockLoadFromPath = vi.fn().mockResolvedValue(undefined);
        mockReviewTreeStoreGetStoreForFile.mockReturnValue({
          getState: () => ({ actions: { loadFromPath: mockLoadFromPath } }),
        });

        await actions.restoreReviewState();

        expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
        expect(mockLoadFromPath).toHaveBeenCalledWith('/tmp/review.arbo');
      });

      it('should not restore if no node has reviewTempFile metadata', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockFindReviewingNode.mockReturnValue(null);

        await actions.restoreReviewState();

        expect(mockSet).not.toHaveBeenCalledWith(
          expect.objectContaining({ reviewingNodeId: expect.anything() })
        );
      });

      // Clipboard monitor is now managed by useReviewClipboard hook, not reviewActions

      it('should skip restore if currentFilePath is null', async () => {
        mockState.currentFilePath = null;

        await actions.restoreReviewState();

        expect(logger.info).toHaveBeenCalledWith(
          'No current file path, skipping review restore',
          'ReviewActions'
        );
      });
    });
  });
});
