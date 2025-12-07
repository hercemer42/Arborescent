import { describe, it, expect } from 'vitest';
import { getContextDeclarations } from './nodeHelpers';
import type { TreeNode } from '../../shared/types';

describe('getContextDeclarations', () => {
  const createNode = (id: string, content: string, metadata: Record<string, unknown> = {}): TreeNode => ({
    id,
    content,
    children: [],
    metadata,
  });

  it('should return empty array when no context declarations exist', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', 'Task 1'),
      'node-2': createNode('node-2', 'Task 2'),
    };

    const result = getContextDeclarations(nodes);
    expect(result).toEqual([]);
  });

  it('should find nodes marked as context declarations', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', 'Context A', { isContextDeclaration: true, blueprintIcon: 'star' }),
      'node-2': createNode('node-2', 'Task 2'),
    };

    const result = getContextDeclarations(nodes);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      nodeId: 'node-1',
      content: 'Context A',
      icon: 'star',
    });
  });

  it('should return multiple context declarations', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', 'Context A', { isContextDeclaration: true, blueprintIcon: 'star' }),
      'node-2': createNode('node-2', 'Task 2'),
      'node-3': createNode('node-3', 'Context B', { isContextDeclaration: true, blueprintIcon: 'flag' }),
    };

    const result = getContextDeclarations(nodes);
    expect(result).toHaveLength(2);
  });

  it('should sort context declarations by content alphabetically', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', 'Zebra Context', { isContextDeclaration: true, blueprintIcon: 'star' }),
      'node-2': createNode('node-2', 'Apple Context', { isContextDeclaration: true, blueprintIcon: 'flag' }),
      'node-3': createNode('node-3', 'Middle Context', { isContextDeclaration: true, blueprintIcon: 'bell' }),
    };

    const result = getContextDeclarations(nodes);
    expect(result[0].content).toBe('Apple Context');
    expect(result[1].content).toBe('Middle Context');
    expect(result[2].content).toBe('Zebra Context');
  });

  it('should use default icon "lightbulb" when blueprintIcon is not set', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', 'Context A', { isContextDeclaration: true }),
    };

    const result = getContextDeclarations(nodes);
    expect(result[0].icon).toBe('lightbulb');
  });

  it('should use "Untitled context" when content is empty', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', '', { isContextDeclaration: true, blueprintIcon: 'star' }),
    };

    const result = getContextDeclarations(nodes);
    expect(result[0].content).toBe('Untitled context');
  });

  it('should not include nodes where isContextDeclaration is false', () => {
    const nodes: Record<string, TreeNode> = {
      'node-1': createNode('node-1', 'Context A', { isContextDeclaration: false }),
      'node-2': createNode('node-2', 'Context B', { isContextDeclaration: true, blueprintIcon: 'star' }),
    };

    const result = getContextDeclarations(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].nodeId).toBe('node-2');
  });

  it('should handle empty nodes object', () => {
    const nodes: Record<string, TreeNode> = {};

    const result = getContextDeclarations(nodes);
    expect(result).toEqual([]);
  });
});
