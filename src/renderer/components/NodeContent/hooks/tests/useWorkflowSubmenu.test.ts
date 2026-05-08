import { describe, it, expect, vi } from 'vitest';
import { buildWorkflowSubmenu, buildWorkflowExecutionItems, buildWorkflowNavigationItems } from '../useWorkflowSubmenu';
import { TreeNode } from '../../../../../shared/types';

function createNode(id: string, overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id,
    content: id,
    children: [],
    metadata: {},
    ...overrides,
  };
}

describe('buildWorkflowSubmenu', () => {
  const defaultCallbacks = {
    onRemoveFromWorkflow: vi.fn(),
    onConfigureStep: vi.fn(),
  };

  const workflowNodes: Record<string, TreeNode> = {
    'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
    'workflow': createNode('workflow', { children: ['step1', 'step2'], metadata: { isBlueprint: true, isWorkflow: true } }),
    'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true } }),
    'step2': createNode('step2', { metadata: { isBlueprint: true } }),
    'task': createNode('task', { metadata: { isBlueprint: true } }),
  };

  const ancestors: Record<string, string[]> = {
    'root': [],
    'workflow': ['root'],
    'step1': ['root', 'workflow'],
    'step2': ['root', 'workflow'],
    'task': ['root', 'workflow', 'step1'],
  };

  it('should return null for nodes with no workflow relevance', () => {
    const result = buildWorkflowSubmenu({
      node: workflowNodes['root'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result).toBeNull();
  });

  it('should show Remove from Workflow for workflow nodes', () => {
    const result = buildWorkflowSubmenu({
      node: workflowNodes['workflow'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result!.submenu!.some(item => item.label === 'Remove from Workflow')).toBe(true);
  });

  it('should show Configure Step for workflow step nodes', () => {
    const result = buildWorkflowSubmenu({
      node: workflowNodes['step1'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result!.submenu!.some(item => item.label === 'Configure Step')).toBe(true);
  });

  it('should return null for nodes inside a workflow step that are not step nodes', () => {
    const result = buildWorkflowSubmenu({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result).toBeNull();
  });

  it('should call callbacks when items are clicked', () => {
    const onConfigureStep = vi.fn();
    const result = buildWorkflowSubmenu({
      node: workflowNodes['step1'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
      onConfigureStep,
    });

    const configureItem = result!.submenu!.find(item => item.label === 'Configure Step');
    configureItem?.onClick?.();
    expect(onConfigureStep).toHaveBeenCalled();
  });
});

describe('buildWorkflowExecutionItems', () => {
  const workflowNodes: Record<string, TreeNode> = {
    'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
    'workflow': createNode('workflow', { children: ['step1'], metadata: { isBlueprint: true, isWorkflow: true } }),
    'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true, stepType: 'autonomous' } }),
    'task': createNode('task', { metadata: { isBlueprint: true } }),
  };

  const ancestors: Record<string, string[]> = {
    'root': [],
    'workflow': ['root'],
    'step1': ['root', 'workflow'],
    'task': ['root', 'workflow', 'step1'],
  };

  const defaultCallbacks = {
    onStartWorkflow: vi.fn(),
    onStopWorkflow: vi.fn(),
    onContinueWorkflow: vi.fn(),
  };

  it('should return empty array for nodes not inside a workflow step', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['root'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });

  it('should show Start Workflow for eligible nodes in autonomous steps', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Start Workflow');
  });

  it('should not show Start Workflow for eligible nodes in manual steps', () => {
    const manualNodes: Record<string, TreeNode> = {
      ...workflowNodes,
      'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true, stepType: 'manual' } }),
    };

    const result = buildWorkflowExecutionItems({
      node: manualNodes['task'],
      nodes: manualNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });

  it('should show Start Workflow for eligible nodes in checkpoint steps', () => {
    const checkpointNodes: Record<string, TreeNode> = {
      ...workflowNodes,
      'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true, stepType: 'checkpoint' } }),
    };

    const result = buildWorkflowExecutionItems({
      node: checkpointNodes['task'],
      nodes: checkpointNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Start Workflow');
  });

  it('should wire Start Workflow click to onStartWorkflow for checkpoint steps', () => {
    const onStartWorkflow = vi.fn();
    const checkpointNodes: Record<string, TreeNode> = {
      ...workflowNodes,
      'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true, stepType: 'checkpoint' } }),
    };

    const result = buildWorkflowExecutionItems({
      node: checkpointNodes['task'],
      nodes: checkpointNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
      onStartWorkflow,
    });

    result[0].onClick?.();
    expect(onStartWorkflow).toHaveBeenCalledTimes(1);
  });

  it('should still show Stop Workflow for running checkpoint-step nodes', () => {
    const checkpointNodes: Record<string, TreeNode> = {
      ...workflowNodes,
      'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true, stepType: 'checkpoint' } }),
    };

    const result = buildWorkflowExecutionItems({
      node: checkpointNodes['task'],
      nodes: checkpointNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'running', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Stop Workflow');
  });

  it('should not show Start Workflow when step type is undefined (defaults to manual)', () => {
    const defaultNodes: Record<string, TreeNode> = {
      ...workflowNodes,
      'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true } }),
    };

    const result = buildWorkflowExecutionItems({
      node: defaultNodes['task'],
      nodes: defaultNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });

  it('should show Stop Workflow for running nodes regardless of step type', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'running', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Stop Workflow');
  });

  it('should show Continue Workflow for awaiting-validation nodes regardless of step type', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Continue Workflow');
  });
});

describe('buildWorkflowNavigationItems', () => {
  const workflowNodes: Record<string, TreeNode> = {
    'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
    'workflow': createNode('workflow', { children: ['step1', 'step2'], metadata: { isBlueprint: true, isWorkflow: true } }),
    'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true } }),
    'step2': createNode('step2', { metadata: { isBlueprint: true } }),
    'task': createNode('task', { metadata: { isBlueprint: true } }),
  };

  const ancestors: Record<string, string[]> = {
    'root': [],
    'workflow': ['root'],
    'step1': ['root', 'workflow'],
    'step2': ['root', 'workflow'],
    'task': ['root', 'workflow', 'step1'],
  };

  const defaultCallbacks = {
    onMoveToNextStep: vi.fn(),
    onMoveToPreviousStep: vi.fn(),
  };

  it('should return empty array for nodes not inside a workflow step', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['root'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });

  it('should show Next step when a next step exists', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(true);
  });

  it('should not show Previous step when at first step', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      ...defaultCallbacks,
    });

    expect(result.some(item => item.label === 'Previous step')).toBe(false);
  });

  it('should return empty when node is being collaborated on', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: 'task',
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });

  it('should return empty when node has active workflow execution', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {
        'task': { state: 'running', terminalTabId: 't1' },
      },
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });

  it('should show navigation when node has no active collaboration or execution', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: null,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(true);
  });
});
