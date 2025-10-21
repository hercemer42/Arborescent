import { describe, it, expect } from 'vitest';
import { updateNodeMetadata } from './nodeHelpers';
import { TreeNode } from '../../shared/types';

describe('updateNodeMetadata', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: 'Test',
    children: [],
    metadata,
  });

  it('should update node metadata', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: '☐' }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { status: '✓' });

    expect(result['node-1'].metadata.status).toBe('✓');
  });

  it('should merge metadata without losing existing properties', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: '☐', expanded: false }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { status: '✓' });

    expect(result['node-1'].metadata.status).toBe('✓');
    expect(result['node-1'].metadata.expanded).toBe(false);
  });

  it('should add new metadata properties', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: '☐' }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { expanded: false });

    expect(result['node-1'].metadata.status).toBe('☐');
    expect(result['node-1'].metadata.expanded).toBe(false);
  });

  it('should return original nodes if node does not exist', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: '☐' }),
    };

    const result = updateNodeMetadata(nodes, 'node-2', { status: '✓' });

    expect(result).toBe(nodes);
  });

  it('should not mutate original nodes object', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: '☐' }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { status: '✓' });

    expect(result).not.toBe(nodes);
    expect(nodes['node-1'].metadata.status).toBe('☐');
    expect(result['node-1'].metadata.status).toBe('✓');
  });

  it('should handle updating multiple metadata fields at once', () => {
    const nodes = {
      'node-1': createNode('node-1', {}),
    };

    const result = updateNodeMetadata(nodes, 'node-1', {
      status: '✓',
      expanded: false,
      created: '2025-01-01',
    });

    expect(result['node-1'].metadata.status).toBe('✓');
    expect(result['node-1'].metadata.expanded).toBe(false);
    expect(result['node-1'].metadata.created).toBe('2025-01-01');
  });
});
