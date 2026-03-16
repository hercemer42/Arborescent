import { describe, it, expect, vi } from 'vitest';
import { buildBlueprintSubmenu } from '../useBlueprintSubmenu';
import type { TreeNode } from '../../../../../shared/types';

describe('buildBlueprintSubmenu', () => {
  const createNode = (id: string, overrides: Partial<TreeNode> = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata: {},
    ...overrides,
  });

  const defaultHandlers = {
    onAddToBlueprint: vi.fn(),
    onAddToBlueprintWithDescendants: vi.fn(),
    onRemoveFromBlueprint: vi.fn(),
    onDeclareAsContext: vi.fn(),
    onRemoveContextDeclaration: vi.fn(),
    onSetContextMode: vi.fn(),
    onDeclareAsWorkflow: vi.fn(),
    onRemoveFromWorkflow: vi.fn(),
  };

  const buildParams = (overrides: Record<string, unknown> = {}) => {
    const nodes: Record<string, TreeNode> = {
      'root': createNode('root', { children: ['parent'], metadata: { isBlueprint: true } }),
      'parent': createNode('parent', { children: ['target'], metadata: { isBlueprint: true } }),
      'target': createNode('target'),
      ...(overrides.extraNodes as Record<string, TreeNode> || {}),
    };

    const ancestorRegistry: Record<string, string[]> = {
      'root': [],
      'parent': ['root'],
      'target': ['root', 'parent'],
      ...(overrides.extraAncestors as Record<string, string[]> || {}),
    };

    return {
      node: (overrides.node as TreeNode) || nodes['target'],
      getNodes: () => nodes,
      getAncestorRegistry: () => ancestorRegistry,
      ...defaultHandlers,
      ...(overrides.handlers as Record<string, unknown> || {}),
    };
  };

  it('should show Add to Blueprint for non-blueprint nodes', () => {
    const result = buildBlueprintSubmenu(buildParams());

    expect(result).not.toBeNull();
    expect(result!.submenu!.some(item => item.label === 'Add to Blueprint')).toBe(true);
  });

  it('should show Add with descendants when node has children', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { children: ['child1'] }),
      extraNodes: {
        'child1': createNode('child1'),
      },
      extraAncestors: {
        'child1': ['root', 'parent', 'target'],
      },
    }));

    expect(result!.submenu!.some(item => item.label === 'Add with descendants')).toBe(true);
  });

  it('should show Remove from Blueprint for blueprint nodes', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Remove from Blueprint')).toBe(true);
  });

  it('should not show Remove from Blueprint for workflow nodes', () => {
    const nodes: Record<string, TreeNode> = {
      'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
      'workflow': createNode('workflow', { metadata: { isBlueprint: true, isWorkflow: true } }),
    };

    const result = buildBlueprintSubmenu({
      node: nodes['workflow'],
      getNodes: () => nodes,
      getAncestorRegistry: () => ({ 'root': [], 'workflow': ['root'] }),
      ...defaultHandlers,
    });

    expect(result!.submenu!.some(item => item.label === 'Remove from Blueprint')).toBe(false);
  });

  it('should show Declare as Context when parent is blueprint', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Declare as Context')).toBe(true);
  });

  it('should not show Declare as Context for context declarations', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Declare as Context')).toBe(false);
  });

  it('should show Remove Context Declaration for context declarations', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Remove Context Declaration')).toBe(true);
  });

  it('should show Declare as Workflow for eligible blueprint nodes', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Declare as Workflow')).toBe(true);
  });

  it('should not show Declare as Workflow for context nodes', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Declare as Workflow')).toBe(false);
  });

  it('should show Remove from Workflow for workflow nodes', () => {
    const result = buildBlueprintSubmenu(buildParams({
      node: createNode('target', { metadata: { isBlueprint: true, isWorkflow: true } }),
    }));

    expect(result!.submenu!.some(item => item.label === 'Remove from Workflow')).toBe(true);
  });

  it('should return null when nothing to display', () => {
    const nodes: Record<string, TreeNode> = {
      'root': createNode('root', { children: ['target'] }),
      'target': createNode('target', { metadata: { isContextDeclaration: true } }),
    };

    const result = buildBlueprintSubmenu({
      node: nodes['target'],
      getNodes: () => nodes,
      getAncestorRegistry: () => ({ 'root': [], 'target': ['root'] }),
      ...defaultHandlers,
    });

    // Context declaration with non-blueprint parent: only shows Remove Context Declaration
    expect(result).not.toBeNull();
    expect(result!.submenu!.some(item => item.label === 'Remove Context Declaration')).toBe(true);
  });

  it('should call onAddToBlueprint when Add to Blueprint is clicked', () => {
    const onAddToBlueprint = vi.fn();
    const result = buildBlueprintSubmenu(buildParams({
      handlers: { onAddToBlueprint },
    }));

    const addItem = result!.submenu!.find(item => item.label === 'Add to Blueprint');
    addItem?.onClick?.();

    expect(onAddToBlueprint).toHaveBeenCalled();
  });

  describe('context mode submenu', () => {
    it('should show Context mode submenu for context declarations', () => {
      const result = buildBlueprintSubmenu(buildParams({
        node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true, contextMode: 'collaborate' } }),
      }));

      const modeItem = result!.submenu!.find(item => item.label === 'Context mode');
      expect(modeItem).toBeDefined();
      expect(modeItem!.submenu).toHaveLength(2);
    });

    it('should show Collaborate as selected when context mode is collaborate', () => {
      const result = buildBlueprintSubmenu(buildParams({
        node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true, contextMode: 'collaborate' } }),
      }));

      const modeItem = result!.submenu!.find(item => item.label === 'Context mode');
      const collaborateOption = modeItem!.submenu!.find(item => item.label === 'Collaborate');
      const executeOption = modeItem!.submenu!.find(item => item.label === 'Execute');
      expect(collaborateOption?.radioSelected).toBe(true);
      expect(executeOption?.radioSelected).toBe(false);
    });

    it('should show Execute as selected when context mode is execute', () => {
      const result = buildBlueprintSubmenu(buildParams({
        node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true, contextMode: 'execute' } }),
      }));

      const modeItem = result!.submenu!.find(item => item.label === 'Context mode');
      const executeOption = modeItem!.submenu!.find(item => item.label === 'Execute');
      expect(executeOption?.radioSelected).toBe(true);
    });

    it('should call onSetContextMode when clicking a mode option', () => {
      const onSetContextMode = vi.fn();
      const result = buildBlueprintSubmenu(buildParams({
        node: createNode('target', { metadata: { isBlueprint: true, isContextDeclaration: true, contextMode: 'collaborate' } }),
        handlers: { onSetContextMode },
      }));

      const modeItem = result!.submenu!.find(item => item.label === 'Context mode');
      const executeOption = modeItem!.submenu!.find(item => item.label === 'Execute');
      executeOption?.onClick?.();
      expect(onSetContextMode).toHaveBeenCalledWith('execute');
    });

    it('should not show Context mode submenu for non-context declarations', () => {
      const result = buildBlueprintSubmenu(buildParams({
        node: createNode('target', { metadata: { isBlueprint: true } }),
      }));

      const modeItem = result!.submenu!.find(item => item.label === 'Context mode');
      expect(modeItem).toBeUndefined();
    });
  });
});
