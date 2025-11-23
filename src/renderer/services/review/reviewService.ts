import { TreeNode } from '../../../shared/types';
import { parseMarkdown } from '../../utils/markdown';
import { wrapNodesWithHiddenRoot } from '../../utils/nodeHelpers';
import { reviewTreeStore } from '../../store/review/reviewTreeStore';
import { deleteReviewTempFile } from './reviewTempFileService';
import { logger } from '../logger';

/**
 * Result of parsing review content
 */
export interface ParsedReviewContent {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  nodeCount: number;
}

/**
 * Parse markdown content and validate it has exactly one root node
 * Returns null if content is invalid
 */
export function parseReviewContent(content: string): ParsedReviewContent | null {
  let rootNodes, allNodes;
  try {
    ({ rootNodes, allNodes } = parseMarkdown(content));
  } catch {
    logger.info('Content is not valid markdown', 'ReviewService');
    return null;
  }

  if (rootNodes.length !== 1) {
    if (rootNodes.length === 0) {
      logger.info('Content has no valid nodes', 'ReviewService');
    } else {
      logger.info(`Content has ${rootNodes.length} root nodes, expected 1`, 'ReviewService');
    }
    return null;
  }

  return {
    nodes: allNodes,
    rootNodeId: rootNodes[0].id,
    nodeCount: Object.keys(allNodes).length,
  };
}

/**
 * Initialize the review store with parsed content
 * Wraps content with a hidden root node
 */
export function initializeReviewStore(
  filePath: string,
  parsedContent: ParsedReviewContent
): void {
  const { nodes: nodesWithHiddenRoot, rootNodeId: hiddenRootId } = wrapNodesWithHiddenRoot(
    parsedContent.nodes,
    parsedContent.rootNodeId,
    'review-root'
  );
  reviewTreeStore.initialize(filePath, nodesWithHiddenRoot, hiddenRootId);
  logger.info(`Initialized review store with ${parsedContent.nodeCount} nodes`, 'ReviewService');
}

/**
 * Extract content nodes from review store, excluding hidden root
 * Returns null if review store is empty or invalid
 */
export function extractReviewContent(
  filePath: string
): { rootNodeId: string; nodes: Record<string, TreeNode> } | null {
  const reviewStore = reviewTreeStore.getStoreForFile(filePath);
  if (!reviewStore) {
    logger.error('No review store available', new Error('Review store not initialized'), 'ReviewService');
    return null;
  }

  const { nodes: reviewNodes, rootNodeId: reviewRootNodeId } = reviewStore.getState();
  const hiddenRoot = reviewNodes[reviewRootNodeId];

  if (!hiddenRoot || hiddenRoot.children.length === 0) {
    logger.error('Review store has no content', new Error('Empty review'), 'ReviewService');
    return null;
  }

  // Get actual content root (first child of hidden root)
  const actualRootNodeId = hiddenRoot.children[0];

  // Filter out the hidden root from the nodes map
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { [reviewRootNodeId]: _hiddenRoot, ...contentNodes } = reviewNodes;

  return { rootNodeId: actualRootNodeId, nodes: contentNodes };
}

/**
 * Stop all review monitors (clipboard, file watcher)
 */
export async function stopReviewMonitors(): Promise<void> {
  await window.electron.stopClipboardMonitor();
  await window.electron.stopReviewFileWatcher();
}

/**
 * Clean up review resources for a file
 */
export async function cleanupReview(filePath: string, tempFilePath?: string): Promise<void> {
  await stopReviewMonitors();
  if (tempFilePath) {
    await deleteReviewTempFile(tempFilePath);
  }
  reviewTreeStore.clearFile(filePath);
}

/**
 * Find node with reviewTempFile metadata
 */
export function findReviewingNode(
  nodes: Record<string, TreeNode>
): [string, TreeNode] | null {
  const entry = Object.entries(nodes).find(
    ([, node]) => node.metadata.reviewTempFile
  );
  return entry || null;
}
