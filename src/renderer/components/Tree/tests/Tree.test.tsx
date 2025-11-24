import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Tree } from '../Tree';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';

vi.mock('./useTree', () => ({
  useTree: vi.fn(),
}));

describe('Tree', () => {
  let store: TreeStore;

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      rootNodeId: '',
      nodes: {},
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <TreeStoreContext.Provider value={store}>
        {component}
      </TreeStoreContext.Provider>
    );
  };

  it('should render nothing when no rootNodeId', () => {
    const { container } = renderWithProvider(<Tree />);
    expect(container.firstChild).toBeNull();
  });

  it('should render tree with root children (root node hidden)', async () => {
    const nodes = {
      'root': {
        id: 'root',
        content: 'Root Project',
        children: ['child-1', 'child-2'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        content: 'First Task',
        children: [],
        metadata: { status: 'pending' as const },
      },
      'child-2': {
        id: 'child-2',
        content: 'Second Task',
        children: [],
        metadata: { status: 'pending' as const },
      },
    };

    store.setState({
      rootNodeId: 'root',
      nodes,
    });

    renderWithProvider(<Tree />);

    // Wait for component to settle
    await waitFor(() => {
      expect(screen.getByText('First Task')).toBeInTheDocument();
    });

    // Root node content should NOT be visible
    expect(screen.queryByText('Root Project')).not.toBeInTheDocument();

    // But its children should be visible
    expect(screen.getByText('First Task')).toBeInTheDocument();
    expect(screen.getByText('Second Task')).toBeInTheDocument();
  });
});
