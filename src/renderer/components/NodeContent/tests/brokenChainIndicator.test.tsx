import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NodeContent } from '../NodeContent';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore } from '../../../store/tree/treeStore';
import { createPartialMockActions } from '../../../test/helpers/mockStoreActions';
import type { TreeNode } from '@shared/types';

describe('broken-chain visual indicator removal', () => {
  let store: TreeStore;

  const brokenNode: TreeNode = {
    id: 'broken-node',
    content: 'Step with broken chain',
    children: [],
    metadata: {
      status: 'pending',
      sessionId: 'sess-1',
      brokenChain: true,
    },
  };

  const liveNode: TreeNode = {
    id: 'live-node',
    content: 'Step with live session',
    children: [],
    metadata: {
      status: 'pending',
      sessionId: 'sess-2',
    },
  };

  const mockActions = createPartialMockActions({
    selectNode: vi.fn(),
    updateStatus: vi.fn(),
    toggleStatus: vi.fn(),
    updateContent: vi.fn(),
    setCursorPosition: vi.fn(),
    setRememberedVisualX: vi.fn(),
    createNode: vi.fn(),
    indentNode: vi.fn(),
    outdentNode: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTreeStore();
    store.setState({
      nodes: {
        'broken-node': brokenNode,
        'live-node': liveNode,
      },
      rootNodeId: '',
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry: {
        'broken-node': [],
        'live-node': [],
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: mockActions as any,
    });
  });

  const renderWithProvider = (node: TreeNode) =>
    render(
      <TreeStoreContext.Provider value={store}>
        <NodeContent node={node} depth={0} />
      </TreeStoreContext.Provider>,
    );

  it('does not render a .broken-chain-indicator element on a node whose metadata.brokenChain is true', () => {
    const { container } = renderWithProvider(brokenNode);
    expect(container.querySelector('.broken-chain-indicator')).not.toBeInTheDocument();
  });

  it('does not render a .broken-chain-indicator element on a node whose metadata.brokenChain is absent', () => {
    const { container } = renderWithProvider(liveNode);
    expect(container.querySelector('.broken-chain-indicator')).not.toBeInTheDocument();
  });

  it('does not apply the .broken-chain class to .node-content when metadata.brokenChain is true', () => {
    const { container } = renderWithProvider(brokenNode);
    const nodeContent = container.querySelector('.node-content');
    expect(nodeContent).toBeInTheDocument();
    expect(nodeContent?.classList.contains('broken-chain')).toBe(false);
  });

  it('does not apply the .broken-chain class to .node-content when metadata.brokenChain is absent', () => {
    const { container } = renderWithProvider(liveNode);
    const nodeContent = container.querySelector('.node-content');
    expect(nodeContent).toBeInTheDocument();
    expect(nodeContent?.classList.contains('broken-chain')).toBe(false);
  });

  it('renders the node content text unchanged when brokenChain is true', () => {
    const { getByText } = renderWithProvider(brokenNode);
    expect(getByText('Step with broken chain')).toBeInTheDocument();
  });

  it('preserves the status checkbox on a broken-chain node — only the dot is removed, not other indicators', () => {
    const { container } = renderWithProvider(brokenNode);
    expect(container.querySelector('.checkbox-icon-wrapper')).toBeInTheDocument();
  });
});
