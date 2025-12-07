import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCollaborateSubmenu } from '../useCollaborateSubmenu';
import { TreeNode } from '../../../../../shared/types';
import { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

describe('buildCollaborateSubmenu', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  const createContextDeclaration = (nodeId: string, content: string, icon = 'lightbulb'): ContextDeclarationInfo => ({
    nodeId,
    content,
    icon,
  });

  const defaultParams = {
    nodes: {} as Record<string, TreeNode>,
    ancestorRegistry: {} as Record<string, string[]>,
    contextDeclarations: [] as ContextDeclarationInfo[],
    onCollaborate: vi.fn(),
    onCollaborateInTerminal: vi.fn(),
    onSetActiveContext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('base actions structure', () => {
    it('should show actions in order: In terminal, In browser', () => {
      const node = createNode('regular-node');
      const result = buildCollaborateSubmenu({ ...defaultParams, node });

      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
    });

    it('should disable actions when no context is selected', () => {
      const node = createNode('regular-node');
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];
      const result = buildCollaborateSubmenu({ ...defaultParams, node, contextDeclarations });

      // Actions are disabled because collaborate requires a context
      expect(result[0].disabled).toBe(true);
      expect(result[1].disabled).toBe(true);
    });

    it('should enable actions when context is selected', () => {
      const node = createNode('regular-node', { activeCollaborateContextId: 'ctx-1' });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      const nodes = { 'regular-node': node, 'ctx-1': ctxNode };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations });

      expect(result[0].disabled).toBe(false);
      expect(result[1].disabled).toBe(false);
    });
  });

  describe('context section', () => {
    it('should show available contexts section when contexts exist', () => {
      const node = createNode('regular-node');
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true, blueprintIcon: 'star' });
      ctxNode.content = 'My Context';
      const nodes = { 'regular-node': node, 'ctx-1': ctxNode };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'My Context', 'star')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations });

      // Structure: In terminal, In browser, separator, heading, context item
      expect(result).toHaveLength(5);
      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
      expect(result[2].label).toBe('-'); // separator
      expect(result[3].label).toBe('Available contexts'); // heading
      expect(result[4].label).toBe('My Context');
    });

    it('should show message when no contexts are available', () => {
      const node = createNode('regular-node');
      const result = buildCollaborateSubmenu({ ...defaultParams, node, contextDeclarations: [] });

      expect(result).toHaveLength(4);
      expect(result[2].label).toBe('-');
      expect(result[3].label).toBe('No contexts available');
      expect(result[3].disabled).toBe(true);
    });

    it('should show multiple contexts with selection indicator', () => {
      const node = createNode('task-node', { activeCollaborateContextId: 'ctx-1' });
      const ctx1 = createNode('ctx-1', { isContextDeclaration: true, blueprintIcon: 'star' });
      ctx1.content = 'Context One';
      const ctx2 = createNode('ctx-2', { isContextDeclaration: true, blueprintIcon: 'flag' });
      ctx2.content = 'Context Two';

      const nodes = { 'task-node': node, 'ctx-1': ctx1, 'ctx-2': ctx2 };
      const contextDeclarations = [
        createContextDeclaration('ctx-1', 'Context One', 'star'),
        createContextDeclaration('ctx-2', 'Context Two', 'flag'),
      ];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations });

      // Structure: In terminal, In browser, separator, heading, ctx1, ctx2
      expect(result).toHaveLength(6);
      expect(result[4].label).toBe('Context One');
      expect(result[4].radioSelected).toBe(true);
      expect(result[5].label).toBe('Context Two');
      expect(result[5].radioSelected).toBe(false);
    });

    it('should inherit context selection from ancestors', () => {
      const node = createNode('child-node');
      const parentNode = createNode('parent-node', { activeCollaborateContextId: 'ctx-1' });
      const ctx1 = createNode('ctx-1', { isContextDeclaration: true });
      ctx1.content = 'Parent Context';

      const nodes = {
        'child-node': node,
        'parent-node': parentNode,
        'ctx-1': ctx1,
      };
      const ancestorRegistry = {
        'child-node': ['parent-node'],
        'parent-node': [],
      };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Parent Context')];

      const result = buildCollaborateSubmenu({
        ...defaultParams,
        node,
        nodes,
        ancestorRegistry,
        contextDeclarations,
      });

      // Child should inherit parent's selection
      expect(result[4].label).toBe('Parent Context');
      expect(result[4].radioSelected).toBe(true);
    });
  });

  describe('context selection', () => {
    it('should call onSetActiveContext when clicking non-active context', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { activeCollaborateContextId: 'ctx-1' });
      const nodes = {
        'task-node': node,
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
        'ctx-2': createNode('ctx-2', { isContextDeclaration: true }),
      };
      const contextDeclarations = [
        createContextDeclaration('ctx-1', 'Context 1'),
        createContextDeclaration('ctx-2', 'Context 2'),
      ];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations, onSetActiveContext });

      // Click the non-active context (ctx-2) - index 5
      result[5].onClick?.();

      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', 'ctx-2', 'collaborate');
    });

    it('should call onSetActiveContext with null when clicking active context to clear', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { activeCollaborateContextId: 'ctx-1' });
      const nodes = {
        'task-node': node,
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
      };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations, onSetActiveContext });

      // Click the active context to clear it
      result[4].onClick?.();

      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', null, 'collaborate');
    });
  });

  describe('click handlers', () => {
    it('should call onCollaborateInTerminal when In terminal is clicked', () => {
      const onCollaborateInTerminal = vi.fn();
      const node = createNode('regular-node', { activeCollaborateContextId: 'ctx-1' });
      const nodes = { 'regular-node': node, 'ctx-1': createNode('ctx-1', { isContextDeclaration: true }) };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations, onCollaborateInTerminal });

      result[0].onClick?.();
      expect(onCollaborateInTerminal).toHaveBeenCalled();
    });

    it('should call onCollaborate when In browser is clicked', () => {
      const onCollaborate = vi.fn();
      const node = createNode('regular-node', { activeCollaborateContextId: 'ctx-1' });
      const nodes = { 'regular-node': node, 'ctx-1': createNode('ctx-1', { isContextDeclaration: true }) };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations, onCollaborate });

      result[1].onClick?.();
      expect(onCollaborate).toHaveBeenCalled();
    });
  });

  describe('filtering', () => {
    it('should not show context if it is an ancestor of the node', () => {
      const node = createNode('child-node');
      const ancestorCtx = createNode('ancestor-ctx', { isContextDeclaration: true });

      const nodes = { 'child-node': node, 'ancestor-ctx': ancestorCtx };
      const ancestorRegistry = { 'child-node': ['ancestor-ctx'] };
      const contextDeclarations = [createContextDeclaration('ancestor-ctx', 'Ancestor Context')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, ancestorRegistry, contextDeclarations });

      // Should not show ancestor context, only the "no contexts" message
      expect(result).toHaveLength(4);
      expect(result[3].label).toBe('No contexts available');
    });

    it('should not show context if it is the node itself', () => {
      const node = createNode('ctx-node', { isContextDeclaration: true });

      const nodes = { 'ctx-node': node };
      const contextDeclarations = [createContextDeclaration('ctx-node', 'Self Context')];

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, contextDeclarations });

      // Should not show self as context
      expect(result).toHaveLength(4);
      expect(result[3].label).toBe('No contexts available');
    });
  });
});
