import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildCollaborateSubmenu } from '../useCollaborateSubmenu';
import { TreeNode } from '../../../../../shared/types';

describe('buildCollaborateSubmenu', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  const defaultParams = {
    nodes: {} as Record<string, TreeNode>,
    ancestorRegistry: {} as Record<string, string[]>,
    hasEffectiveContext: false,
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

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
    });

    it('should disable actions when no context applied', () => {
      const node = createNode('regular-node');
      const result = buildCollaborateSubmenu({ ...defaultParams, node, hasEffectiveContext: false });

      expect(result[0].disabled).toBe(true);
      expect(result[1].disabled).toBe(true);
    });

    it('should enable actions when context is applied', () => {
      const node = createNode('regular-node', { appliedContextIds: ['ctx-1'] });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      const nodes = { 'ctx-1': ctxNode };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true });

      expect(result[0].disabled).toBe(false);
      expect(result[1].disabled).toBe(false);
    });
  });

  describe('context section', () => {
    it('should show context section below actions with heading', () => {
      const node = createNode('regular-node', { appliedContextIds: ['ctx-1'] });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      ctxNode.content = 'My Context';
      const nodes = { 'regular-node': node, 'ctx-1': ctxNode };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true });

      // Structure: In terminal, In browser, separator, heading, context info
      expect(result).toHaveLength(5);
      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
      expect(result[2].label).toBe('-'); // separator
      expect(result[3].label).toBe('Applied contexts'); // heading
      expect(result[4].label).toBe('My Context');
    });

    it('should show inherited context as read-only info', () => {
      const node = createNode('child-node');
      const parentNode = createNode('parent-node', {
        appliedContextIds: ['ctx-1'],
        activeContextId: 'ctx-1',
      });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      ctxNode.content = 'My Context';

      const nodes = {
        'child-node': node,
        'parent-node': parentNode,
        'ctx-1': ctxNode,
      };
      const ancestorRegistry = {
        'child-node': ['parent-node'],
        'parent-node': [],
      };

      const result = buildCollaborateSubmenu({
        ...defaultParams,
        node,
        nodes,
        ancestorRegistry,
        hasEffectiveContext: true,
      });

      // Structure: In terminal, In browser, separator, heading, context info
      expect(result).toHaveLength(5);
      expect(result[4].label).toBe('My Context');
      expect(result[4].disabled).toBe(true);
    });

    it('should show multiple contexts with radio selection', () => {
      const node = createNode('task-node', {
        appliedContextIds: ['ctx-1', 'ctx-2'],
        activeContextId: 'ctx-1',
      });
      const ctx1 = createNode('ctx-1', { isContextDeclaration: true, contextIcon: 'star' });
      ctx1.content = 'Context One';
      const ctx2 = createNode('ctx-2', { isContextDeclaration: true, contextIcon: 'flag' });
      ctx2.content = 'Context Two';

      const nodes = {
        'task-node': node,
        'ctx-1': ctx1,
        'ctx-2': ctx2,
      };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true });

      // Structure: In terminal, In browser, separator, heading, ctx1, ctx2
      expect(result).toHaveLength(6);
      expect(result[4].label).toBe('Context One');
      expect(result[4].radioSelected).toBe(true);
      expect(result[5].label).toBe('Context Two');
      expect(result[5].radioSelected).toBe(false);
    });

    it('should accumulate contexts from ancestors', () => {
      const node = createNode('child-node', { appliedContextIds: ['ctx-1'] });
      const parentNode = createNode('parent-node', { appliedContextIds: ['ctx-2'] });
      const ctx1 = createNode('ctx-1', { isContextDeclaration: true });
      ctx1.content = 'Child Context';
      const ctx2 = createNode('ctx-2', { isContextDeclaration: true });
      ctx2.content = 'Parent Context';

      const nodes = {
        'child-node': node,
        'parent-node': parentNode,
        'ctx-1': ctx1,
        'ctx-2': ctx2,
      };
      const ancestorRegistry = {
        'child-node': ['parent-node'],
        'parent-node': [],
      };

      const result = buildCollaborateSubmenu({
        ...defaultParams,
        node,
        nodes,
        ancestorRegistry,
        hasEffectiveContext: true,
      });

      // Should show both node's own context AND parent's context
      // Structure: In terminal, In browser, separator, heading, ctx1, ctx2
      expect(result).toHaveLength(6);
      expect(result[4].label).toBe('Child Context');
      expect(result[4].radioSelected).toBe(true); // node's own context is active
      expect(result[5].label).toBe('Parent Context');
      expect(result[5].radioSelected).toBe(false);
    });
  });

  describe('context selection', () => {
    it('should call onSetActiveContext when clicking non-active context', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', {
        appliedContextIds: ['ctx-1', 'ctx-2'],
        activeContextId: 'ctx-1',
      });
      const nodes = {
        'task-node': node,
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
        'ctx-2': createNode('ctx-2', { isContextDeclaration: true }),
      };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true, onSetActiveContext });

      // Click the non-active context (ctx-2) - index 5 in new structure
      result[5].onClick?.();

      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', 'ctx-2');
    });

    it('should not call onSetActiveContext when clicking active context', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', {
        appliedContextIds: ['ctx-1', 'ctx-2'],
        activeContextId: 'ctx-1',
      });
      const nodes = {
        'task-node': node,
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
        'ctx-2': createNode('ctx-2', { isContextDeclaration: true }),
      };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true, onSetActiveContext });

      // Click the active context (ctx-1) - index 4 in new structure
      result[4].onClick?.();

      expect(onSetActiveContext).not.toHaveBeenCalled();
    });
  });

  describe('click handlers', () => {
    it('should call onCollaborateInTerminal when In terminal is clicked', () => {
      const onCollaborateInTerminal = vi.fn();
      const node = createNode('regular-node', { appliedContextIds: ['ctx-1'] });
      const nodes = { 'ctx-1': createNode('ctx-1', { isContextDeclaration: true }) };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true, onCollaborateInTerminal });

      result[0].onClick?.();
      expect(onCollaborateInTerminal).toHaveBeenCalled();
    });

    it('should call onCollaborate when In browser is clicked', () => {
      const onCollaborate = vi.fn();
      const node = createNode('regular-node', { appliedContextIds: ['ctx-1'] });
      const nodes = { 'ctx-1': createNode('ctx-1', { isContextDeclaration: true }) };

      const result = buildCollaborateSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true, onCollaborate });

      result[1].onClick?.();
      expect(onCollaborate).toHaveBeenCalled();
    });
  });
});
