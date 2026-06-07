import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHyperlinkNavigation } from '../useHyperlinkNavigation';
import { TreeStoreContext } from '../../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../../store/tree/treeStore';
import type { TreeNode } from '@shared/types';

vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({
        getActiveFile: () => null,
        setActiveFile: vi.fn(),
      }),
    { getState: vi.fn(() => ({ getActiveFile: () => null, setActiveFile: vi.fn() })) }
  ),
}));

vi.mock('../../../../store/browser/browserStore', () => ({
  useBrowserStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ actions: { addTab: vi.fn() } }),
    { getState: vi.fn(() => ({ actions: { addTab: vi.fn() } })) }
  ),
}));

vi.mock('../../../../store/panel/panelStore', () => ({
  usePanelStore: Object.assign(
    (selector: (state: unknown) => unknown) =>
      selector({ showBrowser: vi.fn() }),
    { getState: vi.fn(() => ({ showBrowser: vi.fn() })) }
  ),
}));

vi.mock('../../../../store/toast/toastStore', () => ({
  useToastStore: { getState: vi.fn(() => ({ addToast: vi.fn() })) },
}));

describe('useHyperlinkNavigation', () => {
  let store: TreeStore;
  const mockSelectNode = vi.fn();
  const mockToggleNode = vi.fn();
  const mockFlashNode = vi.fn();

  const targetNode: TreeNode = {
    id: 'target-node',
    content: 'Target',
    children: [],
    metadata: {},
  };

  const hyperlinkNode: TreeNode = {
    id: 'link-node',
    content: 'Link',
    children: [],
    metadata: { isHyperlink: true, linkedNodeId: 'target-node' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTreeStore();
    store.setState({
      nodes: {
        'link-node': hyperlinkNode,
        'target-node': targetNode,
      },
      ancestorRegistry: { 'target-node': [] },
      blueprintModeEnabled: false,
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

  it('flashes the target node after navigating to a hyperlink', () => {
    const { result } = renderHook(() => useHyperlinkNavigation(hyperlinkNode), { wrapper });

    act(() => {
      result.current.navigateToLinkedNode();
    });

    expect(mockSelectNode).toHaveBeenCalledWith('target-node', 0);
    expect(mockFlashNode).toHaveBeenCalledWith('target-node', 'light');
  });

  it('flashes the target node even when ancestors must be expanded first', () => {
    const collapsedAncestor: TreeNode = {
      id: 'ancestor',
      content: 'Ancestor',
      children: ['target-node'],
      metadata: { expanded: false },
    };
    store.setState({
      nodes: {
        'link-node': hyperlinkNode,
        'target-node': targetNode,
        ancestor: collapsedAncestor,
      },
      ancestorRegistry: { 'target-node': ['ancestor'] },
    });

    const { result } = renderHook(() => useHyperlinkNavigation(hyperlinkNode), { wrapper });

    act(() => {
      result.current.navigateToLinkedNode();
    });

    expect(mockToggleNode).toHaveBeenCalledWith('ancestor');
    expect(mockFlashNode).toHaveBeenCalledWith('target-node', 'light');
  });

  it('does not expand the target node\'s own subtree when navigating', () => {
    const targetWithCollapsedChildren: TreeNode = {
      id: 'target-node',
      content: 'Target',
      children: ['target-child'],
      metadata: { expanded: false },
    };
    store.setState({
      nodes: {
        'link-node': hyperlinkNode,
        'target-node': targetWithCollapsedChildren,
        'target-child': { id: 'target-child', content: 'Child', children: [], metadata: {} },
      },
      ancestorRegistry: { 'target-node': [], 'target-child': ['target-node'] },
    });

    const { result } = renderHook(() => useHyperlinkNavigation(hyperlinkNode), { wrapper });

    act(() => {
      result.current.navigateToLinkedNode();
    });

    expect(mockToggleNode).not.toHaveBeenCalledWith('target-node');
    expect(mockFlashNode).toHaveBeenCalledWith('target-node', 'light');
  });

  it('does not flash when the linked node is missing', () => {
    const orphanLink: TreeNode = {
      id: 'orphan-link',
      content: 'Orphan',
      children: [],
      metadata: { isHyperlink: true, linkedNodeId: 'missing-node' },
    };
    store.setState({
      nodes: { 'orphan-link': orphanLink },
      ancestorRegistry: {},
    });

    const { result } = renderHook(() => useHyperlinkNavigation(orphanLink), { wrapper });

    act(() => {
      result.current.navigateToLinkedNode();
    });

    expect(mockFlashNode).not.toHaveBeenCalled();
  });

  it('does not flash for external links', () => {
    const externalLink: TreeNode = {
      id: 'ext-link',
      content: 'External',
      children: [],
      metadata: { isExternalLink: true, externalUrl: 'https://example.com' },
    };

    const { result } = renderHook(() => useHyperlinkNavigation(externalLink), { wrapper });

    act(() => {
      result.current.navigateToLinkedNode();
    });

    expect(mockFlashNode).not.toHaveBeenCalled();
  });
});
