import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NodeContent } from '../NodeContent';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import { createPartialMockActions } from '../../../test/helpers/mockStoreActions';
import type { TreeNode } from '@shared/types';
import * as pluginStore from '../../../store/plugins/pluginStore';

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
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
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

    const toggle = screen.getByText('⌄');
    expect(toggle).toBeInTheDocument();
  });

  it('should show status checkbox for nodes with content', () => {
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

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

    renderWithProvider(<NodeContent node={node} expanded={true} onToggle={vi.fn()} />);

    // StatusCheckbox does not render when there's no status
    const checkbox = screen.queryByRole('button', { name: /Status/ });
    expect(checkbox).not.toBeInTheDocument();
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

    expect(mockActions.createNode).toHaveBeenCalledWith('test-node');
  });

  it('should restore content on Escape key', () => {
    renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

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
        <NodeContent node={node} expanded={true} onToggle={vi.fn()} />
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

  describe('plugin indicators', () => {
    it('should display plugin indicators when plugins return indicators', () => {
      const provideNodeIndicator = vi.fn(() => '🤖');

      const mockPlugin = {
        manifest: { name: 'test-plugin', version: '1.0.0', displayName: 'Test', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensions: {
          provideNodeIndicator,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin],
          enabledPlugins: [mockPlugin],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const nodeWithSession = {
        ...mockNode,
        metadata: {
          plugins: {
            claude: { sessionId: 'session-123' },
          },
        },
      };

      renderWithProvider(<NodeContent node={nodeWithSession} expanded={true} onToggle={vi.fn()} />);

      expect(provideNodeIndicator).toHaveBeenCalledWith(nodeWithSession);
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should not display plugin indicators section when no indicators', () => {
      const provideNodeIndicator = vi.fn(() => null);

      const mockPlugin = {
        manifest: { name: 'test-plugin', version: '1.0.0', displayName: 'Test', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensions: {
          provideNodeIndicator,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin],
          enabledPlugins: [mockPlugin],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { container } = renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

      expect(provideNodeIndicator).toHaveBeenCalledWith(mockNode);
      expect(container.querySelector('.plugin-indicators')).not.toBeInTheDocument();
    });

    it('should display multiple plugin indicators', () => {
      const provideNodeIndicator1 = vi.fn(() => '🤖');
      const provideNodeIndicator2 = vi.fn(() => '✨');

      const mockPlugin1 = {
        manifest: { name: 'plugin1', version: '1.0.0', displayName: 'Plugin 1', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensions: {
          provideNodeIndicator: provideNodeIndicator1,
        },
      };

      const mockPlugin2 = {
        manifest: { name: 'plugin2', version: '1.0.0', displayName: 'Plugin 2', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensions: {
          provideNodeIndicator: provideNodeIndicator2,
        },
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin1, mockPlugin2],
          enabledPlugins: [mockPlugin1, mockPlugin2],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

      expect(screen.getByText('🤖')).toBeInTheDocument();
      expect(screen.getByText('✨')).toBeInTheDocument();
    });

    it('should handle plugins without provideNodeIndicator method', () => {
      const mockPlugin = {
        manifest: { name: 'test-plugin', version: '1.0.0', displayName: 'Test', enabled: true, builtin: false },
        initialize: vi.fn(),
        dispose: vi.fn(),
        extensions: {},
      };

      vi.spyOn(pluginStore, 'usePluginStore').mockImplementation((selector) => {
        const state = {
          plugins: [mockPlugin],
          enabledPlugins: [mockPlugin],
          registerPlugin: vi.fn(),
          unregisterPlugin: vi.fn(),
          enablePlugin: vi.fn(),
          disablePlugin: vi.fn(),
        };
        return selector ? selector(state) : state;
      });

      const { container } = renderWithProvider(<NodeContent node={mockNode} expanded={true} onToggle={vi.fn()} />);

      expect(container.querySelector('.plugin-indicators')).not.toBeInTheDocument();
    });
  });
});
