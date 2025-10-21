import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeCursor } from './useNodeCursor';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import type { TreeNode } from '../../../../shared/types';

vi.mock('../../services/cursorService', () => ({
  setCursorPosition: vi.fn(),
  getVisualCursorPosition: vi.fn(() => 10),
  setCursorToVisualPosition: vi.fn(() => 5),
}));

describe('useNodeCursor', () => {
  let store: TreeStore;
  const mockSetCursorPosition = vi.fn();
  const mockSetRememberedVisualX = vi.fn();
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
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        setCursorPosition: mockSetCursorPosition,
        setRememberedVisualX: mockSetRememberedVisualX,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should return cursor state and setters', () => {
    const contentRef = { current: null };
    const { result } = renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });

    expect(result.current.cursorPosition).toBe(0);
    expect(result.current.rememberedVisualX).toBe(null);
    expect(result.current.setCursorPosition).toBe(mockSetCursorPosition);
    expect(result.current.setRememberedVisualX).toBe(mockSetRememberedVisualX);
  });

  it('should expose cursor position from store', () => {
    const contentRef = { current: null };
    store.setState({ cursorPosition: 5 });

    const { result } = renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });

    expect(result.current.cursorPosition).toBe(5);
  });

  it('should expose rememberedVisualX from store', () => {
    const contentRef = { current: null };
    store.setState({ rememberedVisualX: 15 });

    const { result } = renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });

    expect(result.current.rememberedVisualX).toBe(15);
  });

  it('should provide setCursorPosition action', () => {
    const contentRef = { current: null };
    const { result } = renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });

    result.current.setCursorPosition(10);

    expect(mockSetCursorPosition).toHaveBeenCalledWith(10);
  });

  it('should provide setRememberedVisualX action', () => {
    const contentRef = { current: null };
    const { result } = renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });

    result.current.setRememberedVisualX(20);

    expect(mockSetRememberedVisualX).toHaveBeenCalledWith(20);
  });
});
