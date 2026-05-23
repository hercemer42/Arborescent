import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';

import { findNextDecomposedSibling } from '../workflowHelpers';

function makeNode(
  id: string,
  metadata: Record<string, unknown> = {},
  children: string[] = [],
): TreeNode {
  return { id, content: id, children, metadata };
}

describe('findNextDecomposedSibling — groupId filtering replaces sessionId filtering', () => {
  it('returns the first pending sibling whose groupId matches the originGroupId', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2', 's3']),
      's1': makeNode('s1', { groupId: 'group-A' }),
      's2': makeNode('s2', { groupId: 'group-B' }),
      's3': makeNode('s3', { groupId: 'group-A' }),
    };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, undefined, 'group-A'),
    ).toBe('s1');
    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, undefined, 'group-B'),
    ).toBe('s2');
  });

  it('skips siblings whose groupId does not match — no fallback to a foreign group', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2']),
      's1': makeNode('s1', { groupId: 'group-A' }),
      's2': makeNode('s2', { groupId: 'group-B' }),
    };
    const execStates = { 's2': { state: 'running' as const, terminalTabId: 't2' } };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, execStates, 's2', 'group-B'),
    ).toBeNull();
  });

  it('skips siblings that are still in an executionState', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2']),
      's1': makeNode('s1', { groupId: 'group-A' }),
      's2': makeNode('s2', { groupId: 'group-A' }),
    };
    const execStates = { 's1': { state: 'running' as const, terminalTabId: 't1' } };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, execStates, undefined, 'group-A'),
    ).toBe('s2');
  });

  it('without an originGroupId, only matches siblings that also have no groupId (legacy / unstamped flows)', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2']),
      's1': makeNode('s1', { groupId: 'group-A' }),
      's2': makeNode('s2', {}),
    };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, undefined, undefined),
    ).toBe('s2');
  });

  it('does not filter by sessionId anymore — siblings with mismatched sessionId but matching groupId are still candidates', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2']),
      's1': makeNode('s1', { groupId: 'group-A', sessionId: 'sess-A' }),
      's2': makeNode('s2', { groupId: 'group-A', sessionId: 'sess-B' }),
    };
    const execStates = { 's1': { state: 'running' as const, terminalTabId: 't1' } };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, execStates, 's1', 'group-A'),
    ).toBe('s2');
  });

  it('returns null when the step is not a decomposition step', () => {
    const nodes: Record<string, TreeNode> = {
      'step-plain': makeNode('step-plain', {}, ['s1']),
      's1': makeNode('s1', { groupId: 'group-A' }),
    };
    expect(
      findNextDecomposedSibling('step-plain', nodes, {}, undefined, 'group-A'),
    ).toBeNull();
  });

  it('returns null when the step id does not exist', () => {
    expect(
      findNextDecomposedSibling('does-not-exist', {}, {}, undefined, 'group-A'),
    ).toBeNull();
  });

  it('respects excludeNodeId — does not return the just-completed sibling even when its groupId matches', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2']),
      's1': makeNode('s1', { groupId: 'group-A' }),
      's2': makeNode('s2', { groupId: 'group-A' }),
    };
    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, 's1', 'group-A'),
    ).toBe('s2');
  });
});
