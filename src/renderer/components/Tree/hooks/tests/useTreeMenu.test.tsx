import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeMenu } from '../useTreeMenu';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import { useFilesStore } from '../../../../store/files/filesStore';

const { mockMenuService } = vi.hoisted(() => ({
  mockMenuService: {
    onMenuNew: vi.fn(),
    onMenuOpen: vi.fn(),
    onMenuSave: vi.fn(),
    onMenuSaveAs: vi.fn(),
  },
}));

vi.mock('@platform', () => ({
  MenuService: vi.fn(() => mockMenuService),
  StorageService: vi.fn(),
  ErrorService: vi.fn(),
}));

describe('useTreeMenu', () => {
  let store: TreeStore;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset tabsStore
    useFilesStore.setState({
      files: [],
      activeFilePath: null,
    });

    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: {} as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should register all menu listeners', () => {
    renderHook(() => useTreeMenu(), { wrapper });

    expect(mockMenuService.onMenuNew).toHaveBeenCalledWith(expect.any(Function));
    expect(mockMenuService.onMenuOpen).toHaveBeenCalledWith(expect.any(Function));
    expect(mockMenuService.onMenuSave).toHaveBeenCalledWith(expect.any(Function));
    expect(mockMenuService.onMenuSaveAs).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should re-register listeners when currentFilePath changes', () => {
    const { rerender } = renderHook(() => useTreeMenu(), { wrapper });

    expect(mockMenuService.onMenuNew).toHaveBeenCalledTimes(1);
    expect(mockMenuService.onMenuSave).toHaveBeenCalledTimes(1);

    // Change currentFilePath
    store.setState({ currentFilePath: '/test/path.arbo' });
    rerender();

    expect(mockMenuService.onMenuNew).toHaveBeenCalledTimes(2);
    expect(mockMenuService.onMenuSave).toHaveBeenCalledTimes(2);
  });
});
