import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildExecuteSubmenu } from '../useExecuteSubmenu';
import { TreeNode } from '../../../../../shared/types';
import { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

describe('buildExecuteSubmenu', () => {
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
    onExecuteInBrowser: vi.fn(),
    onExecuteInTerminal: vi.fn(),
    onSetActiveContext: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('base actions structure', () => {
    it('should show actions in order: In terminal, In browser', () => {
      const node = createNode('regular-node');
      const result = buildExecuteSubmenu({ ...defaultParams, node });

      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
    });

    it('should enable actions even when no context is selected (execute does not require context)', () => {
      const node = createNode('regular-node');
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];
      const result = buildExecuteSubmenu({ ...defaultParams, node, contextDeclarations });

      // Execute does not require context
      expect(result[0].disabled).toBe(false);
      expect(result[1].disabled).toBe(false);
    });

    it('should enable actions when context is selected', () => {
      const node = createNode('regular-node', { appliedContextId: 'ctx-1' });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      const nodes = { 'regular-node': node, 'ctx-1': ctxNode };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];

      const result = buildExecuteSubmenu({ ...defaultParams, node, nodes, contextDeclarations });

      expect(result[0].disabled).toBe(false);
      expect(result[1].disabled).toBe(false);
    });
  });

  describe('context section', () => {
    it('should show available contexts when they exist', () => {
      const node = createNode('regular-node');
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      const nodes = { 'regular-node': node, 'ctx-1': ctxNode };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'My Context')];

      const result = buildExecuteSubmenu({ ...defaultParams, node, nodes, contextDeclarations });

      // Structure: In terminal, In browser, separator, heading, context
      expect(result).toHaveLength(5);
      expect(result[3].label).toBe('Available contexts');
      expect(result[4].label).toBe('My Context');
    });

    it('should not show context section when no contexts available', () => {
      const node = createNode('regular-node');
      const result = buildExecuteSubmenu({ ...defaultParams, node, contextDeclarations: [] });

      // Only base actions
      expect(result).toHaveLength(2);
    });
  });

  describe('click handlers', () => {
    it('should call onExecuteInTerminal when In terminal is clicked', () => {
      const onExecuteInTerminal = vi.fn();
      const node = createNode('regular-node');

      const result = buildExecuteSubmenu({ ...defaultParams, node, onExecuteInTerminal });

      result[0].onClick?.();
      expect(onExecuteInTerminal).toHaveBeenCalled();
    });

    it('should call onExecuteInBrowser when In browser is clicked', () => {
      const onExecuteInBrowser = vi.fn();
      const node = createNode('regular-node');

      const result = buildExecuteSubmenu({ ...defaultParams, node, onExecuteInBrowser });

      result[1].onClick?.();
      expect(onExecuteInBrowser).toHaveBeenCalled();
    });
  });

  describe('context selection', () => {
    it('should call onSetActiveContext when clicking non-active context', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { appliedContextId: 'ctx-1' });
      const nodes = {
        'task-node': node,
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
        'ctx-2': createNode('ctx-2', { isContextDeclaration: true }),
      };
      const contextDeclarations = [
        createContextDeclaration('ctx-1', 'Context 1'),
        createContextDeclaration('ctx-2', 'Context 2'),
      ];

      const result = buildExecuteSubmenu({ ...defaultParams, node, nodes, contextDeclarations, onSetActiveContext });

      // Click the non-active context (ctx-2)
      result[5].onClick?.();

      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', 'ctx-2');
    });

    it('should call onSetActiveContext with null when clicking active context to clear', () => {
      const onSetActiveContext = vi.fn();
      const node = createNode('task-node', { appliedContextId: 'ctx-1' });
      const nodes = {
        'task-node': node,
        'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
      };
      const contextDeclarations = [createContextDeclaration('ctx-1', 'Context 1')];

      const result = buildExecuteSubmenu({ ...defaultParams, node, nodes, contextDeclarations, onSetActiveContext });

      // Click the active context to clear it
      result[4].onClick?.();

      expect(onSetActiveContext).toHaveBeenCalledWith('task-node', null);
    });
  });
});
