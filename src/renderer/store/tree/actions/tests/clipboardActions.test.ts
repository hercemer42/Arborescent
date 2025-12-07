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
type MockCacheType = { rootNodeIds: string[]; allCutNodeIds?: string[]; timestamp: number; isCut: boolean } | null;
let currentMockCache: MockCacheType = null;

vi.mock('../../../clipboard/clipboardCacheStore', () => ({
  useClipboardCacheStore: {
    getState: () => ({
      setCache: vi.fn((rootNodeIds: string[], isCut: boolean, allCutNodeIds?: string[]) => {
        currentMockCache = { rootNodeIds, allCutNodeIds, timestamp: Date.now(), isCut };
      }),
      getCache: vi.fn(() => currentMockCache),
      clearCache: vi.fn(() => {
        currentMockCache = null;
      }),
      hasCache: vi.fn(() => currentMockCache !== null),
    }),
  },
}));

// Mock hyperlink clipboard cache store
type MockHyperlinkCacheType = { nodeId: string; content: string; timestamp: number } | null;
let currentMockHyperlinkCache: MockHyperlinkCacheType = null;

vi.mock('../../../clipboard/hyperlinkClipboardStore', () => ({
  useHyperlinkClipboardStore: {
    getState: () => ({
      setCache: vi.fn((nodeId: string, content: string) => {
        currentMockHyperlinkCache = { nodeId, content, timestamp: Date.now() };
      }),
      getCache: vi.fn(() => currentMockHyperlinkCache),
      clearCache: vi.fn(() => {
        currentMockHyperlinkCache = null;
      }),
      hasCache: vi.fn(() => currentMockHyperlinkCache !== null),
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

  // Helper to check if a node is marked as cut via transient metadata
  function isNodeCut(nodeId: string): boolean {
    return state.nodes[nodeId]?.metadata.transient?.isCut === true;
  }

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

      it('should mark node as cut (not delete)', async () => {
        state.activeNodeId = 'node-2';

        await actions.cutNodes();

        // New behavior: cut marks nodes, doesn't delete them
        expect(isNodeCut('node-2')).toBe(true);
        expect(mockDeleteNode).not.toHaveBeenCalled();
        expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
      });

      it('should mark node and descendants as cut', async () => {
        state.activeNodeId = 'node-1';

        await actions.cutNodes();

        // node-1 and its child node-3 should both be marked as cut
        expect(isNodeCut('node-1')).toBe(true);
        expect(isNodeCut('node-3')).toBe(true);
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

      it('should mark all selected nodes as cut', async () => {
        state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

        await actions.cutNodes();

        // All selected nodes and descendants should be marked as cut
        expect(isNodeCut('node-1')).toBe(true);
        expect(isNodeCut('node-2')).toBe(true);
        expect(isNodeCut('node-3')).toBe(true); // child of node-1
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

    it('should clear previous cut state when cutting new nodes', async () => {
      // First cut
      state.activeNodeId = 'node-2';
      await actions.cutNodes();
      expect(isNodeCut('node-2')).toBe(true);

      // Second cut - should clear previous
      state.activeNodeId = 'node-1';
      await actions.cutNodes();
      expect(isNodeCut('node-2')).toBe(false);
      expect(isNodeCut('node-1')).toBe(true);
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

    it('should paste hyperlink when regular cache is empty and hyperlink cache exists', async () => {
      state.activeNodeId = 'node-1';
      // Empty clipboard and no regular cache
      mockClipboard.readText.mockResolvedValueOnce('');
      currentMockCache = null;
      // But has hyperlink cache
      currentMockHyperlinkCache = {
        nodeId: 'node-2',
        content: 'Task 2',
        timestamp: Date.now(),
      };

      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockExecuteCommand).toHaveBeenCalled();
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
      it('should paste from cache when nodes exist (copy)', async () => {
        // Setup cache referencing existing nodes (copy, not cut)
        currentMockCache = {
          rootNodeIds: ['node-1'],
          timestamp: Date.now(),
          isCut: false,
        };
        state.activeNodeId = 'node-2';

        const result = await actions.pasteNodes();

        expect(result).toBe('pasted');
        expect(mockExecuteCommand).toHaveBeenCalled();
        // Should NOT read from system clipboard when cache is available
        expect(mockClipboard.readText).not.toHaveBeenCalled();
      });

      it('should move nodes when pasting cut cache', async () => {
        // Setup cache as cut operation
        currentMockCache = {
          rootNodeIds: ['node-2'],
          allCutNodeIds: ['node-2'],
          timestamp: Date.now(),
          isCut: true,
        };
        // Mark node as cut via transient metadata
        state.nodes['node-2'] = {
          ...state.nodes['node-2'],
          metadata: { ...state.nodes['node-2'].metadata, transient: { isCut: true } },
        };
        state.activeNodeId = 'node-1'; // paste into node-1

        const result = await actions.pasteNodes();

        expect(result).toBe('pasted');
        expect(mockExecuteCommand).toHaveBeenCalled();
        // Cut state should be cleared
        expect(isNodeCut('node-2')).toBe(false);
      });

      it('should cancel when pasting cut nodes into same parent', async () => {
        // node-2 is already a child of root, pasting into root should be a no-op
        currentMockCache = {
          rootNodeIds: ['node-2'],
          allCutNodeIds: ['node-2'],
          timestamp: Date.now(),
          isCut: true,
        };
        // Mark node as cut via transient metadata
        state.nodes['node-2'] = {
          ...state.nodes['node-2'],
          metadata: { ...state.nodes['node-2'].metadata, transient: { isCut: true } },
        };
        state.activeNodeId = null; // paste into root (node-2's current parent)

        const result = await actions.pasteNodes();

        expect(result).toBe('cancelled');
        // Cut state should be cleared
        expect(isNodeCut('node-2')).toBe(false);
      });

      it('should fall back to clipboard when cache is empty', async () => {
        currentMockCache = null;
        currentMockHyperlinkCache = null; // Clear hyperlink cache too
        state.activeNodeId = 'node-1';
        mockClipboard.readText.mockResolvedValueOnce('# External Content');

        const result = await actions.pasteNodes();

        expect(result).toBe('pasted');
        expect(mockClipboard.readText).toHaveBeenCalled();
      });

      it('should fall back to clipboard when cached nodes no longer exist', async () => {
        // Cache references non-existent nodes (copy case)
        currentMockCache = {
          rootNodeIds: ['deleted-node'],
          timestamp: Date.now(),
          isCut: false,
        };
        currentMockHyperlinkCache = null; // Clear hyperlink cache too
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

  describe('blueprint validation on paste', () => {
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

    it('should block pasting blueprint nodes into non-blueprint parent', async () => {
      // Copy blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.copyNodes();

      // Try to paste into non-blueprint parent
      state.activeNodeId = 'normal-parent';
      const result = await actions.pasteNodes();

      expect(result).toBe('blocked');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot paste blueprint nodes into a non-blueprint parent',
        'error'
      );
    });

    it('should allow pasting blueprint nodes into blueprint parent', async () => {
      // Copy blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.copyNodes();

      // Paste into blueprint parent
      state.activeNodeId = 'blueprint-parent';
      const result = await actions.pasteNodes();

      expect(result).toBe('pasted');
      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('should block pasting blueprint nodes into root', async () => {
      // Copy blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.copyNodes();

      // Try to paste into root (no active node)
      state.activeNodeId = null;
      const result = await actions.pasteNodes();

      expect(result).toBe('blocked');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot paste blueprint nodes into a non-blueprint parent',
        'error'
      );
    });

    it('should allow pasting non-blueprint nodes anywhere', async () => {
      // Copy normal node
      state.activeNodeId = 'normal-parent';
      await actions.copyNodes();

      // Paste anywhere
      state.activeNodeId = 'root';
      await actions.pasteNodes();

      expect(mockAddToast).not.toHaveBeenCalled();
    });

    it('should block moving cut blueprint nodes into non-blueprint parent', async () => {
      // Cut blueprint node
      state.activeNodeId = 'blueprint-child';
      await actions.cutNodes();

      // Try to paste into non-blueprint parent
      state.activeNodeId = 'normal-parent';
      const result = await actions.pasteNodes();

      expect(result).toBe('blocked');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot move blueprint nodes into a non-blueprint parent',
        'error'
      );
      // Cut state should remain (not cleared on blocked paste)
      expect(isNodeCut('blueprint-child')).toBe(true);
    });
  });

  describe('hyperlink actions', () => {
    beforeEach(() => {
      // Reset hyperlink cache
      currentMockHyperlinkCache = null;
      mockAddToast.mockClear();
    });

    describe('copyAsHyperlink', () => {
      it('should return no-selection when no active node', () => {
        state.activeNodeId = null;

        const result = actions.copyAsHyperlink();

        expect(result).toBe('no-selection');
        expect(currentMockHyperlinkCache).toBeNull();
      });

      it('should cache node as hyperlink when active node exists', () => {
        state.activeNodeId = 'node-1';

        const result = actions.copyAsHyperlink();

        expect(result).toBe('copied');
        expect(currentMockHyperlinkCache).not.toBeNull();
        expect(currentMockHyperlinkCache?.nodeId).toBe('node-1');
        expect(currentMockHyperlinkCache?.content).toBe('Task 1');
      });

      it('should flash the copied node', () => {
        state.activeNodeId = 'node-2';

        actions.copyAsHyperlink();

        expect(mockFlashNode).toHaveBeenCalledWith('node-2', 'light');
      });

      it('should return no-selection when active node does not exist', () => {
        state.activeNodeId = 'non-existent';

        const result = actions.copyAsHyperlink();

        expect(result).toBe('no-selection');
      });
    });

    describe('pasteAsHyperlink', () => {
      it('should return no-content when no hyperlink cache', () => {
        currentMockHyperlinkCache = null;
        state.activeNodeId = 'node-1';

        const result = actions.pasteAsHyperlink();

        expect(result).toBe('no-content');
      });

      it('should paste hyperlink as child of active node', () => {
        currentMockHyperlinkCache = {
          nodeId: 'node-2',
          content: 'Task 2',
          timestamp: Date.now(),
        };
        state.activeNodeId = 'node-1';

        const result = actions.pasteAsHyperlink();

        expect(result).toBe('pasted');
        expect(mockExecuteCommand).toHaveBeenCalled();
      });

      it('should paste hyperlink as child of root when no active node', () => {
        currentMockHyperlinkCache = {
          nodeId: 'node-2',
          content: 'Task 2',
          timestamp: Date.now(),
        };
        state.activeNodeId = null;

        const result = actions.pasteAsHyperlink();

        expect(result).toBe('pasted');
        expect(mockExecuteCommand).toHaveBeenCalled();
      });

      it('should block pasting hyperlink into another hyperlink', () => {
        // Setup hyperlink node
        state.nodes['hyperlink-node'] = {
          id: 'hyperlink-node',
          content: 'Link to something',
          children: [],
          metadata: { isHyperlink: true, linkedNodeId: 'node-2' },
        };
        state.ancestorRegistry['hyperlink-node'] = ['root'];
        currentMockHyperlinkCache = {
          nodeId: 'node-1',
          content: 'Task 1',
          timestamp: Date.now(),
        };
        state.activeNodeId = 'hyperlink-node';

        const result = actions.pasteAsHyperlink();

        expect(result).toBe('no-content');
        expect(mockAddToast).toHaveBeenCalledWith(
          'Cannot add hyperlink as child of another hyperlink',
          'error'
        );
      });

      it('should flash the pasted hyperlink node', () => {
        currentMockHyperlinkCache = {
          nodeId: 'node-2',
          content: 'Task 2',
          timestamp: Date.now(),
        };
        state.activeNodeId = 'node-1';

        actions.pasteAsHyperlink();

        // Flash is called with the new node ID (UUID)
        expect(mockFlashNode).toHaveBeenCalled();
      });
    });

    describe('hasHyperlinkCache', () => {
      it('should return false when no cache', () => {
        currentMockHyperlinkCache = null;

        const result = actions.hasHyperlinkCache();

        expect(result).toBe(false);
      });

      it('should return true when cache exists', () => {
        currentMockHyperlinkCache = {
          nodeId: 'node-1',
          content: 'Task 1',
          timestamp: Date.now(),
        };

        const result = actions.hasHyperlinkCache();

        expect(result).toBe(true);
      });
    });

    describe('pasteNodes with hyperlinks', () => {
      it('should block pasting into hyperlink nodes', async () => {
        // Setup hyperlink node
        state.nodes['hyperlink-node'] = {
          id: 'hyperlink-node',
          content: 'Link to something',
          children: [],
          metadata: { isHyperlink: true, linkedNodeId: 'node-2' },
        };
        state.ancestorRegistry['hyperlink-node'] = ['root'];
        state.activeNodeId = 'hyperlink-node';

        // Setup clipboard with content
        mockClipboard.readText.mockResolvedValueOnce('# Pasted Node');

        const result = await actions.pasteNodes();

        expect(result).toBe('no-content');
        expect(mockAddToast).toHaveBeenCalledWith(
          'Cannot paste into a hyperlink node',
          'error'
        );
      });
    });
  });
});
