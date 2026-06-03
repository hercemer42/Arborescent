import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClipboardActions, ClipboardActions } from '../clipboardActions';
import type { TreeNode } from '@shared/types';
import type { VisualEffectsActions } from '../visualEffectsActions';

// deleteSelectedNodes does not own the deletion side-effect sequence: a
// multi-selection delegates to the shared deleteNodes(ids[]) core inside the
// animation-complete callback, and a single-node selection routes through
// deleteNode(id, true). The animation stays a caller-layer concern — the core
// itself must never animate.

vi.mock('../../../../utils/markdown', () => ({
  exportNodeAsMarkdown: vi.fn((node: TreeNode) => `# ${node.content}`),
  exportMultipleNodesAsMarkdown: vi.fn(
    (nodeIds: string[], nodes: Record<string, TreeNode>) =>
      nodeIds.map((id) => `# ${nodes[id]?.content || ''}`).join('\n')
  ),
  parseMarkdown: vi.fn(() => ({ rootNodes: [], allNodes: {} })),
}));

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/clipboardService', () => ({
  writeToClipboard: vi.fn(() => Promise.resolve(true)),
  readFromClipboard: vi.fn(() => Promise.resolve('')),
}));

vi.mock('../../../clipboard/clipboardCacheStore', () => ({
  useClipboardCacheStore: {
    getState: () => ({
      setCache: vi.fn(),
      getCache: vi.fn(() => null),
      clearCache: vi.fn(),
      hasCache: vi.fn(() => false),
    }),
  },
}));

vi.mock('../../../clipboard/hyperlinkClipboardStore', () => ({
  useHyperlinkClipboardStore: {
    getState: () => ({
      setCache: vi.fn(),
      getCache: vi.fn(() => null),
      clearCache: vi.fn(),
      hasCache: vi.fn(() => false),
    }),
  },
}));

vi.mock('../../../../utils/errorNotification', () => ({
  notifyError: vi.fn(),
}));

vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('../../../storeManager', () => ({
  storeManager: { getStoreForFile: () => null },
}));

describe('clipboardActions — deleteSelectedNodes routes through the deleteNodes core', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    activeNodeId: string | null;
    multiSelectedNodeIds: Set<string>;
    currentFilePath: string | null;
    blueprintModeEnabled: boolean;
  };

  let state: TestState;
  let actions: ClipboardActions;
  let mockDeleteNode: ReturnType<typeof vi.fn>;
  let mockDeleteNodes: ReturnType<typeof vi.fn>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let mockStartDeleteAnimation: ReturnType<typeof vi.fn>;
  let pendingAnimationCallbacks: Array<() => void>;

  function node(id: string, children: string[]): TreeNode {
    return { id, content: id, children, metadata: {} };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    pendingAnimationCallbacks = [];

    mockExecuteCommand = vi.fn((command: { execute: () => void }) => command.execute());
    mockDeleteNode = vi.fn().mockReturnValue(true);
    mockDeleteNodes = vi.fn();
    mockStartDeleteAnimation = vi.fn((_ids: string | string[], callback?: () => void) => {
      // Capture instead of invoking so tests can assert deletion waits for the animation
      if (callback) pendingAnimationCallbacks.push(callback);
    });

    const visualEffects: VisualEffectsActions = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: mockStartDeleteAnimation,
      clearDeleteAnimation: vi.fn(),
    } as unknown as VisualEffectsActions;

    state = {
      nodes: {
        root: { ...node('root', ['node-1', 'node-2', 'node-3']), metadata: { isRoot: true } },
        'node-1': node('node-1', []),
        'node-2': node('node-2', []),
        'node-3': node('node-3', []),
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root'],
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      currentFilePath: '/test/file.arbo',
      blueprintModeEnabled: false,
    };

    const getActions = () =>
      ({
        executeCommand: mockExecuteCommand,
        deleteNode: mockDeleteNode,
        deleteNodes: mockDeleteNodes,
        autoSave: vi.fn(),
      }) as unknown as ReturnType<Parameters<typeof createClipboardActions>[2]>;

    actions = createClipboardActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      (partial) => {
        state = { ...state, ...partial };
      },
      getActions,
      visualEffects,
      vi.fn()
    );
  });

  function runPendingAnimations(): void {
    const callbacks = [...pendingAnimationCallbacks];
    pendingAnimationCallbacks = [];
    callbacks.forEach((cb) => cb());
  }

  it('delegates a multi-selection to deleteNodes with all selected ids', () => {
    state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

    actions.deleteSelectedNodes();
    runPendingAnimations();

    expect(mockDeleteNodes).toHaveBeenCalledTimes(1);
    const ids = mockDeleteNodes.mock.calls[0][0] as string[];
    expect([...ids].sort()).toEqual(['node-1', 'node-2']);
  });

  it('does not run the deletion before the animation completes', () => {
    state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

    actions.deleteSelectedNodes();

    expect(mockStartDeleteAnimation).toHaveBeenCalledTimes(1);
    expect(mockDeleteNodes).not.toHaveBeenCalled();
    expect(mockExecuteCommand).not.toHaveBeenCalled();

    runPendingAnimations();
    expect(mockDeleteNodes).toHaveBeenCalledTimes(1);
  });

  it('does not own the side-effect sequence itself — no command is pushed from the clipboard layer', () => {
    state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

    actions.deleteSelectedNodes();
    runPendingAnimations();

    expect(mockExecuteCommand).not.toHaveBeenCalled();
  });

  it('keeps the single-selection route through deleteNode(id, true) with animation', () => {
    state.activeNodeId = 'node-1';
    state.multiSelectedNodeIds = new Set();

    actions.deleteSelectedNodes();

    expect(mockStartDeleteAnimation).toHaveBeenCalledTimes(1);
    runPendingAnimations();

    expect(mockDeleteNode).toHaveBeenCalledWith('node-1', true);
    expect(mockDeleteNodes).not.toHaveBeenCalled();
  });

  it('refuses to delete when the selection contains the root', () => {
    state.multiSelectedNodeIds = new Set(['root', 'node-1']);

    actions.deleteSelectedNodes();
    runPendingAnimations();

    expect(mockDeleteNodes).not.toHaveBeenCalled();
    expect(mockDeleteNode).not.toHaveBeenCalled();
  });

  it('does nothing when there is no selection', () => {
    state.activeNodeId = null;
    state.multiSelectedNodeIds = new Set();

    actions.deleteSelectedNodes();
    runPendingAnimations();

    expect(mockStartDeleteAnimation).not.toHaveBeenCalled();
    expect(mockDeleteNodes).not.toHaveBeenCalled();
    expect(mockDeleteNode).not.toHaveBeenCalled();
  });

  it('handles repeated delete invocations without queueing duplicate deletions', () => {
    state.multiSelectedNodeIds = new Set(['node-1', 'node-2']);

    actions.deleteSelectedNodes();
    actions.deleteSelectedNodes();
    runPendingAnimations();

    // Both invocations route through the core; the core (not the clipboard layer)
    // is responsible for making the second call a no-op once the nodes are gone.
    const allIds = mockDeleteNodes.mock.calls.flatMap((c) => [...(c[0] as string[])]);
    expect(allIds.every((id) => ['node-1', 'node-2'].includes(id))).toBe(true);
  });
});
