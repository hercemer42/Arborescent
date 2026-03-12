import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';
import { buildWorkflowExecutionSubmenu } from '../useWorkflowExecutionSubmenu';

describe('buildWorkflowExecutionSubmenu', () => {
  let nodes: Record<string, TreeNode>;
  let ancestorRegistry: Record<string, string[]>;
  let workflowExecutionStates: Record<string, { state: 'idle' | 'running' | 'paused'; terminalTabId: string }>;
  let mockStartWorkflow: ReturnType<typeof vi.fn>;
  let mockPauseWorkflow: ReturnType<typeof vi.fn>;
  let mockResumeWorkflow: ReturnType<typeof vi.fn>;
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
    mockPauseWorkflow = vi.fn();
    mockResumeWorkflow = vi.fn();
    mockGetTerminalId = vi.fn().mockResolvedValue('terminal-1');
  });

  describe('Start Workflow menu item', () => {
    it('should show "Start Workflow" for a non-running node inside a workflow', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
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
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
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
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
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
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
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
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
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
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
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
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      expect(items).toHaveLength(0);
    });
  });

  describe('Pause Workflow menu item', () => {
    it('should show "Pause Workflow" as first item for a running node', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      expect(items[0].label).toBe('Pause Workflow');
    });

    it('should not show "Pause Workflow" for a non-running node', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const pauseItem = items.find(i => i.label === 'Pause Workflow');
      expect(pauseItem).toBeUndefined();
    });

    it('should call pauseWorkflow action when clicked', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });
      const pauseItem = items.find(i => i.label === 'Pause Workflow');
      pauseItem!.onClick!();

      expect(mockPauseWorkflow).toHaveBeenCalledWith('task-a');
    });
  });

  describe('Resume Workflow menu item', () => {
    it('should show "Resume Workflow" as first item for a paused node', () => {
      workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      expect(items[0].label).toBe('Resume Workflow');
    });

    it('should not show "Resume Workflow" for a running node', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const resumeItem = items.find(i => i.label === 'Resume Workflow');
      expect(resumeItem).toBeUndefined();
    });

    it('should call getTerminalId and pass result to resumeWorkflow when clicked', async () => {
      workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });
      const resumeItem = items.find(i => i.label === 'Resume Workflow');
      resumeItem!.onClick!();

      await vi.waitFor(() => {
        expect(mockGetTerminalId).toHaveBeenCalled();
        expect(mockResumeWorkflow).toHaveBeenCalledWith('task-a', 'terminal-1');
      });
    });
  });

  describe('Step Type submenu', () => {
    // Step Type management is handled by buildBlueprintSubmenu, not buildWorkflowExecutionSubmenu
    it.skip('should show Step Type submenu on workflow step nodes', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const stepTypeItem = items.find(i => i.label === 'Step Type');
      expect(stepTypeItem).toBeDefined();
      expect(stepTypeItem!.submenu).toHaveLength(3);
    });

    // Step Type management is handled by buildBlueprintSubmenu, not buildWorkflowExecutionSubmenu
    it.skip('should show Manual as checked when no stepType is set (default)', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const stepTypeItem = items.find(i => i.label === 'Step Type');
      const manual = stepTypeItem!.submenu!.find(i => i.label === 'Manual');
      expect(manual!.radioSelected).toBe(true);
    });

    // Step Type management is handled by buildBlueprintSubmenu, not buildWorkflowExecutionSubmenu
    it.skip('should show Checkpoint as checked when stepType is checkpoint', () => {
      nodes['step-1'].metadata.stepType = 'checkpoint';

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const stepTypeItem = items.find(i => i.label === 'Step Type');
      const checkpoint = stepTypeItem!.submenu!.find(i => i.label === 'Checkpoint');
      expect(checkpoint!.radioSelected).toBe(true);
    });

    // Step Type management is handled by buildBlueprintSubmenu, not buildWorkflowExecutionSubmenu
    it.skip('should show Autonomous as checked when stepType is autonomous', () => {
      nodes['step-1'].metadata.stepType = 'autonomous';

      const items = buildWorkflowExecutionSubmenu({
        node: nodes['step-1'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const stepTypeItem = items.find(i => i.label === 'Step Type');
      const autonomous = stepTypeItem!.submenu!.find(i => i.label === 'Autonomous');
      expect(autonomous!.radioSelected).toBe(true);
    });

    // Step Type management is handled by buildBlueprintSubmenu, not buildWorkflowExecutionSubmenu
    it.skip('should not show Step Type submenu on non-step nodes', () => {
      const items = buildWorkflowExecutionSubmenu({
        node: nodes['task-a'],
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
        actions: { startWorkflow: mockStartWorkflow, pauseWorkflow: mockPauseWorkflow, resumeWorkflow: mockResumeWorkflow },
        getTerminalId: mockGetTerminalId,
      });

      const stepTypeItem = items.find(i => i.label === 'Step Type');
      expect(stepTypeItem).toBeUndefined();
    });
  });
});
