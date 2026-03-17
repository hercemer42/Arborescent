import { describe, it, expect } from 'vitest';
import {
  isWorkflowNode,
  getWorkflowStepNumber,
  isChildOfWorkflowStep,
  getWorkflowStepPosition,
  hasAncestorWorkflow,
  hasDescendantWorkflow,
  collectDescendantWorkflows,
  findNextStepTarget,
  findPreviousStepTarget,
  findFirstAutonomousStepInChain,
  findNextWaitingNode,
} from '../workflowHelpers';
import type { TreeNode } from '../../../shared/types';

describe('workflowHelpers', () => {
  const createNodes = (): Record<string, TreeNode> => ({
    'root': {
      id: 'root',
      content: 'Root',
      children: ['workflow-candidate', 'other-node'],
      metadata: { isBlueprint: true },
    },
    'workflow-candidate': {
      id: 'workflow-candidate',
      content: 'Workflow',
      children: ['step-1', 'step-2'],
      metadata: { isBlueprint: true, isWorkflow: true },
    },
    'step-1': {
      id: 'step-1',
      content: 'Step 1',
      children: ['item-a', 'item-b'],
      metadata: { isBlueprint: true },
    },
    'step-2': {
      id: 'step-2',
      content: 'Step 2',
      children: ['item-c'],
      metadata: { isBlueprint: true },
    },
    'item-a': {
      id: 'item-a',
      content: 'Item A',
      children: [],
      metadata: { isBlueprint: true },
    },
    'item-b': {
      id: 'item-b',
      content: 'Item B',
      children: [],
      metadata: { isBlueprint: true },
    },
    'item-c': {
      id: 'item-c',
      content: 'Item C',
      children: [],
      metadata: { isBlueprint: true },
    },
    'other-node': {
      id: 'other-node',
      content: 'Other',
      children: [],
      metadata: {},
    },
  });

  const ancestorRegistry: Record<string, string[]> = {
    'root': [],
    'workflow-candidate': ['root'],
    'step-1': ['root', 'workflow-candidate'],
    'step-2': ['root', 'workflow-candidate'],
    'item-a': ['root', 'workflow-candidate', 'step-1'],
    'item-b': ['root', 'workflow-candidate', 'step-1'],
    'item-c': ['root', 'workflow-candidate', 'step-2'],
    'other-node': ['root'],
  };

  describe('isWorkflowNode', () => {
    it('should return true for workflow nodes', () => {
      const nodes = createNodes();
      expect(isWorkflowNode('workflow-candidate', nodes)).toBe(true);
    });

    it('should return false for non-workflow nodes', () => {
      const nodes = createNodes();
      expect(isWorkflowNode('step-1', nodes)).toBe(false);
    });

    it('should return false for missing nodes', () => {
      const nodes = createNodes();
      expect(isWorkflowNode('nonexistent', nodes)).toBe(false);
    });
  });

  describe('getWorkflowStepNumber', () => {
    it('should return 1-based step numbers for workflow children', () => {
      const nodes = createNodes();
      expect(getWorkflowStepNumber('step-1', nodes, ancestorRegistry)).toBe(1);
      expect(getWorkflowStepNumber('step-2', nodes, ancestorRegistry)).toBe(2);
    });

    it('should return null for non-step nodes', () => {
      const nodes = createNodes();
      expect(getWorkflowStepNumber('item-a', nodes, ancestorRegistry)).toBe(null);
    });

    it('should return null when parent is not a workflow', () => {
      const nodes = createNodes();
      expect(getWorkflowStepNumber('other-node', nodes, ancestorRegistry)).toBe(null);
    });

    it('should return null for root-level nodes', () => {
      const nodes = createNodes();
      expect(getWorkflowStepNumber('root', nodes, ancestorRegistry)).toBe(null);
    });
  });

  describe('isChildOfWorkflowStep', () => {
    it('should return true for items inside workflow steps', () => {
      const nodes = createNodes();
      expect(isChildOfWorkflowStep('item-a', nodes, ancestorRegistry)).toBe(true);
    });

    it('should return false for workflow steps themselves', () => {
      const nodes = createNodes();
      expect(isChildOfWorkflowStep('step-1', nodes, ancestorRegistry)).toBe(false);
    });

    it('should return false for nodes outside workflows', () => {
      const nodes = createNodes();
      expect(isChildOfWorkflowStep('other-node', nodes, ancestorRegistry)).toBe(false);
    });
  });

  describe('getWorkflowStepPosition', () => {
    it('should return correct position for items in workflow steps', () => {
      const nodes = createNodes();
      const position = getWorkflowStepPosition('item-a', nodes, ancestorRegistry);
      expect(position).toEqual({
        workflowNodeId: 'workflow-candidate',
        currentStepId: 'step-1',
        currentStepIndex: 0,
        totalSteps: 2,
      });
    });

    it('should return correct position for items in second step', () => {
      const nodes = createNodes();
      const position = getWorkflowStepPosition('item-c', nodes, ancestorRegistry);
      expect(position).toEqual({
        workflowNodeId: 'workflow-candidate',
        currentStepId: 'step-2',
        currentStepIndex: 1,
        totalSteps: 2,
      });
    });

    it('should return null for nodes not in a workflow', () => {
      const nodes = createNodes();
      expect(getWorkflowStepPosition('other-node', nodes, ancestorRegistry)).toBe(null);
    });

    it('should return null for workflow steps themselves', () => {
      const nodes = createNodes();
      expect(getWorkflowStepPosition('step-1', nodes, ancestorRegistry)).toBe(null);
    });
  });

  describe('hasAncestorWorkflow', () => {
    it('should detect workflow ancestors', () => {
      const nodes = createNodes();
      expect(hasAncestorWorkflow('step-1', nodes, ancestorRegistry)).toBe(true);
      expect(hasAncestorWorkflow('item-a', nodes, ancestorRegistry)).toBe(true);
    });

    it('should return false for nodes without workflow ancestors', () => {
      const nodes = createNodes();
      expect(hasAncestorWorkflow('other-node', nodes, ancestorRegistry)).toBe(false);
    });

    it('should return false for the workflow node itself', () => {
      const nodes = createNodes();
      expect(hasAncestorWorkflow('workflow-candidate', nodes, ancestorRegistry)).toBe(false);
    });
  });

  describe('hasDescendantWorkflow', () => {
    it('should detect workflow descendants', () => {
      const nodes = createNodes();
      // workflow-candidate has isWorkflow, so root should detect it
      expect(hasDescendantWorkflow('root', nodes)).toBe(true);
    });

    it('should return false for nodes without workflow descendants', () => {
      const nodes = createNodes();
      expect(hasDescendantWorkflow('other-node', nodes)).toBe(false);
      expect(hasDescendantWorkflow('item-a', nodes)).toBe(false);
    });

    it('should return false for missing nodes', () => {
      const nodes = createNodes();
      expect(hasDescendantWorkflow('nonexistent', nodes)).toBe(false);
    });
  });

  describe('nested workflows', () => {
    const createNestedNodes = (): Record<string, TreeNode> => ({
      'root': {
        id: 'root',
        content: 'Root',
        children: ['parent-workflow'],
        metadata: { isBlueprint: true },
      },
      'parent-workflow': {
        id: 'parent-workflow',
        content: 'Parent Workflow',
        children: ['step-1', 'nested-workflow', 'step-3'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'step-1': {
        id: 'step-1',
        content: 'Step 1',
        children: [],
        metadata: { isBlueprint: true },
      },
      'nested-workflow': {
        id: 'nested-workflow',
        content: 'Nested Workflow',
        children: ['nested-step-1', 'nested-step-2'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'step-3': {
        id: 'step-3',
        content: 'Step 3',
        children: [],
        metadata: { isBlueprint: true },
      },
      'nested-step-1': {
        id: 'nested-step-1',
        content: 'Nested Step 1',
        children: [],
        metadata: { isBlueprint: true },
      },
      'nested-step-2': {
        id: 'nested-step-2',
        content: 'Nested Step 2',
        children: [],
        metadata: { isBlueprint: true },
      },
    });

    const nestedAncestorRegistry: Record<string, string[]> = {
      'root': [],
      'parent-workflow': ['root'],
      'step-1': ['root', 'parent-workflow'],
      'nested-workflow': ['root', 'parent-workflow'],
      'step-3': ['root', 'parent-workflow'],
      'nested-step-1': ['root', 'parent-workflow', 'nested-workflow'],
      'nested-step-2': ['root', 'parent-workflow', 'nested-workflow'],
    };

    // Extended fixture with items inside steps (for navigation tests)
    const createNestedNodesWithItems = (): Record<string, TreeNode> => ({
      ...createNestedNodes(),
      'step-1': {
        id: 'step-1',
        content: 'Step 1',
        children: ['item-x'],
        metadata: { isBlueprint: true },
      },
      'step-3': {
        id: 'step-3',
        content: 'Step 3',
        children: ['item-w'],
        metadata: { isBlueprint: true },
      },
      'nested-step-1': {
        id: 'nested-step-1',
        content: 'Nested Step 1',
        children: ['item-y'],
        metadata: { isBlueprint: true },
      },
      'nested-step-2': {
        id: 'nested-step-2',
        content: 'Nested Step 2',
        children: ['item-z'],
        metadata: { isBlueprint: true },
      },
      'item-x': { id: 'item-x', content: 'Item X', children: [], metadata: { isBlueprint: true } },
      'item-y': { id: 'item-y', content: 'Item Y', children: [], metadata: { isBlueprint: true } },
      'item-z': { id: 'item-z', content: 'Item Z', children: [], metadata: { isBlueprint: true } },
      'item-w': { id: 'item-w', content: 'Item W', children: [], metadata: { isBlueprint: true } },
    });

    const nestedItemAncestorRegistry: Record<string, string[]> = {
      ...nestedAncestorRegistry,
      'item-x': ['root', 'parent-workflow', 'step-1'],
      'item-y': ['root', 'parent-workflow', 'nested-workflow', 'nested-step-1'],
      'item-z': ['root', 'parent-workflow', 'nested-workflow', 'nested-step-2'],
      'item-w': ['root', 'parent-workflow', 'step-3'],
    };

    describe('getWorkflowStepNumber with nesting', () => {
      it('should return null for a child that is itself a workflow', () => {
        const nodes = createNestedNodes();
        expect(getWorkflowStepNumber('nested-workflow', nodes, nestedAncestorRegistry)).toBe(null);
      });

      it('should use global depth-first numbering across nested workflows', () => {
        const nodes = createNestedNodes();
        expect(getWorkflowStepNumber('step-1', nodes, nestedAncestorRegistry)).toBe(1);
        expect(getWorkflowStepNumber('nested-step-1', nodes, nestedAncestorRegistry)).toBe(2);
        expect(getWorkflowStepNumber('nested-step-2', nodes, nestedAncestorRegistry)).toBe(3);
        expect(getWorkflowStepNumber('step-3', nodes, nestedAncestorRegistry)).toBe(4);
      });

      it('should number correctly at 4+ nesting levels', () => {
        const nodes = createNestedNodes();
        // Add a deeply nested workflow inside nested-step-1
        nodes['nested-step-1'] = {
          ...nodes['nested-step-1'],
          children: ['deep-wf'],
          metadata: { isBlueprint: true, isWorkflow: true },
        };
        nodes['deep-wf'] = {
          id: 'deep-wf',
          content: 'Deep WF',
          children: ['deep-step-1', 'deep-step-2'],
          metadata: { isBlueprint: true, isWorkflow: true },
        };
        nodes['deep-step-1'] = {
          id: 'deep-step-1',
          content: 'Deep Step 1',
          children: [],
          metadata: { isBlueprint: true },
        };
        nodes['deep-step-2'] = {
          id: 'deep-step-2',
          content: 'Deep Step 2',
          children: [],
          metadata: { isBlueprint: true },
        };

        const deepRegistry: Record<string, string[]> = {
          ...nestedAncestorRegistry,
          'deep-wf': ['root', 'parent-workflow', 'nested-workflow', 'nested-step-1'],
          'deep-step-1': ['root', 'parent-workflow', 'nested-workflow', 'nested-step-1', 'deep-wf'],
          'deep-step-2': ['root', 'parent-workflow', 'nested-workflow', 'nested-step-1', 'deep-wf'],
        };

        // step-1=1, nested-step-1 is now a workflow (null), deep-step-1=2, deep-step-2=3, nested-step-2=4, step-3=5
        expect(getWorkflowStepNumber('step-1', nodes, deepRegistry)).toBe(1);
        expect(getWorkflowStepNumber('nested-step-1', nodes, deepRegistry)).toBe(null);
        expect(getWorkflowStepNumber('deep-step-1', nodes, deepRegistry)).toBe(2);
        expect(getWorkflowStepNumber('deep-step-2', nodes, deepRegistry)).toBe(3);
        expect(getWorkflowStepNumber('nested-step-2', nodes, deepRegistry)).toBe(4);
        expect(getWorkflowStepNumber('step-3', nodes, deepRegistry)).toBe(5);
      });
    });

    describe('findNextStepTarget', () => {
      it('should cross into a nested workflow from a parent step', () => {
        // item-x is child of step-1, next step should enter nested-workflow
        const nodes = createNestedNodesWithItems();
        expect(findNextStepTarget('item-x', nodes, nestedItemAncestorRegistry)).toBe('nested-step-1');
      });

      it('should exit a nested workflow to the parent step', () => {
        // item-z is child of nested-step-2 (last step). Next should be step-3 of parent
        const nodes = createNestedNodesWithItems();
        expect(findNextStepTarget('item-z', nodes, nestedItemAncestorRegistry)).toBe('step-3');
      });

      it('should return null at the very last step of the entire tree', () => {
        const nodes = createNestedNodesWithItems();
        expect(findNextStepTarget('item-w', nodes, nestedItemAncestorRegistry)).toBe(null);
      });

      it('should move between steps within a nested workflow', () => {
        const nodes = createNestedNodesWithItems();
        expect(findNextStepTarget('item-y', nodes, nestedItemAncestorRegistry)).toBe('nested-step-2');
      });
    });

    describe('findPreviousStepTarget', () => {
      it('should cross out of a nested workflow to the parent step', () => {
        // item-y is in nested-step-1 (first step). Previous should be step-1 of parent
        const nodes = createNestedNodesWithItems();
        expect(findPreviousStepTarget('item-y', nodes, nestedItemAncestorRegistry)).toBe('step-1');
      });

      it('should enter a nested workflow from a subsequent parent step', () => {
        // item-w is in step-3. Previous should enter nested-workflow's last step
        const nodes = createNestedNodesWithItems();
        expect(findPreviousStepTarget('item-w', nodes, nestedItemAncestorRegistry)).toBe('nested-step-2');
      });

      it('should return null at the very first step of the entire tree', () => {
        const nodes = createNestedNodesWithItems();
        expect(findPreviousStepTarget('item-x', nodes, nestedItemAncestorRegistry)).toBe(null);
      });

      it('should move between steps within a nested workflow', () => {
        const nodes = createNestedNodesWithItems();
        expect(findPreviousStepTarget('item-z', nodes, nestedItemAncestorRegistry)).toBe('nested-step-1');
      });
    });

    describe('collectDescendantWorkflows', () => {
      it('should return all descendant workflow IDs', () => {
        const nodes = createNestedNodes();
        const result = collectDescendantWorkflows('parent-workflow', nodes);
        expect(result).toEqual(['nested-workflow']);
      });

      it('should return empty array when no descendant workflows', () => {
        const nodes = createNestedNodes();
        expect(collectDescendantWorkflows('nested-workflow', nodes)).toEqual([]);
      });

      it('should find deeply nested workflows', () => {
        const nodes = createNestedNodes();
        nodes['deep-workflow'] = {
          id: 'deep-workflow',
          content: 'Deep',
          children: [],
          metadata: { isBlueprint: true, isWorkflow: true },
        };
        nodes['nested-step-1'] = {
          ...nodes['nested-step-1'],
          children: ['deep-workflow'],
        };
        const result = collectDescendantWorkflows('parent-workflow', nodes);
        expect(result).toContain('nested-workflow');
        expect(result).toContain('deep-workflow');
        expect(result).toHaveLength(2);
      });
    });
  });

  describe('findFirstAutonomousStepInChain', () => {
    it('should return the first step when all steps are autonomous', () => {
      const nodes: Record<string, TreeNode> = {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['s1', 's2', 's3'], metadata: { isBlueprint: true, isWorkflow: true } },
        's1': { id: 's1', content: 'S1', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        's2': { id: 's2', content: 'S2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        's3': { id: 's3', content: 'S3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      };
      const registry = { 'root': [], 'workflow': ['root'], 's1': ['root', 'workflow'], 's2': ['root', 'workflow'], 's3': ['root', 'workflow'] };

      expect(findFirstAutonomousStepInChain('s3', nodes, registry)).toBe('s1');
    });

    it('should stop at a checkpoint step', () => {
      const nodes: Record<string, TreeNode> = {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['s1', 's2', 's3'], metadata: { isBlueprint: true, isWorkflow: true } },
        's1': { id: 's1', content: 'S1', children: [], metadata: { isBlueprint: true, stepType: 'checkpoint' } },
        's2': { id: 's2', content: 'S2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        's3': { id: 's3', content: 'S3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      };
      const registry = { 'root': [], 'workflow': ['root'], 's1': ['root', 'workflow'], 's2': ['root', 'workflow'], 's3': ['root', 'workflow'] };

      expect(findFirstAutonomousStepInChain('s3', nodes, registry)).toBe('s2');
    });

    it('should stop at a manual step', () => {
      const nodes: Record<string, TreeNode> = {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['s1', 's2', 's3'], metadata: { isBlueprint: true, isWorkflow: true } },
        's1': { id: 's1', content: 'S1', children: [], metadata: { isBlueprint: true } },
        's2': { id: 's2', content: 'S2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        's3': { id: 's3', content: 'S3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      };
      const registry = { 'root': [], 'workflow': ['root'], 's1': ['root', 'workflow'], 's2': ['root', 'workflow'], 's3': ['root', 'workflow'] };

      expect(findFirstAutonomousStepInChain('s3', nodes, registry)).toBe('s2');
    });

    it('should walk back within the correct workflow scope for nested workflows', () => {
      const nodes: Record<string, TreeNode> = {
        'root': { id: 'root', content: 'Root', children: ['outer-wf'], metadata: { isBlueprint: true } },
        'outer-wf': { id: 'outer-wf', content: 'Outer', children: ['outer-s1', 'inner-wf', 'outer-s3'], metadata: { isBlueprint: true, isWorkflow: true } },
        'outer-s1': { id: 'outer-s1', content: 'Outer S1', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'inner-wf': { id: 'inner-wf', content: 'Inner', children: ['inner-s1', 'inner-s2'], metadata: { isBlueprint: true, isWorkflow: true } },
        'outer-s3': { id: 'outer-s3', content: 'Outer S3', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'inner-s1': { id: 'inner-s1', content: 'Inner S1', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        'inner-s2': { id: 'inner-s2', content: 'Inner S2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      };
      const registry = {
        'root': [],
        'outer-wf': ['root'],
        'outer-s1': ['root', 'outer-wf'],
        'inner-wf': ['root', 'outer-wf'],
        'outer-s3': ['root', 'outer-wf'],
        'inner-s1': ['root', 'outer-wf', 'inner-wf'],
        'inner-s2': ['root', 'outer-wf', 'inner-wf'],
      };

      // inner-s2 should walk back within inner-wf only, not cross into outer-wf
      expect(findFirstAutonomousStepInChain('inner-s2', nodes, registry)).toBe('inner-s1');
    });

    it('should return the step itself when it is the first step in the workflow', () => {
      const nodes: Record<string, TreeNode> = {
        'root': { id: 'root', content: 'Root', children: ['workflow'], metadata: { isBlueprint: true } },
        'workflow': { id: 'workflow', content: 'WF', children: ['s1', 's2'], metadata: { isBlueprint: true, isWorkflow: true } },
        's1': { id: 's1', content: 'S1', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
        's2': { id: 's2', content: 'S2', children: [], metadata: { isBlueprint: true, stepType: 'autonomous' } },
      };
      const registry = { 'root': [], 'workflow': ['root'], 's1': ['root', 'workflow'], 's2': ['root', 'workflow'] };

      expect(findFirstAutonomousStepInChain('s1', nodes, registry)).toBe('s1');
    });
  });

  describe('findNextWaitingNode', () => {
    it('should return the first child not in execution states', () => {
      const nodes: Record<string, TreeNode> = {
        's1': { id: 's1', content: 'S1', children: ['a', 'b', 'c'], metadata: {} },
        'a': { id: 'a', content: 'A', children: [], metadata: {} },
        'b': { id: 'b', content: 'B', children: [], metadata: {} },
        'c': { id: 'c', content: 'C', children: [], metadata: {} },
      };

      expect(findNextWaitingNode('s1', nodes, {})).toBe('a');
    });

    it('should skip running children', () => {
      const nodes: Record<string, TreeNode> = {
        's1': { id: 's1', content: 'S1', children: ['a', 'b'], metadata: {} },
        'a': { id: 'a', content: 'A', children: [], metadata: {} },
        'b': { id: 'b', content: 'B', children: [], metadata: {} },
      };
      const execStates = { 'a': { state: 'running' as const, terminalTabId: 't1' } };

      expect(findNextWaitingNode('s1', nodes, execStates)).toBe('b');
    });

    it('should skip awaiting-validation children', () => {
      const nodes: Record<string, TreeNode> = {
        's1': { id: 's1', content: 'S1', children: ['a', 'b'], metadata: {} },
        'a': { id: 'a', content: 'A', children: [], metadata: {} },
        'b': { id: 'b', content: 'B', children: [], metadata: {} },
      };
      const execStates = { 'a': { state: 'awaiting-validation' as const, terminalTabId: 't1' } };

      expect(findNextWaitingNode('s1', nodes, execStates)).toBe('b');
    });

    it('should return null when all children are running or awaiting', () => {
      const nodes: Record<string, TreeNode> = {
        's1': { id: 's1', content: 'S1', children: ['a'], metadata: {} },
        'a': { id: 'a', content: 'A', children: [], metadata: {} },
      };
      const execStates = { 'a': { state: 'running' as const, terminalTabId: 't1' } };

      expect(findNextWaitingNode('s1', nodes, execStates)).toBeNull();
    });

    it('should return null when the step has no children', () => {
      const nodes: Record<string, TreeNode> = {
        's1': { id: 's1', content: 'S1', children: [], metadata: {} },
      };

      expect(findNextWaitingNode('s1', nodes, {})).toBeNull();
    });
  });
});
