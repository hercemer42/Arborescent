import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { buildWorkflowExecutionSubmenu } from '../useWorkflowExecutionSubmenu';

describe('buildWorkflowExecutionSubmenu', () => {
  let nodes: Record<string, TreeNode>;
  let ancestorRegistry: Record<string, string[]>;
  let workflowExecutionStates: Record<string, { state: 'running' | 'awaiting-validation'; terminalTabId: string }>;
  let mockStartWorkflow: ReturnType<typeof vi.fn>;
  let mockStopWorkflow: ReturnType<typeof vi.fn>;
  let mockContinueWorkflow: ReturnType<typeof vi.fn>;
  let mockGetTerminalId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['workflow'],
        metadata: { isBlueprint: true },
      },
      'workflow': {
        id: 'workflow',
        content: 'Workflow',
        children: ['step-1', 'step-2'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'step-1': {
        id: 'step-1',
        content: 'Step 1',
        children: ['task-a'],
        metadata: { isBlueprint: true },
      },
      'step-2': {
        id: 'step-2',
        content: 'Step 2',
        children: [],
        metadata: { isBlueprint: true },
      },
      'task-a': {
        id: 'task-a',
        content: 'Task A',
        children: [],
        metadata: { isBlueprint: true },
      },
      'outside': {
        id: 'outside',
        content: 'Outside',
        children: [],
        metadata: {},
      },
    };

    ancestorRegistry = {
      'root': [],
      'workflow': ['root'],
      'step-1': ['root', 'workflow'],
      'step-2': ['root', 'workflow'],
      'task-a': ['root', 'workflow', 'step-1'],
      'outside': ['root'],
    };

    workflowExecutionStates = {};

    mockStartWorkflow = vi.fn();
    mockStopWorkflow = vi.fn();
    mockContinueWorkflow = vi.fn();
    mockGetTerminalId = vi.fn().mockResolvedValue('terminal-1');
  });

  const buildActions = () => ({
    startWorkflow: mockStartWorkflow,
    stopWorkflow: mockStopWorkflow,
    continueWorkflow: mockContinueWorkflow,
  });

  describe('Start Workflow menu item', () => {
    it('should show "Start Workflow" for a non-running node inside a workflow', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      expect(startItem).toBeDefined();
    });

    it('should not show "Start Workflow" for a running node', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      expect(startItem).toBeUndefined();
    });

    it('should not show "Start Workflow" for a workflow step node', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      expect(startItem).toBeUndefined();
    });

    it('should not show "Start Workflow" for the workflow node itself', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['workflow'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      expect(startItem).toBeUndefined();
    });

    it('should call getTerminalId and pass result to startWorkflow when clicked', async () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      startItem!.onClick!();

      await vi.waitFor(() => {
        expect(mockGetTerminalId).toHaveBeenCalled();
        expect(mockStartWorkflow).toHaveBeenCalledWith('task-a', 'terminal-1');
      });
    });

    it('should call startWorkflow with null when no terminal available', async () => {
      mockGetTerminalId.mockResolvedValue(null);

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      startItem!.onClick!();

      await vi.waitFor(() => {
        expect(mockStartWorkflow).toHaveBeenCalledWith('task-a', null);
      });
    });

    it('should not show "Start Workflow" for a node outside any workflow', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['outside'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      expect(items).toHaveLength(0);
    });
  });

  describe('Stop Workflow menu item', () => {
    it('should show "Stop Workflow" as first item for a running node', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      expect(items[0].label).toBe('Stop Workflow');
    });

    it('should not show "Stop Workflow" for a non-running node', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const stopItem = items.find(i => i.label === 'Stop Workflow');
      expect(stopItem).toBeUndefined();
    });

    it('should call stopWorkflow action when clicked', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });
      const stopItem = items.find(i => i.label === 'Stop Workflow');
      stopItem!.onClick!();

      expect(mockStopWorkflow).toHaveBeenCalledWith('task-a');
    });
  });

  describe('Continue Workflow menu item', () => {
    it('should show "Continue Workflow" for a node awaiting validation', () => {
      workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      expect(items[0].label).toBe('Continue Workflow');
    });

    it('should not show "Continue Workflow" for a running node', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const continueItem = items.find(i => i.label === 'Continue Workflow');
      expect(continueItem).toBeUndefined();
    });

    it('should call getTerminalId and pass result to continueWorkflow when clicked', async () => {
      workflowExecutionStates['task-a'] = { state: 'awaiting-validation', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });
      const continueItem = items.find(i => i.label === 'Continue Workflow');
      continueItem!.onClick!();

      await vi.waitFor(() => {
        expect(mockGetTerminalId).toHaveBeenCalled();
        expect(mockContinueWorkflow).toHaveBeenCalledWith('task-a', 'terminal-1');
      });
    });
  });

  describe('nested workflow steps', () => {
    beforeEach(() => {
      nodes['step-1'].metadata.isWorkflow = true;
      nodes['step-1'].children = ['sub-step-1', 'sub-step-2'];
      nodes['sub-step-1'] = {
        id: 'sub-step-1',
        content: 'Sub Step 1',
        children: ['task-a'],
        metadata: { isBlueprint: true },
      };
      nodes['sub-step-2'] = {
        id: 'sub-step-2',
        content: 'Sub Step 2',
        children: [],
        metadata: { isBlueprint: true },
      };
      ancestorRegistry['sub-step-1'] = ['root', 'workflow', 'step-1'];
      ancestorRegistry['sub-step-2'] = ['root', 'workflow', 'step-1'];
      ancestorRegistry['task-a'] = ['root', 'workflow', 'step-1', 'sub-step-1'];
    });

    it('should not show "Start Workflow" for a step of a sub-workflow', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['sub-step-1'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      expect(items).toHaveLength(0);
    });

    it('should show "Start Workflow" for a task inside a step of a sub-workflow', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: buildActions(),
        getTerminalId: mockGetTerminalId,
      });

      const startItem = items.find(i => i.label === 'Start Workflow');
      expect(startItem).toBeDefined();
    });
  });
});
