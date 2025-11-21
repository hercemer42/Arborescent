import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createReviewActions } from '../reviewActions';
import { TreeState } from '../../treeStore';
import { TreeNode } from '../../../../../shared/types';
import { logger } from '../../../../services/logger';

vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../utils/terminalExecution', () => ({
  executeInTerminal: vi.fn().mockResolvedValue(undefined),
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
      reviewingNodeId: null,
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

    const mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
    };

    actions = createReviewActions(mockGet, mockSet, mockVisualEffects);
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
    it('should write to terminal, execute, and start review', async () => {
      const { executeInTerminal } = await import('../../../../utils/terminalExecution');

      await actions.requestReviewInTerminal('child1', 'terminal-1');

      expect(executeInTerminal).toHaveBeenCalledWith(
        'terminal-1',
        expect.stringContaining('Review the following list')
      );
      expect(executeInTerminal).toHaveBeenCalledWith(
        'terminal-1',
        expect.stringContaining('Child 1')
      );
      expect(mockSet).toHaveBeenCalledWith({ reviewingNodeId: 'child1' });
      expect(mockStartClipboardMonitor).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Started terminal review for node: child1',
        'ReviewActions'
      );
    });

    it('should not start review if one is already in progress', async () => {
      const { executeInTerminal } = await import('../../../../utils/terminalExecution');
      mockState.reviewingNodeId = 'child2';

      await actions.requestReviewInTerminal('child1', 'terminal-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(mockStartClipboardMonitor).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Review already in progress',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should throw error if no terminal ID provided', async () => {
      const { executeInTerminal } = await import('../../../../utils/terminalExecution');

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
      const { executeInTerminal } = await import('../../../../utils/terminalExecution');

      await actions.requestReviewInTerminal('nonexistent', 'terminal-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(mockStartClipboardMonitor).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Node not found',
        expect.any(Error),
        'ReviewActions'
      );
    });

    it('should handle terminal execution errors', async () => {
      const { executeInTerminal } = await import('../../../../utils/terminalExecution');
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
});
