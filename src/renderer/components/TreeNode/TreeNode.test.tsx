import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeNode } from './TreeNode';
import { useTreeStore } from '../../store/treeStore';
import type { TreeNode as TreeNodeType } from '../../../shared/types';

describe('TreeNode', () => {
  beforeEach(() => {
    useTreeStore.setState({
      nodes: {},
      rootNodeId: '',
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
        task: { icon: '', style: '' },
      },
      selectedNodeId: null,
      ancestorRegistry: {},
    });
  });

  it('should render nothing if node does not exist', () => {
    useTreeStore.setState({ nodes: {} });

    const { container } = render(<TreeNode nodeId="nonexistent" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render node without children', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      type: 'task',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    useTreeStore.setState({ nodes: { 'test-node': mockNode } });

    render(<TreeNode nodeId="test-node" />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render node with children', () => {
    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        type: 'project',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        type: 'task',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    useTreeStore.setState({ nodes });

    render(<TreeNode nodeId="parent" />);
    expect(screen.getByText('Parent Node')).toBeInTheDocument();
    expect(screen.getByText('Child Node')).toBeInTheDocument();
  });

  it('should apply correct depth indentation', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      type: 'task',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    useTreeStore.setState({ nodes: { 'test-node': mockNode } });

    const { container } = render(<TreeNode nodeId="test-node" depth={2} />);
    const nodeWrapper = container.firstChild as HTMLElement;
    expect(nodeWrapper).toHaveStyle({ paddingLeft: '40px' });
  });

  it('should default depth to 0', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      type: 'task',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    useTreeStore.setState({ nodes: { 'test-node': mockNode } });

    const { container } = render(<TreeNode nodeId="test-node" />);
    const nodeWrapper = container.firstChild as HTMLElement;
    expect(nodeWrapper).toHaveStyle({ paddingLeft: '0px' });
  });

  it('should maintain cursor position when collapsing node being edited', async () => {
    const user = userEvent.setup();

    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        type: 'project',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        type: 'task',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    useTreeStore.setState({
      nodes,
      selectedNodeId: 'parent',
      cursorPosition: 5,
      ancestorRegistry: {
        'parent': [],
        'child-1': ['parent'],
      },
    });

    render(<TreeNode nodeId="parent" />);

    const contentEditable = screen.getByText('Parent Node');
    expect(contentEditable).toHaveFocus();

    const collapseButton = screen.getByText('▼');
    await user.click(collapseButton);

    expect(contentEditable).toHaveFocus();
    expect(useTreeStore.getState().selectedNodeId).toBe('parent');
    expect(useTreeStore.getState().cursorPosition).toBe(5);
  });

  it('should move cursor to end when collapsing node with descendant being edited', async () => {
    const user = userEvent.setup();
    const mockSelectNode = vi.fn();

    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        type: 'project',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        type: 'task',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    useTreeStore.setState({
      nodes,
      selectedNodeId: 'child-1',
      ancestorRegistry: {
        'parent': [],
        'child-1': ['parent'],
      },
      actions: {
        ...useTreeStore.getState().actions,
        selectNode: mockSelectNode,
      },
    });

    render(<TreeNode nodeId="parent" />);

    const collapseButton = screen.getByText('▼');
    await user.click(collapseButton);

    expect(mockSelectNode).toHaveBeenCalledWith('parent', 11);
  });
});
