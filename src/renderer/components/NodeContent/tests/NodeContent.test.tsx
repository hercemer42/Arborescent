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

  describe('context declaration overlay', () => {
    const contextDeclarationNode: TreeNode = {
      id: 'context-decl',
      content: 'My Context',
      children: [],
      metadata: {
        isContextDeclaration: true,
        isBlueprint: true,
        blueprintIcon: 'lightbulb',
        blueprintColor: '#3b82f6',
      },
    };

    beforeEach(() => {
      store.setState({
        nodes: {
          'context-decl': contextDeclarationNode,
        },
        ancestorRegistry: {
          'context-decl': [],
        },
      });
    });

    it('should render Asterisk overlay icon for context declarations', () => {
      const { container } = renderWithProvider(
        <NodeContent node={contextDeclarationNode} depth={0} />
      );
      expect(container.querySelector('.context-declaration-overlay')).toBeInTheDocument();
    });

    it('should render Asterisk overlay within a wrapper span', () => {
      const { container } = renderWithProvider(
        <NodeContent node={contextDeclarationNode} depth={0} />
      );
      const overlay = container.querySelector('.context-declaration-overlay');
      expect(overlay?.parentElement?.tagName.toLowerCase()).toBe('span');
    });

    it('should still render the context icon button for click-to-change', () => {
      const { container } = renderWithProvider(
        <NodeContent node={contextDeclarationNode} depth={0} />
      );
      const iconButton = container.querySelector('.context-indicator.context-declaration');
      expect(iconButton).toBeInTheDocument();
      expect(iconButton?.tagName.toLowerCase()).toBe('button');
    });

    it('should render both overlay and context icon together', () => {
      const { container } = renderWithProvider(
        <NodeContent node={contextDeclarationNode} depth={0} />
      );
      expect(container.querySelector('.context-declaration-overlay')).toBeInTheDocument();
      expect(container.querySelector('.context-indicator.context-declaration')).toBeInTheDocument();
    });
  });

  describe('context child nodes', () => {
    const contextDeclNode: TreeNode = {
      id: 'context-parent',
      content: 'Parent Context',
      children: ['context-child-1'],
      metadata: {
        isContextDeclaration: true,
        isBlueprint: true,
        blueprintIcon: 'lightbulb',
        blueprintColor: '#3b82f6',
      },
    };

    const contextChildNode: TreeNode = {
      id: 'context-child-1',
      content: 'Child Node',
      children: [],
      metadata: {
        isBlueprint: true,
      },
    };

    beforeEach(() => {
      store.setState({
        nodes: {
          'context-parent': contextDeclNode,
          'context-child-1': contextChildNode,
        },
        ancestorRegistry: {
          'context-parent': [],
          'context-child-1': ['context-parent'],
        },
      });
    });

    it('should not render Asterisk overlay for context child nodes', () => {
      const { container } = renderWithProvider(
        <NodeContent node={contextChildNode} depth={1} />
      );
      expect(container.querySelector('.context-declaration-overlay')).not.toBeInTheDocument();
    });

    it('should render inherited context icon at reduced opacity', () => {
      const { container } = renderWithProvider(
        <NodeContent node={contextChildNode} depth={1} />
      );
      const contextChild = container.querySelector('.context-indicator.context-child');
      expect(contextChild).toBeInTheDocument();
    });
  });

  describe('regular nodes', () => {
    it('should not render Asterisk overlay for regular nodes', () => {
      const { container } = renderWithProvider(
        <NodeContent node={mockNode} depth={0} />
      );
      expect(container.querySelector('.context-declaration-overlay')).not.toBeInTheDocument();
    });

    it('should not render Asterisk overlay for blueprint nodes', () => {
      const blueprintNode: TreeNode = {
        id: 'blueprint-1',
        content: 'Blueprint',
        children: [],
        metadata: { isBlueprint: true, blueprintIcon: 'folder' },
      };

      store.setState({
        nodes: { 'blueprint-1': blueprintNode },
        ancestorRegistry: { 'blueprint-1': [] },
      });

      const { container } = renderWithProvider(
        <NodeContent node={blueprintNode} depth={0} />
      );
      expect(container.querySelector('.context-declaration-overlay')).not.toBeInTheDocument();
    });
  });

});
