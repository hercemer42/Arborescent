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

// Mock clipboard cache store
type MockCacheType = { rootNodeIds: string[]; timestamp: number } | null;
let currentMockCache: MockCacheType = null;

vi.mock('../../../clipboard/clipboardCacheStore', () => ({
  useClipboardCacheStore: {
    getState: () => ({
      setCache: vi.fn((rootNodeIds: string[]) => {
        currentMockCache = { rootNodeIds, timestamp: Date.now() };
      }),
      getCache: vi.fn(() => currentMockCache),
      clearCache: vi.fn(() => {
        currentMockCache = null;
      }),
      hasCache: vi.fn(() => currentMockCache !== null),
    }),
  },
}));

// Mock error notification
vi.mock('../../../../utils/errorNotification', () => ({
  notifyError: vi.fn(),
}));

// Mock toast store
const mockAddToast = vi.fn();
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
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
    // Clear the clipboard cache for each test
    currentMockCache = null;

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

        expect(mockFlashNode).toHaveBeenCalledWith(['node-2'], 'light');
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

      it('should flash all selected nodes', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        await actions.copyNodes();

        // flashNode is now called once with all node IDs as an array
        expect(mockFlashNode).toHaveBeenCalledWith(['node-1', 'node-2'], 'light');
        expect(mockFlashNode).toHaveBeenCalledTimes(1);
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

      it('should use command for multi-selection delete', () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        actions.deleteSelectedNodes();

        expect(mockExecuteCommand).toHaveBeenCalled();
      });

      it('should start delete animation with all selections', () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        actions.deleteSelectedNodes();

        expect(mockStartDeleteAnimation).toHaveBeenCalledWith(
          expect.arrayContaining(['node-1', 'node-2']),
          expect.any(Function)
        );
      });
    });
  });

  describe('root node protection', () => {
    beforeEach(() => {
      // Mark root node with isRoot metadata
      state.nodes.root.metadata = { isRoot: true };
    });

    it('should fail cut if root node is selected', async () => {
      state.activeNodeId = 'root';

      const result = await actions.cutNodes();

      expect(result).toBe('no-selection');
      expect(mockClipboard.writeText).not.toHaveBeenCalled();
    });

    it('should fail delete if root node is selected', () => {
      state.activeNodeId = 'root';

      const result = actions.deleteSelectedNodes();

      expect(result).toBe('no-selection');
      expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
    });

    it('should allow copying root node', async () => {
      state.activeNodeId = 'root';

      const result = await actions.copyNodes();

      expect(result).toBe('copied');
      expect(mockClipboard.writeText).toHaveBeenCalled();
    });

    it('should fail cut if root is in multi-selection (indicates bug)', async () => {
      state.multiSelectedNodeIds = new Set(['root', 'node-1']);

      const result = await actions.cutNodes();

      // Any selection containing root should fail entirely
      expect(result).toBe('no-selection');
      expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
    });

    it('should fail delete if root is in multi-selection (indicates bug)', () => {
      state.multiSelectedNodeIds = new Set(['root', 'node-1']);

      const result = actions.deleteSelectedNodes();

      // Any selection containing root should fail entirely
      expect(result).toBe('no-selection');
      expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
    });
  });

  describe('dual clipboard mechanism', () => {
    beforeEach(() => {
      // Clear the mock cache before each test
      currentMockCache = null;
    });

    describe('copy caching', () => {
      it('should cache nodes when copying', async () => {
        state.activeNodeId = 'node-1';

        await actions.copyNodes();

        // Cache should have been set
        expect(currentMockCache).not.toBeNull();
        expect(currentMockCache?.rootNodeIds).toContain('node-1');
      });

      it('should cache multi-selection', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        await actions.copyNodes();

        // Should include all root selections
        expect(currentMockCache?.rootNodeIds).toContain('node-1');
        expect(currentMockCache?.rootNodeIds).toContain('node-2');
      });
    });

    describe('cut caching', () => {
      it('should cache node IDs when cutting', async () => {
        state.activeNodeId = 'node-2';

        await actions.cutNodes();

        expect(currentMockCache).not.toBeNull();
        expect(currentMockCache?.rootNodeIds).toContain('node-2');
      });
    });

    describe('paste from cache', () => {
      it('should paste from cache when nodes exist', async () => {
        // Setup cache referencing existing nodes
        currentMockCache = {
          rootNodeIds: ['node-1'],
          timestamp: Date.now(),
        };
        state.activeNodeId = 'node-2';

        const result = await actions.pasteNodes();

        expect(result).toBe('pasted');
        expect(mockExecuteCommand).toHaveBeenCalled();
        // Should NOT read from system clipboard when cache is available
        expect(mockClipboard.readText).not.toHaveBeenCalled();
      });

      it('should fall back to clipboard when cache is empty', async () => {
        currentMockCache = null;
        state.activeNodeId = 'node-1';
        mockClipboard.readText.mockResolvedValueOnce('# External Content');

        const result = await actions.pasteNodes();

        expect(result).toBe('pasted');
        expect(mockClipboard.readText).toHaveBeenCalled();
      });

      it('should fall back to clipboard when cached nodes no longer exist', async () => {
        // Cache references non-existent nodes
        currentMockCache = {
          rootNodeIds: ['deleted-node'],
          timestamp: Date.now(),
        };
        state.activeNodeId = 'node-1';
        mockClipboard.readText.mockResolvedValueOnce('# External Content');

        const result = await actions.pasteNodes();

        expect(result).toBe('pasted');
        expect(mockClipboard.readText).toHaveBeenCalled();
      });
    });

    describe('cache replacement', () => {
      it('should replace cache on new copy', async () => {
        // First copy
        state.activeNodeId = 'node-1';
        await actions.copyNodes();
        const firstCache = currentMockCache;

        // Second copy
        state.activeNodeId = 'node-2';
        await actions.copyNodes();

        // Cache should have been replaced
        expect(currentMockCache).not.toBe(firstCache);
        expect(currentMockCache?.rootNodeIds).toContain('node-2');
        expect(currentMockCache?.rootNodeIds).not.toContain('node-1');
      });
    });
  });

  describe('blueprint flag stripping on paste', () => {
    beforeEach(() => {
      mockAddToast.mockClear();

      // Setup blueprint nodes for testing
      state.nodes = {
        root: {
          id: 'root',
          content: 'Root',
          children: ['blueprint-parent', 'normal-parent'],
          metadata: { isRoot: true },
        },
        'blueprint-parent': {
          id: 'blueprint-parent',
          content: 'Blueprint Parent',
          children: ['blueprint-child'],
          metadata: { isBlueprint: true, blueprintIcon: 'star', blueprintColor: '#ff0000' },
        },
        'blueprint-child': {
          id: 'blueprint-child',
          content: 'Blueprint Child',
          children: [],
          metadata: { isBlueprint: true, blueprintIcon: 'circle', blueprintColor: '#00ff00' },
        },
        'normal-parent': {
          id: 'normal-parent',
          content: 'Normal Parent',
          children: [],
          metadata: {},
        },
      };
      state.ancestorRegistry = {
        root: [],
        'blueprint-parent': ['root'],
        'blueprint-child': ['root', 'blueprint-parent'],
        'normal-parent': ['root'],
      };
    });

    it('should strip blueprint flags when pasting into non-blueprint parent', async () => {
      // Copy blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.copyNodes();

      // Paste into non-blueprint parent
      state.activeNodeId = 'normal-parent';
      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Blueprint status removed from pasted nodes',
        'info'
      );
    });

    it('should preserve blueprint flags when pasting into blueprint parent', async () => {
      // Copy blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.copyNodes();

      // Paste into blueprint parent
      state.activeNodeId = 'blueprint-parent';
      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('should strip blueprint flags when pasting into root', async () => {
      // Copy blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.copyNodes();

      // Paste into root (no active node)
      state.activeNodeId = null;
      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Blueprint status removed from pasted nodes',
        'info'
      );
    });

    it('should not show toast when pasting non-blueprint nodes', async () => {
      // Copy normal node
      state.activeNodeId = 'normal-parent';
      await actions.copyNodes();

      // Paste anywhere
      state.activeNodeId = 'root';
      await actions.pasteNodes();

      expect(mockAddToast).not.toHaveBeenCalled();
    });
  });
});
