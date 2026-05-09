import { describe, it, expect } from 'vitest';
import type { NodeMetadata, TreeNode } from '../treeNode';

describe('TreeNode session metadata (PR1)', () => {
  it('NodeMetadata accepts a sessionId string', () => {
    const meta: NodeMetadata = { sessionId: 'sess-abc-123' };
    expect(meta.sessionId).toBe('sess-abc-123');
  });

  it('NodeMetadata accepts a sessionWorkingDirectory string', () => {
    const meta: NodeMetadata = { sessionWorkingDirectory: '/Users/me/repo' };
    expect(meta.sessionWorkingDirectory).toBe('/Users/me/repo');
  });

  it('NodeMetadata accepts a sessionLiveness enum value', () => {
    const meta: NodeMetadata = { sessionLiveness: 'alive-attached' };
    expect(meta.sessionLiveness).toBe('alive-attached');
  });

  it('NodeMetadata accepts a sessionTabId pointer (runtime-only)', () => {
    const meta: NodeMetadata = { sessionTabId: 'tab-xyz' };
    expect(meta.sessionTabId).toBe('tab-xyz');
  });

  it.todo('sessionLiveness is a string-literal union of "alive-attached" | "alive-detached" | "lost"');
  it.todo('a TreeNode without any session fields type-checks (all session fields are optional)');
  it.todo('session metadata can coexist with isWorkflow + stepType on the same node');
  it.todo('a "starting" pre-spawn marker field exists so a crash mid-spawn can be reconciled on next load');

  it('a workflow node with no session metadata has undefined session fields', () => {
    const node: TreeNode = {
      id: 'n1',
      content: 'step',
      children: [],
      metadata: { isWorkflow: true, stepType: 'autonomous' },
    };
    expect(node.metadata.sessionId).toBeUndefined();
    expect(node.metadata.sessionWorkingDirectory).toBeUndefined();
    expect(node.metadata.sessionLiveness).toBeUndefined();
    expect(node.metadata.sessionTabId).toBeUndefined();
  });
});
