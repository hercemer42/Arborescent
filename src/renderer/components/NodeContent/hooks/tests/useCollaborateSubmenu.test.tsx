import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCollaborateSubmenu } from '../useCollaborateSubmenu';
import { TreeNode } from '../../../../../shared/types';

describe('useCollaborateSubmenu', () => {
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

  describe('base actions', () => {
    it('should return base actions for context declaration nodes', () => {
      const node = createNode('ctx-node', { isContextDeclaration: true });
      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].label).toBe('In browser');
      expect(result.current[1].label).toBe('In terminal');
    });

    it('should return base actions when no context applied', () => {
      const node = createNode('regular-node');
      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].label).toBe('In browser');
      expect(result.current[1].label).toBe('In terminal');
    });

    it('should return base actions when single context applied', () => {
      const node = createNode('regular-node', { appliedContextIds: ['ctx-1'] });
      const nodes = {
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
      };
      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node, nodes })
      );

      expect(result.current).toHaveLength(2);
      expect(result.current[0].label).toBe('In browser');
    });
  });

  describe('inherited context', () => {
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

      const { result } = renderHook(() =>
        useCollaborateSubmenu({
          ...defaultParams,
          node,
          nodes,
          ancestorRegistry,
          hasEffectiveContext: true,
        })
      );

      // Should have: info item, separator, 2 base actions
      expect(result.current).toHaveLength(4);
      expect(result.current[0].label).toBe('Context: My Context');
      expect(result.current[0].disabled).toBe(true);
      expect(result.current[1].label).toBe('-'); // separator
      expect(result.current[2].label).toBe('In browser');
    });
  });

  describe('multiple contexts', () => {
    it('should show context selection with radio indicators', () => {
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

      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node, nodes })
      );

      // Should have: 2 context items, separator, 2 base actions
      expect(result.current).toHaveLength(5);
      expect(result.current[0].label).toBe('Context One');
      expect(result.current[0].radioSelected).toBe(true);
      expect(result.current[1].label).toBe('Context Two');
      expect(result.current[1].radioSelected).toBe(false);
      expect(result.current[2].label).toBe('-'); // separator
    });

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

      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node, nodes, onSetActiveContext })
      );

      // Click the non-active context (ctx-2)
      result.current[1].onClick?.();

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

      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node, nodes, onSetActiveContext })
      );

      // Click the active context (ctx-1)
      result.current[0].onClick?.();

      expect(onSetActiveContext).not.toHaveBeenCalled();
    });
  });

  describe('click handlers', () => {
    it('should call onCollaborate when In browser is clicked', () => {
      const onCollaborate = vi.fn();
      const node = createNode('regular-node');

      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node, onCollaborate })
      );

      result.current[0].onClick?.();
      expect(onCollaborate).toHaveBeenCalled();
    });

    it('should call onCollaborateInTerminal when In terminal is clicked', () => {
      const onCollaborateInTerminal = vi.fn();
      const node = createNode('regular-node');

      const { result } = renderHook(() =>
        useCollaborateSubmenu({ ...defaultParams, node, onCollaborateInTerminal })
      );

      result.current[1].onClick?.();
      expect(onCollaborateInTerminal).toHaveBeenCalled();
    });
  });
});
