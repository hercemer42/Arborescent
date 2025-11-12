import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeNode } from '../TreeNode';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import type { TreeNode as TreeNodeType } from '@shared/types';

describe('TreeNode', () => {
  let store: TreeStore;

  beforeEach(() => {
    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      activeNodeId: null,
      ancestorRegistry: {},
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <TreeStoreContext.Provider value={store}>
        {component}
      </TreeStoreContext.Provider>
    );
  };

  it('should render nothing if node does not exist', () => {
    store.setState({ nodes: {} });

    const { container } = renderWithProvider(<TreeNode nodeId="nonexistent" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render node without children', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    store.setState({ nodes: { 'test-node': mockNode } });

    renderWithProvider(<TreeNode nodeId="test-node" />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render node with children', () => {
    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    store.setState({ nodes });

    renderWithProvider(<TreeNode nodeId="parent" />);
    expect(screen.getByText('Parent Node')).toBeInTheDocument();
    expect(screen.getByText('Child Node')).toBeInTheDocument();
  });

  it('should apply correct depth indentation', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    store.setState({ nodes: { 'test-node': mockNode } });

    const { container } = renderWithProvider(<TreeNode nodeId="test-node" depth={2} />);
    const nodeContent = container.querySelector('.node-content') as HTMLElement;
    expect(nodeContent).toHaveStyle({ paddingLeft: '55px' }); // depth * 20 + 15
  });

  it('should default depth to 0', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    store.setState({ nodes: { 'test-node': mockNode } });

    const { container } = renderWithProvider(<TreeNode nodeId="test-node" />);
    const nodeContent = container.querySelector('.node-content') as HTMLElement;
    expect(nodeContent).toHaveStyle({ paddingLeft: '15px' }); // depth * 20 + 15
  });

  it('should maintain cursor position when collapsing node being edited', async () => {
    const user = userEvent.setup();

    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    store.setState({
      nodes,
      activeNodeId: 'parent',
      cursorPosition: 5,
      ancestorRegistry: {
        'parent': [],
        'child-1': ['parent'],
      },
    });

    renderWithProvider(<TreeNode nodeId="parent" />);

    const contentEditable = screen.getByText('Parent Node');
    expect(contentEditable).toHaveFocus();

    const collapseButton = screen.getByText('⌄');
    await user.click(collapseButton);

    expect(contentEditable).toHaveFocus();
    expect(store.getState().activeNodeId).toBe('parent');
    expect(store.getState().cursorPosition).toBe(5);
  });

  it('should move cursor to end when collapsing node with descendant being edited', async () => {
    const user = userEvent.setup();
    const mockSelectNode = vi.fn();

    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    store.setState({
      nodes,
      activeNodeId: 'child-1',
      ancestorRegistry: {
        'parent': [],
        'child-1': ['parent'],
      },
      actions: {
        ...store.getState().actions,
        selectNode: mockSelectNode,
      },
    });

    renderWithProvider(<TreeNode nodeId="parent" />);

    const collapseButton = screen.getByText('⌄');
    await user.click(collapseButton);

    expect(mockSelectNode).toHaveBeenCalledWith('parent', 11);
  });
});
