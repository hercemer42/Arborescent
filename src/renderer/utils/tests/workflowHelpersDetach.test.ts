import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';

import { findNextDecomposedSibling } from '../workflowHelpers';

// "Start workflow in new session" detaches a decomposed sibling by REMOVING its
// groupId (not re-stamping a fresh one). These tests lock the recurse-selection
// behaviour the feature relies on: a detached (ungrouped) sibling is skipped, the
// chain advances to the next still-grouped sibling, and an all-detached group ends
// cleanly. No new selector logic is expected — the existing groupId filter does it.

function makeNode(
  id: string,
  metadata: Record<string, unknown> = {},
  children: string[] = [],
): TreeNode {
  return { id, content: id, children, metadata };
}

describe('findNextDecomposedSibling — detaching a sibling (groupId removed)', () => {
  it('skips a detached sibling and advances to the next still-grouped sibling', () => {
    // s1 has been detached (groupId removed); s2 still carries the shared group.
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2', 's3']),
      's1': makeNode('s1', {}),
      's2': makeNode('s2', { groupId: 'group-A' }),
      's3': makeNode('s3', { groupId: 'group-A' }),
    };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, undefined, 'group-A'),
    ).toBe('s2');
  });

  it('does not match a detached (ungrouped) sibling when the origin group is a real id', () => {
    // Undefined-group guard: an ungrouped child must not be picked up by a chain
    // whose originGroupId is a real uuid.
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1']),
      's1': makeNode('s1', {}),
    };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, undefined, 'group-A'),
    ).toBeNull();
  });

  it('returns null once every sibling in the group has been detached (clean termination)', () => {
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2']),
      's1': makeNode('s1', {}),
      's2': makeNode('s2', {}),
    };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, {}, undefined, 'group-A'),
    ).toBeNull();
  });

  it('leaves the remaining group intact — non-detached siblings still chain in order', () => {
    // s2 is detached out of the middle of the group; after s1 completes the chain
    // skips s2 and hands off to s3 on the shared session.
    const nodes: Record<string, TreeNode> = {
      'step-decomp': makeNode('step-decomp', { decomposition: true }, ['s1', 's2', 's3']),
      's1': makeNode('s1', { groupId: 'group-A' }),
      's2': makeNode('s2', {}),
      's3': makeNode('s3', { groupId: 'group-A' }),
    };
    const execStates = { 's1': { state: 'running' as const, terminalTabId: 't1' } };

    expect(
      findNextDecomposedSibling('step-decomp', nodes, execStates, 's1', 'group-A'),
    ).toBe('s3');
  });
});
