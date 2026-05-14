import { describe, it, expect, vi } from 'vitest';
import { buildWorkflowExecutionItems, buildWorkflowNavigationItems, combineExecutionAndNavigationItems } from '../useWorkflowSubmenu';
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

const workflowNodes: Record<string, TreeNode> = {
  'root': createNode('root', { children: ['workflow'], metadata: { isBlueprint: true } }),
  'workflow': createNode('workflow', { children: ['step1', 'step2'], metadata: { isBlueprint: true, isWorkflow: true } }),
  'step1': createNode('step1', { children: ['task'], metadata: { isBlueprint: true, stepType: 'autonomous' } }),
  'step2': createNode('step2', { metadata: { isBlueprint: true, stepType: 'autonomous' } }),
  'task': createNode('task', { metadata: { isBlueprint: true } }),
};

const ancestors: Record<string, string[]> = {
  'root': [],
  'workflow': ['root'],
  'step1': ['root', 'workflow'],
  'step2': ['root', 'workflow'],
  'task': ['root', 'workflow', 'step1'],
};

describe('buildWorkflowExecutionItems — Resend step replaces Continue Workflow', () => {
  const defaultCallbacks = {
    onStartWorkflow: vi.fn(),
    onStopWorkflow: vi.fn(),
    onResendStep: vi.fn(),
    onResumeStuckNode: vi.fn(),
  };

  it('shows Resend step (not Continue Workflow) alongside Stop Workflow for awaiting-validation nodes', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    const labels = result.map(item => item.label);
    expect(labels).toContain('Resend step');
    expect(labels).toContain('Stop Workflow');
    expect(labels).not.toContain('Continue Workflow');
  });

  it('never exposes a "Continue Workflow" item in any execution state', () => {
    const states: Array<'running' | 'awaiting-validation'> = ['running', 'awaiting-validation'];
    for (const state of states) {
      const result = buildWorkflowExecutionItems({
        node: workflowNodes['task'],
        nodes: workflowNodes,
        ancestorRegistry: ancestors,
        workflowExecutionStates: { 'task': { state, terminalTabId: 'tab1' } },
        ...defaultCallbacks,
      });
      expect(result.map(item => item.label)).not.toContain('Continue Workflow');
    }
  });

  it('does not show Resend step when the workflow is running', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'running', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result.map(item => item.label)).not.toContain('Resend step');
  });

  it('does not show Resend step when there is no execution state entry', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: {},
      ...defaultCallbacks,
    });

    expect(result.map(item => item.label)).not.toContain('Resend step');
  });

  it('wires Resend step click to onResendStep for awaiting-validation nodes', () => {
    const onResendStep = vi.fn();
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
      onResendStep,
    });

    const resendItem = result.find(item => item.label === 'Resend step');
    expect(resendItem).toBeDefined();
    resendItem?.onClick?.();
    expect(onResendStep).toHaveBeenCalledTimes(1);
  });

  it('does not advance the workflow when Resend step is clicked (no side effect on next-step callbacks)', () => {
    const onResendStep = vi.fn();
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
      onResendStep,
    });

    result.find(item => item.label === 'Resend step')?.onClick?.();
    // Resend must not invoke Stop nor any start/move callbacks.
    expect(defaultCallbacks.onStartWorkflow).not.toHaveBeenCalled();
    expect(defaultCallbacks.onStopWorkflow).not.toHaveBeenCalled();
  });

  it('returns empty for nodes that are not children of a workflow step', () => {
    const result = buildWorkflowExecutionItems({
      node: workflowNodes['root'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'root': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result).toEqual([]);
  });
});

describe('buildWorkflowNavigationItems — Next step visibility during paused workflows', () => {
  const defaultCallbacks = {
    onMoveToNextStep: vi.fn(),
    onMoveToPreviousStep: vi.fn(),
  };

  it('shows Next step for an awaiting-validation node when a next step exists', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: null,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(true);
  });

  it('hides Next step while the workflow is running', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: null,
      workflowExecutionStates: { 'task': { state: 'running', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(false);
  });

  it('still hides Next step when the node is being collaborated on, even if paused', () => {
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: 'task',
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
    });

    expect(result.some(item => item.label === 'Next step')).toBe(false);
  });

  it('continues to show Next step for nodes with no execution state (preserves existing behaviour)', () => {
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

  it('wires Next step click to onMoveToNextStep for awaiting-validation nodes', () => {
    const onMoveToNextStep = vi.fn();
    const result = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: null,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...defaultCallbacks,
      onMoveToNextStep,
    });

    const nextItem = result.find(item => item.label === 'Next step');
    expect(nextItem).toBeDefined();
    nextItem?.onClick?.();
    expect(onMoveToNextStep).toHaveBeenCalledTimes(1);
  });
});

describe('Combined visibility — Resend step and Next step appear together when paused', () => {
  const execCallbacks = {
    onStartWorkflow: vi.fn(),
    onStopWorkflow: vi.fn(),
    onResendStep: vi.fn(),
    onResumeStuckNode: vi.fn(),
  };
  const navCallbacks = {
    onMoveToNextStep: vi.fn(),
    onMoveToPreviousStep: vi.fn(),
  };

  it('exposes both Resend step and Next step for an awaiting-validation node', () => {
    const executionItems = buildWorkflowExecutionItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...execCallbacks,
    });
    const navigationItems = buildWorkflowNavigationItems({
      node: workflowNodes['task'],
      nodes: workflowNodes,
      ancestorRegistry: ancestors,
      collaboratingNodeId: null,
      workflowExecutionStates: { 'task': { state: 'awaiting-validation', terminalTabId: 'tab1' } },
      ...navCallbacks,
    });

    const combined = [...executionItems, ...navigationItems].map(item => item.label);
    expect(combined).toContain('Resend step');
    expect(combined).toContain('Next step');
  });
});

describe('combineExecutionAndNavigationItems — Resend and Next step adjacency', () => {
  const resend = { label: 'Resend step', onClick: vi.fn() };
  const stop = { label: 'Stop Workflow', onClick: vi.fn() };
  const next = { label: 'Next step', onClick: vi.fn() };
  const previous = { label: 'Previous step', onClick: vi.fn() };
  const resume = { label: 'Resume session', onClick: vi.fn() };

  it('places Next step immediately after Resend step when both are present', () => {
    const combined = combineExecutionAndNavigationItems(
      [resend, stop],
      [next, previous],
    );
    const labels = combined.map(item => item.label);
    expect(labels).toEqual(['Resend step', 'Next step', 'Stop Workflow', 'Previous step']);
  });

  it('places Resume session after Stop Workflow when Resend step is present', () => {
    const combined = combineExecutionAndNavigationItems(
      [resend, stop],
      [next, previous],
      resume,
    );
    const labels = combined.map(item => item.label);
    expect(labels).toEqual([
      'Resend step',
      'Next step',
      'Stop Workflow',
      'Resume session',
      'Previous step',
    ]);
  });

  it('preserves the original execution → resume → navigation order when Resend step is absent', () => {
    const combined = combineExecutionAndNavigationItems(
      [stop],
      [next, previous],
      resume,
    );
    const labels = combined.map(item => item.label);
    expect(labels).toEqual(['Stop Workflow', 'Resume session', 'Next step', 'Previous step']);
  });

  it('returns just navigation items when execution and resume are empty', () => {
    const combined = combineExecutionAndNavigationItems(
      [],
      [next, previous],
    );
    expect(combined.map(item => item.label)).toEqual(['Next step', 'Previous step']);
  });

  it('returns the original concatenation when Next step is absent', () => {
    const combined = combineExecutionAndNavigationItems(
      [resend, stop],
      [previous],
    );
    expect(combined.map(item => item.label)).toEqual(['Resend step', 'Stop Workflow', 'Previous step']);
  });
});
