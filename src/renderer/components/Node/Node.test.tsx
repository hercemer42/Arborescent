import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Node } from './Node';
import { useTreeStore } from '../../store/treeStore';
import type { TreeNode } from '../../../shared/types';

describe('Node', () => {
  beforeEach(() => {
    useTreeStore.setState({
      nodes: {},
      rootNodeId: '',
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
        task: { icon: '', style: '' },
      },
      selectedNodeId: null,
    });
  });

  it('should render nothing if node does not exist', () => {
    useTreeStore.setState({ nodes: {} });

    const { container } = render(<Node nodeId="nonexistent" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render node without children', () => {
    const mockNode: TreeNode = {
      id: 'test-node',
      type: 'task',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    useTreeStore.setState({ nodes: { 'test-node': mockNode } });

    render(<Node nodeId="test-node" />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render node with children', () => {
    const nodes: Record<string, TreeNode> = {
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

    render(<Node nodeId="parent" />);
    expect(screen.getByText('Parent Node')).toBeInTheDocument();
    expect(screen.getByText('Child Node')).toBeInTheDocument();
  });

  it('should apply correct depth indentation', () => {
    const mockNode: TreeNode = {
      id: 'test-node',
      type: 'task',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    useTreeStore.setState({ nodes: { 'test-node': mockNode } });

    const { container } = render(<Node nodeId="test-node" depth={2} />);
    const nodeWrapper = container.firstChild as HTMLElement;
    const indentedDiv = nodeWrapper?.children[0] as HTMLElement;
    expect(indentedDiv).toHaveStyle({ paddingLeft: '40px' }); // 2 * 20px
  });

  it('should default depth to 0', () => {
    const mockNode: TreeNode = {
      id: 'test-node',
      type: 'task',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    useTreeStore.setState({ nodes: { 'test-node': mockNode } });

    const { container } = render(<Node nodeId="test-node" />);
    const nodeWrapper = container.firstChild as HTMLElement;
    const indentedDiv = nodeWrapper?.children[0] as HTMLElement;
    expect(indentedDiv).toHaveStyle({ paddingLeft: '0px' });
  });
});
