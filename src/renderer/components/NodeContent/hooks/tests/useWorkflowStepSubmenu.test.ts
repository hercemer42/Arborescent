import { describe, it, expect, vi } from 'vitest';
import { buildWorkflowStepSubmenu } from '../useWorkflowStepSubmenu';
import type { TreeNode } from '../../../../../shared/types';

describe('buildWorkflowStepSubmenu', () => {
  const createWorkflowTree = () => {
    const nodes: Record<string, TreeNode> = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['workflow'],
        metadata: { isBlueprint: true },
      },
      'workflow': {
        id: 'workflow',
        content: 'Workflow',
        children: ['step-1', 'step-2', 'step-3'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'step-1': {
        id: 'step-1',
        content: 'Step 1',
        children: ['item-a'],
        metadata: { isBlueprint: true },
      },
      'step-2': {
        id: 'step-2',
        content: 'Step 2',
        children: ['item-b'],
        metadata: { isBlueprint: true },
      },
      'step-3': {
        id: 'step-3',
        content: 'Step 3',
        children: ['item-c'],
        metadata: { isBlueprint: true },
      },
      'item-a': {
        id: 'item-a',
        content: 'Item A',
        children: [],
        metadata: {},
      },
      'item-b': {
        id: 'item-b',
        content: 'Item B',
        children: [],
        metadata: {},
      },
      'item-c': {
        id: 'item-c',
        content: 'Item C',
        children: [],
        metadata: {},
      },
    };

    const ancestorRegistry: Record<string, string[]> = {
      'root': [],
      'workflow': ['root'],
      'step-1': ['root', 'workflow'],
      'step-2': ['root', 'workflow'],
      'step-3': ['root', 'workflow'],
      'item-a': ['root', 'workflow', 'step-1'],
      'item-b': ['root', 'workflow', 'step-2'],
      'item-c': ['root', 'workflow', 'step-3'],
    };

    return { nodes, ancestorRegistry };
  };

  const defaultActions = {
    moveToNextStep: vi.fn(),
    moveToPreviousStep: vi.fn(),
  };

  it('should return empty array for nodes not in a workflow step', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const result = buildWorkflowStepSubmenu({
      node: nodes['step-1'],
      nodes,
      ancestorRegistry,
      actions: defaultActions,
    });
    expect(result).toEqual([]);
  });

  it('should show next step for items in non-last step', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const result = buildWorkflowStepSubmenu({
      node: nodes['item-a'],
      nodes,
      ancestorRegistry,
      actions: defaultActions,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(true);
  });

  it('should show previous step for items in non-first step', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const result = buildWorkflowStepSubmenu({
      node: nodes['item-b'],
      nodes,
      ancestorRegistry,
      actions: defaultActions,
    });

    expect(result.some(item => item.label === 'Previous step')).toBe(true);
  });

  it('should not show previous step for items in first step', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const result = buildWorkflowStepSubmenu({
      node: nodes['item-a'],
      nodes,
      ancestorRegistry,
      actions: defaultActions,
    });

    expect(result.some(item => item.label === 'Previous step')).toBe(false);
  });

  it('should not show next step for items in last step', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const result = buildWorkflowStepSubmenu({
      node: nodes['item-c'],
      nodes,
      ancestorRegistry,
      actions: defaultActions,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(false);
  });

  it('should show both next and previous for middle step items', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const result = buildWorkflowStepSubmenu({
      node: nodes['item-b'],
      nodes,
      ancestorRegistry,
      actions: defaultActions,
    });

    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('Next step');
    expect(result[1].label).toBe('Previous step');
  });

  it('should call moveToNextStep when next step is clicked', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const actions = {
      moveToNextStep: vi.fn(),
      moveToPreviousStep: vi.fn(),
    };

    const result = buildWorkflowStepSubmenu({
      node: nodes['item-a'],
      nodes,
      ancestorRegistry,
      actions,
    });

    const nextItem = result.find(item => item.label === 'Next step');
    nextItem?.onClick?.();

    expect(actions.moveToNextStep).toHaveBeenCalledWith('item-a');
  });

  it('should call moveToPreviousStep when previous step is clicked', () => {
    const { nodes, ancestorRegistry } = createWorkflowTree();
    const actions = {
      moveToNextStep: vi.fn(),
      moveToPreviousStep: vi.fn(),
    };

    const result = buildWorkflowStepSubmenu({
      node: nodes['item-c'],
      nodes,
      ancestorRegistry,
      actions,
    });

    const prevItem = result.find(item => item.label === 'Previous step');
    prevItem?.onClick?.();

    expect(actions.moveToPreviousStep).toHaveBeenCalledWith('item-c');
  });
});
