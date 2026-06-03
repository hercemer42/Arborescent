import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { NodeContent } from '../NodeContent';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore } from '../../../store/tree/treeStore';
import { createPartialMockActions } from '../../../test/helpers/mockStoreActions';
import type { TreeNode } from '@shared/types';

describe('broken-chain visual indicator', () => {
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

  it('renders a .broken-chain-indicator on a node whose metadata.brokenChain is true', () => {
    const { container } = renderWithProvider(brokenNode);
    expect(container.querySelector('.broken-chain-indicator')).toBeInTheDocument();
  });

  it('does not render the indicator on a node whose metadata.brokenChain is absent', () => {
    const { container } = renderWithProvider(liveNode);
    expect(container.querySelector('.broken-chain-indicator')).not.toBeInTheDocument();
  });

  it('renders the node content text unchanged when brokenChain is true', () => {
    const { getByText } = renderWithProvider(brokenNode);
    expect(getByText('Step with broken chain')).toBeInTheDocument();
  });

  it('preserves the status checkbox alongside the broken-chain indicator', () => {
    const { container } = renderWithProvider(brokenNode);
    expect(container.querySelector('.checkbox-icon-wrapper')).toBeInTheDocument();
    expect(container.querySelector('.broken-chain-indicator')).toBeInTheDocument();
  });

  it('clears the indicator once the binding is re-resolved (brokenChain removed)', () => {
    const { container, rerender } = renderWithProvider(brokenNode);
    expect(container.querySelector('.broken-chain-indicator')).toBeInTheDocument();

    rerender(
      <TreeStoreContext.Provider value={store}>
        <NodeContent
          node={{ ...brokenNode, metadata: { ...brokenNode.metadata, brokenChain: false } }}
          depth={0}
        />
      </TreeStoreContext.Provider>,
    );
    expect(container.querySelector('.broken-chain-indicator')).not.toBeInTheDocument();
  });

  it('exposes the broken-chain state to assistive tech via an accessible name', () => {
    const { getByLabelText } = renderWithProvider(brokenNode);
    expect(getByLabelText('Session link broken')).toBeInTheDocument();
  });
});
