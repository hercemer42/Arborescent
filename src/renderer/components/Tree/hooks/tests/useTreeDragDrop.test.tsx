import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeDragDrop } from '../useTreeDragDrop';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';
import type { DragEndEvent } from '@dnd-kit/core';

// These tests pin the order-preservation contract for multi-node drag-drop.
// The bug: dragging A, B, C onto a target X with dropZone 'after' or 'child'
// reverses them because each per-node call lands at the same target offset.
// Fix is in handleDragEnd's iteration order; these tests assert the per-call
// order on actions.dropNode rather than the final tree state, so they remain
// stable regardless of how the dropNode action itself implements the moves.

vi.mock('../../../../services/storageService');

interface SpyActions {
  dropNode: ReturnType<typeof vi.fn>;
  getNodesToMove: ReturnType<typeof vi.fn>;
  clearSelection: ReturnType<typeof vi.fn>;
  addToSelection: ReturnType<typeof vi.fn>;
}

function makeStore(opts: {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: Record<string, string[]>;
  multiSelectedNodeIds: Set<string>;
  nodesToMove: string[];
}): { store: TreeStore; spies: SpyActions } {
  const store = createTreeStore();
  const spies: SpyActions = {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    actions: spies as any,
  });
  return { store, spies };
}

function makeWrapper(store: TreeStore) {
  function StoreWrapper({ children }: { children: React.ReactNode }) {
    return <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>;
  }
  return StoreWrapper;
}

function dragEndEvent(activeId: string, overId: string, dropPosition: 'before' | 'after' | 'child'): DragEndEvent {
  return {
    active: { id: activeId } as DragEndEvent['active'],
    over: {
      id: overId,
      data: { current: { dropPosition } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any as DragEndEvent['over'],
    activatorEvent: new MouseEvent('mousedown'),
    collisions: null,
    delta: { x: 0, y: 0 },
  } as DragEndEvent;
}

describe('useTreeDragDrop — multi-node order preservation', () => {
  const SOURCE_ORDER = ['node-a', 'node-b', 'node-c'];

  function basicTreeWithSeparateTarget(): {
    nodes: Record<string, TreeNode>;
    ancestorRegistry: Record<string, string[]>;
  } {
    return {
      nodes: {
        root: { id: 'root', content: 'Root', children: ['node-a', 'node-b', 'node-c', 'node-x'], metadata: {} },
        'node-a': { id: 'node-a', content: 'A', children: [], metadata: {} },
        'node-b': { id: 'node-b', content: 'B', children: [], metadata: {} },
        'node-c': { id: 'node-c', content: 'C', children: [], metadata: {} },
        'node-x': { id: 'node-x', content: 'X', children: [], metadata: {} },
      },
      ancestorRegistry: {
        root: [],
        'node-a': ['root'],
        'node-b': ['root'],
        'node-c': ['root'],
        'node-x': ['root'],
      },
    };
  }

  let setup: ReturnType<typeof makeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path: three siblings dropped onto a target', () => {
    it("'before' zone calls dropNode in source order (A, B, C) so they land before X in source order", () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(SOURCE_ORDER),
        nodesToMove: SOURCE_ORDER,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'node-x', 'before'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).toEqual(['node-a', 'node-b', 'node-c']);
    });

    it("'after' zone calls dropNode in REVERSE source order (C, B, A) so they end up after X in source order", () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(SOURCE_ORDER),
        nodesToMove: SOURCE_ORDER,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'node-x', 'after'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).toEqual(['node-c', 'node-b', 'node-a']);
    });

    it("'child' zone calls dropNode in REVERSE source order (C, B, A) so they end up as children of X in source order", () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(SOURCE_ORDER),
        nodesToMove: SOURCE_ORDER,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'node-x', 'child'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).toEqual(['node-c', 'node-b', 'node-a']);
    });
  });

  describe('single-node drag is unaffected', () => {
    it("does not reverse a one-node drag for 'after' zone", () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(),
        nodesToMove: ['node-a'],
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'node-x', 'after'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).toEqual(['node-a']);
    });

    it("does not reverse a one-node drag for 'child' zone", () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(),
        nodesToMove: ['node-a'],
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'node-x', 'child'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).toEqual(['node-a']);
    });
  });

  describe('invalid drops are filtered before the iteration order is decided', () => {
    it("'child' zone: a node that would create a cycle is skipped, the rest stay in correct reversed order", () => {
      // Drop A, B, C as children of `target`. `target` is a descendant of B,
      // so dropping B onto target would create a cycle and isValidDrop
      // returns false for B alone. The remaining valid nodes (A, C) must
      // be iterated in reverse source order: [C, A].
      const nodes: Record<string, TreeNode> = {
        root: { id: 'root', content: 'Root', children: ['node-a', 'node-b', 'node-c'], metadata: {} },
        'node-a': { id: 'node-a', content: 'A', children: [], metadata: {} },
        'node-b': { id: 'node-b', content: 'B', children: ['target'], metadata: {} },
        'node-c': { id: 'node-c', content: 'C', children: [], metadata: {} },
        target: { id: 'target', content: 'T', children: [], metadata: {} },
      };
      const ancestorRegistry: Record<string, string[]> = {
        root: [],
        'node-a': ['root'],
        'node-b': ['root'],
        'node-c': ['root'],
        target: ['root', 'node-b'],
      };
      const selection = ['node-a', 'node-b', 'node-c'];
      setup = makeStore({
        nodes,
        ancestorRegistry,
        multiSelectedNodeIds: new Set(selection),
        nodesToMove: selection,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'target', 'child'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).not.toContain('node-b');
      expect(callOrder).toEqual(['node-c', 'node-a']);
    });
  });

  describe('drop into a separate parent (cross-parent multi-drag)', () => {
    it("'child' zone with three sources from one parent dropped into another preserves source order", () => {
      const nodes: Record<string, TreeNode> = {
        root: { id: 'root', content: 'Root', children: ['parent-a', 'parent-b'], metadata: {} },
        'parent-a': { id: 'parent-a', content: 'PA', children: ['node-a', 'node-b', 'node-c'], metadata: {} },
        'parent-b': { id: 'parent-b', content: 'PB', children: ['existing-1'], metadata: {} },
        'node-a': { id: 'node-a', content: 'A', children: [], metadata: {} },
        'node-b': { id: 'node-b', content: 'B', children: [], metadata: {} },
        'node-c': { id: 'node-c', content: 'C', children: [], metadata: {} },
        'existing-1': { id: 'existing-1', content: 'E1', children: [], metadata: {} },
      };
      const ancestorRegistry: Record<string, string[]> = {
        root: [],
        'parent-a': ['root'],
        'parent-b': ['root'],
        'node-a': ['root', 'parent-a'],
        'node-b': ['root', 'parent-a'],
        'node-c': ['root', 'parent-a'],
        'existing-1': ['root', 'parent-b'],
      };
      setup = makeStore({
        nodes,
        ancestorRegistry,
        multiSelectedNodeIds: new Set(SOURCE_ORDER),
        nodesToMove: SOURCE_ORDER,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'parent-b', 'child'));

      const callOrder = setup.spies.dropNode.mock.calls.map(c => c[0]);
      expect(callOrder).toEqual(['node-c', 'node-b', 'node-a']);
    });
  });

  describe('no-op cases', () => {
    it('drops onto self do not call dropNode at all', () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(SOURCE_ORDER),
        nodesToMove: SOURCE_ORDER,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd(dragEndEvent('node-a', 'node-a', 'before'));

      expect(setup.spies.dropNode).not.toHaveBeenCalled();
    });

    it('drag without an over target does not call dropNode', () => {
      const tree = basicTreeWithSeparateTarget();
      setup = makeStore({
        ...tree,
        multiSelectedNodeIds: new Set(SOURCE_ORDER),
        nodesToMove: SOURCE_ORDER,
      });

      const { result } = renderHook(() => useTreeDragDrop(), { wrapper: makeWrapper(setup.store) });
      result.current.handleDragEnd({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        active: { id: 'node-a' } as any as DragEndEvent['active'],
        over: null,
        activatorEvent: new MouseEvent('mousedown'),
        collisions: null,
        delta: { x: 0, y: 0 },
      } as DragEndEvent);

      expect(setup.spies.dropNode).not.toHaveBeenCalled();
    });
  });
});
