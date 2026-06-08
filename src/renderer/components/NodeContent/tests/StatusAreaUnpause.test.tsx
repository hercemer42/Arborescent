import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { NodeContent } from '../NodeContent';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, type TreeStore } from '../../../store/tree/treeStore';
import { createPartialMockActions } from '../../../test/helpers/mockStoreActions';
import type { TreeNode } from '@shared/types';

describe('StatusArea — unpause control (awaiting-validation)', () => {
  let store: TreeStore;

  const pausedNode: TreeNode = {
    id: 'paused-node',
    content: 'Paused step',
    children: [],
    metadata: { status: 'pending' },
  };

  const stopWorkflow = vi.fn();
  const unpauseWorkflow = vi.fn();
  const mockActions = createPartialMockActions({
    selectNode: vi.fn(),
    toggleStatus: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTreeStore();
    store.setState({
      nodes: { 'paused-node': pausedNode },
      rootNodeId: '',
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry: { 'paused-node': [] },
      workflowExecutionStates: {
        'paused-node': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: { ...mockActions, stopWorkflow, unpauseWorkflow } as any,
    });
  });

  const renderNode = (node: TreeNode = pausedNode) =>
    render(
      <TreeStoreContext.Provider value={store}>
        <NodeContent node={node} depth={0} />
      </TreeStoreContext.Provider>,
    );

  it('renders the paused glyph as a clickable button, not a static span', () => {
    const { getByLabelText } = renderNode();
    const control = getByLabelText('Unpause workflow');
    expect(control.tagName).toBe('BUTTON');
    expect(control).toHaveClass('workflow-execution-overlay', 'paused');
  });

  it('invokes unpauseWorkflow for the node when the paused glyph is clicked', () => {
    const { getByLabelText } = renderNode();
    fireEvent.click(getByLabelText('Unpause workflow'));
    expect(unpauseWorkflow).toHaveBeenCalledWith('paused-node');
  });

  it('stops click propagation so unpausing does not also reach a parent handler', () => {
    const parentClick = vi.fn();
    const { getByLabelText } = render(
      <TreeStoreContext.Provider value={store}>
        <div onClick={parentClick}>
          <NodeContent node={pausedNode} depth={0} />
        </div>
      </TreeStoreContext.Provider>,
    );
    fireEvent.click(getByLabelText('Unpause workflow'));
    expect(unpauseWorkflow).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('exposes a keyboard-reachable label distinct from "Stop workflow"', () => {
    const { getByLabelText, queryByLabelText } = renderNode();
    // A native <button> is focusable and Enter/Space-activatable without extra wiring.
    expect(getByLabelText('Unpause workflow').tagName).toBe('BUTTON');
    expect(queryByLabelText('Stop workflow')).not.toBeInTheDocument();
  });

  it('is absent on a running node, which shows the Stop control instead', () => {
    store.setState({
      workflowExecutionStates: {
        'paused-node': { state: 'running', terminalTabId: 'terminal-1' },
      },
    });
    const { getByLabelText, queryByLabelText } = renderNode();
    expect(getByLabelText('Stop workflow')).toBeInTheDocument();
    expect(queryByLabelText('Unpause workflow')).not.toBeInTheDocument();
  });

  it('is absent on a node with no execution state (non-paused / non-workflow)', () => {
    store.setState({ workflowExecutionStates: {} });
    const { queryByLabelText } = renderNode();
    expect(queryByLabelText('Unpause workflow')).not.toBeInTheDocument();
    expect(queryByLabelText('Stop workflow')).not.toBeInTheDocument();
  });
});
