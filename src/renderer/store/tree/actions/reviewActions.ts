import { TreeState } from '../treeStore';
import { TreeNode } from '../../../../shared/types';
import { formatNodeAsMarkdown } from '../../../utils/nodeFormatting';
import { executeInTerminal } from '../../../utils/terminalExecution';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { VisualEffectsActions } from './visualEffectsActions';
import { loadReviewContent } from '../../../utils/reviewTempFiles';

export interface ReviewActions {
  startReview: (nodeId: string) => void;
  cancelReview: () => void;
  acceptReview: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => void;
  requestReview: (nodeId: string) => Promise<void>;
  requestReviewInTerminal: (nodeId: string, terminalId: string) => Promise<void>;
  restoreReviewState: () => Promise<void>;
  updateReviewMetadata: (nodeId: string, tempFile: string, contentHash: string) => void;
}

export function createReviewActions(
  get: () => TreeState,
  set: (partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void,
  visualEffects: VisualEffectsActions
): ReviewActions {
  return {
    /**
     * Start reviewing a node
     * Only one node can be reviewed at a time
     */
    startReview: (nodeId: string) => {
      const state = get();

      // Can't start a new review if one is already in progress
      if (state.reviewingNodeId) {
        useToastStore.getState().addToast(
          'Review already in progress - Please finish or cancel the current review first',
          'error'
        );
        return;
      }

      set({ reviewingNodeId: nodeId });
    },

    /**
     * Cancel the current review
     */
    cancelReview: () => {
      set({ reviewingNodeId: null });
    },

    /**
     * Accept review and replace the reviewing node with new nodes
     * @param newRootNodeId - The ID of the new root node to replace the reviewing node
     * @param newNodesMap - Flat map of all new nodes (including the root and all descendants)
     */
    acceptReview: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => {
      const state = get();
      const reviewingNodeId = state.reviewingNodeId;

      if (!reviewingNodeId) {
        return;
      }

      const reviewingNode = state.nodes[reviewingNodeId];
      if (!reviewingNode) {
        return;
      }

      // Find all descendants of the reviewing node
      const descendantIds = new Set<string>();
      const collectDescendants = (nodeId: string) => {
        const node = state.nodes[nodeId];
        if (!node) return;

        for (const childId of node.children) {
          descendantIds.add(childId);
          collectDescendants(childId);
        }
      };
      collectDescendants(reviewingNodeId);

      // Find parent by searching through all nodes
      let parentId: string | null = null;
      for (const [id, node] of Object.entries(state.nodes)) {
        if (node.children.includes(reviewingNodeId)) {
          parentId = id;
          break;
        }
      }

      // Create merged nodes map
      const mergedNodesMap = { ...state.nodes };

      // Remove old reviewing node and its descendants
      delete mergedNodesMap[reviewingNodeId];
      for (const descendantId of descendantIds) {
        delete mergedNodesMap[descendantId];
      }

      // Add all new nodes
      for (const [id, node] of Object.entries(newNodesMap)) {
        mergedNodesMap[id] = node;
      }

      // Update parent's children or root
      let updatedRootNodeId = state.rootNodeId;

      if (parentId !== null) {
        const parent = mergedNodesMap[parentId];
        if (parent) {
          const newChildren = parent.children.map(id =>
            id === reviewingNodeId ? newRootNodeId : id
          );
          mergedNodesMap[parentId] = { ...parent, children: newChildren };
        }
      } else {
        // Replacing the root node itself
        updatedRootNodeId = newRootNodeId;
      }

      // Rebuild ancestor registry
      const newAncestorRegistry: Record<string, string[]> = {};

      const buildAncestorRegistry = (nodeId: string, ancestors: string[]) => {
        newAncestorRegistry[nodeId] = ancestors;

        const node = mergedNodesMap[nodeId];
        if (node) {
          const newAncestors = [...ancestors, nodeId];
          for (const childId of node.children) {
            buildAncestorRegistry(childId, newAncestors);
          }
        }
      };

      buildAncestorRegistry(updatedRootNodeId, []);

      set({
        nodes: mergedNodesMap,
        rootNodeId: updatedRootNodeId,
        ancestorRegistry: newAncestorRegistry,
        reviewingNodeId: null,
      });

      // Flash the new root node to indicate success
      visualEffects.flashNode(newRootNodeId, 'medium');
    },

    /**
     * Request review for a node (manual workflow - for browser-based tools)
     * Copies node content to clipboard and starts monitoring for response
     * Note: Caller should also call panelStore.showReview() to show the review panel
     */
    requestReview: async (nodeId: string) => {
      const state = get();

      // Can't start a new review if one is already in progress
      if (state.reviewingNodeId) {
        useToastStore.getState().addToast(
          'Review already in progress - Please finish or cancel the current review first',
          'error'
        );
        logger.error('Review already in progress', new Error('Cannot start new review'), 'ReviewActions');
        return;
      }

      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'ReviewActions');
        return;
      }

      try {
        // Copy node content to clipboard
        const formattedContent = formatNodeAsMarkdown(node, state.nodes);
        await navigator.clipboard.writeText(formattedContent);
        logger.info('Copied to clipboard for review', 'ReviewActions');

        // Show toast message
        useToastStore.getState().addToast(
          'Content copied to clipboard - Paste to review tool, then copy response to continue',
          'info'
        );

        // Start review mode
        set({ reviewingNodeId: nodeId });

        // Start clipboard monitoring
        await window.electron.startClipboardMonitor();

        logger.info(`Started review for node: ${nodeId}`, 'ReviewActions');
      } catch (error) {
        logger.error('Failed to request review', error as Error, 'ReviewActions');
        throw error;
      }
    },

    /**
     * Request review in terminal (automated workflow)
     * Writes instruction + content to terminal, executes, and starts monitoring
     * Works with any terminal tool that can copy responses to clipboard
     * Note: Caller should also call panelStore.showReview() to show the review panel
     */
    requestReviewInTerminal: async (nodeId: string, terminalId: string) => {
      const state = get();

      // Can't start a new review if one is already in progress
      if (state.reviewingNodeId) {
        useToastStore.getState().addToast(
          'Review already in progress - Please finish or cancel the current review first',
          'error'
        );
        logger.error('Review already in progress', new Error('Cannot start new review'), 'ReviewActions');
        return;
      }

      if (!terminalId) {
        const error = new Error('No terminal selected');
        logger.error('Cannot request review in terminal', error, 'ReviewActions');
        throw error;
      }

      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'ReviewActions');
        return;
      }

      try {
        // Prepend instruction for terminal tool
        const instruction = 'Review the following list and update it in the same format, then copy your reply to clipboard:\n\n';
        const formattedContent = formatNodeAsMarkdown(node, state.nodes);
        const contentWithInstruction = instruction + formattedContent;

        // Write and execute in terminal
        await executeInTerminal(terminalId, contentWithInstruction);

        // Start review mode
        set({ reviewingNodeId: nodeId });

        // Start clipboard monitoring
        await window.electron.startClipboardMonitor();

        logger.info(`Started terminal review for node: ${nodeId}`, 'ReviewActions');
      } catch (error) {
        logger.error('Failed to request review in terminal', error as Error, 'ReviewActions');
        throw error;
      }
    },

    /**
     * Restore review state from node metadata
     * Called after loading a file to check if there was a review in progress
     */
    restoreReviewState: async () => {
      const state = get();
      const { nodes } = state;

      // Find any node with review metadata
      const reviewingNode = Object.entries(nodes).find(
        ([, node]) => node.metadata.reviewTempFile && node.metadata.reviewContentHash
      );

      if (!reviewingNode) {
        logger.info('No review state to restore', 'ReviewActions');
        return;
      }

      const [nodeId, node] = reviewingNode;
      const { reviewTempFile, reviewContentHash } = node.metadata;

      if (!reviewTempFile || !reviewContentHash) {
        return;
      }

      try {
        // Try to load the review content from temp file
        const content = await loadReviewContent(reviewTempFile, reviewContentHash);

        if (content) {
          // Start review mode for this node
          set({ reviewingNodeId: nodeId });

          // Start clipboard monitoring
          await window.electron.startClipboardMonitor();

          logger.info(`Restored review state for node: ${nodeId}`, 'ReviewActions');
          useToastStore.getState().addToast(
            'Review restored - Continue your previous review',
            'info'
          );
        } else {
          // Temp file not found or hash mismatch - clean up metadata
          logger.warn(`Review temp file not found or invalid: ${reviewTempFile}`, 'ReviewActions');

          const updatedNodes = {
            ...nodes,
            [nodeId]: {
              ...node,
              metadata: {
                ...node.metadata,
                reviewTempFile: undefined,
                reviewContentHash: undefined,
              },
            },
          };

          set({ nodes: updatedNodes });
        }
      } catch (error) {
        logger.error('Failed to restore review state', error as Error, 'ReviewActions');
      }
    },

    /**
     * Update review metadata on a node
     * Called when review content is saved to temp file
     */
    updateReviewMetadata: (nodeId: string, tempFile: string, contentHash: string) => {
      const state = get();
      const node = state.nodes[nodeId];

      if (!node) {
        logger.warn(`Cannot update review metadata - node not found: ${nodeId}`, 'ReviewActions');
        return;
      }

      const updatedNodes = {
        ...state.nodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            reviewTempFile: tempFile,
            reviewContentHash: contentHash,
          },
        },
      };

      set({ nodes: updatedNodes });
      logger.info(`Updated review metadata for node: ${nodeId}`, 'ReviewActions');
    },
  };
}
