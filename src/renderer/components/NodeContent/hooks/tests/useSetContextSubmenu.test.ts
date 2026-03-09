import { describe, it, expect, vi } from 'vitest';
import { buildSetContextSubmenu } from '../useSetContextSubmenu';
import type { TreeNode } from '../../../../../shared/types';
import type { ContextDeclarationInfo } from '../../../../store/tree/treeStore';

vi.mock('../../../ui/CustomizeDialog/CustomizeDialog', () => ({
  getIconByName: () => null,
}));

describe('buildSetContextSubmenu', () => {
  const createNode = (id: string, metadata: Record<string, unknown> = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  const defaultParams = (overrides: Partial<Parameters<typeof buildSetContextSubmenu>[0]> = {}) => ({
    node: createNode('target-node'),
    nodes: {
      'target-node': createNode('target-node'),
      'context-1': createNode('context-1', { isContextDeclaration: true }),
    },
    ancestorRegistry: {
      'target-node': ['root'],
      'context-1': ['root'],
      'root': [],
    } as Record<string, string[]>,
    contextDeclarations: [{
      nodeId: 'context-1',
      content: 'Context One',
      icon: 'star',
    }] as ContextDeclarationInfo[],
    onSetAppliedContext: vi.fn(),
    ...overrides,
  });

  it('should return null when no context declarations exist', () => {
    const result = buildSetContextSubmenu(defaultParams({
      contextDeclarations: [],
    }));
    expect(result).toBeNull();
  });

  it('should return null when all contexts are ancestors of the node', () => {
    const result = buildSetContextSubmenu(defaultParams({
      ancestorRegistry: {
        'target-node': ['root', 'context-1'],
        'context-1': ['root'],
        'root': [],
      },
    }));
    expect(result).toBeNull();
  });

  it('should return null when context is the node itself', () => {
    const result = buildSetContextSubmenu(defaultParams({
      node: createNode('context-1', { isContextDeclaration: true }),
      contextDeclarations: [{
        nodeId: 'context-1',
        content: 'Context One',
        icon: 'star',
      }] as ContextDeclarationInfo[],
    }));
    expect(result).toBeNull();
  });

  it('should return submenu items for available contexts', () => {
    const result = buildSetContextSubmenu(defaultParams());

    expect(result).not.toBeNull();
    expect(result!.length).toBeGreaterThan(0);
    expect(result!.some(item => item.label === 'Context One')).toBe(true);
  });

  it('should include close item and separator', () => {
    const result = buildSetContextSubmenu(defaultParams());

    expect(result).not.toBeNull();
    expect(result![result!.length - 1].label).toBe('Close');
    expect(result![result!.length - 2].label).toBe('-');
  });

  it('should mark active context with radioSelected', () => {
    const result = buildSetContextSubmenu(defaultParams({
      node: createNode('target-node', { appliedContextId: 'context-1' }),
    }));

    const contextItem = result!.find(item => item.label === 'Context One');
    expect(contextItem?.radioSelected).toBe(true);
  });

  it('should call onSetAppliedContext with contextId when selecting', () => {
    const onSetAppliedContext = vi.fn();
    const result = buildSetContextSubmenu(defaultParams({ onSetAppliedContext }));

    const contextItem = result!.find(item => item.label === 'Context One');
    contextItem?.onClick?.();

    expect(onSetAppliedContext).toHaveBeenCalledWith('context-1');
  });

  it('should call onSetAppliedContext with null when deselecting active context', () => {
    const onSetAppliedContext = vi.fn();
    const result = buildSetContextSubmenu(defaultParams({
      node: createNode('target-node', { appliedContextId: 'context-1' }),
      onSetAppliedContext,
    }));

    const contextItem = result!.find(item => item.label === 'Context One');
    contextItem?.onClick?.();

    expect(onSetAppliedContext).toHaveBeenCalledWith(null);
  });

  it('should truncate long context names', () => {
    const longName = 'A'.repeat(50);
    const result = buildSetContextSubmenu(defaultParams({
      contextDeclarations: [{
        nodeId: 'context-1',
        content: longName,
        icon: 'star',
      }] as ContextDeclarationInfo[],
    }));

    const contextItem = result!.find(item => item.label?.includes('...'));
    expect(contextItem).toBeDefined();
    expect(contextItem!.label!.length).toBeLessThan(longName.length);
  });
});
