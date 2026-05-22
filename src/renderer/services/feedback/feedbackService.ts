import { TreeNode } from '../../../shared/types';
import { parseMarkdown } from '../../utils/markdown';
import { wrapNodesWithHiddenRoot } from '../../utils/nodeHelpers';
import { feedbackTreeStore } from '../../store/feedback/feedbackTreeStore';
import { reconcileFeedback } from '../../store/feedback/reconcileFeedback';
import { deleteFeedbackTempFile } from './feedbackTempFileService';
import { logger } from '../logger';

export interface ParsedFeedbackContent {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  rootNodeIds: string[];
  nodeCount: number;
}

function looksLikePackedBlob(nodeContent: string): boolean {
  if (nodeContent.includes('\\n')) return true;
  if (/(^|\n)#{1,6}\s/.test(nodeContent)) return true;
  const checkboxMatches = nodeContent.match(/\[[xX -]\]/g);
  if (checkboxMatches && checkboxMatches.length >= 3) return true;
  return false;
}

export type ParseFeedbackResult =
  | { ok: true; content: ParsedFeedbackContent }
  | { ok: false; reason: string };

export function parseFeedbackContentWithReason(content: string, decomposition: boolean = false): ParseFeedbackResult {
  let rootNodes, allNodes;
  try {
    ({ rootNodes, allNodes } = parseMarkdown(content));
  } catch {
    const reason = 'Content is not valid markdown — could not parse';
    logger.info(reason, 'FeedbackService');
    return { ok: false, reason };
  }

  if (rootNodes.length === 0) {
    const reason = 'Content has no `#` heading — at least one root heading is required';
    logger.info(reason, 'FeedbackService');
    return { ok: false, reason };
  }

  if (rootNodes.some((node) => looksLikePackedBlob(node.content))) {
    const reason = 'Content looks like a packed blob — a root node carries the whole payload as raw text (likely escaped `\\n` sequences or embedded heading/checkbox markers); emit one heading per line instead';
    logger.warn(`Rejecting blob-shaped submission — ${reason}`, 'FeedbackService');
    return { ok: false, reason };
  }

  if (!decomposition && rootNodes.length !== 1) {
    const reason = `Content has ${rootNodes.length} root nodes, expected exactly 1 — this step does not allow decomposition; output a single \`#\` root with everything else nested under it`;
    logger.info(reason, 'FeedbackService');
    return { ok: false, reason };
  }

  const rootNodeIds = rootNodes.map(node => node.id);

  return {
    ok: true,
    content: {
      nodes: allNodes,
      rootNodeId: rootNodeIds[0],
      rootNodeIds,
      nodeCount: Object.keys(allNodes).length,
    },
  };
}

export function parseFeedbackContent(content: string, decomposition: boolean = false): ParsedFeedbackContent | null {
  const result = parseFeedbackContentWithReason(content, decomposition);
  return result.ok ? result.content : null;
}

export interface FeedbackReconcilePriorSubtree {
  collaboratingNodeId: string;
  priorNodes: Record<string, TreeNode>;
  decomposition: boolean;
}

export function initializeFeedbackStore(
  filePath: string,
  parsedContent: ParsedFeedbackContent,
  blueprintModeEnabled: boolean = false,
  priorSubtree?: FeedbackReconcilePriorSubtree
): void {
  const { nodes: nodesWithHiddenRoot, rootNodeId: hiddenRootId } = wrapNodesWithHiddenRoot(
    parsedContent.nodes,
    parsedContent.rootNodeIds,
    'feedback-root'
  );

  const isMultiRoot = parsedContent.rootNodeIds.length > 1;
  if (priorSubtree && !isMultiRoot) {
    applyReconciliationMetadata(nodesWithHiddenRoot, parsedContent.rootNodeId, priorSubtree);
  }

  feedbackTreeStore.initialize(filePath, nodesWithHiddenRoot, hiddenRootId);

  if (blueprintModeEnabled) {
    const store = feedbackTreeStore.getStoreForFile(filePath);
    if (store) {
      store.setState({ blueprintModeEnabled: true });
    }
  }

  logger.info(`Initialized feedback store with ${parsedContent.nodeCount} nodes`, 'FeedbackService');
}

function applyReconciliationMetadata(
  nodes: Record<string, TreeNode>,
  newRootNodeId: string,
  priorSubtree: FeedbackReconcilePriorSubtree
): void {
  const view = reconcileFeedback({
    priorRootId: priorSubtree.collaboratingNodeId,
    priorNodes: priorSubtree.priorNodes,
    newRootId: newRootNodeId,
    newNodes: nodes,
    mode: priorSubtree.decomposition ? 'decomposition' : 'feedback',
  });

  for (const [newId, resolvedId] of Object.entries(view.idMap)) {
    const node = nodes[newId];
    if (!node) continue;
    const baseline = view.classifications[resolvedId];
    if (!baseline) continue;
    const priorContent = priorSubtree.priorNodes[resolvedId]?.content;
    nodes[newId] = {
      ...node,
      metadata: {
        ...node.metadata,
        feedbackBaselineKind: baseline,
        ...(priorContent !== undefined && { feedbackPriorContent: priorContent }),
      },
    };
  }

  injectRemovedPlaceholders(nodes, view);
}

function injectRemovedPlaceholders(
  nodes: Record<string, TreeNode>,
  view: ReturnType<typeof reconcileFeedback>
): void {
  if (view.removed.length === 0) return;

  const reverseIdMap: Record<string, string> = {};
  for (const [newId, priorId] of Object.entries(view.idMap)) {
    reverseIdMap[priorId] = newId;
  }

  for (const removed of view.removed) {
    const newParentId = reverseIdMap[removed.parentPriorId];
    if (!newParentId) continue;
    const newParent = nodes[newParentId];
    if (!newParent) continue;

    const placeholderId = `feedback-removed-${removed.priorId}`;
    nodes[placeholderId] = {
      id: placeholderId,
      content: removed.node.content,
      children: [],
      metadata: {
        feedbackBaselineKind: 'removed',
        feedbackPriorContent: removed.node.content,
      },
    };

    const updatedChildren = [...newParent.children];
    const insertAt = Math.min(removed.index, updatedChildren.length);
    updatedChildren.splice(insertAt, 0, placeholderId);
    nodes[newParentId] = {
      ...newParent,
      children: updatedChildren,
    };
  }
}

export function extractFeedbackContent(
  filePath: string
): { rootNodeId: string; rootNodeIds: string[]; nodes: Record<string, TreeNode> } | null {
  const feedbackStore = feedbackTreeStore.getStoreForFile(filePath);
  if (!feedbackStore) {
    logger.error('No feedback store available', new Error('Feedback store not initialized'), 'FeedbackService');
    return null;
  }

  const { nodes: feedbackNodes, rootNodeId: feedbackRootNodeId } = feedbackStore.getState();
  const hiddenRoot = feedbackNodes[feedbackRootNodeId];

  if (!hiddenRoot || hiddenRoot.children.length === 0) {
    logger.error('Feedback store has no content', new Error('Empty feedback'), 'FeedbackService');
    return null;
  }

  const rootNodeIds = hiddenRoot.children;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [feedbackRootNodeId]: _hiddenRoot, ...rest } = feedbackNodes;
  const contentNodes = stripRemovedPlaceholderNodes(rest);

  return { rootNodeId: rootNodeIds[0], rootNodeIds, nodes: contentNodes };
}

function stripRemovedPlaceholderNodes(
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const placeholderIds = new Set<string>();
  for (const [id, node] of Object.entries(nodes)) {
    if (node.metadata.feedbackBaselineKind === 'removed') {
      placeholderIds.add(id);
    }
  }
  if (placeholderIds.size === 0) return nodes;

  const result: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(nodes)) {
    if (placeholderIds.has(id)) continue;
    const filteredChildren = node.children.filter((childId) => !placeholderIds.has(childId));
    result[id] = filteredChildren.length === node.children.length
      ? node
      : { ...node, children: filteredChildren };
  }
  return result;
}

export async function stopFeedbackMonitors(): Promise<void> {
  await window.electron.stopClipboardMonitor();
}

export async function cleanupFeedback(filePath: string, tempFilePath?: string): Promise<void> {
  await stopFeedbackMonitors();
  if (tempFilePath) {
    await deleteFeedbackTempFile(tempFilePath);
  }
  feedbackTreeStore.clearFile(filePath);
}

export function findCollaboratingNode(
  nodes: Record<string, TreeNode>
): [string, TreeNode] | null {
  const entry = Object.entries(nodes).find(
    ([, node]) => node.metadata.feedbackTempFile
  );
  return entry || null;
}
