import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { createCollaborateActions } from '../collaborateActions';
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

// Mock the feedbackService
const mockParseFeedbackContent = vi.fn();
const mockInitializeFeedbackStore = vi.fn();
const mockExtractFeedbackContent = vi.fn();
const mockCleanupFeedback = vi.fn().mockResolvedValue(undefined);
const mockFindCollaboratingNode = vi.fn();

vi.mock('../../../../services/feedback/feedbackService', () => ({
  parseFeedbackContent: (...args: unknown[]) => mockParseFeedbackContent(...args),
  initializeFeedbackStore: (...args: unknown[]) => mockInitializeFeedbackStore(...args),
  extractFeedbackContent: (...args: unknown[]) => mockExtractFeedbackContent(...args),
  cleanupFeedback: (...args: unknown[]) => mockCleanupFeedback(...args),
  findCollaboratingNode: (...args: unknown[]) => mockFindCollaboratingNode(...args),
}));

// Mock feedbackTreeStore
const mockFeedbackTreeStoreGetStoreForFile = vi.fn();
const mockFeedbackTreeStoreInitialize = vi.fn();
const mockFeedbackTreeStoreSetFilePath = vi.fn();

vi.mock('../../../feedback/feedbackTreeStore', () => ({
  feedbackTreeStore: {
    getStoreForFile: (...args: unknown[]) => mockFeedbackTreeStoreGetStoreForFile(...args),
    initialize: (...args: unknown[]) => mockFeedbackTreeStoreInitialize(...args),
    setFilePath: (...args: unknown[]) => mockFeedbackTreeStoreSetFilePath(...args),
    clearFile: vi.fn(),
  },
}));

describe('collaborateActions', () => {
  let mockGet: Mock<() => TreeState>;
  let mockSet: Mock<(partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void>;
  let actions: ReturnType<typeof createCollaborateActions>;
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
        createTempFile: vi.fn().mockResolvedValue('/tmp/arborescent/feedback-response.md'),
        readTempFile: vi.fn().mockResolvedValue(null),
        startFeedbackFileWatcher: vi.fn().mockResolvedValue(undefined),
        stopFeedbackFileWatcher: vi.fn().mockResolvedValue(undefined),
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
      collaboratingNodeId: null,
      feedbackFadingNodeIds: new Set(),
      contextDeclarations: [],
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

    actions = createCollaborateActions(mockGet, mockSet, mockVisualEffects, mockAutoSave);
  });

  describe('startCollaboration', () => {
    it('should set collaboratingNodeId', () => {
      actions.startCollaboration('child1');

      expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: 'child1' });
    });

    it('should not start collaboration if one is already in progress', () => {
      mockState.collaboratingNodeId = 'child1';

      actions.startCollaboration('child2');

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('cancelCollaboration', () => {
    it('should clear collaboratingNodeId', () => {
      mockState.collaboratingNodeId = 'child1';

      actions.cancelCollaboration();

      expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: null });
    });
  });

  describe('acceptFeedback', () => {
    it('should replace collaborating node with new nodes', () => {
      mockState.collaboratingNodeId = 'child1';

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

      actions.acceptFeedback('new-child1', {
        'new-child1': newRootNode,
        'new-grandchild1': newGrandchild,
      });

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboratingNodeId: null,
        })
      );

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.nodes!['new-child1']).toEqual(newRootNode);
      expect(setCall.nodes!['new-grandchild1']).toEqual(newGrandchild);
      expect(setCall.nodes!['child1']).toBeUndefined();
      expect(setCall.nodes!['grandchild1']).toBeUndefined();
    });

    it('should update parent children to reference new root node', () => {
      mockState.collaboratingNodeId = 'child1';

      const newRootNode: TreeNode = {
        id: 'new-child1',
        content: 'Updated Child 1',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptFeedback('new-child1', {
        'new-child1': newRootNode,
      });

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.nodes!.root.children).toContain('new-child1');
      expect(setCall.nodes!.root.children).not.toContain('child1');
    });

    it('should rebuild ancestor registry', () => {
      mockState.collaboratingNodeId = 'child1';

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

      actions.acceptFeedback('new-child1', {
        'new-child1': newRootNode,
        'new-grandchild1': newGrandchild,
      });

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.ancestorRegistry!['new-child1']).toEqual(['root']);
      expect(setCall.ancestorRegistry!['new-grandchild1']).toEqual(['root', 'new-child1']);
      expect(setCall.ancestorRegistry!['child1']).toBeUndefined();
      expect(setCall.ancestorRegistry!['grandchild1']).toBeUndefined();
    });

    it('should replace root node if collaborating root', () => {
      mockState.collaboratingNodeId = 'root';

      const newRootNode: TreeNode = {
        id: 'new-root',
        content: 'New Root',
        children: [],
        metadata: { plugins: {} },
      };

      actions.acceptFeedback('new-root', {
        'new-root': newRootNode,
      });

      const setCall = mockSet.mock.calls[0][0] as Partial<TreeState>;
      expect(setCall.rootNodeId).toBe('new-root');
      expect(setCall.nodes!['new-root']).toEqual(newRootNode);
      expect(setCall.nodes!['root']).toBeUndefined();
    });

    it('should not do anything if no collaboration in progress', () => {
      mockState.collaboratingNodeId = null;

      actions.acceptFeedback('new-node', {});

      expect(mockSet).not.toHaveBeenCalled();
    });

    it('should not do anything if collaborating node does not exist', () => {
      mockState.collaboratingNodeId = 'nonexistent';

      actions.acceptFeedback('new-node', {});

      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('collaborate', () => {
    it('should copy content to clipboard and start collaboration', async () => {
      await actions.collaborate('child1');

      expect(mockClipboardWriteText).toHaveBeenCalledWith(expect.stringContaining('Child 1'));
      expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: 'child1' });
      // Clipboard monitor is managed by useFeedbackClipboard, not collaborateActions
      expect(logger.info).toHaveBeenCalledWith('Started collaboration for node: child1', 'CollaborateActions');
    });

    it('should not start collaboration if one is already in progress', async () => {
      mockState.collaboratingNodeId = 'child2';

      await actions.collaborate('child1');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      // Clipboard monitor is managed by useFeedbackClipboard, not collaborateActions
      expect(logger.error).toHaveBeenCalledWith(
        'Collaboration already in progress',
        expect.any(Error),
        'CollaborateActions'
      );
    });

    it('should not start collaboration if node does not exist', async () => {
      await actions.collaborate('nonexistent');

      expect(mockClipboardWriteText).not.toHaveBeenCalled();
      // Clipboard monitor is managed by useFeedbackClipboard, not collaborateActions
      expect(logger.error).toHaveBeenCalledWith(
        'Node not found',
        expect.any(Error),
        'CollaborateActions'
      );
    });

    it('should handle clipboard write errors', async () => {
      const error = new Error('Clipboard error');
      mockClipboardWriteText.mockRejectedValue(error);

      await expect(actions.collaborate('child1')).rejects.toThrow('Clipboard error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to start collaboration',
        error,
        'CollaborateActions'
      );
    });
  });

  describe('collaborateInTerminal', () => {
    it('should write to terminal, execute, and start file watcher', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');

      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(executeInTerminal).toHaveBeenCalledWith(
        'terminal-1',
        expect.stringContaining('Write your reviewed/updated list to this file:')
      );
      expect(executeInTerminal).toHaveBeenCalledWith(
        'terminal-1',
        expect.stringContaining('Child 1')
      );
      expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: 'child1' });
      expect(window.electron.startFeedbackFileWatcher).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Started terminal collaboration for node: child1'),
        'CollaborateActions'
      );
    });

    it('should not start collaboration if one is already in progress', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      mockState.collaboratingNodeId = 'child2';

      await actions.collaborateInTerminal('child1', 'terminal-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(window.electron.startFeedbackFileWatcher).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Collaboration already in progress',
        expect.any(Error),
        'CollaborateActions'
      );
    });

    it('should throw error if no terminal ID provided', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');

      await expect(actions.collaborateInTerminal('child1', '')).rejects.toThrow(
        'No terminal selected'
      );

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Cannot collaborate in terminal',
        expect.any(Error),
        'CollaborateActions'
      );
    });

    it('should not start collaboration if node does not exist', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');

      await actions.collaborateInTerminal('nonexistent', 'terminal-1');

      expect(executeInTerminal).not.toHaveBeenCalled();
      expect(window.electron.startFeedbackFileWatcher).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'Node not found',
        expect.any(Error),
        'CollaborateActions'
      );
    });

    it('should handle terminal execution errors', async () => {
      const { executeInTerminal } = await import('../../../../services/terminalExecution');
      const error = new Error('Terminal error');
      vi.mocked(executeInTerminal).mockRejectedValue(error);

      await expect(actions.collaborateInTerminal('child1', 'terminal-1')).rejects.toThrow(
        'Terminal error'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to collaborate in terminal',
        error,
        'CollaborateActions'
      );
    });
  });

  describe('collaboration persistence', () => {
    describe('startCollaboration', () => {
      it('should set collaboratingNodeId without saving metadata', () => {
        mockState.currentFilePath = '/test/file.arbo';

        actions.startCollaboration('child1');

        // Metadata is only saved when content is received via processIncomingFeedbackContent
        expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: 'child1' });
      });
    });

    describe('finishCancel', () => {
      it('should cleanup collaboration state and metadata', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.collaboratingNodeId = 'child1';
        mockState.nodes.child1.metadata.feedbackTempFile = '/tmp/feedback.arbo';

        await actions.finishCancel();

        // Should clear node metadata and collaboratingNodeId together
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({
          collaboratingNodeId: null,
        }));
      });

      it('should clear collaboratingNodeId', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.collaboratingNodeId = 'child1';

        await actions.finishCancel();

        expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: null });
      });
    });

    describe('finishAccept', () => {
      it('should complete accept workflow and cleanup', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockState.collaboratingNodeId = 'child1';

        // Mock extractFeedbackContent to return valid content
        mockExtractFeedbackContent.mockReturnValue({
          rootNodeId: 'new-child1',
          nodes: {
            'new-child1': { id: 'new-child1', content: 'Updated', children: [], metadata: { plugins: {} } },
          },
        });

        await actions.finishAccept();

        // Should cleanup the collaboration
        expect(mockCleanupFeedback).toHaveBeenCalledWith('/test/file.arbo', undefined);
      });
    });

    describe('restoreCollaborationState', () => {
      it('should NOT restore when findCollaboratingNode returns null', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockFindCollaboratingNode.mockReturnValue(null);

        await actions.restoreCollaborationState();

        expect(mockSet).not.toHaveBeenCalledWith({ collaboratingNodeId: 'child1' });
        // Clipboard monitor is managed by useFeedbackClipboard, not collaborateActions
      });

      it('should restore collaboratingNodeId and content when temp file exists', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        const nodeWithCollaboration = { ...mockState.nodes.child1, metadata: { ...mockState.nodes.child1.metadata, feedbackTempFile: '/tmp/feedback.arbo' } };
        mockFindCollaboratingNode.mockReturnValue(['child1', nodeWithCollaboration]);

        // Mock temp file exists
        (window.electron.readTempFile as ReturnType<typeof vi.fn>).mockResolvedValue('file content');

        const mockLoadFromPath = vi.fn().mockResolvedValue(undefined);
        mockFeedbackTreeStoreGetStoreForFile.mockReturnValue({
          getState: () => ({ actions: { loadFromPath: mockLoadFromPath } }),
        });

        await actions.restoreCollaborationState();

        expect(mockSet).toHaveBeenCalledWith({ collaboratingNodeId: 'child1' });
        expect(mockLoadFromPath).toHaveBeenCalledWith('/tmp/feedback.arbo');
      });

      it('should not restore if no node has feedbackTempFile metadata', async () => {
        mockState.currentFilePath = '/test/file.arbo';
        mockFindCollaboratingNode.mockReturnValue(null);

        await actions.restoreCollaborationState();

        expect(mockSet).not.toHaveBeenCalledWith(
          expect.objectContaining({ collaboratingNodeId: expect.anything() })
        );
      });

      // Clipboard monitor is now managed by useFeedbackClipboard hook, not collaborateActions

      it('should skip restore if currentFilePath is null', async () => {
        mockState.currentFilePath = null;

        await actions.restoreCollaborationState();

        expect(logger.info).toHaveBeenCalledWith(
          'No current file path, skipping collaboration restore',
          'CollaborateActions'
        );
      });
    });
  });
});
