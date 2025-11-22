import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createClipboardActions, ClipboardActions } from '../clipboardActions';
import type { TreeNode } from '@shared/types';
import type { VisualEffectsActions } from '../visualEffectsActions';

// Mock markdown utilities
vi.mock('../../../../utils/markdown', () => ({
  exportNodeAsMarkdown: vi.fn((node: TreeNode) => `# ${node.content}`),
  exportMultipleNodesAsMarkdown: vi.fn(
    (nodeIds: string[], nodes: Record<string, TreeNode>) =>
      nodeIds.map((id) => `# ${nodes[id]?.content || ''}`).join('\n')
  ),
  parseMarkdown: vi.fn((text: string) => {
    // Simple mock: treat each line as a node
    if (!text || text.trim() === '') {
      return { rootNodes: [], allNodes: {} };
    }
    const lines = text.split('\n').filter((l) => l.trim());
    const rootNodes: TreeNode[] = lines.map((line, i) => ({
      id: `parsed-${i}`,
      content: line.replace(/^#\s*/, ''),
      children: [],
      metadata: {},
    }));
    const allNodes: Record<string, TreeNode> = {};
    rootNodes.forEach((n) => {
      allNodes[n.id] = n;
    });
    return { rootNodes, allNodes };
  }),
}));

// Mock logger
vi.mock('../../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('clipboardActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    activeNodeId: string | null;
    multiSelectedNodeIds: Set<string>;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockDeleteNode: ReturnType<typeof vi.fn>;
  let mockAutoSave: ReturnType<typeof vi.fn>;
  let mockFlashNode: ReturnType<typeof vi.fn>;
  let mockStartDeleteAnimation: ReturnType<typeof vi.fn>;
  let visualEffects: VisualEffectsActions;
  let actions: ClipboardActions;

  // Mock clipboard
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup navigator.clipboard mock
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      command.execute();
    });
    mockDeleteNode = vi.fn().mockReturnValue(true);
    mockAutoSave = vi.fn();
    mockFlashNode = vi.fn();
    mockStartDeleteAnimation = vi.fn((nodeIds: string | string[], callback?: () => void) => {
      // Immediately call callback for synchronous testing
      if (callback) callback();
    });

    visualEffects = {
      flashNode: mockFlashNode,
      scrollToNode: vi.fn(),
      startDeleteAnimation: mockStartDeleteAnimation,
      clearDeleteAnimation: vi.fn(),
    };

    state = {
      nodes: {
        root: {
          id: 'root',
          content: 'Root',
          children: ['node-1', 'node-2'],
          metadata: {},
        },
        'node-1': {
          id: 'node-1',
          content: 'Task 1',
          children: ['node-3'],
          metadata: {},
        },
        'node-2': {
          id: 'node-2',
          content: 'Task 2',
          children: [],
          metadata: {},
        },
        'node-3': {
          id: 'node-3',
          content: 'Task 3',
          children: [],
          metadata: {},
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root', 'node-1'],
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createClipboardActions(
      () => state,
      setState,
      () => ({
        executeCommand: mockExecuteCommand,
        deleteNode: mockDeleteNode,
        autoSave: mockAutoSave,
      }),
      visualEffects,
      mockAutoSave
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cutNodes', () => {
    describe('single node selection', () => {
      it('should return no-selection when no active node', async () => {
        state.activeNodeId = null;

        const result = await actions.cutNodes();

        expect(result).toBe('no-selection');
        expect(mockClipboard.writeText).not.toHaveBeenCalled();
      });

      it('should cut active node to clipboard', async () => {
        state.activeNodeId = 'node-1';

        const result = await actions.cutNodes();

        expect(result).toBe('cut');
        expect(mockClipboard.writeText).toHaveBeenCalledWith('# Task 1');
      });

      it('should start delete animation for active node', async () => {
        state.activeNodeId = 'node-2';

        await actions.cutNodes();

        expect(mockStartDeleteAnimation).toHaveBeenCalledWith('node-2', expect.any(Function));
      });

      it('should delete node after animation', async () => {
        state.activeNodeId = 'node-2';

        await actions.cutNodes();

        expect(mockDeleteNode).toHaveBeenCalledWith('node-2', true);
      });

      it('should return no-selection when node does not exist', async () => {
        state.activeNodeId = 'non-existent';

        const result = await actions.cutNodes();

        expect(result).toBe('no-selection');
      });
    });

    describe('multi-selection', () => {
      it('should cut multiple selected nodes', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        const result = await actions.cutNodes();

        expect(result).toBe('cut');
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      it('should filter out descendant nodes from selection', async () => {
        // node-3 is a child of node-1, so it should be filtered out
        state.multiSelectedNodeIds = new Set(['node-1', 'node-3']);

        await actions.cutNodes();

        // Should only export node-1 since node-3 is its descendant
        expect(mockStartDeleteAnimation).toHaveBeenCalledWith(['node-1'], expect.any(Function));
      });

      it('should use command for multi-selection cut', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        await actions.cutNodes();

        expect(mockExecuteCommand).toHaveBeenCalled();
      });

      it('should return no-selection when all selected nodes are descendants', async () => {
        // If somehow all nodes are filtered out (edge case)
        state.multiSelectedNodeIds = new Set();

        const result = await actions.cutNodes();

        expect(result).toBe('no-selection');
      });
    });

    it('should return no-selection on clipboard error', async () => {
      state.activeNodeId = 'node-1';
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

      const result = await actions.cutNodes();

      expect(result).toBe('no-selection');
    });
  });

  describe('copyNodes', () => {
    describe('single node selection', () => {
      it('should return no-selection when no active node', async () => {
        state.activeNodeId = null;

        const result = await actions.copyNodes();

        expect(result).toBe('no-selection');
        expect(mockClipboard.writeText).not.toHaveBeenCalled();
      });

      it('should copy active node to clipboard', async () => {
        state.activeNodeId = 'node-1';

        const result = await actions.copyNodes();

        expect(result).toBe('copied');
        expect(mockClipboard.writeText).toHaveBeenCalledWith('# Task 1');
      });

      it('should flash the copied node', async () => {
        state.activeNodeId = 'node-2';

        await actions.copyNodes();

        expect(mockFlashNode).toHaveBeenCalledWith('node-2', 'light');
      });

      it('should return no-selection when node does not exist', async () => {
        state.activeNodeId = 'non-existent';

        const result = await actions.copyNodes();

        expect(result).toBe('no-selection');
      });
    });

    describe('multi-selection', () => {
      it('should copy multiple selected nodes', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        const result = await actions.copyNodes();

        expect(result).toBe('copied');
        expect(mockClipboard.writeText).toHaveBeenCalled();
      });

      it('should filter out descendant nodes from selection', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-3']);

        await actions.copyNodes();

        // Should flash only node-1
        expect(mockFlashNode).toHaveBeenCalledWith('node-1', 'light');
        expect(mockFlashNode).toHaveBeenCalledTimes(1);
      });

      it('should flash all root-level selected nodes', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        await actions.copyNodes();

        expect(mockFlashNode).toHaveBeenCalledWith('node-1', 'light');
        expect(mockFlashNode).toHaveBeenCalledWith('node-2', 'light');
        expect(mockFlashNode).toHaveBeenCalledTimes(2);
      });
    });

    it('should return no-selection on clipboard error', async () => {
      state.activeNodeId = 'node-1';
      mockClipboard.writeText.mockRejectedValueOnce(new Error('Clipboard error'));

      const result = await actions.copyNodes();

      expect(result).toBe('no-selection');
    });
  });

  describe('pasteNodes', () => {
    it('should return no-content when clipboard is empty', async () => {
      mockClipboard.readText.mockResolvedValueOnce('');

      const result = await actions.pasteNodes();

      expect(result).toBe('no-content');
    });

    it('should paste nodes as children of active node', async () => {
      state.activeNodeId = 'node-1';
      mockClipboard.readText.mockResolvedValueOnce('# Pasted Node');

      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockExecuteCommand).toHaveBeenCalled();
    });

    it('should paste nodes under root when no active node', async () => {
      state.activeNodeId = null;
      mockClipboard.readText.mockResolvedValueOnce('# Pasted Node');

      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockExecuteCommand).toHaveBeenCalled();
    });

    it('should flash pasted nodes', async () => {
      state.activeNodeId = 'node-1';
      mockClipboard.readText.mockResolvedValueOnce('# Pasted Node');

      await actions.pasteNodes();

      expect(mockFlashNode).toHaveBeenCalled();
    });

    it('should return no-content on clipboard error', async () => {
      mockClipboard.readText.mockRejectedValueOnce(new Error('Clipboard error'));

      const result = await actions.pasteNodes();

      expect(result).toBe('no-content');
    });

    it('should return no-content when no target parent', async () => {
      state.activeNodeId = null;
      state.rootNodeId = '';
      mockClipboard.readText.mockResolvedValueOnce('# Pasted Node');

      const result = await actions.pasteNodes();

      expect(result).toBe('no-content');
    });
  });

  describe('deleteSelectedNodes', () => {
    describe('single node selection', () => {
      it('should return no-selection when no active node', () => {
        state.activeNodeId = null;

        const result = actions.deleteSelectedNodes();

        expect(result).toBe('no-selection');
      });

      it('should delete active node', () => {
        state.activeNodeId = 'node-2';

        const result = actions.deleteSelectedNodes();

        expect(result).toBe('deleted');
        expect(mockStartDeleteAnimation).toHaveBeenCalledWith('node-2', expect.any(Function));
      });

      it('should start delete animation for active node', () => {
        state.activeNodeId = 'node-2';

        actions.deleteSelectedNodes();

        expect(mockStartDeleteAnimation).toHaveBeenCalledWith('node-2', expect.any(Function));
        expect(mockDeleteNode).toHaveBeenCalledWith('node-2', true);
      });

      it('should return no-selection when node does not exist', () => {
        state.activeNodeId = 'non-existent';

        const result = actions.deleteSelectedNodes();

        expect(result).toBe('no-selection');
      });
    });

    describe('multi-selection', () => {
      it('should delete multiple selected nodes', () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        const result = actions.deleteSelectedNodes();

        expect(result).toBe('deleted');
        expect(mockStartDeleteAnimation).toHaveBeenCalled();
      });

      it('should filter out descendant nodes from deletion', () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-3']);

        actions.deleteSelectedNodes();

        // Should only delete node-1 since node-3 is its descendant
        expect(mockStartDeleteAnimation).toHaveBeenCalledWith(['node-1'], expect.any(Function));
      });

      it('should use command for multi-selection delete', () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        actions.deleteSelectedNodes();

        expect(mockExecuteCommand).toHaveBeenCalled();
      });

      it('should start delete animation with all root-level selections', () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        actions.deleteSelectedNodes();

        expect(mockStartDeleteAnimation).toHaveBeenCalledWith(
          expect.arrayContaining(['node-1', 'node-2']),
          expect.any(Function)
        );
      });
    });
  });

  describe('getRootLevelSelections helper', () => {
    it('should return only root-level nodes when descendants are selected', async () => {
      // node-3 is child of node-1, so selecting both should only operate on node-1
      state.multiSelectedNodeIds = new Set(['node-1', 'node-3']);

      await actions.copyNodes();

      // The mock exportMultipleNodesAsMarkdown receives only root-level nodes
      // We can verify by checking that only node-1 was flashed
      expect(mockFlashNode).toHaveBeenCalledTimes(1);
      expect(mockFlashNode).toHaveBeenCalledWith('node-1', 'light');
    });

    it('should keep all nodes when none are descendants of others', async () => {
      state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

      await actions.copyNodes();

      expect(mockFlashNode).toHaveBeenCalledTimes(2);
    });

    it('should handle deeply nested selection', async () => {
      // Add another level of nesting
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: {},
      };
      state.nodes['node-3'].children = ['node-4'];
      state.ancestorRegistry['node-4'] = ['root', 'node-1', 'node-3'];

      // Select node-1, node-3, and node-4 - only node-1 should be kept
      state.multiSelectedNodeIds = new Set(['node-1', 'node-3', 'node-4']);

      await actions.copyNodes();

      expect(mockFlashNode).toHaveBeenCalledTimes(1);
      expect(mockFlashNode).toHaveBeenCalledWith('node-1', 'light');
    });
  });
});
