import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeEditing } from '../useNodeEditing';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';

describe('useNodeEditing', () => {
  let store: TreeStore;
  const mockUpdateContent = vi.fn();
  const mockNode: TreeNode = {
    id: 'test-node',
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
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        updateContent: mockUpdateContent,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should return contentRef and handleInput', () => {
    const { result } = renderHook(() => useNodeEditing(mockNode), { wrapper });

    expect(result.current.contentRef).toBeDefined();
    expect(result.current.handleInput).toBeInstanceOf(Function);
  });

  it('should update content when handleInput is called', () => {
    const { result } = renderHook(() => useNodeEditing(mockNode), { wrapper });

    // Mock contentEditable element
    const mockElement = {
      textContent: 'New Content',
    };

    result.current.contentRef.current = mockElement as unknown as HTMLDivElement;

    const mockEvent = {
      currentTarget: mockElement,
    } as unknown as React.FormEvent<HTMLDivElement>;

    result.current.handleInput(mockEvent);

    expect(mockUpdateContent).toHaveBeenCalledWith('test-node', 'New Content');
  });

  it('should handle empty content', () => {
    const { result } = renderHook(() => useNodeEditing(mockNode), { wrapper });

    const mockElement = {
      textContent: '',
    };

    result.current.contentRef.current = mockElement as unknown as HTMLDivElement;

    const mockEvent = {
      currentTarget: mockElement,
    } as unknown as React.FormEvent<HTMLDivElement>;

    result.current.handleInput(mockEvent);

    expect(mockUpdateContent).toHaveBeenCalledWith('test-node', '');
  });

  it('should handle null textContent', () => {
    const { result } = renderHook(() => useNodeEditing(mockNode), { wrapper });

    const mockElement = {
      textContent: null,
    };

    result.current.contentRef.current = mockElement as unknown as HTMLDivElement;

    const mockEvent = {
      currentTarget: mockElement,
    } as unknown as React.FormEvent<HTMLDivElement>;

    result.current.handleInput(mockEvent);

    expect(mockUpdateContent).toHaveBeenCalledWith('test-node', '');
  });
});
