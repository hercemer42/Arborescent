import { describe, it, expect } from 'vitest';
import { getActiveContextIdWithInheritance } from '../nodeHelpers';
import { TreeNode } from '@shared/types';

describe('Execute and Collaborate context independence', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  it('should store and retrieve Execute context independently from Collaborate', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task', {
        activeExecuteContextId: 'ctx-exec',
        activeCollaborateContextId: 'ctx-collab',
      }),
      'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
      'ctx-collab': createNode('ctx-collab', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    const executeContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'execute');
    const collaborateContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'collaborate');

    expect(executeContext).toBe('ctx-exec');
    expect(collaborateContext).toBe('ctx-collab');
    expect(executeContext).not.toBe(collaborateContext);
  });

  it('should allow Execute to have a context while Collaborate has none', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task', {
        activeExecuteContextId: 'ctx-exec',
        // No activeCollaborateContextId
      }),
      'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    const executeContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'execute');
    const collaborateContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'collaborate');

    expect(executeContext).toBe('ctx-exec');
    expect(collaborateContext).toBeUndefined();
  });

  it('should allow Collaborate to have a context while Execute has none', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task', {
        // No activeExecuteContextId
        activeCollaborateContextId: 'ctx-collab',
      }),
      'ctx-collab': createNode('ctx-collab', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    const executeContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'execute');
    const collaborateContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'collaborate');

    expect(executeContext).toBeUndefined();
    expect(collaborateContext).toBe('ctx-collab');
  });

  it('should fall back to shared appliedContextId when neither has explicit selection', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task'),
      'blueprint-parent': createNode('blueprint-parent', {
        isBlueprint: true,
        appliedContextId: 'ctx-default',
      }),
      'ctx-default': createNode('ctx-default', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': ['blueprint-parent'] };

    const executeContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'execute');
    const collaborateContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'collaborate');

    // Both should fall back to the shared default
    expect(executeContext).toBe('ctx-default');
    expect(collaborateContext).toBe('ctx-default');
  });

  it('should use explicit selection over shared fallback', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task', {
        activeExecuteContextId: 'ctx-exec',
        // No activeCollaborateContextId - will fall back
      }),
      'blueprint-parent': createNode('blueprint-parent', {
        isBlueprint: true,
        appliedContextId: 'ctx-default',
      }),
      'ctx-exec': createNode('ctx-exec', { isContextDeclaration: true }),
      'ctx-default': createNode('ctx-default', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': ['blueprint-parent'] };

    const executeContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'execute');
    const collaborateContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'collaborate');

    expect(executeContext).toBe('ctx-exec'); // Explicit selection
    expect(collaborateContext).toBe('ctx-default'); // Falls back to shared default
  });

  it('should inherit Execute context from ancestor independently of Collaborate', () => {
    const nodes: Record<string, TreeNode> = {
      'task': createNode('task'),
      'parent': createNode('parent', {
        activeExecuteContextId: 'ctx-parent-exec',
        activeCollaborateContextId: 'ctx-parent-collab',
      }),
      'ctx-parent-exec': createNode('ctx-parent-exec', { isContextDeclaration: true }),
      'ctx-parent-collab': createNode('ctx-parent-collab', { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': ['parent'] };

    const executeContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'execute');
    const collaborateContext = getActiveContextIdWithInheritance('task', nodes, ancestorRegistry, 'collaborate');

    expect(executeContext).toBe('ctx-parent-exec');
    expect(collaborateContext).toBe('ctx-parent-collab');
  });
});
