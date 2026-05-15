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

  describe('inline URL rendering', () => {
    const urlNode: TreeNode = {
      id: 'url-node',
      content: 'go https://example.com here',
      children: [],
      metadata: { status: 'pending' },
    };

    beforeEach(() => {
      store.setState({
        nodes: { 'url-node': urlNode },
        ancestorRegistry: { 'url-node': [] },
        activeNodeId: null,
      });
    });

    it('renders an inline-url anchor when the node is not selected', () => {
      const { container } = renderWithProvider(<NodeContent node={urlNode} depth={0} />);
      const anchor = container.querySelector('a.inline-url');
      expect(anchor).toBeInTheDocument();
      expect(anchor?.getAttribute('href')).toBe('https://example.com');
    });

    it('falls back to plain contentEditable when the node is selected', () => {
      store.setState({ activeNodeId: 'url-node' });
      const { container } = renderWithProvider(<NodeContent node={urlNode} depth={0} />);
      expect(container.querySelector('a.inline-url')).not.toBeInTheDocument();
      const editable = container.querySelector('[contenteditable="true"]');
      expect(editable).toBeInTheDocument();
    });

    it('renders file:// content as plain text without an anchor', () => {
      const fileNode: TreeNode = {
        id: 'file-node',
        content: 'see file:///etc/passwd here',
        children: [],
        metadata: { status: 'pending' },
      };
      store.setState({
        nodes: { 'file-node': fileNode },
        ancestorRegistry: { 'file-node': [] },
      });
      const { container } = renderWithProvider(<NodeContent node={fileNode} depth={0} />);
      expect(container.querySelector('a.inline-url')).not.toBeInTheDocument();
    });

    it('invokes openExternal when an anchor is clicked', () => {
      const openExternal = vi.fn().mockResolvedValue(undefined);
      (window as unknown as { electron: { openExternal: typeof openExternal } }).electron = {
        openExternal,
      };

      const { container } = renderWithProvider(<NodeContent node={urlNode} depth={0} />);
      const anchor = container.querySelector('a.inline-url');
      expect(anchor).toBeInTheDocument();

      fireEvent.click(anchor!);

      expect(openExternal).toHaveBeenCalledWith('https://example.com');
    });

    it('renders one anchor per URL when multiple URLs are present', () => {
      const multi: TreeNode = {
        id: 'multi-url',
        content: 'a https://a.com and https://b.com b',
        children: [],
        metadata: { status: 'pending' },
      };
      store.setState({
        nodes: { 'multi-url': multi },
        ancestorRegistry: { 'multi-url': [] },
      });
      const { container } = renderWithProvider(<NodeContent node={multi} depth={0} />);
      expect(container.querySelectorAll('a.inline-url')).toHaveLength(2);
    });

    it('renders nodes without URLs through the contentEditable path', () => {
      const plainNode: TreeNode = {
        id: 'plain',
        content: 'no urls here',
        children: [],
        metadata: { status: 'pending' },
      };
      store.setState({
        nodes: { plain: plainNode },
        ancestorRegistry: { plain: [] },
      });
      const { container } = renderWithProvider(<NodeContent node={plainNode} depth={0} />);
      expect(container.querySelector('a.inline-url')).not.toBeInTheDocument();
      expect(container.querySelector('[contenteditable="true"]')).toBeInTheDocument();
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

  describe('workflow step blueprint icon suppression', () => {
    const workflowRoot: TreeNode = {
      id: 'wf-root',
      content: 'Workflow',
      children: ['step-1'],
      metadata: {
        isWorkflow: true,
        isBlueprint: true,
        blueprintIcon: 'cog',
        blueprintColor: '#333',
      },
    };

    const workflowStep: TreeNode = {
      id: 'step-1',
      content: 'First step',
      children: [],
      metadata: {
        isBlueprint: true,
        blueprintIcon: 'diamond',
        blueprintColor: '#f00',
      },
    };

    beforeEach(() => {
      store.setState({
        nodes: {
          'wf-root': workflowRoot,
          'step-1': workflowStep,
        },
        ancestorRegistry: {
          'wf-root': [],
          'step-1': ['wf-root'],
        },
      });
    });

    it('does not render the blueprint-indicator button for a workflow step', () => {
      const { container } = renderWithProvider(
        <NodeContent node={workflowStep} depth={1} />
      );
      expect(container.querySelector('.blueprint-indicator')).not.toBeInTheDocument();
    });

    it('still renders the workflow step number for a workflow step', () => {
      const { container } = renderWithProvider(
        <NodeContent node={workflowStep} depth={1} />
      );
      expect(container.querySelector('.workflow-step-number')).toBeInTheDocument();
    });

    it('renders the blueprint-indicator button for the workflow root itself', () => {
      const { container } = renderWithProvider(
        <NodeContent node={workflowRoot} depth={0} />
      );
      const button = container.querySelector('.blueprint-indicator');
      expect(button).toBeInTheDocument();
      expect(button?.tagName.toLowerCase()).toBe('button');
    });

    it('suppresses the icon even when the workflow step carries its own bespoke blueprintIcon', () => {
      const stepWithOwnIcon: TreeNode = {
        ...workflowStep,
        metadata: { ...workflowStep.metadata, blueprintIcon: 'star' },
      };
      store.setState({
        nodes: { 'wf-root': workflowRoot, 'step-1': stepWithOwnIcon },
        ancestorRegistry: { 'wf-root': [], 'step-1': ['wf-root'] },
      });
      const { container } = renderWithProvider(
        <NodeContent node={stepWithOwnIcon} depth={1} />
      );
      expect(container.querySelector('.blueprint-indicator')).not.toBeInTheDocument();
    });

    it('preserves the blueprint-indicator button on a blueprint node with no workflow ancestor', () => {
      const standaloneBlueprint: TreeNode = {
        id: 'standalone',
        content: 'Standalone blueprint',
        children: [],
        metadata: { isBlueprint: true, blueprintIcon: 'folder' },
      };
      store.setState({
        nodes: { standalone: standaloneBlueprint },
        ancestorRegistry: { standalone: [] },
      });
      const { container } = renderWithProvider(
        <NodeContent node={standaloneBlueprint} depth={0} />
      );
      expect(container.querySelector('.blueprint-indicator')).toBeInTheDocument();
    });

    it('keeps the workflow step recognised as a blueprint element via its isBlueprint metadata', () => {
      renderWithProvider(<NodeContent node={workflowStep} depth={1} />);
      expect(workflowStep.metadata.isBlueprint).toBe(true);
    });
  });

});
