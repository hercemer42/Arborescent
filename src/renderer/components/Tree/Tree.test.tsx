import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tree } from './Tree';
import { useTreeStore } from '../../store/treeStore';


vi.mock('./useTreeListeners', () => ({
  useTreeListeners: vi.fn(),
}));

describe('Tree', () => {
  beforeEach(() => {
    vi.clearAllMocks();


    useTreeStore.setState({
      rootNodeId: '',
      nodes: {},
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
      },
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
    });
  });

  it('should render nothing when no rootNodeId', () => {
    const { container } = render(<Tree />);
    expect(container.firstChild).toBeNull();
  });

  it('should render tree with root children (root node hidden)', () => {
    const nodes = {
      'root': {
        id: 'root',
        type: 'project',
        content: 'Root Project',
        children: ['child-1', 'child-2'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        type: 'task',
        content: 'First Task',
        children: [],
        metadata: { status: '☐' },
      },
      'child-2': {
        id: 'child-2',
        type: 'task',
        content: 'Second Task',
        children: [],
        metadata: { status: '☐' },
      },
    };

    useTreeStore.setState({
      rootNodeId: 'root',
      nodes,
    });

    render(<Tree />);

    // Root node content should NOT be visible
    expect(screen.queryByText('Root Project')).not.toBeInTheDocument();

    // But its children should be visible
    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
  });
});
