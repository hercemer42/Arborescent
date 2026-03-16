import { TreeNode } from '../../../shared/types';
import { parseMarkdown } from '../../utils/markdown';
import { wrapNodesWithHiddenRoot } from '../../utils/nodeHelpers';
import { feedbackTreeStore } from '../../store/feedback/feedbackTreeStore';
import { deleteFeedbackTempFile } from './feedbackTempFileService';
import { logger } from '../logger';

export interface ParsedFeedbackContent {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  rootNodeIds: string[];
  nodeCount: number;
}

export function parseFeedbackContent(content: string, decomposition: boolean = false): ParsedFeedbackContent | null {
  let rootNodes, allNodes;
  try {
    ({ rootNodes, allNodes } = parseMarkdown(content));
  } catch {
    logger.info('Content is not valid markdown', 'FeedbackService');
    return null;
  }

  if (rootNodes.length === 0) {
    logger.info('Content has no valid nodes', 'FeedbackService');
    return null;
  }

  if (!decomposition && rootNodes.length !== 1) {
    logger.info(`Content has ${rootNodes.length} root nodes, expected 1`, 'FeedbackService');
    return null;
  }

  const rootNodeIds = rootNodes.map(node => node.id);

  return {
    nodes: allNodes,
    rootNodeId: rootNodeIds[0],
    rootNodeIds,
    nodeCount: Object.keys(allNodes).length,
  };
}

export function initializeFeedbackStore(
  filePath: string,
  parsedContent: ParsedFeedbackContent,
  blueprintModeEnabled: boolean = false
): void {
  const { nodes: nodesWithHiddenRoot, rootNodeId: hiddenRootId } = wrapNodesWithHiddenRoot(
    parsedContent.nodes,
    parsedContent.rootNodeIds,
    'feedback-root'
  );
  feedbackTreeStore.initialize(filePath, nodesWithHiddenRoot, hiddenRootId);

  if (blueprintModeEnabled) {
    const store = feedbackTreeStore.getStoreForFile(filePath);
    if (store) {
      store.setState({ blueprintModeEnabled: true });
    }
  }

  logger.info(`Initialized feedback store with ${parsedContent.nodeCount} nodes`, 'FeedbackService');
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
  const { [feedbackRootNodeId]: _hiddenRoot, ...contentNodes } = feedbackNodes;

  return { rootNodeId: rootNodeIds[0], rootNodeIds, nodes: contentNodes };
}

export async function stopFeedbackMonitors(): Promise<void> {
  await window.electron.stopClipboardMonitor();
  await window.electron.stopFeedbackFileWatcher();
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
