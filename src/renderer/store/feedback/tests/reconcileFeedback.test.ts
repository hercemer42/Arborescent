import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../../../shared/types';
import { reconcileFeedback } from '../reconcileFeedback';

type NodeMap = Record<string, TreeNode>;

function makeNode(id: string, content: string, children: string[] = []): TreeNode {
  return { id, content, children, metadata: {} };
}

function buildTree(nodes: TreeNode[]): NodeMap {
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

const PRIOR_PARENT_ID = 'prior-parent';

function priorTree(children: TreeNode[]): { rootId: string; nodes: NodeMap } {
  const parent = makeNode(PRIOR_PARENT_ID, 'parent', children.map((c) => c.id));
  return { rootId: PRIOR_PARENT_ID, nodes: buildTree([parent, ...children]) };
}

function newTree(children: TreeNode[]): { rootId: string; nodes: NodeMap } {
  const parent = makeNode('new-parent', 'parent', children.map((c) => c.id));
  return { rootId: 'new-parent', nodes: buildTree([parent, ...children]) };
}

describe('reconcileFeedback (feedback mode)', () => {
  it('retains the parent UUID', () => {
    const prior = priorTree([makeNode('p1', 'A')]);
    const next = newTree([makeNode('n1', 'A')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.idMap[next.rootId]).toBe(PRIOR_PARENT_ID);
  });

  it('classifies an unchanged child as unchanged and inherits its UUID', () => {
    const prior = priorTree([makeNode('p1', 'A')]);
    const next = newTree([makeNode('n1', 'A')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.idMap.n1).toBe('p1');
    expect(view.classifications.p1).toBe('unchanged');
  });

  it('classifies a modified child as modified and still inherits its UUID', () => {
    const prior = priorTree([makeNode('p1', 'original')]);
    const next = newTree([makeNode('n1', 'edited')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.idMap.n1).toBe('p1');
    expect(view.classifications.p1).toBe('modified');
  });

  it('mints a fresh UUID for an added child and classifies it as added', () => {
    const prior = priorTree([]);
    const next = newTree([makeNode('n1', 'fresh')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    const resolvedId = view.idMap.n1;
    expect(resolvedId).toBeTruthy();
    expect(resolvedId).not.toBe('n1');
    expect(view.classifications[resolvedId]).toBe('added');
  });

  it('records prior children that disappear from the output as removed', () => {
    const prior = priorTree([makeNode('p1', 'A'), makeNode('p2', 'B')]);
    const next = newTree([makeNode('n1', 'A')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.removed).toHaveLength(1);
    expect(view.removed[0].priorId).toBe('p2');
    expect(view.removed[0].parentPriorId).toBe(PRIOR_PARENT_ID);
    expect(view.removed[0].index).toBe(1);
  });

  it('recurses into matched parents to classify their children', () => {
    const priorChildA = makeNode('p1', 'parent-a', ['p1a', 'p1b']);
    const priorGrand1 = makeNode('p1a', 'unchanged-grand');
    const priorGrand2 = makeNode('p1b', 'modified-grand');
    const priorParent = makeNode(PRIOR_PARENT_ID, 'parent', ['p1']);
    const priorNodes = buildTree([priorParent, priorChildA, priorGrand1, priorGrand2]);

    const newChildA = makeNode('n1', 'parent-a', ['n1a', 'n1b']);
    const newGrand1 = makeNode('n1a', 'unchanged-grand');
    const newGrand2 = makeNode('n1b', 'edited-grand');
    const newParent = makeNode('new-parent', 'parent', ['n1']);
    const newNodes = buildTree([newParent, newChildA, newGrand1, newGrand2]);

    const view = reconcileFeedback({
      priorRootId: PRIOR_PARENT_ID,
      priorNodes,
      newRootId: 'new-parent',
      newNodes,
      mode: 'feedback',
    });

    expect(view.idMap.n1).toBe('p1');
    expect(view.idMap.n1a).toBe('p1a');
    expect(view.idMap.n1b).toBe('p1b');
    expect(view.classifications.p1).toBe('unchanged');
    expect(view.classifications.p1a).toBe('unchanged');
    expect(view.classifications.p1b).toBe('modified');
  });

  it('matches duplicate-content siblings deterministically by relative position', () => {
    const prior = priorTree([
      makeNode('p1', 'same'),
      makeNode('p2', 'same'),
    ]);
    const next = newTree([
      makeNode('n1', 'same'),
      makeNode('n2', 'same'),
    ]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.idMap.n1).toBe('p1');
    expect(view.idMap.n2).toBe('p2');
  });

  it('treats every prior child as removed when the proposed children list is empty', () => {
    const prior = priorTree([makeNode('p1', 'A'), makeNode('p2', 'B')]);
    const next = newTree([]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.removed.map((r) => r.priorId).sort()).toEqual(['p1', 'p2']);
  });

  it('treats every proposed child as added when the prior children list is empty', () => {
    const prior = priorTree([]);
    const next = newTree([makeNode('n1', 'A'), makeNode('n2', 'B')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    const ids = Object.keys(view.classifications).filter((id) => id !== PRIOR_PARENT_ID);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(view.classifications[id]).toBe('added');
    }
    expect(view.removed).toEqual([]);
  });

  it('produces a stable result across repeated runs of identical input', () => {
    const prior = priorTree([
      makeNode('p1', 'same'),
      makeNode('p2', 'same'),
      makeNode('p3', 'other'),
    ]);
    const next = newTree([
      makeNode('n1', 'same'),
      makeNode('n2', 'same'),
      makeNode('n3', 'other'),
    ]);

    const args = {
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback' as const,
    };
    const a = reconcileFeedback(args);
    const b = reconcileFeedback(args);

    expect(a.idMap).toEqual(b.idMap);
    expect(a.classifications).toEqual(b.classifications);
    expect(a.removed).toEqual(b.removed);
  });
});

describe('reconcileFeedback (decomposition mode)', () => {
  it('mints fresh UUIDs for every output node and never reuses prior ones', () => {
    const prior = priorTree([makeNode('p1', 'A'), makeNode('p2', 'B')]);
    const next = newTree([makeNode('n1', 'A'), makeNode('n2', 'C')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'decomposition',
    });

    const reusedPriorIds = Object.values(view.idMap).filter((id) => id === 'p1' || id === 'p2');
    expect(reusedPriorIds).toEqual([]);
  });

  it('classifies every output node as added in decomposition mode', () => {
    const prior = priorTree([]);
    const next = newTree([makeNode('n1', 'A'), makeNode('n2', 'B')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'decomposition',
    });

    const childResolvedIds = [view.idMap.n1, view.idMap.n2];
    for (const id of childResolvedIds) {
      expect(view.classifications[id]).toBe('added');
    }
  });

  it('does not surface a removed list in decomposition mode', () => {
    const prior = priorTree([makeNode('p1', 'A')]);
    const next = newTree([makeNode('n1', 'A')]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'decomposition',
    });

    expect(view.removed).toEqual([]);
  });

  it('does not reuse a prior UUID even when content matches exactly', () => {
    const prior = priorTree([makeNode('p1', 'duplicated content')]);
    const next = newTree([
      makeNode('n1', 'duplicated content'),
      makeNode('n2', 'duplicated content'),
    ]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'decomposition',
    });

    expect(view.idMap.n1).not.toBe('p1');
    expect(view.idMap.n2).not.toBe('p1');
    expect(view.idMap.n1).not.toBe(view.idMap.n2);
  });
});

describe('reconcileFeedback (per-node text-edit reclassification)', () => {
  it.todo('reclassifyAfterTextEdit flips a node from modified to unchanged when its content reverts to the prior value');
  it.todo('reclassifyAfterTextEdit flips a node from unchanged to modified when its content diverges from the prior value');
  it.todo('reclassifyAfterTextEdit preserves the inherited UUID across the flip');
  it.todo('reclassifyAfterTextEdit does not touch sibling classifications');
  it.todo('reclassifyAfterTextEdit does not re-run LCS over the children array');
});

describe('reconcileFeedback (structural-edit reclassification)', () => {
  it.todo('reclassifyAfterStructuralEdit re-runs LCS only at the affected sibling level on insertion');
  it.todo('reclassifyAfterStructuralEdit re-runs LCS only at the affected sibling level on deletion');
  it.todo('reclassifyAfterStructuralEdit re-runs LCS only at the affected sibling level on reorder');
  it.todo('reclassifyAfterStructuralEdit leaves unrelated subtrees untouched');
});

describe('reconcileFeedback (boundary inputs)', () => {
  it('returns a parent-only view when the proposed subtree has no children', () => {
    const prior = priorTree([]);
    const next = newTree([]);

    const view = reconcileFeedback({
      priorRootId: prior.rootId,
      priorNodes: prior.nodes,
      newRootId: next.rootId,
      newNodes: next.nodes,
      mode: 'feedback',
    });

    expect(view.idMap[next.rootId]).toBe(PRIOR_PARENT_ID);
    expect(view.removed).toEqual([]);
    expect(Object.keys(view.classifications)).toEqual([PRIOR_PARENT_ID]);
  });

  it.todo('handles a missing prior subtree gracefully (e.g. first-time feedback against a new node)');
  it.todo('handles repeated successive feedback runs without leaking classifications between them');
});
