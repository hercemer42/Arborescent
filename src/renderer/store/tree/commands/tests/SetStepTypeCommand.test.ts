import { describe, it, expect, beforeEach } from 'vitest';
import type { TreeNode } from '@shared/types';
import { SetStepTypeCommand } from '../SetStepTypeCommand';

describe('SetStepTypeCommand', () => {
  let nodes: Record<string, TreeNode>;
  let setNodes: (n: Record<string, TreeNode>) => void;

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
        metadata: { isBlueprint: true, stepType: 'checkpoint' },
      },
      'step-3': {
        id: 'step-3',
        content: 'Step 3',
        children: [],
        metadata: { isBlueprint: true, stepType: 'autonomous' },
      },
    };

    setNodes = (updated) => { nodes = updated; };
  });

  describe('execute', () => {
    it('should set stepType on the target node', () => {
      const cmd = new SetStepTypeCommand('step-1', 'checkpoint', () => nodes, setNodes);
      cmd.execute();
      expect(nodes['step-1'].metadata.stepType).toBe('checkpoint');
    });

    it('should overwrite an existing stepType', () => {
      const cmd = new SetStepTypeCommand('step-2', 'autonomous', () => nodes, setNodes);
      cmd.execute();
      expect(nodes['step-2'].metadata.stepType).toBe('autonomous');
    });

    it('should not affect other nodes', () => {
      const cmd = new SetStepTypeCommand('step-1', 'checkpoint', () => nodes, setNodes);
      cmd.execute();
      expect(nodes['step-2'].metadata.stepType).toBe('checkpoint');
      expect(nodes['step-3'].metadata.stepType).toBe('autonomous');
    });

    it('should not modify non-stepType metadata', () => {
      const cmd = new SetStepTypeCommand('step-1', 'autonomous', () => nodes, setNodes);
      cmd.execute();
      expect(nodes['step-1'].metadata.isBlueprint).toBe(true);
      expect(nodes['step-1'].content).toBe('Step 1');
    });

    it('should handle setting to manual explicitly', () => {
      const cmd = new SetStepTypeCommand('step-2', 'manual', () => nodes, setNodes);
      cmd.execute();
      expect(nodes['step-2'].metadata.stepType).toBe('manual');
    });
  });

  describe('undo', () => {
    it('should restore the previous stepType', () => {
      const cmd = new SetStepTypeCommand('step-2', 'autonomous', () => nodes, setNodes);
      cmd.execute();
      cmd.undo();
      expect(nodes['step-2'].metadata.stepType).toBe('checkpoint');
    });

    it('should restore undefined when node had no previous stepType', () => {
      const cmd = new SetStepTypeCommand('step-1', 'checkpoint', () => nodes, setNodes);
      cmd.execute();
      cmd.undo();
      expect(nodes['step-1'].metadata.stepType).toBeUndefined();
    });

    it('should not affect other nodes on undo', () => {
      const cmd = new SetStepTypeCommand('step-2', 'manual', () => nodes, setNodes);
      cmd.execute();
      cmd.undo();
      expect(nodes['step-3'].metadata.stepType).toBe('autonomous');
    });
  });

  describe('redo', () => {
    it('should re-apply the stepType after undo', () => {
      const cmd = new SetStepTypeCommand('step-1', 'autonomous', () => nodes, setNodes);
      cmd.execute();
      cmd.undo();
      cmd.redo();
      expect(nodes['step-1'].metadata.stepType).toBe('autonomous');
    });

    it('should be idempotent across multiple redo calls', () => {
      const cmd = new SetStepTypeCommand('step-1', 'checkpoint', () => nodes, setNodes);
      cmd.execute();
      cmd.undo();
      cmd.redo();
      cmd.undo();
      cmd.redo();
      expect(nodes['step-1'].metadata.stepType).toBe('checkpoint');
    });
  });

  describe('edge cases', () => {
    it('should be a no-op if node does not exist', () => {
      const cmd = new SetStepTypeCommand('nonexistent', 'checkpoint', () => nodes, setNodes);
      cmd.execute();
      expect(Object.keys(nodes)).toHaveLength(5);
    });

    it('should handle setting the same stepType that is already set', () => {
      const cmd = new SetStepTypeCommand('step-2', 'checkpoint', () => nodes, setNodes);
      cmd.execute();
      expect(nodes['step-2'].metadata.stepType).toBe('checkpoint');
      cmd.undo();
      expect(nodes['step-2'].metadata.stepType).toBe('checkpoint');
    });
  });
});
