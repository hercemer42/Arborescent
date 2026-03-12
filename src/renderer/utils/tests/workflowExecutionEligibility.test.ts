import { describe, it, expect, beforeEach } from 'vitest';
import type { TreeNode } from '../../../shared/types';
import { isEligibleForExecution } from '../workflowHelpers';

describe('isEligibleForExecution', () => {
  let nodes: Record<string, TreeNode>;
  let ancestorRegistry: Record<string, string[]>;
  let workflowExecutionStates: Record<string, { state: 'idle' | 'running' | 'paused'; terminalTabId: string }>;

  beforeEach(() => {
    // Tree:
    // root (blueprint)
    // ├── workflow (blueprint, isWorkflow)
    // │   ├── step-1 (blueprint)
    // │   │   ├── task-a (blueprint)
    // │   │   └── context-node (blueprint, isContextDeclaration)
    // │   └── step-2 (blueprint)
    // │       └── task-c (blueprint)
    // └── outside (not in workflow)
    nodes = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['workflow', 'outside'],
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
        children: ['task-a', 'context-node'],
        metadata: { isBlueprint: true },
      },
      'step-2': {
        id: 'step-2',
        content: 'Step 2',
        children: ['task-c'],
        metadata: { isBlueprint: true },
      },
      'task-a': {
        id: 'task-a',
        content: 'Task A',
        children: [],
        metadata: { isBlueprint: true },
      },
      'task-c': {
        id: 'task-c',
        content: 'Task C',
        children: [],
        metadata: { isBlueprint: true },
      },
      'context-node': {
        id: 'context-node',
        content: 'Context',
        children: [],
        metadata: { isBlueprint: true, isContextDeclaration: true },
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
      'task-c': ['root', 'workflow', 'step-2'],
      'context-node': ['root', 'workflow', 'step-1'],
      'outside': ['root'],
    };

    workflowExecutionStates = {};
  });

  describe('eligible nodes', () => {
    it('should return true for a direct child of a workflow step', () => {
      const result = isEligibleForExecution('task-a', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(true);
    });

    it('should return true for a node in Paused state (eligible for resume)', () => {
      workflowExecutionStates['task-a'] = { state: 'paused', terminalTabId: 'terminal-1' };

      const result = isEligibleForExecution('task-a', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(true);
    });
  });

  describe('ineligible nodes', () => {
    it('should return false for a direct child of a workflow (step node)', () => {
      const result = isEligibleForExecution('step-1', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for a leaf node at the workflow root', () => {
      nodes['workflow'].children.push('task-root');
      nodes['task-root'] = { id: 'task-root', content: 'Root Task', children: [], metadata: { isBlueprint: true } };
      ancestorRegistry['task-root'] = ['root', 'workflow'];

      const result = isEligibleForExecution('task-root', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for the workflow root node itself', () => {
      const result = isEligibleForExecution('workflow', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for an ancestor of a workflow', () => {
      const result = isEligibleForExecution('root', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for a context declaration node', () => {
      const result = isEligibleForExecution('context-node', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for a node outside any workflow', () => {
      const result = isEligibleForExecution('outside', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for a node already in Running state', () => {
      workflowExecutionStates['task-a'] = { state: 'running', terminalTabId: 'terminal-1' };

      const result = isEligibleForExecution('task-a', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for a node that is itself a nested workflow', () => {
      nodes['step-1'].metadata.isWorkflow = true;

      const result = isEligibleForExecution('step-1', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });
  });

  describe('nested workflows', () => {
    beforeEach(() => {
      // Add sub-workflow: step-1 becomes a workflow with its own steps
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

    it('should return false for a step of a sub-workflow', () => {
      const result = isEligibleForExecution('sub-step-1', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return true for a task inside a step of a sub-workflow', () => {
      const result = isEligibleForExecution('task-a', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(true);
    });
  });

  describe('boundary cases', () => {
    it('should return false for a nonexistent node ID', () => {
      const result = isEligibleForExecution('nonexistent', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false for an empty string node ID', () => {
      const result = isEligibleForExecution('', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should return false when ancestor registry has no entry for the node', () => {
      delete ancestorRegistry['task-a'];

      const result = isEligibleForExecution('task-a', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });

    it('should handle a workflow with no steps (empty children array)', () => {
      nodes['workflow'].children = [];

      const result = isEligibleForExecution('task-a', nodes, ancestorRegistry, workflowExecutionStates);
      expect(result).toBe(false);
    });
  });
});
