import { vi, type Mock } from 'vitest';
import type { DragEndEvent } from '@dnd-kit/core';
import type { TreeNode } from '@shared/types';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore, type TreeState } from '../../../../store/tree/treeStore';

export interface DragDropSpyActions {
  dropNode: Mock;
  getNodesToMove: Mock;
  clearSelection: Mock;
  addToSelection: Mock;
}

export interface MakeDragDropStoreOpts {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: Record<string, string[]>;
  multiSelectedNodeIds: Set<string>;
  nodesToMove: string[];
}

export function makeDragDropStore(
  opts: MakeDragDropStoreOpts,
): { store: TreeStore; spies: DragDropSpyActions } {
  const store = createTreeStore();
  const spies: DragDropSpyActions = {
    dropNode: vi.fn(),
    getNodesToMove: vi.fn(() => opts.nodesToMove),
    clearSelection: vi.fn(),
    addToSelection: vi.fn(),
  };
  store.setState({
    nodes: opts.nodes,
    rootNodeId: 'root',
    activeNodeId: null,
    cursorPosition: 0,
    rememberedVisualX: null,
    currentFilePath: null,
    fileMeta: null,
    multiSelectedNodeIds: opts.multiSelectedNodeIds,
    ancestorRegistry: opts.ancestorRegistry,
    actions: spies as unknown as TreeState['actions'],
  });
  return { store, spies };
}

export function makeStoreWrapper(store: TreeStore) {
  return function StoreWrapper({ children }: { children: React.ReactNode }) {
    return <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>;
  };
}

export function dragEndEvent(
  activeId: string,
  overId: string,
  dropPosition: 'before' | 'after' | 'child',
): DragEndEvent {
  return {
    active: { id: activeId } as DragEndEvent['active'],
    over: {
      id: overId,
      data: { current: { dropPosition } },
    } as unknown as DragEndEvent['over'],
    activatorEvent: new MouseEvent('mousedown'),
    collisions: null,
    delta: { x: 0, y: 0 },
  } as DragEndEvent;
}
