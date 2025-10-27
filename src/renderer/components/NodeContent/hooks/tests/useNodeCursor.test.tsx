import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNodeCursor } from '../useNodeCursor';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';

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

  it('should render without errors when node is not selected', () => {
    const contentRef = { current: null };

    expect(() => {
      renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });
    }).not.toThrow();
  });

  it('should render without errors when node is selected', () => {
    const contentRef = { current: document.createElement('div') };
    store.setState({ selectedNodeId: 'test-node' });

    expect(() => {
      renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });
    }).not.toThrow();
  });

  it('should render without errors with rememberedVisualX', () => {
    const contentRef = { current: document.createElement('div') };
    store.setState({
      selectedNodeId: 'test-node',
      rememberedVisualX: 15
    });

    expect(() => {
      renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });
    }).not.toThrow();
  });

  it('should render without errors with cursor position', () => {
    const contentRef = { current: document.createElement('div') };
    store.setState({
      selectedNodeId: 'test-node',
      cursorPosition: 5
    });

    expect(() => {
      renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });
    }).not.toThrow();
  });

  it('should render without errors when contentRef is null', () => {
    const contentRef = { current: null };
    store.setState({ selectedNodeId: 'test-node' });

    expect(() => {
      renderHook(() => useNodeCursor(mockNode, contentRef), { wrapper });
    }).not.toThrow();
  });
});
