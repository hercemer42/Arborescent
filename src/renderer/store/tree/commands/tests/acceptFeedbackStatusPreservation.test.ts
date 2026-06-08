import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../../../../shared/types';
import { collectPreservedMetadata } from '../acceptFeedbackStrategies';

function nodeWith(metadata: TreeNode['metadata']): TreeNode {
  return { id: 'n', content: 'x', children: [], metadata };
}

// A task-status toggle applied to a proposition row while it is under review must survive
// Accept. Accept takes the proposition node's metadata and overlays only the original
// (collaborating) node's PRESERVED_METADATA_KEYS on top. If `status`/`resolvedAt` were
// collected here, the original status would clobber the reviewed toggle on Accept.
describe('accept keeps the reviewed-row status, not the original', () => {
  it('collectPreservedMetadata does not carry status or resolvedAt from the original node', () => {
    const preserved = collectPreservedMetadata(
      nodeWith({ status: 'pending', resolvedAt: '2020-01-01T00:00:00.000Z', appliedContextIds: ['c1'] }),
    );

    expect('status' in preserved).toBe(false);
    expect('resolvedAt' in preserved).toBe(false);
    // sanity: it still preserves the keys it is meant to carry over from the original
    expect(preserved.appliedContextIds).toEqual(['c1']);
  });
});
