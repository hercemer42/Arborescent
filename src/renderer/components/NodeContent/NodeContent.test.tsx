import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NodeContent } from './NodeContent';
import { useTreeStore } from '../../store/treeStore';
import { createPartialMockActions } from '../../test/helpers/mockStoreActions';
import type { TreeNode } from '../../../shared/types';

describe('NodeContent', () => {
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
    setRememberedCursorColumn: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    useTreeStore.setState({
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedCursorColumn: null,
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
        task: { icon: '✓', style: '' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: mockActions as any,
    });
  });

  it('should render node content with contentEditable', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');
    expect(contentDiv).toBeInTheDocument();
    expect(contentDiv).toHaveAttribute('contenteditable', 'true');
  });

  it('should show expand toggle when node has children', () => {
    const nodeWithChildren = { ...mockNode, children: ['child-1'] };

    render(<NodeContent node={nodeWithChildren} expanded={true} onToggle={vi.fn()} />);

    const toggle = screen.getByText('▼');
    expect(toggle).toBeInTheDocument();
  });

  it('should show status checkbox for task nodes', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

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

    render(<NodeContent node={projectNode} expanded={true} onToggle={vi.fn()} />);

    expect(screen.getByText('📁')).toBeInTheDocument();
  });

  it('should call selectNode when clicked', async () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const nodeContent = screen.getByText('Test Task').closest('.node-content');
    fireEvent.click(nodeContent!);

    await waitFor(() => {
      expect(mockActions.selectNode).toHaveBeenCalledWith('test-node', expect.any(Number));
    });
  });

  it('should update content when typing in contentEditable', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');
    fireEvent.input(contentDiv, { target: { textContent: 'Updated Task' } });

    expect(mockActions.updateContent).toHaveBeenCalledWith('test-node', 'Updated Task');
  });

  it('should prevent default on Enter key', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    contentDiv.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should restore content on Escape key', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const contentDiv = screen.getByText('Test Task');

    contentDiv.textContent = 'Changed Content';

    fireEvent.keyDown(contentDiv, { key: 'Escape' });

    expect(contentDiv.textContent).toBe('Test Task');
  });
});
