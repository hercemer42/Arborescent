import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTree } from './useTree';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';

vi.mock('@platform/menu');
vi.mock('@platform/storage');

describe('useTree', () => {
  let store: TreeStore;

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      nodeTypeConfig: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      actions: {
        moveUp: vi.fn(),
        moveDown: vi.fn(),
        loadFromPath: vi.fn(),
        saveToPath: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should compose specialized hooks without error', () => {
    expect(() => {
      renderHook(() => useTree(), { wrapper });
    }).not.toThrow();
  });
});
