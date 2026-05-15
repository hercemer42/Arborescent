import { describe, it, expect, vi } from 'vitest';
import { buildSendToWorkflowSubmenu } from '../useSendToWorkflowSubmenu';
import type { TreeNode } from '../../../../../shared/types';

function createNode(id: string, overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    content: id,
    children: [],
    metadata: {},
    ...overrides,
  };
}

describe('buildSendToWorkflowSubmenu', () => {
  const nodes: Record<string, TreeNode> = {
    'root': createNode('root', { children: ['wf-a', 'wf-b', 'loose'] }),
    'wf-a': createNode('wf-a', {
      content: 'Workflow A',
      children: ['wf-a-step1'],
      metadata: { isWorkflow: true },
    }),
    'wf-a-step1': createNode('wf-a-step1', { content: 'A step 1' }),
    'wf-b': createNode('wf-b', {
      content: 'Workflow B',
      children: ['wf-b-step1'],
      metadata: { isWorkflow: true },
    }),
    'wf-b-step1': createNode('wf-b-step1', { content: 'B step 1' }),
    'loose': createNode('loose', { content: 'A loose node' }),
  };

  const ancestors: Record<string, string[]> = {
    'root': [],
    'wf-a': ['root'],
    'wf-a-step1': ['root', 'wf-a'],
    'wf-b': ['root'],
    'wf-b-step1': ['root', 'wf-b'],
    'loose': ['root'],
  };

  it('returns one menu item per workflow in the tree', () => {
    const items = buildSendToWorkflowSubmenu({
      sourceNodeId: 'loose',
      nodes,
      ancestorRegistry: ancestors,
      onSendToWorkflow: vi.fn(),
    });

    expect(items).not.toBeNull();
    expect(items!.length).toBe(2);
  });

  it('includes the workflow the source node currently lives in', () => {
    const labels = buildSendToWorkflowSubmenu({
      sourceNodeId: 'wf-a-step1',
      nodes,
      ancestorRegistry: ancestors,
      onSendToWorkflow: vi.fn(),
    })!.map((i) => i.label);

    expect(labels).toContain('Workflow A');
    expect(labels).toContain('Workflow B');
  });

  it('uses the workflow node content as the item label', () => {
    const labels = buildSendToWorkflowSubmenu({
      sourceNodeId: 'loose',
      nodes,
      ancestorRegistry: ancestors,
      onSendToWorkflow: vi.fn(),
    })!.map((i) => i.label);

    expect(labels).toEqual(['Workflow A', 'Workflow B']);
  });

  it('sorts items alphabetically by workflow content', () => {
    const unsortedNodes: Record<string, TreeNode> = {
      'root': createNode('root', { children: ['source', 'z', 'a', 'm'] }),
      'source': createNode('source', { content: 'source' }),
      'z': createNode('z', { content: 'Zebra workflow', metadata: { isWorkflow: true } }),
      'a': createNode('a', { content: 'Aardvark workflow', metadata: { isWorkflow: true } }),
      'm': createNode('m', { content: 'Monkey workflow', metadata: { isWorkflow: true } }),
    };
    const unsortedAncestors = {
      'root': [],
      'source': ['root'],
      'z': ['root'],
      'a': ['root'],
      'm': ['root'],
    };

    const labels = buildSendToWorkflowSubmenu({
      sourceNodeId: 'source',
      nodes: unsortedNodes,
      ancestorRegistry: unsortedAncestors,
      onSendToWorkflow: vi.fn(),
    })!.map((i) => i.label);

    expect(labels).toEqual(['Aardvark workflow', 'Monkey workflow', 'Zebra workflow']);
  });

  it('excludes the source node itself when the source is a workflow', () => {
    const labels = buildSendToWorkflowSubmenu({
      sourceNodeId: 'wf-a',
      nodes,
      ancestorRegistry: ancestors,
      onSendToWorkflow: vi.fn(),
    })!.map((i) => i.label);

    expect(labels).not.toContain('Workflow A');
    expect(labels).toContain('Workflow B');
  });

  it('excludes workflows that are descendants of the source (would create a cycle)', () => {
    const withNestedWorkflow: Record<string, TreeNode> = {
      ...nodes,
      'wf-a-step1': createNode('wf-a-step1', { content: 'A step 1', children: ['wf-nested'] }),
      'wf-nested': createNode('wf-nested', {
        content: 'Nested workflow',
        metadata: { isWorkflow: true },
      }),
    };
    const withNestedAncestors = {
      ...ancestors,
      'wf-nested': ['root', 'wf-a', 'wf-a-step1'],
    };

    const items = buildSendToWorkflowSubmenu({
      sourceNodeId: 'wf-a',
      nodes: withNestedWorkflow,
      ancestorRegistry: withNestedAncestors,
      onSendToWorkflow: vi.fn(),
    });

    const labels = items!.map((i) => i.label);
    expect(labels).not.toContain('Nested workflow');
    expect(labels).toContain('Workflow B');
  });

  it('calls onSendToWorkflow with the destination workflow id when an item is clicked', () => {
    const onSendToWorkflow = vi.fn();
    const items = buildSendToWorkflowSubmenu({
      sourceNodeId: 'loose',
      nodes,
      ancestorRegistry: ancestors,
      onSendToWorkflow,
    });

    items!.find((i) => i.label === 'Workflow A')!.onClick!();

    expect(onSendToWorkflow).toHaveBeenCalledWith('wf-a');
  });

  it('returns null when the tree contains no workflows', () => {
    const noWorkflows: Record<string, TreeNode> = {
      'root': createNode('root', { children: ['a', 'b'] }),
      'a': createNode('a'),
      'b': createNode('b'),
    };
    const noWorkflowsAncestors = { 'root': [], 'a': ['root'], 'b': ['root'] };

    const items = buildSendToWorkflowSubmenu({
      sourceNodeId: 'a',
      nodes: noWorkflows,
      ancestorRegistry: noWorkflowsAncestors,
      onSendToWorkflow: vi.fn(),
    });

    expect(items).toBeNull();
  });

  it('returns null when the only workflow is the source itself', () => {
    const onlySelf: Record<string, TreeNode> = {
      'root': createNode('root', { children: ['wf-only'] }),
      'wf-only': createNode('wf-only', { content: 'Only', metadata: { isWorkflow: true } }),
    };

    const items = buildSendToWorkflowSubmenu({
      sourceNodeId: 'wf-only',
      nodes: onlySelf,
      ancestorRegistry: { 'root': [], 'wf-only': ['root'] },
      onSendToWorkflow: vi.fn(),
    });

    expect(items).toBeNull();
  });
});
