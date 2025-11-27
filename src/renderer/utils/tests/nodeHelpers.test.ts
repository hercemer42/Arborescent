import { describe, it, expect } from 'vitest';
import {
  updateNodeMetadata,
  findPreviousNode,
  findNextNode,
  createTreeNode,
  cloneNodesWithNewIds,
  getEffectiveContextId,
} from '../nodeHelpers';
import { TreeNode } from '@shared/types';

describe('updateNodeMetadata', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: 'Test',
    children: [],
    metadata,
  });

  it('should update node metadata', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: 'pending' }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { status: 'completed' });

    expect(result['node-1'].metadata.status).toBe('completed');
  });

  it('should merge metadata without losing existing properties', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: 'pending', expanded: false }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { status: 'completed' });

    expect(result['node-1'].metadata.status).toBe('completed');
    expect(result['node-1'].metadata.expanded).toBe(false);
  });

  it('should add new metadata properties', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: 'pending' }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { expanded: false });

    expect(result['node-1'].metadata.status).toBe('pending');
    expect(result['node-1'].metadata.expanded).toBe(false);
  });

  it('should return original nodes if node does not exist', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: 'pending' }),
    };

    const result = updateNodeMetadata(nodes, 'node-2', { status: 'completed' });

    expect(result).toBe(nodes);
  });

  it('should not mutate original nodes object', () => {
    const nodes = {
      'node-1': createNode('node-1', { status: 'pending' }),
    };

    const result = updateNodeMetadata(nodes, 'node-1', { status: 'completed' });

    expect(result).not.toBe(nodes);
    expect(nodes['node-1'].metadata.status).toBe('pending');
    expect(result['node-1'].metadata.status).toBe('completed');
  });

  it('should handle updating multiple metadata fields at once', () => {
    const nodes = {
      'node-1': createNode('node-1', {}),
    };

    const result = updateNodeMetadata(nodes, 'node-1', {
      status: 'completed',
      expanded: false,
      created: '2025-01-01',
    });

    expect(result['node-1'].metadata.status).toBe('completed');
    expect(result['node-1'].metadata.expanded).toBe(false);
    expect(result['node-1'].metadata.created).toBe('2025-01-01');
  });
});

describe('findPreviousNode', () => {
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

    const result = findPreviousNode('child-2', nodes, 'root', ancestorRegistry);
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

    const result = findPreviousNode('child-2', nodes, 'root', ancestorRegistry);
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

    const result = findPreviousNode('grandchild-1', nodes, 'root', ancestorRegistry);
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

    const result = findPreviousNode('child-1', nodes, 'root', ancestorRegistry);
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

    const result = findPreviousNode('child-2', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-1');
  });
});

describe('findNextNode', () => {
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

    const result = findNextNode('child-1', nodes, 'root', ancestorRegistry);
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

    const result = findNextNode('child-1', nodes, 'root', ancestorRegistry);
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

    const result = findNextNode('grandchild-1', nodes, 'root', ancestorRegistry);
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

    const result = findNextNode('child-1', nodes, 'root', ancestorRegistry);
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

    const result = findNextNode('child-1', nodes, 'root', ancestorRegistry);
    expect(result).toBe('child-2');
  });
});

describe('createTreeNode', () => {
  it('should create a node with only id', () => {
    const node = createTreeNode('test-id');

    expect(node).toEqual({
      id: 'test-id',
      content: '',
      children: [],
      metadata: {},
    });
  });

  it('should create a node with content', () => {
    const node = createTreeNode('test-id', { content: 'Hello world' });

    expect(node.id).toBe('test-id');
    expect(node.content).toBe('Hello world');
    expect(node.children).toEqual([]);
    expect(node.metadata).toEqual({});
  });

  it('should create a node with children', () => {
    const node = createTreeNode('parent-id', { children: ['child-1', 'child-2'] });

    expect(node.id).toBe('parent-id');
    expect(node.content).toBe('');
    expect(node.children).toEqual(['child-1', 'child-2']);
    expect(node.metadata).toEqual({});
  });

  it('should create a node with metadata', () => {
    const node = createTreeNode('test-id', { metadata: { status: 'pending', isRoot: true } });

    expect(node.id).toBe('test-id');
    expect(node.content).toBe('');
    expect(node.children).toEqual([]);
    expect(node.metadata).toEqual({ status: 'pending', isRoot: true });
  });

  it('should create a node with all options', () => {
    const node = createTreeNode('test-id', {
      content: 'Test content',
      children: ['child-1'],
      metadata: { status: 'completed' },
    });

    expect(node).toEqual({
      id: 'test-id',
      content: 'Test content',
      children: ['child-1'],
      metadata: { status: 'completed' },
    });
  });

  it('should not share references between nodes', () => {
    const node1 = createTreeNode('node-1');
    const node2 = createTreeNode('node-2');

    node1.children.push('child-a');
    node1.metadata.status = 'pending';

    expect(node2.children).toEqual([]);
    expect(node2.metadata).toEqual({});
  });
});

describe('cloneNodesWithNewIds', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should generate new UUIDs for all nodes', () => {
    const cachedNodes = {
      'original-id': createNode('original-id'),
    };

    const result = cloneNodesWithNewIds(['original-id'], cachedNodes);

    expect(result.newRootNodes).toHaveLength(1);
    expect(result.newRootNodes[0].id).not.toBe('original-id');
    expect(result.newRootNodes[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('should update children references to new IDs', () => {
    const cachedNodes = {
      parent: createNode('parent', ['child']),
      child: createNode('child'),
    };

    const result = cloneNodesWithNewIds(['parent'], cachedNodes);

    const newParent = result.newRootNodes[0];
    expect(newParent.children).toHaveLength(1);
    expect(newParent.children[0]).not.toBe('child');

    // The child reference should point to the cloned child
    const newChildId = newParent.children[0];
    expect(result.newNodesMap[newChildId]).toBeDefined();
    expect(result.newNodesMap[newChildId].content).toBe('Node child');
  });

  it('should preserve all metadata', () => {
    const cachedNodes = {
      'node-1': createNode('node-1', [], {
        status: 'completed',
        appliedContextId: 'ctx-123',
        customField: { nested: 'value' },
      }),
    };

    const result = cloneNodesWithNewIds(['node-1'], cachedNodes);

    expect(result.newRootNodes[0].metadata).toEqual({
      status: 'completed',
      appliedContextId: 'ctx-123',
      customField: { nested: 'value' },
    });
  });

  it('should handle multiple root nodes', () => {
    const cachedNodes = {
      'root1': createNode('root1'),
      'root2': createNode('root2'),
    };

    const result = cloneNodesWithNewIds(['root1', 'root2'], cachedNodes);

    expect(result.newRootNodes).toHaveLength(2);
    expect(result.newRootNodes[0].id).not.toBe(result.newRootNodes[1].id);
  });

  it('should deep clone (not share references)', () => {
    const cachedNodes = {
      'node-1': createNode('node-1', [], { nested: { value: 'original' } }),
    };

    const result = cloneNodesWithNewIds(['node-1'], cachedNodes);
    (result.newRootNodes[0].metadata.nested as { value: string }).value = 'modified';

    expect((cachedNodes['node-1'].metadata.nested as { value: string }).value).toBe('original');
  });
});

describe('getEffectiveContextId', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return node own appliedContextId', () => {
    const nodes = {
      'node-1': createNode('node-1', [], { appliedContextId: 'ctx-1' }),
    };
    const ancestorRegistry = { 'node-1': [] };

    const result = getEffectiveContextId('node-1', nodes, ancestorRegistry);
    expect(result).toBe('ctx-1');
  });

  it('should return inherited context from parent', () => {
    const nodes = {
      'parent': createNode('parent', ['child'], { appliedContextId: 'ctx-1' }),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    const result = getEffectiveContextId('child', nodes, ancestorRegistry);
    expect(result).toBe('ctx-1');
  });

  it('should return inherited context from grandparent', () => {
    const nodes = {
      'grandparent': createNode('grandparent', ['parent'], { appliedContextId: 'ctx-1' }),
      'parent': createNode('parent', ['child']),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'grandparent': [],
      'parent': ['grandparent'],
      'child': ['grandparent', 'parent'],
    };

    const result = getEffectiveContextId('child', nodes, ancestorRegistry);
    expect(result).toBe('ctx-1');
  });

  it('should prefer node own context over inherited', () => {
    const nodes = {
      'parent': createNode('parent', ['child'], { appliedContextId: 'ctx-parent' }),
      'child': createNode('child', [], { appliedContextId: 'ctx-child' }),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    const result = getEffectiveContextId('child', nodes, ancestorRegistry);
    expect(result).toBe('ctx-child');
  });

  it('should return closest ancestor context when multiple exist', () => {
    const nodes = {
      'grandparent': createNode('grandparent', ['parent'], { appliedContextId: 'ctx-gp' }),
      'parent': createNode('parent', ['child'], { appliedContextId: 'ctx-parent' }),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'grandparent': [],
      'parent': ['grandparent'],
      'child': ['grandparent', 'parent'],
    };

    const result = getEffectiveContextId('child', nodes, ancestorRegistry);
    expect(result).toBe('ctx-parent');
  });

  it('should return null if no context in chain', () => {
    const nodes = {
      'parent': createNode('parent', ['child']),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    const result = getEffectiveContextId('child', nodes, ancestorRegistry);
    expect(result).toBeNull();
  });

  it('should return null for non-existent node', () => {
    const nodes = {};
    const ancestorRegistry = {};

    const result = getEffectiveContextId('non-existent', nodes, ancestorRegistry);
    expect(result).toBeNull();
  });
});
