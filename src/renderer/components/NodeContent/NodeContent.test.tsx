import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeContent } from './NodeContent';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../store/tree/treeStore';
import { createPartialMockActions } from '../../test/helpers/mockStoreActions';
import type { TreeNode } from '../../../shared/types';

describe('NodeContent', () => {
  let store: TreeStore;
  const mockNode: TreeNode = {
    id: 'test-node',
    type: 'task',
    content: 'Test Task',
    children: [],
    metadata: { status: '☐' },
  };

  const mockActions = createPartialMockActions({
    selectNode: vi.fn(),
    updateStatus: vi.fn(),
    updateContent: vi.fn(),
    setCursorPosition: vi.fn(),
    setRememberedVisualX: vi.fn(),
    createSiblingNode: vi.fn(),
    indentNode: vi.fn(),
    outdentNode: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
        task: { icon: '✓', style: '' },
      },
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
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveAttribute('contenteditable', 'true');
  });

  it('should show expand toggle when node has children', () => {
    const nodeWithChildren = { ...mockNode, children: ['child-1'] };

    renderWithProvider(<NodeContent node={nodeWithChildren} expanded={true} onToggle={vi.fn()} />);

    const toggle = screen.getByText('▼');
    expect(toggle).toBeInTheDocument();
  });

  it('should show status checkbox for task nodes', () => {
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const checkbox = screen.getByLabelText('Status: ☐');
    expect(checkbox).toBeInTheDocument();
  });

  it('should show icon when configured', () => {
    const projectNode: TreeNode = {
      id: 'project-node',
      type: 'project',
      content: 'Project',
      children: [],
      metadata: {},
    };

    renderWithProvider(<NodeContent node={projectNode} expanded={true} onToggle={vi.fn()} />);

    expect(screen.getByText('📁')).toBeInTheDocument();
  });

  it('should update content when typing in contentEditable', () => {
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');
    fireEvent.input(contentDiv, { target: { textContent: 'Updated Task' } });

    expect(mockActions.updateContent).toHaveBeenCalledWith('test-node', 'Updated Task');
  });

  it('should create sibling node on Enter key', () => {
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');
    fireEvent.keyDown(contentDiv, { key: 'Enter' });

    expect(mockActions.createSiblingNode).toHaveBeenCalledWith('test-node');
  });

  it('should restore content on Escape key', () => {
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');

    contentDiv.textContent = 'Changed Content';

    fireEvent.keyDown(contentDiv, { key: 'Escape' });

    expect(contentDiv.textContent).toBe('Test Task');
  });

  it('should not steal focus when clicking on icon', () => {
    const projectNode: TreeNode = {
      id: 'project-node',
      type: 'project',
      content: 'Project',
      children: [],
      metadata: {},
    };

    renderWithProvider(
      <div>
        <input type="text" data-testid="focused-input" />
        <NodeContent node={projectNode} expanded={true} onToggle={vi.fn()} />
      </div>
    );

    const input = screen.getByTestId('focused-input');
    const icon = screen.getByText('📁');

    input.focus();
    expect(input).toHaveFocus();

    fireEvent.mouseDown(icon);
    fireEvent.click(icon);

    expect(input).toHaveFocus();
  });
});
