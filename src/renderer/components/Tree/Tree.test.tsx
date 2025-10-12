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

  it('should render tree with root node', () => {
    const nodes = {
      'root': {
        id: 'root',
        type: 'project',
        content: 'Root Project',
        children: [],
        metadata: {},
      },
    };

    useTreeStore.setState({
      rootNodeId: 'root',
      nodes,
    });

    render(<Tree />);
    const treeDiv = screen.getByText('Root Project').closest('.tree');
    expect(treeDiv).toBeInTheDocument();
  });
});
