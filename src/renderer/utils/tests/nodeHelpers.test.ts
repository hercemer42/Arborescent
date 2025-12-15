import { describe, it, expect } from 'vitest';
import {
  updateNodeMetadata,
  findPreviousNode,
  findNextNode,
  createTreeNode,
  cloneNodesWithNewIds,
  getNextSiblingId,
  findClosestAncestorWithMetadata,
  resolveHyperlinkedContexts,
  getContextsForCollaboration,
  getNodeAndDescendantIds,
  getParentId,
  getAllDescendants,
  computeSummaryVisibleNodeIds,
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

describe('resolveHyperlinkedContexts', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return empty array when no hyperlinks in descendants', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', ['child-1'], { isContextDeclaration: true }),
      'child-1': createNode('child-1', [], {}),
    };

    expect(resolveHyperlinkedContexts('ctx-1', nodes)).toEqual([]);
  });

  it('should resolve hyperlinked nodes in descendants', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', ['hyperlink-1', 'hyperlink-2'], { isContextDeclaration: true }),
      'hyperlink-1': createNode('hyperlink-1', [], { isHyperlink: true, linkedNodeId: 'linked-node-1' }),
      'hyperlink-2': createNode('hyperlink-2', [], { isHyperlink: true, linkedNodeId: 'linked-node-2' }),
      'linked-node-1': createNode('linked-node-1', [], {}),
      'linked-node-2': createNode('linked-node-2', [], {}),
    };

    const result = resolveHyperlinkedContexts('ctx-1', nodes);
    expect(result).toEqual(['linked-node-1', 'linked-node-2']);
  });

  it('should skip hyperlinks to non-existent nodes', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', ['hyperlink-1'], { isContextDeclaration: true }),
      'hyperlink-1': createNode('hyperlink-1', [], { isHyperlink: true, linkedNodeId: 'deleted-node' }),
    };

    expect(resolveHyperlinkedContexts('ctx-1', nodes)).toEqual([]);
  });

  it('should skip hyperlinks that point to the context declaration itself', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', ['hyperlink-1'], { isContextDeclaration: true }),
      'hyperlink-1': createNode('hyperlink-1', [], { isHyperlink: true, linkedNodeId: 'ctx-1' }),
    };

    expect(resolveHyperlinkedContexts('ctx-1', nodes)).toEqual([]);
  });

  it('should deduplicate linked nodes', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', ['hyperlink-1', 'hyperlink-2'], { isContextDeclaration: true }),
      'hyperlink-1': createNode('hyperlink-1', [], { isHyperlink: true, linkedNodeId: 'linked-node' }),
      'hyperlink-2': createNode('hyperlink-2', [], { isHyperlink: true, linkedNodeId: 'linked-node' }),
      'linked-node': createNode('linked-node', [], {}),
    };

    const result = resolveHyperlinkedContexts('ctx-1', nodes);
    expect(result).toHaveLength(1);
    expect(result).toEqual(['linked-node']);
  });

  it('should find hyperlinks in nested descendants', () => {
    const nodes = {
      'ctx-1': createNode('ctx-1', ['child-1'], { isContextDeclaration: true }),
      'child-1': createNode('child-1', ['grandchild-1'], {}),
      'grandchild-1': createNode('grandchild-1', ['hyperlink-1'], {}),
      'hyperlink-1': createNode('hyperlink-1', [], { isHyperlink: true, linkedNodeId: 'linked-node' }),
      'linked-node': createNode('linked-node', [], {}),
    };

    expect(resolveHyperlinkedContexts('ctx-1', nodes)).toEqual(['linked-node']);
  });
});

describe('getContextsForCollaboration', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return applied context ID (hyperlinks resolved during export)', () => {
    const nodes = {
      'task': createNode('task', [], { appliedContextId: 'ctx-with-links' }),
      'ctx-with-links': createNode('ctx-with-links', ['hyperlink-1', 'hyperlink-2'], { isContextDeclaration: true }),
      'hyperlink-1': createNode('hyperlink-1', [], { isHyperlink: true, linkedNodeId: 'linked-1' }),
      'hyperlink-2': createNode('hyperlink-2', [], { isHyperlink: true, linkedNodeId: 'linked-2' }),
      'linked-1': createNode('linked-1', [], {}),
      'linked-2': createNode('linked-2', [], {}),
    };
    const ancestorRegistry = { 'task': [], 'ctx-with-links': [], 'hyperlink-1': ['ctx-with-links'], 'hyperlink-2': ['ctx-with-links'] };

    const result = getContextsForCollaboration('task', nodes, ancestorRegistry);
    // Returns just the context ID - hyperlinks are resolved during export
    expect(result).toEqual(['ctx-with-links']);
  });

  it('should return applied context', () => {
    const nodes = {
      'task': createNode('task', [], { appliedContextId: 'ctx-1' }),
      'ctx-1': createNode('ctx-1', [], { isContextDeclaration: true }),
    };
    const ancestorRegistry = { 'task': [] };

    expect(getContextsForCollaboration('task', nodes, ancestorRegistry)).toEqual(['ctx-1']);
  });

  it('should return empty array when no context', () => {
    const nodes = {
      'task': createNode('task'),
    };
    const ancestorRegistry = { 'task': [] };

    expect(getContextsForCollaboration('task', nodes, ancestorRegistry)).toEqual([]);
  });

  it('should use inherited applied context', () => {
    const nodes = {
      'parent': createNode('parent', ['task'], { appliedContextId: 'ctx-1' }),
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

describe('computeSummaryVisibleNodeIds', () => {
  const createNode = (id: string, children: string[] = [], metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children,
    metadata,
  });

  it('should return empty set when no resolved nodes', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'pending' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.size).toBe(0);
  });

  it('should include completed node within date range', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2025-01-03T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.has('child')).toBe(true);
    expect(result.has('root')).toBe(true);
  });

  it('should include abandoned node within date range', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'abandoned', resolvedAt: '2025-01-03T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.has('child')).toBe(true);
    expect(result.has('root')).toBe(true);
  });

  it('should exclude completed node before date range', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2024-12-25T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.size).toBe(0);
  });

  it('should exclude completed node after date range', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2025-01-10T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.size).toBe(0);
  });

  it('should include node on exact dateFrom boundary', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2025-01-01T00:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.has('child')).toBe(true);
  });

  it('should include node on exact dateTo boundary', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2025-01-07T23:59:59Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.has('child')).toBe(true);
  });

  it('should include all ancestors of resolved node', () => {
    const nodes = {
      'root': createNode('root', ['parent']),
      'parent': createNode('parent', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2025-01-03T10:00:00Z' }),
    };
    const ancestorRegistry = {
      'parent': ['root'],
      'child': ['root', 'parent'],
    };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.has('child')).toBe(true);
    expect(result.has('parent')).toBe(true);
    expect(result.has('root')).toBe(true);
  });

  it('should work with null dateFrom (no lower bound)', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2020-01-01T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, null, '2025-01-07');
    expect(result.has('child')).toBe(true);
  });

  it('should work with null dateTo (no upper bound)', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2030-01-01T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', null);
    expect(result.has('child')).toBe(true);
  });

  it('should work with both dates null (all resolved nodes)', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed', resolvedAt: '2025-01-03T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, null, null);
    expect(result.has('child')).toBe(true);
  });

  it('should exclude pending nodes', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'pending', resolvedAt: '2025-01-03T10:00:00Z' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.size).toBe(0);
  });

  it('should exclude completed nodes without resolvedAt', () => {
    const nodes = {
      'root': createNode('root', ['child']),
      'child': createNode('child', [], { status: 'completed' }),
    };
    const ancestorRegistry = { 'child': ['root'] };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.size).toBe(0);
  });

  it('should handle multiple resolved nodes in range', () => {
    const nodes = {
      'root': createNode('root', ['child1', 'child2']),
      'child1': createNode('child1', [], { status: 'completed', resolvedAt: '2025-01-02T10:00:00Z' }),
      'child2': createNode('child2', [], { status: 'abandoned', resolvedAt: '2025-01-05T10:00:00Z' }),
    };
    const ancestorRegistry = {
      'child1': ['root'],
      'child2': ['root'],
    };

    const result = computeSummaryVisibleNodeIds(nodes, 'root', ancestorRegistry, '2025-01-01', '2025-01-07');
    expect(result.has('child1')).toBe(true);
    expect(result.has('child2')).toBe(true);
    expect(result.has('root')).toBe(true);
  });
});
