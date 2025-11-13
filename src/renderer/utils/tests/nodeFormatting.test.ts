import { describe, it, expect } from 'vitest';
import { formatNodeAsMarkdown } from '../nodeFormatting';
import type { TreeNode } from '../../../shared/types';

describe('formatNodeAsMarkdown', () => {
  it('formats a single node with status symbol', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Test task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': node };

    const result = formatNodeAsMarkdown(node, nodes);

    expect(result).toBe('☐ Test task\n');
  });

  it('formats nested nodes with indentation', () => {
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

    const result = formatNodeAsMarkdown(parent, nodes);

    expect(result).toBe('☐ Parent task\n  ✓ Subtask\n');
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

    const result = formatNodeAsMarkdown(parent, nodes);

    expect(result).toBe('☐ Parent task\n  ☐ Child task\n    ☐ Deep task\n');
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

    const result = formatNodeAsMarkdown(parent, nodes);

    expect(result).toBe('☐ Parent task\n  ☐ Visible task\n');
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

    const result = formatNodeAsMarkdown(parent, nodes);

    expect(result).toBe('☐ Pending\n  ✓ Completed\n  ✗ Failed\n');
  });

  it('preserves multi-line content with proper indentation', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Task title\nAdditional details\nMore context',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: false },
    };
    const nodes = { '1': node };

    const result = formatNodeAsMarkdown(node, nodes);

    expect(result).toBe('☐ Task title\n  Additional details\n  More context\n');
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

    const result = formatNodeAsMarkdown(parent, nodes);

    expect(result).toBe('☐ Parent\n  ☐ First sibling\n  ✓ Second sibling\n');
  });

  it('returns empty string for deleted root node', () => {
    const node: TreeNode = {
      id: '1',
      content: 'Deleted task',
      children: [],
      metadata: { status: 'pending', expanded: true, deleted: true },
    };
    const nodes = { '1': node };

    const result = formatNodeAsMarkdown(node, nodes);

    expect(result).toBe('');
  });
});
