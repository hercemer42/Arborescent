import { describe, it, expect, beforeEach } from 'vitest';
import { DeclareWorkflowCommand } from '../DeclareWorkflowCommand';
import type { TreeNode } from '@shared/types';

describe('DeclareWorkflowCommand', () => {
  let nodes: Record<string, TreeNode>;
  let setNodes: (n: Record<string, TreeNode>) => void;

  beforeEach(() => {
    nodes = {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['candidate'],
        metadata: { isBlueprint: true },
      },
      'candidate': {
        id: 'candidate',
        content: 'Candidate',
        children: ['child-1', 'child-2'],
        metadata: { isBlueprint: true },
      },
      'child-1': {
        id: 'child-1',
        content: 'Child 1',
        children: [],
        metadata: {},
      },
      'child-2': {
        id: 'child-2',
        content: 'Child 2',
        children: [],
        metadata: { isBlueprint: true },
      },
    };

    setNodes = (updated) => { nodes = updated; };
  });

  it('should set isWorkflow and isBlueprint on execute', () => {
    const cmd = new DeclareWorkflowCommand('candidate', () => nodes, setNodes);
    cmd.execute();

    expect(nodes['candidate'].metadata.isWorkflow).toBe(true);
    expect(nodes['candidate'].metadata.isBlueprint).toBe(true);
  });

  it('should auto-add children as blueprints', () => {
    const cmd = new DeclareWorkflowCommand('candidate', () => nodes, setNodes);
    cmd.execute();

    expect(nodes['child-1'].metadata.isBlueprint).toBe(true);
    expect(nodes['child-2'].metadata.isBlueprint).toBe(true);
  });

  it('should restore original state on undo', () => {
    const cmd = new DeclareWorkflowCommand('candidate', () => nodes, setNodes);
    cmd.execute();
    cmd.undo();

    expect(nodes['candidate'].metadata.isWorkflow).toBeUndefined();
    expect(nodes['child-1'].metadata.isBlueprint).toBeUndefined();
    expect(nodes['child-2'].metadata.isBlueprint).toBe(true);
  });

  it('should re-apply on redo', () => {
    const cmd = new DeclareWorkflowCommand('candidate', () => nodes, setNodes);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(nodes['candidate'].metadata.isWorkflow).toBe(true);
    expect(nodes['child-1'].metadata.isBlueprint).toBe(true);
  });
});
