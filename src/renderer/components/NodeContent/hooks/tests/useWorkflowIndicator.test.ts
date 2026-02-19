import { describe, it, expect } from 'vitest';
import { getWorkflowStepNumber, isWorkflowNode } from '../../../../utils/workflowHelpers';
import type { TreeNode } from '../../../../../shared/types';

describe('useWorkflowIndicator logic', () => {
  const createNodes = (): Record<string, TreeNode> => ({
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
      children: [],
      metadata: { isBlueprint: true },
    },
    'step-2': {
      id: 'step-2',
      content: 'Step 2',
      children: [],
      metadata: { isBlueprint: true },
    },
    'step-3': {
      id: 'step-3',
      content: 'Step 3',
      children: [],
      metadata: { isBlueprint: true },
    },
    'regular': {
      id: 'regular',
      content: 'Regular',
      children: ['child'],
      metadata: {},
    },
    'child': {
      id: 'child',
      content: 'Child',
      children: [],
      metadata: {},
    },
  });

  const ancestorRegistry: Record<string, string[]> = {
    'root': [],
    'workflow': ['root'],
    'step-1': ['root', 'workflow'],
    'step-2': ['root', 'workflow'],
    'step-3': ['root', 'workflow'],
    'regular': ['root'],
    'child': ['root', 'regular'],
  };

  describe('isWorkflow detection', () => {
    it('should detect workflow nodes', () => {
      const nodes = createNodes();
      expect(isWorkflowNode('workflow', nodes)).toBe(true);
    });

    it('should return false for non-workflow nodes', () => {
      const nodes = createNodes();
      expect(isWorkflowNode('step-1', nodes)).toBe(false);
      expect(isWorkflowNode('regular', nodes)).toBe(false);
    });
  });

  describe('stepNumber derivation', () => {
    it('should return 1-based step numbers for workflow children', () => {
      const nodes = createNodes();
      expect(getWorkflowStepNumber('step-1', nodes, ancestorRegistry)).toBe(1);
      expect(getWorkflowStepNumber('step-2', nodes, ancestorRegistry)).toBe(2);
      expect(getWorkflowStepNumber('step-3', nodes, ancestorRegistry)).toBe(3);
    });

    it('should return null for non-workflow children', () => {
      const nodes = createNodes();
      expect(getWorkflowStepNumber('child', nodes, ancestorRegistry)).toBe(null);
      expect(getWorkflowStepNumber('workflow', nodes, ancestorRegistry)).toBe(null);
    });

    it('should return null when parent is not a workflow', () => {
      const nodes = createNodes();
      // regular is not a workflow, so child should return null
      expect(getWorkflowStepNumber('child', nodes, ancestorRegistry)).toBe(null);
    });
  });
});
