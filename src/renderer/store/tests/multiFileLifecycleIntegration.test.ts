import { describe, it, expect, vi, beforeEach } from 'vitest';

// Behavior-pinning integration tests for Story 2 (decouple storeManager
// service-locator). These run against the REAL storeManager and REAL tree
// stores — only the peripheral stores touched by closeFile are mocked — so
// they must pass identically before and after the accessor-injection
// refactor. They pin the observable contract the refactor must preserve:
// lazy store creation order, zoom-path resolution, multi-file close/save
// independence, and cross-file paste reaching the source store through the
// manager.

const mockCloseFileTerminals = vi.fn().mockResolvedValue(undefined);
const mockCloseFileBrowserTabs = vi.fn();
const mockRemoveFileState = vi.fn();

vi.mock('../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      closeFileTerminals: mockCloseFileTerminals,
      fileStates: {},
    }),
  },
  setTerminalSessionResolver: vi.fn(),
}));

vi.mock('../browser/browserStore', () => ({
  useBrowserStore: {
    getState: () => ({ actions: { closeFileBrowserTabs: mockCloseFileBrowserTabs } }),
  },
}));

vi.mock('../panel/panelStore', () => ({
  usePanelStore: {
    getState: () => ({ removeFileState: mockRemoveFileState }),
  },
}));

vi.mock('../tabIndicators/tabIndicatorStore', () => ({
  useTabIndicatorStore: {
    getState: () => ({ removeIndicator: vi.fn(), updateIndicator: vi.fn() }),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

import { storeManager } from '../storeManager';
import { TreeStore } from '../tree/treeStore';
import { handleCutPaste, handleCopyPaste, PasteContext } from '../tree/actions/clipboardPasteHandlers';
import { useClipboardCacheStore, ClipboardCacheContent } from '../clipboard/clipboardCacheStore';
import type { TreeNode } from '../../../shared/types';

function makeNodes(prefix: string): { nodes: Record<string, TreeNode>; rootId: string } {
  const rootId = `${prefix}-root`;
  return {
    rootId,
    nodes: {
      [rootId]: { id: rootId, content: `${prefix} root`, children: [`${prefix}-a`, `${prefix}-b`], metadata: {} },
      [`${prefix}-a`]: { id: `${prefix}-a`, content: `${prefix} a`, children: [], metadata: { status: 'pending' } },
      [`${prefix}-b`]: { id: `${prefix}-b`, content: `${prefix} b`, children: [], metadata: { status: 'pending' } },
    },
  };
}

function seedStore(filePath: string, prefix: string): TreeStore {
  const store = storeManager.getStoreForFile(filePath);
  const { nodes, rootId } = makeNodes(prefix);
  store.getState().actions.initialize(nodes, rootId);
  return store;
}

function makeCache(overrides: Partial<ClipboardCacheContent>): ClipboardCacheContent {
  return {
    rootNodeIds: [],
    isCut: false,
    clipboardText: '',
    timestamp: Date.now(),
    ...overrides,
  };
}

function makePasteContext(targetStore: TreeStore, targetParentId: string): PasteContext & { clearCutState: ReturnType<typeof vi.fn> } {
  const get = () => {
    const s = targetStore.getState();
    return {
      nodes: s.nodes,
      rootNodeId: s.rootNodeId,
      ancestorRegistry: s.ancestorRegistry,
      currentFilePath: s.currentFilePath,
    };
  };
  return {
    state: get(),
    targetParentId,
    actions: { executeCommand: targetStore.getState().actions.executeCommand },
    get,
    set: (partial) => targetStore.setState(partial),
    triggerAutosave: undefined,
    visualEffects: {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    },
    clearCutState: vi.fn(),
    getStoreForFile: (filePath: string) => storeManager.getStoreForFile(filePath),
  };
}

describe('multi-file lifecycle integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeManager.clearAll();
    useClipboardCacheStore.getState().clearCache();
  });

  describe('store init order', () => {
    it('creates stores lazily on first access', () => {
      expect(storeManager.hasStore('/a.arbo')).toBe(false);
      expect(storeManager.getAllStores()).toHaveLength(0);

      storeManager.getStoreForFile('/a.arbo');

      expect(storeManager.hasStore('/a.arbo')).toBe(true);
      expect(storeManager.getAllStores()).toHaveLength(1);
    });

    it('wires a store fully at creation — actions usable before any other store exists', () => {
      const store = seedStore('/a.arbo', 'a');

      store.getState().actions.updateStatus('a-a', 'completed');

      expect(store.getState().nodes['a-a'].metadata.status).toBe('completed');
    });

    it('exposes stores created later to earlier stores via getAllStores', () => {
      const first = storeManager.getStoreForFile('/first.arbo');

      // getAllStores must be read lazily — the refactor injects this accessor
      // and this pins that a snapshot taken at first-store creation is wrong
      const before = storeManager.getAllStores();
      const second = storeManager.getStoreForFile('/second.arbo');
      const after = storeManager.getAllStores();

      expect(before).toHaveLength(1);
      expect(after).toHaveLength(2);
      expect(after[0]).toBe(first);
      expect(after[1]).toBe(second);
    });

    it('yields a fresh empty store after clearAll', () => {
      const original = seedStore('/a.arbo', 'a');
      storeManager.clearAll();

      const recreated = storeManager.getStoreForFile('/a.arbo');

      expect(recreated).not.toBe(original);
      expect(Object.keys(recreated.getState().nodes)).toHaveLength(0);
    });
  });

  describe('zoom path resolution', () => {
    it('resolves a zoom:// path to the same store instance as the source file', () => {
      const sourceStore = storeManager.getStoreForFile('/project.arbo');

      const zoomStore = storeManager.getStoreForFile('zoom:///project.arbo#node-1');

      expect(zoomStore).toBe(sourceStore);
    });

    it('registers a store opened via zoom path under the source path, not the zoom path', () => {
      storeManager.getStoreForFile('zoom:///project.arbo#node-1');

      expect(storeManager.hasStore('/project.arbo')).toBe(true);
      expect(storeManager.hasStore('zoom:///project.arbo#node-1')).toBe(false);
    });

    it('makes edits through a zoom-resolved store visible in the source store', () => {
      const sourceStore = seedStore('/project.arbo', 'p');
      const zoomStore = storeManager.getStoreForFile('zoom:///project.arbo#p-a');

      zoomStore.getState().actions.updateStatus('p-a', 'completed');

      expect(sourceStore.getState().nodes['p-a'].metadata.status).toBe('completed');
    });

    it('leaves the source store intact when closing a zoom path', async () => {
      seedStore('/project.arbo', 'p');

      await storeManager.closeFile('zoom:///project.arbo#p-a');

      expect(storeManager.hasStore('/project.arbo')).toBe(true);
      expect(storeManager.getStoreForFile('/project.arbo').getState().nodes['p-a']).toBeDefined();
    });
  });

  describe('multi-file open/close/save', () => {
    it('saves the closed file and leaves other open files untouched', async () => {
      const storeA = seedStore('/a.arbo', 'a');
      const storeB = seedStore('/b.arbo', 'b');
      const mockSaveToPath = vi.fn().mockResolvedValue(undefined);
      storeA.setState({
        currentFilePath: '/a.arbo',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: { ...storeA.getState().actions, saveToPath: mockSaveToPath } as any,
      });

      await storeManager.closeFile('/a.arbo');

      expect(mockSaveToPath).toHaveBeenCalledWith('/a.arbo', undefined);
      expect(storeManager.hasStore('/a.arbo')).toBe(false);
      expect(storeManager.hasStore('/b.arbo')).toBe(true);
      expect(storeB.getState().nodes['b-a'].content).toBe('b a');
    });

    it('still removes the store when the save on close fails, without disturbing other files', async () => {
      const storeA = seedStore('/a.arbo', 'a');
      seedStore('/b.arbo', 'b');
      const mockSaveToPath = vi.fn().mockRejectedValue(new Error('disk full'));
      storeA.setState({
        currentFilePath: '/a.arbo',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        actions: { ...storeA.getState().actions, saveToPath: mockSaveToPath } as any,
      });

      await expect(storeManager.closeFile('/a.arbo')).resolves.not.toThrow();

      expect(storeManager.hasStore('/a.arbo')).toBe(false);
      expect(storeManager.hasStore('/b.arbo')).toBe(true);
    });

    it('moves a store to its saved path without disturbing other files', () => {
      const storeA = seedStore('/tmp/untitled-1.arbo', 'a');
      const storeB = seedStore('/b.arbo', 'b');

      storeManager.moveStore('/tmp/untitled-1.arbo', '/saved/a.arbo');

      expect(storeManager.hasStore('/tmp/untitled-1.arbo')).toBe(false);
      expect(storeManager.getStoreForFile('/saved/a.arbo')).toBe(storeA);
      expect(storeManager.getStoreForFile('/b.arbo')).toBe(storeB);
      const entries = storeManager.getAllStoreEntries().map(e => e.filePath);
      expect(entries).toContain('/saved/a.arbo');
      expect(entries).toContain('/b.arbo');
    });

    it('closes files independently — closing both leaves no stores behind', async () => {
      seedStore('/a.arbo', 'a');
      seedStore('/b.arbo', 'b');

      await storeManager.closeFile('/a.arbo');
      await storeManager.closeFile('/b.arbo');

      expect(storeManager.getAllStores()).toHaveLength(0);
    });
  });

  describe('cross-file paste through the store manager', () => {
    it('copy-paste pulls source nodes via the store manager and clones them into the target', () => {
      const sourceStore = seedStore('/source.arbo', 'src');
      const targetStore = seedStore('/target.arbo', 'tgt');
      targetStore.getState().actions.setFilePath('/target.arbo');
      const ctx = makePasteContext(targetStore, 'tgt-root');

      const result = handleCopyPaste(
        makeCache({ rootNodeIds: ['src-a'], isCut: false, sourceFilePath: '/source.arbo' }),
        ctx,
      );

      expect(result).toBe('pasted');
      const targetChildren = targetStore.getState().nodes['tgt-root'].children;
      expect(targetChildren).toHaveLength(3);
      const pastedId = targetChildren.find(id => !['tgt-a', 'tgt-b'].includes(id))!;
      expect(pastedId).not.toBe('src-a');
      expect(targetStore.getState().nodes[pastedId].content).toBe('src a');
      // copy leaves the source untouched
      expect(sourceStore.getState().nodes['src-a']).toBeDefined();
    });

    it('cut-paste moves nodes into the target and deletes them from the source store', () => {
      const sourceStore = seedStore('/source.arbo', 'src');
      const targetStore = seedStore('/target.arbo', 'tgt');
      targetStore.getState().actions.setFilePath('/target.arbo');
      const ctx = makePasteContext(targetStore, 'tgt-root');

      const result = handleCutPaste(
        makeCache({ rootNodeIds: ['src-a'], isCut: true, sourceFilePath: '/source.arbo' }),
        ctx,
      );

      expect(result).toBe('pasted');
      const targetChildren = targetStore.getState().nodes['tgt-root'].children;
      expect(targetChildren).toHaveLength(3);
      const movedId = targetChildren.find(id => !['tgt-a', 'tgt-b'].includes(id))!;
      expect(targetStore.getState().nodes[movedId].content).toBe('src a');
      expect(sourceStore.getState().nodes['src-a']).toBeUndefined();
      expect(sourceStore.getState().nodes['src-root'].children).toEqual(['src-b']);
      expect(ctx.clearCutState).toHaveBeenCalled();
    });

    it('reports no-content when the cut source nodes no longer exist in the source store', () => {
      seedStore('/source.arbo', 'src');
      const targetStore = seedStore('/target.arbo', 'tgt');
      targetStore.getState().actions.setFilePath('/target.arbo');
      const ctx = makePasteContext(targetStore, 'tgt-root');

      const result = handleCutPaste(
        makeCache({ rootNodeIds: ['src-deleted'], isCut: true, sourceFilePath: '/source.arbo' }),
        ctx,
      );

      expect(result).toBe('no-content');
      expect(ctx.clearCutState).toHaveBeenCalled();
      expect(targetStore.getState().nodes['tgt-root'].children).toHaveLength(2);
    });

    it('returns null for a copy cache with no root node ids and leaves both stores untouched', () => {
      const sourceStore = seedStore('/source.arbo', 'src');
      const targetStore = seedStore('/target.arbo', 'tgt');
      targetStore.getState().actions.setFilePath('/target.arbo');
      const ctx = makePasteContext(targetStore, 'tgt-root');

      const result = handleCopyPaste(
        makeCache({ rootNodeIds: [], isCut: false, sourceFilePath: '/source.arbo' }),
        ctx,
      );

      expect(result).toBeNull();
      expect(targetStore.getState().nodes['tgt-root'].children).toHaveLength(2);
      expect(sourceStore.getState().nodes['src-root'].children).toHaveLength(2);
    });

    it('creates distinct clones on repeated cross-file copy-paste of the same nodes', () => {
      seedStore('/source.arbo', 'src');
      const targetStore = seedStore('/target.arbo', 'tgt');
      targetStore.getState().actions.setFilePath('/target.arbo');

      handleCopyPaste(makeCache({ rootNodeIds: ['src-a'], isCut: false, sourceFilePath: '/source.arbo' }), makePasteContext(targetStore, 'tgt-root'));
      handleCopyPaste(makeCache({ rootNodeIds: ['src-a'], isCut: false, sourceFilePath: '/source.arbo' }), makePasteContext(targetStore, 'tgt-root'));

      const children = targetStore.getState().nodes['tgt-root'].children;
      expect(children).toHaveLength(4);
      const cloneIds = children.filter(id => !['tgt-a', 'tgt-b'].includes(id));
      expect(cloneIds).toHaveLength(2);
      expect(cloneIds[0]).not.toBe(cloneIds[1]);
      expect(targetStore.getState().nodes[cloneIds[0]].content).toBe('src a');
      expect(targetStore.getState().nodes[cloneIds[1]].content).toBe('src a');
    });
  });

  describe('accessor injection contract (post-refactor shape uncertain)', () => {
    it.todo('clipboard paste handlers receive getStoreForFile as an injected accessor instead of importing the singleton');
    it.todo('fileActions receives the lifecycle accessor subset (moveStore, closeFile, hasStore) as injected params');
    it.todo('createTreeStore receives getAllStores for autoSave wiring instead of closing over the singleton');
  });
});
