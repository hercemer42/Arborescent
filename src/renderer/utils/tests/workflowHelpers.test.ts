import { describe, it, expect } from 'vitest';
import {
  isWorkflowNode,
  getWorkflowStepNumber,
  isChildOfWorkflowStep,
  getWorkflowStepPosition,
  hasAncestorWorkflow,
  hasDescendantWorkflow,
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
});
