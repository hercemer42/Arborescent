import { diffArrays } from 'diff';
import { v4 as uuidv4 } from 'uuid';
import type { TreeNode } from '../../../shared/types';

export type ChangeKind = 'unchanged' | 'modified' | 'added';

export interface RemovedEntry {
  priorId: string;
  parentPriorId: string;
  index: number;
  node: TreeNode;
}

export interface ReconcileInput {
  priorRootId: string;
  priorNodes: Record<string, TreeNode>;
  newRootId: string;
  newNodes: Record<string, TreeNode>;
  mode: 'feedback' | 'decomposition';
}

export interface ReconcilePanelView {
  idMap: Record<string, string>;
  classifications: Record<string, ChangeKind>;
  removed: RemovedEntry[];
}

export function reconcileFeedback(input: ReconcileInput): ReconcilePanelView {
  const { priorRootId, priorNodes, newRootId, newNodes, mode } = input;

  const view: ReconcilePanelView = {
    idMap: {},
    classifications: {},
    removed: [],
  };

  view.idMap[newRootId] = priorRootId;

  if (mode === 'decomposition') {
    addEverythingAsNew(newRootId, newNodes, view, /* skipRootMint */ true);
    return view;
  }

  const priorRoot = priorNodes[priorRootId];
  const newRoot = newNodes[newRootId];
  if (!priorRoot || !newRoot) {
    delete view.idMap[newRootId];
    addEverythingAsNew(newRootId, newNodes, view, /* skipRootMint */ false);
    return view;
  }

  view.classifications[priorRootId] =
    priorRoot.content === newRoot.content ? 'unchanged' : 'modified';

  reconcileChildren(priorRoot, newRoot, priorNodes, newNodes, view);

  return view;
}

interface RemovedCandidate {
  node: TreeNode;
  index: number;
}

const SIMILARITY_THRESHOLD = 0.5;

function reconcileChildren(
  priorParent: TreeNode,
  newParent: TreeNode,
  priorNodes: Record<string, TreeNode>,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
): void {
  const priorChildren = priorParent.children
    .map((id) => priorNodes[id])
    .filter((n): n is TreeNode => Boolean(n));
  const newChildren = newParent.children
    .map((id) => newNodes[id])
    .filter((n): n is TreeNode => Boolean(n));

  const segments = diffArrays(priorChildren, newChildren, {
    comparator: (a, b) => a.content === b.content,
  });

  const { leftoverRemoved, leftoverAdded } = processSegments(
    segments, priorParent, priorNodes, newNodes, view,
  );
  const pairing = pairLeftovers(leftoverRemoved, leftoverAdded);
  applyLeftoverPairing(pairing, priorParent.id, priorNodes, newNodes, view);
}

type DiffSegments = ReturnType<typeof diffArrays<TreeNode>>;

function processSegments(
  segments: DiffSegments,
  priorParent: TreeNode,
  priorNodes: Record<string, TreeNode>,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
): { leftoverRemoved: RemovedCandidate[]; leftoverAdded: TreeNode[] } {
  const leftoverRemoved: RemovedCandidate[] = [];
  const leftoverAdded: TreeNode[] = [];
  let priorCursor = 0;

  for (const segment of segments) {
    if (segment.added) {
      for (const node of segment.value) {
        leftoverAdded.push(node);
      }
    } else if (segment.removed) {
      for (const node of segment.value) {
        leftoverRemoved.push({ node, index: priorCursor });
        priorCursor++;
      }
    } else {
      for (const node of segment.value) {
        const priorChild = priorParent.children[priorCursor]
          ? priorNodes[priorParent.children[priorCursor]]
          : undefined;
        if (priorChild) {
          pairAsUnchanged(priorChild, node, priorNodes, newNodes, view);
        }
        priorCursor++;
      }
    }
  }

  return { leftoverRemoved, leftoverAdded };
}

interface LeftoverPairing {
  paired: Array<{ removedEntry: RemovedCandidate; addedNode: TreeNode }>;
  unpairedRemoved: RemovedCandidate[];
  unpairedAdded: TreeNode[];
}

function applyLeftoverPairing(
  pairing: LeftoverPairing,
  parentPriorId: string,
  priorNodes: Record<string, TreeNode>,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
): void {
  for (const { removedEntry, addedNode } of pairing.paired) {
    if (removedEntry.node.content === addedNode.content) {
      pairAsUnchanged(removedEntry.node, addedNode, priorNodes, newNodes, view);
    } else {
      pairAsModified(removedEntry.node, addedNode, priorNodes, newNodes, view);
    }
  }

  for (const removed of pairing.unpairedRemoved) {
    view.removed.push({
      priorId: removed.node.id,
      parentPriorId,
      index: removed.index,
      node: removed.node,
    });
  }
  for (const added of pairing.unpairedAdded) {
    mintAddedSubtree(added.id, newNodes, view);
  }
}

function pairLeftovers(removed: RemovedCandidate[], added: TreeNode[]): LeftoverPairing {
  if (removed.length === 0 || added.length === 0) {
    return { paired: [], unpairedRemoved: removed, unpairedAdded: added };
  }

  const usedRemoved = new Set<number>();
  const usedAdded = new Set<number>();
  const paired: Array<{ removedEntry: RemovedCandidate; addedNode: TreeNode }> = [];

  const scores: Array<{ r: number; a: number; score: number }> = [];
  for (let i = 0; i < removed.length; i++) {
    for (let j = 0; j < added.length; j++) {
      const score = contentSimilarity(removed[i].node.content, added[j].content);
      if (score >= SIMILARITY_THRESHOLD) {
        scores.push({ r: i, a: j, score });
      }
    }
  }
  scores.sort((x, y) => y.score - x.score);
  for (const { r, a } of scores) {
    if (usedRemoved.has(r) || usedAdded.has(a)) continue;
    usedRemoved.add(r);
    usedAdded.add(a);
    paired.push({ removedEntry: removed[r], addedNode: added[a] });
  }

  const remainingRemoved: RemovedCandidate[] = [];
  for (let i = 0; i < removed.length; i++) {
    if (!usedRemoved.has(i)) remainingRemoved.push(removed[i]);
  }
  const remainingAdded: TreeNode[] = [];
  for (let j = 0; j < added.length; j++) {
    if (!usedAdded.has(j)) remainingAdded.push(added[j]);
  }

  // Below-threshold leftovers still pair by position so a single low-similarity rename
  // (e.g. 'original' → 'edited', Jaccard 0) classifies as modified rather than add+remove —
  // matches the pre-similarity-pair behaviour users already expect for one-off edits.
  const positionPairCount = Math.min(remainingRemoved.length, remainingAdded.length);
  for (let k = 0; k < positionPairCount; k++) {
    paired.push({ removedEntry: remainingRemoved[k], addedNode: remainingAdded[k] });
  }

  return {
    paired,
    unpairedRemoved: remainingRemoved.slice(positionPairCount),
    unpairedAdded: remainingAdded.slice(positionPairCount),
  };
}

function contentSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const aTokens = tokenize(a);
  const bTokens = tokenize(b);
  if (aTokens.size === 0 && bTokens.size === 0) return 1;
  if (aTokens.size === 0 || bTokens.size === 0) return 0;

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) intersection++;
  }
  const union = aTokens.size + bTokens.size - intersection;
  return intersection / union;
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

function pairAsUnchanged(
  priorNode: TreeNode,
  newNode: TreeNode,
  priorNodes: Record<string, TreeNode>,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
): void {
  view.idMap[newNode.id] = priorNode.id;
  view.classifications[priorNode.id] = 'unchanged';
  reconcileChildren(priorNode, newNode, priorNodes, newNodes, view);
}

function pairAsModified(
  priorNode: TreeNode,
  newNode: TreeNode,
  priorNodes: Record<string, TreeNode>,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
): void {
  view.idMap[newNode.id] = priorNode.id;
  view.classifications[priorNode.id] = 'modified';
  reconcileChildren(priorNode, newNode, priorNodes, newNodes, view);
}

function mintAddedSubtree(
  newNodeId: string,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
): void {
  const node = newNodes[newNodeId];
  if (!node) return;

  const fresh = uuidv4();
  view.idMap[newNodeId] = fresh;
  view.classifications[fresh] = 'added';

  for (const childId of node.children) {
    mintAddedSubtree(childId, newNodes, view);
  }
}

function addEverythingAsNew(
  rootId: string,
  newNodes: Record<string, TreeNode>,
  view: ReconcilePanelView,
  skipRootMint: boolean,
): void {
  const root = newNodes[rootId];
  if (!root) return;

  if (!skipRootMint) {
    const fresh = uuidv4();
    view.idMap[rootId] = fresh;
    view.classifications[fresh] = 'added';
  }

  for (const childId of root.children) {
    mintAddedSubtree(childId, newNodes, view);
  }
}
