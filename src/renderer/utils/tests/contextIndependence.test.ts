import { describe, it, expect } from 'vitest';
import { getAppliedContextIdWithInheritance } from '../nodeHelpers';
import { TreeNode } from '@shared/types';

describe('Unified context system', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  it('should use appliedContextId', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task', {
        appliedContextId: 'ctx-1',
      }),
      'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    const appliedContext = getAppliedContextIdWithInheritance('task', nodes, ancestorRegistry);

    expect(appliedContext).toBe('ctx-1');
  });

  it('should inherit context from ancestor', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task'),
      'parent': createNode('parent', {
        appliedContextId: 'ctx-parent',
      }),
      'ctx-parent': createNode('ctx-parent', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': ['parent'] };

    const context = getAppliedContextIdWithInheritance('task', nodes, ancestorRegistry);

    expect(context).toBe('ctx-parent');
  });

  it('should allow descendant to override inherited context', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task', {
        appliedContextId: 'ctx-child',
      }),
      'parent': createNode('parent', {
        appliedContextId: 'ctx-parent',
      }),
      'ctx-parent': createNode('ctx-parent', { isContextDeclaration: true }),
      'ctx-child': createNode('ctx-child', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': ['parent'] };

    const context = getAppliedContextIdWithInheritance('task', nodes, ancestorRegistry);

    // Child's explicit context overrides parent's
    expect(context).toBe('ctx-child');
  });

  it('should return undefined when no context is set', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task'),
    };
    const ancestorRegistry = { 'task': [] };

    const context = getAppliedContextIdWithInheritance('task', nodes, ancestorRegistry);

    expect(context).toBeUndefined();
  });

  it('should allow any node to have an applied context (not just blueprints)', () => {
    const nodes: Record<string, TreeNode> = {
      'regular-node': createNode('regular-node', {
        // Not a blueprint, but still has appliedContextId
        appliedContextId: 'ctx-1',
      }),
      'ctx-1': createNode('ctx-1', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'regular-node': [] };

    const context = getAppliedContextIdWithInheritance('regular-node', nodes, ancestorRegistry);

    expect(context).toBe('ctx-1');
  });
});
