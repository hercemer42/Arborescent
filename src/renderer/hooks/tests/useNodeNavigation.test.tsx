import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../store/tree/treeStore';
import { useNodeNavigation } from '../useNodeNavigation';
import type { TreeNode } from '@shared/types';

const mockSetActiveFile = vi.fn();
let mockActiveFile: unknown = null;

vi.mock('../../store/files/filesStore', () => ({
  setFileActionsStoreAccess: vi.fn(),
  useFilesStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ getActiveFile: () => mockActiveFile, setActiveFile: mockSetActiveFile }),
    {
      getState: vi.fn(() => ({ getActiveFile: () => mockActiveFile, setActiveFile: mockSetActiveFile })),
    }
  ),
}));

describe('useNodeNavigation', () => {
  let store: TreeStore;
  const mockSelectNode = vi.fn();
  const mockToggleNode = vi.fn();
  const mockFlashNode = vi.fn();

  const target: TreeNode = { id: 'target', content: 'Target', children: [], metadata: {} };

  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveFile = null;
    store = createTreeStore();
    store.setState({
      nodes: { target },
      ancestorRegistry: { target: [] },
      blueprintModeEnabled: false,
      scrollToNodeId: null,
      actions: {
        selectNode: mockSelectNode,
        toggleNode: mockToggleNode,
        flashNode: mockFlashNode,
        toggleBlueprintMode: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('selects, scrolls to, and flashes the target node', () => {
    const { result } = renderHook(() => useNodeNavigation(), { wrapper });

    act(() => result.current.navigateToNode('target'));

    expect(mockSelectNode).toHaveBeenCalledWith('target', 0);
    expect(store.getState().scrollToNodeId).toBe('target');
    expect(mockFlashNode).toHaveBeenCalledWith('target', 'light');
  });

  it('expands collapsed ancestors before navigating', () => {
    store.setState({
      nodes: {
        target,
        ancestor: { id: 'ancestor', content: 'Ancestor', children: ['target'], metadata: { expanded: false } },
      },
      ancestorRegistry: { target: ['ancestor'], ancestor: [] },
    });
    const { result } = renderHook(() => useNodeNavigation(), { wrapper });

    act(() => result.current.navigateToNode('target'));

    expect(mockToggleNode).toHaveBeenCalledWith('ancestor');
  });

  it("does not expand the target node's own subtree", () => {
    store.setState({
      nodes: {
        target: { ...target, children: ['child'], metadata: { expanded: false } },
        child: { id: 'child', content: 'Child', children: [], metadata: {} },
      },
      ancestorRegistry: { target: [], child: ['target'] },
    });
    const { result } = renderHook(() => useNodeNavigation(), { wrapper });

    act(() => result.current.navigateToNode('target'));

    expect(mockToggleNode).not.toHaveBeenCalledWith('target');
  });

  it('switches out of a zoom tab to the main view before navigating', () => {
    mockActiveFile = { zoomSource: { sourceFilePath: '/main.arbo' } };
    const { result } = renderHook(() => useNodeNavigation(), { wrapper });

    act(() => result.current.navigateToNode('target'));

    expect(mockSetActiveFile).toHaveBeenCalledWith('/main.arbo');
  });

  it('no-ops when the target node does not exist', () => {
    const { result } = renderHook(() => useNodeNavigation(), { wrapper });

    act(() => result.current.navigateToNode('missing'));

    expect(mockSelectNode).not.toHaveBeenCalled();
    expect(mockFlashNode).not.toHaveBeenCalled();
  });

  it('no-ops without throwing when rendered outside a tree store provider', () => {
    const { result } = renderHook(() => useNodeNavigation());

    expect(() => act(() => result.current.navigateToNode('target'))).not.toThrow();
    expect(mockSelectNode).not.toHaveBeenCalled();
  });
});
