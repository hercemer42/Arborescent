import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import type { TreeNode as TreeNodeType } from '@shared/types';

// Mock hooks to avoid bundling heavy dependencies (@dnd-kit, plugins) that cause OOM during compilation
vi.mock('../hooks/useNodeDragDrop', () => ({
  useNodeDragDrop: () => ({
    isDragging: false,
    isOver: false,
    dropPosition: null,
    setRefs: vi.fn(),
    attributes: {},
    listeners: {},
  }),
}));

vi.mock('../hooks/useNodeMouse', () => ({
  useNodeMouse: () => ({
    handleMouseDown: vi.fn(),
    handleMouseMove: vi.fn(),
    handleClick: vi.fn(),
    wrappedListeners: {},
  }),
}));

vi.mock('../hooks/useNodeEffects', () => ({
  useNodeEffects: () => ({
    flashIntensity: null,
    isDeleting: false,
    nodeRef: { current: null },
    onAnimationEnd: vi.fn(),
  }),
}));

vi.mock('../../NodeGutter/hooks/usePluginIndicators', () => ({
  usePluginIndicators: () => [],
}));

import { TreeNode } from '../TreeNode';

describe('TreeNode', () => {
  let store: TreeStore;

  beforeEach(() => {
    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      activeNodeId: null,
      ancestorRegistry: {},
    });
  });

  afterEach(() => {
    cleanup();
  });

  const renderWithProvider = (component: React.ReactElement) => {
    return render(
      <TreeStoreContext.Provider value={store}>
        {component}
      </TreeStoreContext.Provider>
    );
  };

  it('should render nothing if node does not exist', () => {
    store.setState({ nodes: {} });

    const { container } = renderWithProvider(<TreeNode nodeId="nonexistent" />);
    expect(container.firstChild).toBeNull();
  });

  it('should render node without children', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    store.setState({ nodes: { 'test-node': mockNode } });

    renderWithProvider(<TreeNode nodeId="test-node" />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render node with children', () => {
    const nodes: Record<string, TreeNodeType> = {
      'parent': {
        id: 'parent',
        content: 'Parent Node',
        children: ['child-1'],
        metadata: {},
      },
      'child-1': {
        id: 'child-1',
        content: 'Child Node',
        children: [],
        metadata: {},
      },
    };

    store.setState({ nodes });

    renderWithProvider(<TreeNode nodeId="parent" />);
    expect(screen.getByText('Parent Node')).toBeInTheDocument();
    expect(screen.getByText('Child Node')).toBeInTheDocument();
  });

  it('should apply correct depth indentation', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    store.setState({ nodes: { 'test-node': mockNode } });

    const { container } = renderWithProvider(<TreeNode nodeId="test-node" depth={2} />);
    const nodeContent = container.querySelector('.node-content') as HTMLElement;
    expect(nodeContent).toHaveStyle({ paddingLeft: '55px' }); // depth * 20 + 15
  });

  it('should default depth to 0', () => {
    const mockNode: TreeNodeType = {
      id: 'test-node',
      content: 'Test Task',
      children: [],
      metadata: {},
    };

    store.setState({ nodes: { 'test-node': mockNode } });

    const { container } = renderWithProvider(<TreeNode nodeId="test-node" />);
    const nodeContent = container.querySelector('.node-content') as HTMLElement;
    expect(nodeContent).toHaveStyle({ paddingLeft: '15px' }); // depth * 20 + 15
  });

  // NOTE: Toggle/collapse behavior tests have been moved to useNodeToggle.test.tsx
  // since they require non-mocked hooks that cause OOM during compilation

  describe('active-session highlight', () => {
    afterEach(() => {
      useTerminalStore.setState({ activeTerminalId: null });
    });

    it('applies active-session class when a running workflow step is bound to the focused terminal', () => {
      const mockNode: TreeNodeType = {
        id: 'step-node',
        content: 'Step',
        children: [],
        metadata: {},
      };
      store.setState({
        nodes: { 'step-node': mockNode },
        workflowExecutionStates: {
          'step-node': { state: 'running', terminalTabId: 'terminal-1' },
        },
      });
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const { container } = renderWithProvider(<TreeNode nodeId="step-node" />);
      expect(container.querySelector('.tree-node-wrapper')?.classList.contains('active-session')).toBe(true);
    });

    it('applies active-session class when a terminal collaboration is bound to the focused terminal', () => {
      const mockNode: TreeNodeType = {
        id: 'collab-node',
        content: 'Collab',
        children: [],
        metadata: {},
      };
      store.setState({
        nodes: { 'collab-node': mockNode },
        collaboratingNodeId: 'collab-node',
        collaborationSource: 'terminal',
        collaboratingTerminalId: 'terminal-1',
      });
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const { container } = renderWithProvider(<TreeNode nodeId="collab-node" />);
      expect(container.querySelector('.tree-node-wrapper')?.classList.contains('active-session')).toBe(true);
    });

    it('does not apply active-session class when the focused terminal has no binding', () => {
      const mockNode: TreeNodeType = {
        id: 'plain-node',
        content: 'Plain',
        children: [],
        metadata: {},
      };
      store.setState({ nodes: { 'plain-node': mockNode } });
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const { container } = renderWithProvider(<TreeNode nodeId="plain-node" />);
      expect(container.querySelector('.tree-node-wrapper')?.classList.contains('active-session')).toBe(false);
    });

    it('does not apply active-session class to a node bound to a non-focused terminal', () => {
      const mockNode: TreeNodeType = {
        id: 'other-step',
        content: 'Other',
        children: [],
        metadata: {},
      };
      store.setState({
        nodes: { 'other-step': mockNode },
        workflowExecutionStates: {
          'other-step': { state: 'running', terminalTabId: 'terminal-2' },
        },
      });
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const { container } = renderWithProvider(<TreeNode nodeId="other-step" />);
      expect(container.querySelector('.tree-node-wrapper')?.classList.contains('active-session')).toBe(false);
    });

    it('does not modify activeNodeId (selection) when the active-session highlight applies', () => {
      const mockNode: TreeNodeType = {
        id: 'step-node',
        content: 'Step',
        children: [],
        metadata: {},
      };
      store.setState({
        nodes: { 'step-node': mockNode },
        activeNodeId: 'some-other-node',
        workflowExecutionStates: {
          'step-node': { state: 'running', terminalTabId: 'terminal-1' },
        },
      });
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      renderWithProvider(<TreeNode nodeId="step-node" />);
      expect(store.getState().activeNodeId).toBe('some-other-node');
    });
  });
});
