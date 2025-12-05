import { describe, it, expect } from 'vitest';
import {
  updateNodeMetadata,
  findPreviousNode,
  findNextNode,
  createTreeNode,
  cloneNodesWithNewIds,
  getEffectiveContextIds,
  getNextSiblingId,
  findClosestAncestorWithMetadata,
  getActiveContextId,
  resolveBundledContexts,
  getContextsForCollaboration,
  getNodeAndDescendantIds,
  getParentId,
  getAllDescendants,
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
        appliedContextIds: ['ctx-123'],
        customField: { nested: 'value' },
      }),
    };

    const result = cloneNodesWithNewIds(['node-1'], cachedNodes);

    expect(result.newRootNodes[0].metadata).toEqual({
      status: 'completed',
      appliedContextIds: ['ctx-123'],
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

describe('getEffectiveContextIds', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return node own appliedContextIds', () => {
    const nodes = {
      'node-1': createNode('node-1', [], { appliedContextIds: ['ctx-1'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'node-1': [] };

    const result = getEffectiveContextIds('node-1', nodes, ancestorRegistry);
    expect(result).toEqual(['ctx-1']);
  });

  it('should return multiple contexts from node', () => {
    const nodes = {
      'node-1': createNode('node-1', [], { appliedContextIds: ['ctx-1', 'ctx-2'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'node-1': [] };

    const result = getEffectiveContextIds('node-1', nodes, ancestorRegistry);
    expect(result).toEqual(['ctx-1', 'ctx-2']);
  });

  it('should return inherited context from parent', () => {
    const nodes = {
      'parent': createNode('parent', ['child'], { appliedContextIds: ['ctx-1'] }),
      'child': createNode('child'),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    const result = getEffectiveContextIds('child', nodes, ancestorRegistry);
    expect(result).toEqual(['ctx-1']);
  });

  it('should return inherited context from grandparent', () => {
    const nodes = {
      'grandparent': createNode('grandparent', ['parent'], { appliedContextIds: ['ctx-1'] }),
      'parent': createNode('parent', ['child']),
      'child': createNode('child'),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'grandparent': [],
      'parent': ['grandparent'],
      'child': ['grandparent', 'parent'],
    };

    const result = getEffectiveContextIds('child', nodes, ancestorRegistry);
    expect(result).toEqual(['ctx-1']);
  });

  it('should accumulate node own contexts and ancestor contexts', () => {
    const nodes = {
      'parent': createNode('parent', ['child'], { appliedContextIds: ['ctx-parent'] }),
      'child': createNode('child', [], { appliedContextIds: ['ctx-child'] }),
      'ctx-parent': createNode('ctx-parent', [], { isContextDeclaration: true }),
      'ctx-child': createNode('ctx-child', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    const result = getEffectiveContextIds('child', nodes, ancestorRegistry);
    // Node's own context comes first, then ancestor context
    expect(result).toEqual(['ctx-child', 'ctx-parent']);
  });

  it('should accumulate contexts from all ancestors (closest first)', () => {
    const nodes = {
      'grandparent': createNode('grandparent', ['parent'], { appliedContextIds: ['ctx-gp'] }),
      'parent': createNode('parent', ['child'], { appliedContextIds: ['ctx-parent'] }),
      'child': createNode('child'),
      'ctx-gp': createNode('ctx-gp', [], { isContextDeclaration: true }),
      'ctx-parent': createNode('ctx-parent', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'grandparent': [],
      'parent': ['grandparent'],
      'child': ['grandparent', 'parent'],
    };

    const result = getEffectiveContextIds('child', nodes, ancestorRegistry);
    // Child inherits from both: parent (nearest) first, then grandparent
    expect(result).toEqual(['ctx-parent', 'ctx-gp']);
  });

  it('should skip ancestors without contexts when accumulating', () => {
    const nodes = {
      'grandparent': createNode('grandparent', ['parent'], { appliedContextIds: ['ctx-gp'] }),
      'parent': createNode('parent', ['child']), // No context
      'child': createNode('child'),
      'ctx-gp': createNode('ctx-gp', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'grandparent': [],
      'parent': ['grandparent'],
      'child': ['grandparent', 'parent'],
    };

    const result = getEffectiveContextIds('child', nodes, ancestorRegistry);
    // Parent has no context, so only grandparent context is included
    expect(result).toEqual(['ctx-gp']);
  });

  it('should return empty array if no context in chain', () => {
    const nodes = {
      'parent': createNode('parent', ['child']),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    const result = getEffectiveContextIds('child', nodes, ancestorRegistry);
    expect(result).toEqual([]);
  });

  it('should return empty array for non-existent node', () => {
    const nodes = {};
    const ancestorRegistry = {};

    const result = getEffectiveContextIds('non-existent', nodes, ancestorRegistry);
    expect(result).toEqual([]);
  });

  it('should filter out context IDs that do not exist as nodes', () => {
    const nodes = {
      'node-1': createNode('node-1', [], { appliedContextIds: ['ctx-exists', 'ctx-missing'] }),
      'ctx-exists': createNode('ctx-exists', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'node-1': [] };

    const result = getEffectiveContextIds('node-1', nodes, ancestorRegistry);
    expect(result).toEqual(['ctx-exists']);
  });
});

describe('getNextSiblingId', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return next sibling id when it exists', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2', 'child-3']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
      'child-3': createNode('child-3'),
    };
    const ancestorRegistry = {
      'child-1': ['root'],
      'child-2': ['root'],
      'child-3': ['root'],
    };

    expect(getNextSiblingId('child-1', nodes, 'root', ancestorRegistry)).toBe('child-2');
    expect(getNextSiblingId('child-2', nodes, 'root', ancestorRegistry)).toBe('child-3');
  });

  it('should return null when node is last sibling', () => {
    const nodes = {
      'root': createNode('root', ['child-1', 'child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'child-1': ['root'],
      'child-2': ['root'],
    };

    expect(getNextSiblingId('child-2', nodes, 'root', ancestorRegistry)).toBeNull();
  });

  it('should return null when node is only child', () => {
    const nodes = {
      'root': createNode('root', ['only-child']),
      'only-child': createNode('only-child'),
    };
    const ancestorRegistry = {
      'only-child': ['root'],
    };

    expect(getNextSiblingId('only-child', nodes, 'root', ancestorRegistry)).toBeNull();
  });

  it('should work with nested nodes', () => {
    const nodes = {
      'root': createNode('root', ['parent']),
      'parent': createNode('parent', ['child-1', 'child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    const ancestorRegistry = {
      'parent': ['root'],
      'child-1': ['root', 'parent'],
      'child-2': ['root', 'parent'],
    };

    expect(getNextSiblingId('child-1', nodes, 'root', ancestorRegistry)).toBe('child-2');
  });
});

describe('findClosestAncestorWithMetadata', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return node itself if it has the metadata flag', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { nextStepContext: true }),
    };
    const ancestorRegistry = {
      'child': ['root'],
    };

    expect(findClosestAncestorWithMetadata('child', nodes, ancestorRegistry, 'nextStepContext')).toBe('child');
  });

  it('should return closest ancestor with the metadata flag', () => {
    const nodes = {
      'root': createNode('root', ['parent']),
      'parent': createNode('parent', ['child'], { nextStepContext: true }),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'parent': ['root'],
      'child': ['root', 'parent'],
    };

    expect(findClosestAncestorWithMetadata('child', nodes, ancestorRegistry, 'nextStepContext')).toBe('parent');
  });

  it('should return closest when multiple ancestors have the flag', () => {
    const nodes = {
      'root': createNode('root', ['grandparent']),
      'grandparent': createNode('grandparent', ['parent'], { nextStepContext: true }),
      'parent': createNode('parent', ['child'], { nextStepContext: true }),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'grandparent': ['root'],
      'parent': ['root', 'grandparent'],
      'child': ['root', 'grandparent', 'parent'],
    };

    // Should return parent (closest), not grandparent
    expect(findClosestAncestorWithMetadata('child', nodes, ancestorRegistry, 'nextStepContext')).toBe('parent');
  });

  it('should return null when no ancestor has the flag', () => {
    const nodes = {
      'root': createNode('root', ['parent']),
      'parent': createNode('parent', ['child']),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'parent': ['root'],
      'child': ['root', 'parent'],
    };

    expect(findClosestAncestorWithMetadata('child', nodes, ancestorRegistry, 'nextStepContext')).toBeNull();
  });

  it('should return null for non-existent node', () => {
    const nodes = {};
    const ancestorRegistry = {};

    expect(findClosestAncestorWithMetadata('non-existent', nodes, ancestorRegistry, 'nextStepContext')).toBeNull();
  });

  it('should work with different metadata keys', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'child': ['root'],
    };

    expect(findClosestAncestorWithMetadata('child', nodes, ancestorRegistry, 'isContextDeclaration')).toBe('child');
    expect(findClosestAncestorWithMetadata('child', nodes, ancestorRegistry, 'nextStepContext')).toBeNull();
  });
});

describe('getActiveContextId', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return activeContextId when set on regular node', () => {
    const nodes = {
      'node': createNode('node', [], { appliedContextIds: ['ctx-1', 'ctx-2'], activeContextId: 'ctx-2' }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'node': [] };

    expect(getActiveContextId('node', nodes, ancestorRegistry)).toBe('ctx-2');
  });

  it('should return first applied context when activeContextId not set', () => {
    const nodes = {
      'node': createNode('node', [], { appliedContextIds: ['ctx-1', 'ctx-2'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'node': [] };

    expect(getActiveContextId('node', nodes, ancestorRegistry)).toBe('ctx-1');
  });

  it('should return active context for context declaration nodes with applied contexts', () => {
    const nodes = {
      'ctx-node': createNode('ctx-node', [], { isContextDeclaration: true, appliedContextIds: ['ctx-1'], activeContextId: 'ctx-1' }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'ctx-node': [] };

    expect(getActiveContextId('ctx-node', nodes, ancestorRegistry)).toBe('ctx-1');
  });

  it('should inherit active context from ancestor', () => {
    const nodes = {
      'parent': createNode('parent', ['child'], { appliedContextIds: ['ctx-1', 'ctx-2'], activeContextId: 'ctx-2' }),
      'child': createNode('child'),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    expect(getActiveContextId('child', nodes, ancestorRegistry)).toBe('ctx-2');
  });

  it('should return first inherited context when ancestor has no activeContextId', () => {
    const nodes = {
      'parent': createNode('parent', ['child'], { appliedContextIds: ['ctx-1', 'ctx-2'] }),
      'child': createNode('child'),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    expect(getActiveContextId('child', nodes, ancestorRegistry)).toBe('ctx-1');
  });

  it('should return undefined when no context in chain', () => {
    const nodes = {
      'parent': createNode('parent', ['child']),
      'child': createNode('child'),
    };
    const ancestorRegistry = {
      'parent': [],
      'child': ['parent'],
    };

    expect(getActiveContextId('child', nodes, ancestorRegistry)).toBeUndefined();
  });

  it('should fall back to first context if activeContextId is invalid', () => {
    const nodes = {
      'node': createNode('node', [], { appliedContextIds: ['ctx-1', 'ctx-2'], activeContextId: 'invalid' }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'node': [] };

    expect(getActiveContextId('node', nodes, ancestorRegistry)).toBe('ctx-1');
  });

  it('should return undefined when applied context nodes do not exist', () => {
    const nodes = {
      'node': createNode('node', [], { appliedContextIds: ['non-existent'] }),
    };
    const ancestorRegistry = { 'node': [] };

    expect(getActiveContextId('node', nodes, ancestorRegistry)).toBeUndefined();
  });
});

describe('resolveBundledContexts', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return just the context node when no bundle', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };

    expect(resolveBundledContexts('ctx-1', nodes)).toEqual(['ctx-1']);
  });

  it('should resolve bundled contexts in order', () => {
    const nodes = {
      'bundle': createNode('bundle', [], { isContextDeclaration: true, bundledContextIds: ['ctx-1', 'ctx-2'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };

    // Bundled contexts come first, then the bundle itself
    expect(resolveBundledContexts('bundle', nodes)).toEqual(['ctx-1', 'ctx-2', 'bundle']);
  });

  it('should resolve nested bundles', () => {
    const nodes = {
      'outer-bundle': createNode('outer-bundle', [], { isContextDeclaration: true, bundledContextIds: ['inner-bundle'] }),
      'inner-bundle': createNode('inner-bundle', [], { isContextDeclaration: true, bundledContextIds: ['ctx-1'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };

    // Deepest first: ctx-1, then inner-bundle, then outer-bundle
    expect(resolveBundledContexts('outer-bundle', nodes)).toEqual(['ctx-1', 'inner-bundle', 'outer-bundle']);
  });

  it('should handle circular references gracefully', () => {
    const nodes = {
      'ctx-a': createNode('ctx-a', [], { isContextDeclaration: true, bundledContextIds: ['ctx-b'] }),
      'ctx-b': createNode('ctx-b', [], { isContextDeclaration: true, bundledContextIds: ['ctx-a'] }),
    };

    // Should not infinite loop
    const result = resolveBundledContexts('ctx-a', nodes);
    expect(result).toContain('ctx-a');
    expect(result).toContain('ctx-b');
  });

  it('should deduplicate contexts', () => {
    const nodes = {
      'bundle': createNode('bundle', [], { isContextDeclaration: true, bundledContextIds: ['ctx-1', 'inner-bundle'] }),
      'inner-bundle': createNode('inner-bundle', [], { isContextDeclaration: true, bundledContextIds: ['ctx-1'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };

    const result = resolveBundledContexts('bundle', nodes);
    // ctx-1 should only appear once
    expect(result.filter(id => id === 'ctx-1')).toHaveLength(1);
  });
});

describe('getContextsForCollaboration', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should resolve active context and its bundle for regular node', () => {
    const nodes = {
      'task': createNode('task', [], { appliedContextIds: ['bundle-ctx'], activeContextId: 'bundle-ctx' }),
      'bundle-ctx': createNode('bundle-ctx', [], { isContextDeclaration: true, bundledContextIds: ['ctx-1', 'ctx-2'] }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    const result = getContextsForCollaboration('task', nodes, ancestorRegistry);
    expect(result).toEqual(['ctx-1', 'ctx-2', 'bundle-ctx']);
  });

  it('should return just active context if not a bundle', () => {
    const nodes = {
      'task': createNode('task', [], { appliedContextIds: ['ctx-1'], activeContextId: 'ctx-1' }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    expect(getContextsForCollaboration('task', nodes, ancestorRegistry)).toEqual(['ctx-1']);
  });

  it('should use applied contexts for context declaration node, not bundled', () => {
    const nodes = {
      'bundle-ctx': createNode('bundle-ctx', [], {
        isContextDeclaration: true,
        bundledContextIds: ['ctx-1'],
        appliedContextIds: ['ctx-2'],
      }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
      'ctx-2': createNode('ctx-2', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'bundle-ctx': [] };

    const result = getContextsForCollaboration('bundle-ctx', nodes, ancestorRegistry);
    // Context declarations use their applied contexts for collaboration, not bundled
    expect(result).toEqual(['ctx-2']);
  });

  it('should return empty for context declaration without applied contexts', () => {
    const nodes = {
      'bundle-ctx': createNode('bundle-ctx', [], {
        isContextDeclaration: true,
        bundledContextIds: ['ctx-1'],
      }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'bundle-ctx': [] };

    const result = getContextsForCollaboration('bundle-ctx', nodes, ancestorRegistry);
    // No applied contexts means no contexts for collaboration
    expect(result).toEqual([]);
  });

  it('should return empty array when no context', () => {
    const nodes = {
      'task': createNode('task'),
    };
    const ancestorRegistry = { 'task': [] };

    expect(getContextsForCollaboration('task', nodes, ancestorRegistry)).toEqual([]);
  });

  it('should use inherited active context', () => {
    const nodes = {
      'parent': createNode('parent', ['task'], { appliedContextIds: ['ctx-1'], activeContextId: 'ctx-1' }),
      'task': createNode('task'),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = {
      'parent': [],
      'task': ['parent'],
    };

    expect(getContextsForCollaboration('task', nodes, ancestorRegistry)).toEqual(['ctx-1']);
  });
});

describe('getAllDescendants', () => {
  const createNode = (id: string, children: string[] = []): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata: {},
  });

  it('should return empty array for node with no children', () => {
    const nodes = { 'node-1': createNode('node-1') };
    expect(getAllDescendants('node-1', nodes)).toEqual([]);
  });

  it('should return direct children', () => {
    const nodes = {
      'parent': createNode('parent', ['child-1', 'child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    expect(getAllDescendants('parent', nodes)).toEqual(['child-1', 'child-2']);
  });

  it('should return all descendants recursively', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', ['grandchild']),
      'grandchild': createNode('grandchild'),
    };
    expect(getAllDescendants('root', nodes)).toEqual(['child', 'grandchild']);
  });

  it('should return empty array for non-existent node', () => {
    const nodes = { 'node-1': createNode('node-1') };
    expect(getAllDescendants('non-existent', nodes)).toEqual([]);
  });
});

describe('getNodeAndDescendantIds', () => {
  const createNode = (id: string, children: string[] = []): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata: {},
  });

  it('should return the root node itself when no children', () => {
    const nodes = { 'node-1': createNode('node-1') };
    expect(getNodeAndDescendantIds(['node-1'], nodes)).toEqual(['node-1']);
  });

  it('should return root and all descendants', () => {
    const nodes = {
      'parent': createNode('parent', ['child-1', 'child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    expect(getNodeAndDescendantIds(['parent'], nodes)).toEqual(['parent', 'child-1', 'child-2']);
  });

  it('should handle multiple root nodes', () => {
    const nodes = {
      'root-1': createNode('root-1', ['child-1']),
      'root-2': createNode('root-2', ['child-2']),
      'child-1': createNode('child-1'),
      'child-2': createNode('child-2'),
    };
    expect(getNodeAndDescendantIds(['root-1', 'root-2'], nodes)).toEqual([
      'root-1', 'child-1', 'root-2', 'child-2'
    ]);
  });

  it('should skip non-existent root nodes', () => {
    const nodes = { 'node-1': createNode('node-1') };
    expect(getNodeAndDescendantIds(['non-existent', 'node-1'], nodes)).toEqual(['node-1']);
  });

  it('should handle deeply nested tree', () => {
    const nodes = {
      'root': createNode('root', ['a']),
      'a': createNode('a', ['b']),
      'b': createNode('b', ['c']),
      'c': createNode('c'),
    };
    expect(getNodeAndDescendantIds(['root'], nodes)).toEqual(['root', 'a', 'b', 'c']);
  });
});

describe('getParentId', () => {
  it('should return parent from ancestor registry', () => {
    const ancestorRegistry = {
      'child': ['grandparent', 'parent'],
    };
    expect(getParentId('child', ancestorRegistry, 'root')).toBe('parent');
  });

  it('should return root when node has no ancestors', () => {
    const ancestorRegistry = {
      'child': [],
    };
    expect(getParentId('child', ancestorRegistry, 'root')).toBe('root');
  });

  it('should return root when node not in registry', () => {
    const ancestorRegistry = {};
    expect(getParentId('unknown', ancestorRegistry, 'root')).toBe('root');
  });

  it('should return immediate parent (last in ancestors array)', () => {
    const ancestorRegistry = {
      'deeply-nested': ['root', 'level-1', 'level-2', 'level-3'],
    };
    expect(getParentId('deeply-nested', ancestorRegistry, 'root')).toBe('level-3');
  });
});
