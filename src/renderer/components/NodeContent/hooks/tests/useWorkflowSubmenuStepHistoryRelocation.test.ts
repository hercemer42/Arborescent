import { describe, it, expect, vi } from 'vitest';
import { buildWorkflowSubmenu } from '../useWorkflowSubmenu';
import { TreeNode } from '../../../../../shared/types';
import type { ContextMenuItem } from '../../../ui/ContextMenu';

// Bug fix contract: "Step History" must be relocated OUT of the "Workflow"
// submenu and surfaced as its own top-level context-menu item. This file pins
// the relocation invariant — the Workflow submenu no longer hosts history. The
// extracted top-level builder is covered by useWorkflowSubmenuStepHistory.test.ts.

function createNode(id: string, overrides: Partial<TreeNode> = {}): TreeNode {
  return { id, content: id, children: [], metadata: {}, ...overrides };
}

function makeStepFixture() {
  const nodes: Record<string, TreeNode> = {
    'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
    'workflow': createNode('workflow', { children: ['step-1'], metadata: { isBlueprint: true, isWorkflow: true } }),
    'step-1': createNode('step-1', { children: ['task-a'], metadata: { isBlueprint: true, stepType: 'autonomous' } }),
    'task-a': createNode('task-a', { metadata: { isBlueprint: true } }),
  };
  const ancestorRegistry: Record<string, string[]> = {
    'root': [],
    'workflow': ['root'],
    'step-1': ['root', 'workflow'],
    'task-a': ['root', 'workflow', 'step-1'],
  };
  return { nodes, ancestorRegistry };
}

function findItem(items: ContextMenuItem[] | undefined, label: string): ContextMenuItem | undefined {
  return items?.find((it) => it.label === label);
}

const callbacks = {
  onRemoveFromWorkflow: vi.fn(),
  onConfigureStep: vi.fn(),
};

describe('Step History relocation — Workflow submenu no longer hosts history', () => {
  it('omits the Step History entry from the Workflow submenu for a workflow step node', () => {
    const { nodes, ancestorRegistry } = makeStepFixture();

    const result = buildWorkflowSubmenu({
      node: nodes['step-1'],
      nodes,
      ancestorRegistry,
      ...callbacks,
    });

    expect(findItem(result?.submenu, 'Step History')).toBeUndefined();
  });

  it('still exposes Configure Step in the Workflow submenu after the extraction', () => {
    const { nodes, ancestorRegistry } = makeStepFixture();

    const result = buildWorkflowSubmenu({
      node: nodes['step-1'],
      nodes,
      ancestorRegistry,
      ...callbacks,
    });

    expect(findItem(result?.submenu, 'Configure Step')).toBeDefined();
  });

  it('keeps Remove from Workflow for a workflow-root node without surfacing Step History there', () => {
    const { nodes, ancestorRegistry } = makeStepFixture();

    const result = buildWorkflowSubmenu({
      node: nodes['workflow'],
      nodes,
      ancestorRegistry,
      ...callbacks,
    });

    expect(findItem(result?.submenu, 'Remove from Workflow')).toBeDefined();
    expect(findItem(result?.submenu, 'Step History')).toBeUndefined();
  });
});
