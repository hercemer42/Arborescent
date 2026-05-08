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
    addEverythingAsNew(newRootId, newNodes, view, /* skipRootMint */ true);
    return view;
  }

  view.classifications[priorRootId] =
    priorRoot.content === newRoot.content ? 'unchanged' : 'modified';

  reconcileChildren(priorRoot, newRoot, priorNodes, newNodes, view);

  return view;
}

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

  let priorCursor = 0;
  let pendingRemoved: Array<{ node: TreeNode; index: number }> = [];
  let pendingAdded: TreeNode[] = [];

  const flush = () => {
    const pairCount = Math.min(pendingRemoved.length, pendingAdded.length);
    for (let i = 0; i < pairCount; i++) {
      pairAsModified(pendingRemoved[i].node, pendingAdded[i], priorNodes, newNodes, view);
    }
    for (let i = pairCount; i < pendingRemoved.length; i++) {
      const removed = pendingRemoved[i];
      view.removed.push({
        priorId: removed.node.id,
        parentPriorId: priorParent.id,
        index: removed.index,
        node: removed.node,
      });
    }
    for (let i = pairCount; i < pendingAdded.length; i++) {
      mintAddedSubtree(pendingAdded[i].id, newNodes, view);
    }
    pendingRemoved = [];
    pendingAdded = [];
  };

  for (const segment of segments) {
    if (segment.added) {
      for (const node of segment.value) {
        pendingAdded.push(node);
      }
    } else if (segment.removed) {
      for (const node of segment.value) {
        pendingRemoved.push({ node, index: priorCursor });
        priorCursor++;
      }
    } else {
      flush();
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
  flush();
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
