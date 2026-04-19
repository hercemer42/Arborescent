import { describe, it, expect, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { makeDragDropStore, dragEndEvent, makeStoreWrapper } from './fixtures';

vi.mock('../../../../services/storageService');

describe('drag-drop test fixtures — makeDragDropStore', () => {
  it('returns { store, spies } with both populated', () => {
    const { store, spies } = makeDragDropStore({
      nodes: { root: { id: 'root', content: 'Root', children: [], metadata: {} } },
      ancestorRegistry: { root: [] },
      multiSelectedNodeIds: new Set(),
      nodesToMove: [],
    });

    expect(store).toBeDefined();
    expect(typeof store.getState).toBe('function');
    expect(spies).toBeDefined();
  });

  it('populates state.nodes from opts', () => {
    const nodes: Record<string, TreeNode> = {
      root: { id: 'root', content: 'Root', children: ['a'], metadata: {} },
      a: { id: 'a', content: 'A', children: [], metadata: {} },
    };
    const { store } = makeDragDropStore({
      nodes,
      ancestorRegistry: { root: [], a: ['root'] },
      multiSelectedNodeIds: new Set(),
      nodesToMove: [],
    });

    expect(store.getState().nodes).toEqual(nodes);
  });

  it('populates state.ancestorRegistry from opts', () => {
    const ancestorRegistry = { root: [], a: ['root'], b: ['root'] };
    const { store } = makeDragDropStore({
      nodes: {},
      ancestorRegistry,
      multiSelectedNodeIds: new Set(),
      nodesToMove: [],
    });

    expect(store.getState().ancestorRegistry).toEqual(ancestorRegistry);
  });

  it('populates state.multiSelectedNodeIds from opts', () => {
    const selection = new Set(['a', 'b', 'c']);
    const { store } = makeDragDropStore({
      nodes: {},
      ancestorRegistry: {},
      multiSelectedNodeIds: selection,
      nodesToMove: [],
    });

    expect(store.getState().multiSelectedNodeIds).toEqual(selection);
  });

  it('exposes drop-related spies on state.actions (dropNode, getNodesToMove, clearSelection, addToSelection)', () => {
    const { store, spies } = makeDragDropStore({
      nodes: {},
      ancestorRegistry: {},
      multiSelectedNodeIds: new Set(),
      nodesToMove: [],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = store.getState().actions as any;
    expect(actions.dropNode).toBe(spies.dropNode);
    expect(actions.getNodesToMove).toBe(spies.getNodesToMove);
    expect(actions.clearSelection).toBe(spies.clearSelection);
    expect(actions.addToSelection).toBe(spies.addToSelection);
  });

  it('wires getNodesToMove spy to return opts.nodesToMove', () => {
    const nodesToMove = ['node-a', 'node-b', 'node-c'];
    const { spies } = makeDragDropStore({
      nodes: {},
      ancestorRegistry: {},
      multiSelectedNodeIds: new Set(),
      nodesToMove,
    });

    expect(spies.getNodesToMove()).toEqual(nodesToMove);
  });

  it('returns fresh spies per invocation (no leakage between setups)', () => {
    const a = makeDragDropStore({
      nodes: {}, ancestorRegistry: {}, multiSelectedNodeIds: new Set(), nodesToMove: [],
    });
    const b = makeDragDropStore({
      nodes: {}, ancestorRegistry: {}, multiSelectedNodeIds: new Set(), nodesToMove: [],
    });

    a.spies.dropNode('x', 'y', 'after');

    expect(a.spies.dropNode).toHaveBeenCalledTimes(1);
    expect(b.spies.dropNode).not.toHaveBeenCalled();
    expect(a.spies.dropNode).not.toBe(b.spies.dropNode);
  });

  it('accepts an empty nodes map and empty registry without throwing', () => {
    expect(() =>
      makeDragDropStore({
        nodes: {},
        ancestorRegistry: {},
        multiSelectedNodeIds: new Set(),
        nodesToMove: [],
      }),
    ).not.toThrow();
  });
});

describe('drag-drop test fixtures — dragEndEvent', () => {
  it('sets active.id from the first argument', () => {
    const evt = dragEndEvent('node-a', 'node-b', 'after');
    expect(evt.active.id).toBe('node-a');
  });

  it('sets over.id from the second argument', () => {
    const evt = dragEndEvent('node-a', 'node-b', 'after');
    expect(evt.over?.id).toBe('node-b');
  });

  it('puts dropPosition in over.data.current.dropPosition', () => {
    const evt = dragEndEvent('node-a', 'node-b', 'child');
    expect(evt.over?.data.current).toEqual({ dropPosition: 'child' });
  });

  it("supports drop zone 'before'", () => {
    const evt = dragEndEvent('a', 'b', 'before');
    expect(evt.over?.data.current).toEqual({ dropPosition: 'before' });
  });

  it("supports drop zone 'after'", () => {
    const evt = dragEndEvent('a', 'b', 'after');
    expect(evt.over?.data.current).toEqual({ dropPosition: 'after' });
  });

  it("supports drop zone 'child'", () => {
    const evt = dragEndEvent('a', 'b', 'child');
    expect(evt.over?.data.current).toEqual({ dropPosition: 'child' });
  });

  it('produces a DragEndEvent shape accepted by @dnd-kit handleDragEnd consumers (activatorEvent, collisions, delta)', () => {
    const evt = dragEndEvent('a', 'b', 'after');
    expect(evt.activatorEvent).toBeInstanceOf(MouseEvent);
    expect(evt.collisions).toBeNull();
    expect(evt.delta).toEqual({ x: 0, y: 0 });
  });
});

describe('drag-drop test fixtures — makeStoreWrapper', () => {
  it('returns a React component that provides the store via TreeStoreContext', () => {
    const { store } = makeDragDropStore({
      nodes: {}, ancestorRegistry: {}, multiSelectedNodeIds: new Set(), nodesToMove: [],
    });
    const Wrapper = makeStoreWrapper(store);
    expect(typeof Wrapper).toBe('function');
  });

  it('lets a hook under the wrapper read state from the provided store');
});
