import { describe, it, expect, beforeEach } from 'vitest';
import { RemoveWorkflowCommand } from '../RemoveWorkflowCommand';
import type { TreeNode } from '@shared/types';

describe('RemoveWorkflowCommand', () => {
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
        children: ['step-1', 'nested-wf'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'step-1': {
        id: 'step-1',
        content: 'Step 1',
        children: [],
        metadata: { isBlueprint: true },
      },
      'nested-wf': {
        id: 'nested-wf',
        content: 'Nested',
        children: ['nested-step'],
        metadata: { isBlueprint: true, isWorkflow: true },
      },
      'nested-step': {
        id: 'nested-step',
        content: 'Nested Step',
        children: [],
        metadata: { isBlueprint: true },
      },
    };

    setNodes = (updated) => { nodes = updated; };
  });

  it('should strip isWorkflow from target node on execute', () => {
    const cmd = new RemoveWorkflowCommand('workflow', () => nodes, setNodes);
    cmd.execute();

    expect(nodes['workflow'].metadata.isWorkflow).toBeUndefined();
  });

  it('should cascade removal to descendant workflows', () => {
    const cmd = new RemoveWorkflowCommand('workflow', () => nodes, setNodes);
    cmd.execute();

    expect(nodes['nested-wf'].metadata.isWorkflow).toBeUndefined();
  });

  it('should keep isBlueprint on all affected nodes', () => {
    const cmd = new RemoveWorkflowCommand('workflow', () => nodes, setNodes);
    cmd.execute();

    expect(nodes['workflow'].metadata.isBlueprint).toBe(true);
    expect(nodes['nested-wf'].metadata.isBlueprint).toBe(true);
  });

  it('should restore workflow status on undo', () => {
    const cmd = new RemoveWorkflowCommand('workflow', () => nodes, setNodes);
    cmd.execute();
    cmd.undo();

    expect(nodes['workflow'].metadata.isWorkflow).toBe(true);
    expect(nodes['nested-wf'].metadata.isWorkflow).toBe(true);
  });

  it('should re-apply removal on redo', () => {
    const cmd = new RemoveWorkflowCommand('workflow', () => nodes, setNodes);
    cmd.execute();
    cmd.undo();
    cmd.redo();

    expect(nodes['workflow'].metadata.isWorkflow).toBeUndefined();
    expect(nodes['nested-wf'].metadata.isWorkflow).toBeUndefined();
  });
});
