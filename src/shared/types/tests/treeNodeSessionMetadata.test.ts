import { describe, it, expect } from 'vitest';
import type { NodeMetadata, TreeNode } from '../treeNode';
import type { ArboFile } from '../document';

describe('TreeNode session metadata (PR1)', () => {
  it('NodeMetadata accepts a sessionId string', () => {
    const meta: NodeMetadata = { sessionId: 'sess-abc-123' };
    expect(meta.sessionId).toBe('sess-abc-123');
  });

  it('a workflow node with no session metadata has undefined sessionId', () => {
    const node: TreeNode = {
      id: 'n1',
      content: 'step',
      children: [],
      metadata: { isWorkflow: true, stepType: 'autonomous' },
    };
    expect(node.metadata.sessionId).toBeUndefined();
  });

  it('sessionId can coexist with isWorkflow + stepType + brokenChain on the same node', () => {
    const meta: NodeMetadata = {
      sessionId: 'sess-1',
      isWorkflow: true,
      stepType: 'autonomous',
      brokenChain: true,
    };
    expect(meta.sessionId).toBe('sess-1');
    expect(meta.brokenChain).toBe(true);
  });

  it('a TreeNode without any session fields type-checks (all session fields are optional)', () => {
    const node: TreeNode = {
      id: 'n2',
      content: 'manual step',
      children: [],
      metadata: {},
    };
    expect(node.metadata.sessionId).toBeUndefined();
  });

  it('NodeMetadata does not carry sessionLiveness — liveness is derived at runtime', () => {
    const meta: NodeMetadata = { sessionId: 'sess-1' };
    expect(meta.sessionLiveness).toBeUndefined();
  });

  it('NodeMetadata does not carry sessionTabId — terminal mapping is runtime-only in workflowSessionMap', () => {
    const meta: NodeMetadata = { sessionId: 'sess-1' };
    expect(meta.sessionTabId).toBeUndefined();
  });

  it('NodeMetadata does not carry sessionWorkingDirectory — cwd lives in sessionRegistry', () => {
    const meta: NodeMetadata = { sessionId: 'sess-1' };
    expect(meta.sessionWorkingDirectory).toBeUndefined();
  });
});

describe('ArboFile sessionRegistry type (PR1)', () => {
  it('ArboFile accepts a sessionRegistry map', () => {
    const file: ArboFile = {
      format: 'Arborescent',
      version: '1.0.0',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
      author: 'Test',
      rootNodeId: 'root',
      nodes: {},
      sessionRegistry: { 'sess-1': { cwd: '/project' } },
    };
    expect(file.sessionRegistry?.['sess-1']?.cwd).toBe('/project');
  });

  it('ArboFile sessionRegistry is optional (existing files without it still load)', () => {
    const file: ArboFile = {
      format: 'Arborescent',
      version: '1.0.0',
      created: '2026-01-01T00:00:00.000Z',
      updated: '2026-01-01T00:00:00.000Z',
      author: 'Test',
      rootNodeId: 'root',
      nodes: {},
    };
    expect(file.sessionRegistry).toBeUndefined();
  });
});
