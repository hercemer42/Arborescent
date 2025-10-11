import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeContent } from './NodeContent';
import { useTreeStore } from '../../store/treeStore';
import { createPartialMockActions } from '../../test/helpers/mockStoreActions';
import type { Node } from '../../../shared/types';

describe('NodeContent', () => {
  const mockNode: Node = {
    id: 'test-node',
    type: 'task',
    content: 'Test Task',
    children: [],
    metadata: { status: '☐' },
  };

  const mockActions = createPartialMockActions({
    selectAndEdit: vi.fn(),
    updateStatus: vi.fn(),
    saveNodeContent: vi.fn(),
    finishEdit: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();

    useTreeStore.setState({
      nodes: {},
      rootNodeId: '',
      editingNodeId: null,
      selectedNodeId: null,
      nodeTypeConfig: {
        project: { icon: '📁', style: '' },
        task: { icon: '✓', style: '' },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions: mockActions as any,
    });
  });

  it('should render node content in view mode', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
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
    const projectNode: Node = {
      id: 'project-node',
      type: 'project',
      content: 'Project',
      children: [],
      metadata: {},
    };

    render(<NodeContent node={projectNode} expanded={true} onToggle={vi.fn()} />);

    expect(screen.getByText('📁')).toBeInTheDocument();
  });

  it('should render input when editing', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('should call selectAndEdit when clicked', () => {
    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const nodeContent = screen.getByText('Test Task').closest('.node-content');
    fireEvent.click(nodeContent!);

    expect(mockActions.selectAndEdit).toHaveBeenCalledWith('test-node');
  });

  it('should update edit value when typing in input', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated Task' } });

    expect(input.value).toBe('Updated Task');
  });

  it('should save content on blur', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task');
    fireEvent.change(input, { target: { value: 'Updated Task' } });
    fireEvent.blur(input);

    expect(mockActions.saveNodeContent).toHaveBeenCalledWith('test-node', 'Updated Task');
  });

  it('should save content on Enter key', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task');
    fireEvent.change(input, { target: { value: 'Updated Task' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockActions.saveNodeContent).toHaveBeenCalledWith('test-node', 'Updated Task');
  });

  it('should finish edit on Enter with empty value', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockActions.finishEdit).toHaveBeenCalled();
  });

  it('should cancel edit on Escape key', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task');
    fireEvent.change(input, { target: { value: 'Updated Task' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockActions.finishEdit).toHaveBeenCalled();
    expect(input).toHaveValue('Test Task');
  });

  it('should finish edit on blur with empty value', () => {
    useTreeStore.setState({
      editingNodeId: 'test-node',
      selectedNodeId: 'test-node',
    });

    render(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

    const input = screen.getByDisplayValue('Test Task');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);

    expect(mockActions.finishEdit).toHaveBeenCalled();
    expect(input).toHaveValue('Test Task');
  });
});
