import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeContent } from '../NodeContent';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import { createPartialMockActions } from '../../../test/helpers/mockStoreActions';
import type { TreeNode } from '@shared/types';

describe('NodeContent', () => {
  let store: TreeStore;
  const mockNode: TreeNode = {
    id: 'test-node',
    content: 'Test Task',
    children: [],
    metadata: { status: 'pending' },
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
        'test-node': mockNode,
      },
      rootNodeId: '',
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: mockActions as any,
    });
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <TreeStoreContext.Provider value={store}>
        {component}
      </TreeStoreContext.Provider>
    );
  };

  it('should render node content with contentEditable', () => {
    renderWithProvider(<NodeContent node={mockNode} depth={0} />);

    const contentDiv = screen.getByText('Test Task');
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveAttribute('contenteditable', 'true');
  });

  it('should show status checkbox for nodes with content', () => {
    renderWithProvider(<NodeContent node={mockNode} depth={0} />);

    const checkbox = screen.getByLabelText('Status: pending');
    expect(checkbox).toBeInTheDocument();
  });

  it('should not show status checkbox when no status', () => {
    const node: TreeNode = {
      id: 'node-1',
      content: 'Node',
      children: [],
      metadata: {},
    };

    renderWithProvider(<NodeContent node={node} depth={0} />);

    // StatusCheckbox does not render when there's no status
    const checkbox = screen.queryByRole('button', { name: /Status/ });
    expect(checkbox).not.toBeInTheDocument();
  });

  it('should update content when typing in contentEditable', () => {
    renderWithProvider(<NodeContent node={mockNode} depth={0} />);

    const contentDiv = screen.getByText('Test Task');
    fireEvent.input(contentDiv, { target: { textContent: 'Updated Task' } });

    expect(mockActions.updateContent).toHaveBeenCalledWith('test-node', 'Updated Task');
  });

  it('should create sibling node on Enter key', () => {
    renderWithProvider(<NodeContent node={mockNode} depth={0} />);

    const contentDiv = screen.getByText('Test Task');
    fireEvent.keyDown(contentDiv, { key: 'Enter' });

    expect(mockActions.createNode).toHaveBeenCalledWith('test-node');
  });

  it('should restore content on Escape key', () => {
    renderWithProvider(<NodeContent node={mockNode} depth={0} />);

    const contentDiv = screen.getByText('Test Task');

    contentDiv.textContent = 'Changed Content';

    fireEvent.keyDown(contentDiv, { key: 'Escape' });

    expect(contentDiv.textContent).toBe('Test Task');
  });

  it('should not steal focus when clicking on status checkbox', () => {
    const node: TreeNode = {
      id: 'node-1',
      content: 'Node',
      children: [],
      metadata: { status: 'completed' },
    };

    renderWithProvider(
      <div>
        <input type="text" data-testid="focused-input" />
        <NodeContent node={node} depth={0} />
      </div>
    );

    const input = screen.getByTestId('focused-input');
    const checkbox = screen.getByRole('button', { name: /Status/ });

    input.focus();
    expect(input).toHaveFocus();

    fireEvent.mouseDown(checkbox);
    fireEvent.click(checkbox);

    expect(input).toHaveFocus();
  });

});
