import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildExecuteSubmenu } from '../useExecuteSubmenu';
import { TreeNode } from '../../../../../shared/types';

describe('buildExecuteSubmenu', () => {
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

      expect(result).toHaveLength(2);
      expect(result[0].label).toBe('In terminal');
      expect(result[1].label).toBe('In browser');
    });

    it('should enable actions even when no context applied', () => {
      const node = createNode('regular-node');
      const result = buildExecuteSubmenu({ ...defaultParams, node, hasEffectiveContext: false });

      expect(result[0].disabled).toBe(false);
      expect(result[1].disabled).toBe(false);
    });

    it('should enable actions when context is applied', () => {
      const node = createNode('regular-node', { appliedContextIds: ['ctx-1'] });
      const ctxNode = createNode('ctx-1', { isContextDeclaration: true });
      const nodes = { 'ctx-1': ctxNode };

      const result = buildExecuteSubmenu({ ...defaultParams, node, nodes, hasEffectiveContext: true });

      expect(result[0].disabled).toBe(false);
      expect(result[1].disabled).toBe(false);
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
});
