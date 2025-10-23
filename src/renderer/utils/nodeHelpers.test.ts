import { describe, it, expect } from 'vitest';
import { updateNodeMetadata, findPreviousVisibleNode, findNextVisibleNode } from './nodeHelpers';
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

describe('findPreviousVisibleNode', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should find previous sibling', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'child-2': ['root'],
    };

    const result = findPreviousVisibleNode('child-2', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-1');
  });

  it('should find deepest child of previous sibling', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1', ['grandchild-1']),
      'grandchild-1': createNode('grandchild-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'grandchild-1': ['root', 'child-1'],
      'child-2': ['root'],
    };

    const result = findPreviousVisibleNode('child-2', nodes, 'root', ancestorRegistry);
    expect(result).toBe('grandchild-1');
  });

  it('should return parent if first child', () => {
    const nodes = {
      'root': createNode('root', ['child-1']),
      'child-1': createNode('child-1', ['grandchild-1']),
      'grandchild-1': createNode('grandchild-1'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'grandchild-1': ['root', 'child-1'],
    };

    const result = findPreviousVisibleNode('grandchild-1', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-1');
  });

  it('should return null if first child of root', () => {
    const nodes = {
      'root': createNode('root', ['child-1']),
      'child-1': createNode('child-1'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
    };

    const result = findPreviousVisibleNode('child-1', nodes, 'root', ancestorRegistry);
    expect(result).toBeNull();
  });

  it('should skip collapsed children', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1', ['grandchild-1'], { expanded: false }),
      'grandchild-1': createNode('grandchild-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'grandchild-1': ['root', 'child-1'],
      'child-2': ['root'],
    };

    const result = findPreviousVisibleNode('child-2', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-1');
  });
});

describe('findNextVisibleNode', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should find first child if expanded', () => {
    const nodes = {
      'root': createNode('root', ['child-1']),
      'child-1': createNode('child-1', ['grandchild-1']),
      'grandchild-1': createNode('grandchild-1'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'grandchild-1': ['root', 'child-1'],
    };

    const result = findNextVisibleNode('child-1', nodes, 'root', ancestorRegistry);
    expect(result).toBe('grandchild-1');
  });

  it('should find next sibling if no children', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'child-2': ['root'],
    };

    const result = findNextVisibleNode('child-1', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-2');
  });

  it('should find parent sibling if last child', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1', ['grandchild-1']),
      'grandchild-1': createNode('grandchild-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'grandchild-1': ['root', 'child-1'],
      'child-2': ['root'],
    };

    const result = findNextVisibleNode('grandchild-1', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-2');
  });

  it('should return null if last node in tree', () => {
    const nodes = {
      'root': createNode('root', ['child-1']),
      'child-1': createNode('child-1'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
    };

    const result = findNextVisibleNode('child-1', nodes, 'root', ancestorRegistry);
    expect(result).toBeNull();
  });

  it('should skip collapsed children', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1', ['grandchild-1'], { expanded: false }),
      'grandchild-1': createNode('grandchild-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'root': [],
      'child-1': ['root'],
      'grandchild-1': ['root', 'child-1'],
      'child-2': ['root'],
    };

    const result = findNextVisibleNode('child-1', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-2');
  });
});
