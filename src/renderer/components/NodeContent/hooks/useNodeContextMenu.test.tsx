import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNodeContextMenu } from './useNodeContextMenu';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import type { TreeNode } from '../../../../shared/types';

describe('useNodeContextMenu', () => {
  let store: TreeStore;
  const mockDeleteNode = vi.fn();
  const mockNode: TreeNode = {
    id: 'test-node',
    type: 'task',
    content: 'Test Content',
    children: [],
    metadata: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: { 'test-node': mockNode },
      rootNodeId: 'test-node',
      nodeTypeConfig: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        deleteNode: mockDeleteNode,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should initialize with no context menu', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    expect(result.current.contextMenu).toBe(null);
  });

  it('should return contextMenuItems array', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    expect(result.current.contextMenuItems).toBeInstanceOf(Array);
    expect(result.current.contextMenuItems.length).toBeGreaterThan(0);
  });

  it('should have a Delete menu item', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const deleteItem = result.current.contextMenuItems.find(item => item.label === 'Delete');
    expect(deleteItem).toBeDefined();
    expect(deleteItem?.danger).toBe(true);
  });

  it('should set context menu position on handleContextMenu', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });
  });

  it('should close context menu', () => {
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    const mockEvent = {
      preventDefault: vi.fn(),
      clientX: 100,
      clientY: 200,
    } as unknown as React.MouseEvent;

    act(() => {
      result.current.handleContextMenu(mockEvent);
    });

    expect(result.current.contextMenu).toEqual({ x: 100, y: 200 });

    act(() => {
      result.current.closeContextMenu();
    });

    expect(result.current.contextMenu).toBe(null);
  });

  it('should delete node without children', () => {
    mockDeleteNode.mockReturnValue(true);
    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    act(() => {
      result.current.handleDelete();
    });

    expect(mockDeleteNode).toHaveBeenCalledWith('test-node');
    expect(mockDeleteNode).toHaveBeenCalledTimes(1);
  });

  it('should show confirmation for nodes with children', () => {
    mockDeleteNode.mockReturnValueOnce(false);
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    act(() => {
      result.current.handleDelete();
    });

    expect(mockDeleteNode).toHaveBeenCalledWith('test-node');
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDeleteNode).toHaveBeenCalledWith('test-node', true);
    expect(mockDeleteNode).toHaveBeenCalledTimes(2);

    mockConfirm.mockRestore();
  });

  it('should not delete if user cancels confirmation', () => {
    mockDeleteNode.mockReturnValueOnce(false);
    const mockConfirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() => useNodeContextMenu(mockNode), { wrapper });

    act(() => {
      result.current.handleDelete();
    });

    expect(mockDeleteNode).toHaveBeenCalledWith('test-node');
    expect(mockConfirm).toHaveBeenCalled();
    expect(mockDeleteNode).toHaveBeenCalledTimes(1);

    mockConfirm.mockRestore();
  });
});
