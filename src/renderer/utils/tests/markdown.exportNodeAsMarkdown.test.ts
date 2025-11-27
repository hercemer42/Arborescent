import { describe, it, expect } from 'vitest';
import { exportNodeAsMarkdown, exportMultipleNodesAsMarkdown } from '../markdown';
import type { TreeNode } from '../../../shared/types';

describe('exportNodeAsMarkdown', () => {
  it('formats a single node with heading and status symbol', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Test task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': node };

    const result = exportNodeAsMarkdown(node, nodes);

    expect(result).toBe('# [ ] Test task\n');
  });

  it('formats nested nodes with heading levels', () => {
    const child: TreeNode = {
      id: '2',
      content: 'Subtask',
      children: [],
      metadata: { status: 'completed', expanded: true, deleted: false },
    };
    const parent: TreeNode = {
      id: '1',
      content: 'Parent task',
      children: ['2'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': parent, '2': child };

    const result = exportNodeAsMarkdown(parent, nodes);

    expect(result).toBe('# [ ] Parent task\n## [x] Subtask\n');
  });

  it('formats deeply nested hierarchy', () => {
    const grandchild: TreeNode = {
      id: '3',
      content: 'Deep task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const child: TreeNode = {
      id: '2',
      content: 'Child task',
      children: ['3'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const parent: TreeNode = {
      id: '1',
      content: 'Parent task',
      children: ['2'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': parent, '2': child, '3': grandchild };

    const result = exportNodeAsMarkdown(parent, nodes);

    expect(result).toBe('# [ ] Parent task\n## [ ] Child task\n### [ ] Deep task\n');
  });

  it('skips deleted nodes', () => {
    const deletedChild: TreeNode = {
      id: '2',
      content: 'Deleted task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: true },
    };
    const visibleChild: TreeNode = {
      id: '3',
      content: 'Visible task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const parent: TreeNode = {
      id: '1',
      content: 'Parent task',
      children: ['2', '3'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': parent, '2': deletedChild, '3': visibleChild };

    const result = exportNodeAsMarkdown(parent, nodes);

    expect(result).toBe('# [ ] Parent task\n## [ ] Visible task\n');
  });

  it('handles different status symbols', () => {
    const child1: TreeNode = {
      id: '2',
      content: 'Completed',
      children: [],
      metadata: { status: 'completed', expanded: true, deleted: false },
    };
    const child2: TreeNode = {
      id: '3',
      content: 'Failed',
      children: [],
      metadata: { status: 'failed', expanded: true, deleted: false },
    };
    const parent: TreeNode = {
      id: '1',
      content: 'Pending',
      children: ['2', '3'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': parent, '2': child1, '3': child2 };

    const result = exportNodeAsMarkdown(parent, nodes);

    expect(result).toBe('# [ ] Pending\n## [x] Completed\n## [-] Failed\n');
  });

  it('preserves multi-line content', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Task title\nAdditional details\nMore context',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': node };

    const result = exportNodeAsMarkdown(node, nodes);

    expect(result).toBe('# [ ] Task title\nAdditional details\nMore context\n');
  });

  it('handles multiple siblings at same level', () => {
    const child1: TreeNode = {
      id: '2',
      content: 'First sibling',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const child2: TreeNode = {
      id: '3',
      content: 'Second sibling',
      children: [],
      metadata: { status: 'completed', expanded: true, deleted: false },
    };
    const parent: TreeNode = {
      id: '1',
      content: 'Parent',
      children: ['2', '3'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': parent, '2': child1, '3': child2 };

    const result = exportNodeAsMarkdown(parent, nodes);

    expect(result).toBe('# [ ] Parent\n## [ ] First sibling\n## [x] Second sibling\n');
  });

  it('returns empty string for deleted root node', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Deleted task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: true },
    };
    const nodes = { '1': node };

    const result = exportNodeAsMarkdown(node, nodes);

    expect(result).toBe('');
  });

  it('does not include context metadata in export (metadata preserved via clipboard cache)', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Task with context',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false, appliedContextId: 'context-123' },
    };
    const nodes = { '1': node };

    const result = exportNodeAsMarkdown(node, nodes);

    // Context is NOT exported to markdown - it's preserved via the clipboard cache instead
    expect(result).toBe('# [ ] Task with context\n');
    expect(result).not.toContain('context-123');
  });
});

describe('exportMultipleNodesAsMarkdown', () => {
  it('exports multiple nodes as siblings (all at depth 0)', () => {
    const node1: TreeNode = {
      id: '1',
      content: 'First task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const node2: TreeNode = {
      id: '2',
      content: 'Second task',
      children: [],
      metadata: { status: 'completed', expanded: true, deleted: false },
    };
    const nodes = { '1': node1, '2': node2 };

    const result = exportMultipleNodesAsMarkdown(['1', '2'], nodes);

    expect(result).toBe('# [ ] First task\n# [x] Second task\n');
  });

  it('exports nodes with their descendants', () => {
    const child: TreeNode = {
      id: 'child',
      content: 'Child task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const parent: TreeNode = {
      id: 'parent',
      content: 'Parent task',
      children: ['child'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const sibling: TreeNode = {
      id: 'sibling',
      content: 'Sibling task',
      children: [],
      metadata: { status: 'completed', expanded: true, deleted: false },
    };
    const nodes = { parent, child, sibling };

    const result = exportMultipleNodesAsMarkdown(['parent', 'sibling'], nodes);

    expect(result).toBe('# [ ] Parent task\n## [ ] Child task\n# [x] Sibling task\n');
  });

  it('returns empty string for empty nodeIds array', () => {
    const nodes = {};

    const result = exportMultipleNodesAsMarkdown([], nodes);

    expect(result).toBe('');
  });

  it('skips non-existent nodes', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Existing task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': node };

    const result = exportMultipleNodesAsMarkdown(['1', 'non-existent'], nodes);

    expect(result).toBe('# [ ] Existing task\n');
  });

  it('preserves order of nodeIds', () => {
    const node1: TreeNode = {
      id: '1',
      content: 'First',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const node2: TreeNode = {
      id: '2',
      content: 'Second',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const node3: TreeNode = {
      id: '3',
      content: 'Third',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': node1, '2': node2, '3': node3 };

    const result = exportMultipleNodesAsMarkdown(['3', '1', '2'], nodes);

    expect(result).toBe('# [ ] Third\n# [ ] First\n# [ ] Second\n');
  });

  it('handles complex nested hierarchies', () => {
    const grandchild: TreeNode = {
      id: 'gc',
      content: 'Grandchild',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const child1: TreeNode = {
      id: 'c1',
      content: 'Child 1',
      children: ['gc'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const child2: TreeNode = {
      id: 'c2',
      content: 'Child 2',
      children: [],
      metadata: { status: 'completed', expanded: true, deleted: false },
    };
    const parent1: TreeNode = {
      id: 'p1',
      content: 'Parent 1',
      children: ['c1'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const parent2: TreeNode = {
      id: 'p2',
      content: 'Parent 2',
      children: ['c2'],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { p1: parent1, p2: parent2, c1: child1, c2: child2, gc: grandchild };

    const result = exportMultipleNodesAsMarkdown(['p1', 'p2'], nodes);

    expect(result).toBe(
      '# [ ] Parent 1\n## [ ] Child 1\n### [ ] Grandchild\n# [ ] Parent 2\n## [x] Child 2\n'
    );
  });
});
