import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';
import { getAppliedContextIdWithInheritance } from '../nodeHelpers';

describe('getAppliedContextIdWithInheritance — silent fallback for dangling IDs', () => {
  it('returns null when the node has an appliedContextId that does not resolve to any node in nodes[]', () => {
    const nodes: Record<string, TreeNode> = {
      target: {
        id: 'target',
        content: 'Target',
        children: [],
        metadata: { appliedContextId: 'ghost-sentinel' },
      },
    };
    const ancestorRegistry: Record<string, string[]> = { target: [] };

    const result = getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry);
    expect(result).toBeUndefined();
  });

  it('returns null when the ancestor chain only has dangling IDs and the target node has no direct applied ID', () => {
    const nodes: Record<string, TreeNode> = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['target'],
        metadata: { appliedContextId: 'ghost-ancestor' },
      },
      target: { id: 'target', content: 'T', children: [], metadata: {} },
    };
    const ancestorRegistry: Record<string, string[]> = {
      root: [],
      target: ['root'],
    };

    const result = getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry);
    expect(result).toBeUndefined();
  });

  it('prefers the target node\'s own dangling ID over any ancestor context — both yield null when nothing resolves', () => {
    const nodes: Record<string, TreeNode> = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['target'],
        metadata: { appliedContextId: 'also-ghost' },
      },
      target: {
        id: 'target',
        content: 'T',
        children: [],
        metadata: { appliedContextId: 'ghost-direct' },
      },
    };
    const ancestorRegistry: Record<string, string[]> = {
      root: [],
      target: ['root'],
    };

    const result = getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry);
    expect(result).toBeUndefined();
  });

  it('resolves a real ancestor context even when the target node has a dangling direct ID', () => {
    const nodes: Record<string, TreeNode> = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['target'],
        metadata: { appliedContextId: 'real-ctx' },
      },
      'real-ctx': {
        id: 'real-ctx',
        content: 'Real context',
        children: [],
        metadata: { isContextDeclaration: true },
      },
      target: {
        id: 'target',
        content: 'T',
        children: [],
        metadata: { appliedContextId: 'ghost-direct' },
      },
    };
    const ancestorRegistry: Record<string, string[]> = {
      root: [],
      'real-ctx': [],
      target: ['root'],
    };

    const result = getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry);
    expect(result).toBe('real-ctx');
  });

  it('skips a dangling ancestor and returns a valid context from a higher ancestor', () => {
    const nodes: Record<string, TreeNode> = {
      grand: {
        id: 'grand',
        content: 'Grand',
        children: ['mid'],
        metadata: { appliedContextId: 'real-ctx' },
      },
      mid: {
        id: 'mid',
        content: 'Mid',
        children: ['target'],
        metadata: { appliedContextId: 'ghost-mid' },
      },
      'real-ctx': {
        id: 'real-ctx',
        content: 'Real context',
        children: [],
        metadata: { isContextDeclaration: true },
      },
      target: { id: 'target', content: 'T', children: [], metadata: {} },
    };
    const ancestorRegistry: Record<string, string[]> = {
      grand: [],
      mid: ['grand'],
      'real-ctx': [],
      target: ['grand', 'mid'],
    };

    const result = getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry);
    expect(result).toBe('real-ctx');
  });

  it('returns null without throwing when metadata is absent or undefined', () => {
    const nodes: Record<string, TreeNode> = {
      target: { id: 'target', content: 'T', children: [], metadata: {} },
    };
    const ancestorRegistry: Record<string, string[]> = { target: [] };

    expect(() =>
      getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry),
    ).not.toThrow();
    expect(getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry)).toBeFalsy();
  });

  it('returns null without throwing when the target node does not exist', () => {
    const nodes: Record<string, TreeNode> = {};
    const ancestorRegistry: Record<string, string[]> = {};

    expect(() =>
      getAppliedContextIdWithInheritance('missing-node', nodes, ancestorRegistry),
    ).not.toThrow();
  });
});

describe('getAppliedContextIdWithInheritance — happy path still works', () => {
  it('returns a real context ID when the target node directly references a context that resolves', () => {
    const nodes: Record<string, TreeNode> = {
      ctx: {
        id: 'ctx',
        content: 'My Context',
        children: [],
        metadata: { isContextDeclaration: true },
      },
      target: {
        id: 'target',
        content: 'T',
        children: [],
        metadata: { appliedContextId: 'ctx' },
      },
    };
    const ancestorRegistry: Record<string, string[]> = {
      ctx: [],
      target: [],
    };

    const result = getAppliedContextIdWithInheritance('target', nodes, ancestorRegistry);
    expect(result).toBe('ctx');
  });
});
