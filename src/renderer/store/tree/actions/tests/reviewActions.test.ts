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

vi.mock('../../../../services/review/reviewTempFileService', () => ({
  loadReviewContent: vi.fn().mockResolvedValue(null),
  saveReviewContent: vi.fn().mockResolvedValue({ filePath: '/tmp/review.md', contentHash: 'abc123' }),
  deleteReviewTempFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../review/reviewTreeStore', () => ({
  reviewTreeStore: {
    initialize: vi.fn(),
    setTempFilePath: vi.fn(),
    getStoreForFile: vi.fn(() => null),
    clearFile: vi.fn(),
    hasReview: vi.fn(() => false),
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
        startReviewFileWatcher: vi.fn().mockResolvedValue(undefined),
        stopReviewFileWatcher: vi.fn().mockResolvedValue(undefined),
        saveReviewSession: vi.fn().mockResolvedValue(undefined),
        getReviewSession: vi.fn().mockResolvedValue(null),
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
      expect(mockStartClipboardMonitor).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Started review for node: child1', 'ReviewActions');
    });

    it('should not start review if one is already in progress', async () => {
      mockState.reviewingNodeId = 'child2';

      await actions.requestReview('child1');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      expect(mockStartClipboardMonitor).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Review already in progress',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should not start review if node does not exist', async () => {
      await actions.requestReview('nonexistent');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      expect(mockStartClipboardMonitor).not.toHaveBeenCalled();
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

  describe('review session persistence', () => {
    describe('startReview', () => {
      it('should not save to session on startReview (only when content is received)', () => {
        mockState.currentFilePath = '/test/file.arbo';

        actions.startReview('child1');

        // Session save now happens in processIncomingReviewContent, not startReview
        expect(window.electron.saveReviewSession).not.toHaveBeenCalled();
      });
    });

    describe('finishCancel', () => {
      it('should remove review from session', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.reviewingNodeId = 'child1';
        vi.mocked(window.electron.getReviewSession).mockResolvedValue(
          JSON.stringify({ activeReviews: { '/test/file.arbo': 'child1' } })
        );

        await actions.finishCancel();

        expect(window.electron.saveReviewSession).toHaveBeenCalled();
        const savedData = JSON.parse(
          vi.mocked(window.electron.saveReviewSession).mock.calls[0][0]
        );
        expect(savedData.activeReviews['/test/file.arbo']).toBeUndefined();
      });

      it('should clear reviewingNodeId', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.reviewingNodeId = 'child1';

        await actions.finishCancel();

        expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: null });
      });
    });

    describe('finishAccept', () => {
      it('should remove review from session after accepting', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.reviewingNodeId = 'child1';
        vi.mocked(window.electron.getReviewSession).mockResolvedValue(
          JSON.stringify({ activeReviews: { '/test/file.arbo': 'child1' } })
        );

        // Override getStoreForFile for this test
        const { reviewTreeStore } = await import('../../../review/reviewTreeStore');
        vi.mocked(reviewTreeStore.getStoreForFile).mockReturnValue({
          getState: () => ({
            nodes: {
              'review-root': { id: 'review-root', content: '', children: ['new-child1'], metadata: { plugins: {} } },
              'new-child1': { id: 'new-child1', content: 'Updated', children: [], metadata: { plugins: {} } },
            },
            rootNodeId: 'review-root',
          }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        await actions.finishAccept();

        expect(window.electron.saveReviewSession).toHaveBeenCalled();
      });
    });

    describe('restoreReviewState', () => {
      it('should NOT restore when node has no temp file (user can redo action)', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        vi.mocked(window.electron.getReviewSession).mockResolvedValue(
          JSON.stringify({ activeReviews: { '/test/file.arbo': 'child1' } })
        );

        await actions.restoreReviewState();

        // When there's no temp file, don't restore - user can easily redo the action
        expect(mockSet).not.toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
        expect(window.electron.startClipboardMonitor).not.toHaveBeenCalled();
        // Should clear the stale session entry
        expect(window.electron.saveReviewSession).toHaveBeenCalled();
      });

      it('should restore reviewingNodeId and content when temp file exists', async () => {
        const { loadReviewContent } = await import('../../../../services/review/reviewTempFileService');
        vi.mocked(loadReviewContent).mockResolvedValue('# Test Content');

        mockState.currentFilePath = '/test/file.arbo';
        mockState.nodes.child1.metadata = {
          ...mockState.nodes.child1.metadata,
          reviewTempFile: '/tmp/review.md',
          reviewContentHash: 'abc123',
        };
        vi.mocked(window.electron.getReviewSession).mockResolvedValue(
          JSON.stringify({ activeReviews: { '/test/file.arbo': 'child1' } })
        );

        await actions.restoreReviewState();

        expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
        // Hash is no longer passed - content may have been edited since initial save
        expect(loadReviewContent).toHaveBeenCalledWith('/tmp/review.md');
      });

      it('should not restore if no session data exists', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        vi.mocked(window.electron.getReviewSession).mockResolvedValue(null);

        await actions.restoreReviewState();

        expect(mockSet).not.toHaveBeenCalledWith(
          expect.objectContaining({ reviewingNodeId: expect.anything() })
        );
      });

      it('should start clipboard monitor when restoring with content', async () => {
        const { loadReviewContent } = await import('../../../../services/review/reviewTempFileService');
        vi.mocked(loadReviewContent).mockResolvedValue('# Test Content');

        mockState.currentFilePath = '/test/file.arbo';
        mockState.nodes.child1.metadata = {
          ...mockState.nodes.child1.metadata,
          reviewTempFile: '/tmp/review.md',
          reviewContentHash: 'abc123',
        };
        vi.mocked(window.electron.getReviewSession).mockResolvedValue(
          JSON.stringify({ activeReviews: { '/test/file.arbo': 'child1' } })
        );

        await actions.restoreReviewState();

        expect(window.electron.startClipboardMonitor).toHaveBeenCalled();
      });

      it('should skip restore if currentFilePath is null', async () => {
        mockState.currentFilePath = null;

        await actions.restoreReviewState();

        expect(window.electron.getReviewSession).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledWith(
          'No current file path, skipping review restore',
          'ReviewActions'
        );
      });
    });
  });
});
