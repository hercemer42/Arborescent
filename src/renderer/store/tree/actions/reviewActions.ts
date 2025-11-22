import { TreeState } from '../treeStore';
import { TreeNode } from '../../../../shared/types';
import { exportNodeAsMarkdown } from '../../../utils/markdown';
import { executeInTerminal } from '../../../utils/terminalExecution';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { VisualEffectsActions } from './visualEffectsActions';
import { loadReviewContent } from '../../../services/review/reviewTempFileService';
import { AcceptReviewCommand } from '../commands/AcceptReviewCommand';

// Base instruction for review requests
const REVIEW_INSTRUCTION_BASE = `You are reviewing a hierarchical task/note list. Please:
1. Analyze the content and suggest improvements, additions, or reorganization
2. Add any missing items that would make the list more complete
3. Fix any issues or inconsistencies you find

OUTPUT FORMAT:
- Use markdown headings for hierarchy (# root, ## child, ### grandchild)
- Use [ ] for pending items, [x] for completed, [-] for failed
- Example: "## [ ] Task name" or "### [x] Completed task"`;

// Web version - output in code block for easy copying
const REVIEW_INSTRUCTION_WEB = `${REVIEW_INSTRUCTION_BASE}

Output the complete updated list in a markdown code block.`;

// Terminal version - just the base instruction (file path added separately)
const REVIEW_INSTRUCTION_TERMINAL = `${REVIEW_INSTRUCTION_BASE}

Output the complete updated list.`;

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
  visualEffects: VisualEffectsActions,
  autoSave: () => void
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
      const state = get() as TreeState & { actions?: { executeCommand?: (cmd: unknown) => void } };
      const reviewingNodeId = state.reviewingNodeId;

      if (!reviewingNodeId) {
        return;
      }

      const reviewingNode = state.nodes[reviewingNodeId];
      if (!reviewingNode) {
        return;
      }

      // Use command pattern for undo support
      if (!state.actions?.executeCommand) {
        logger.error('executeCommand not available', new Error('Cannot accept review without command system'), 'ReviewActions');
        return;
      }

      const command = new AcceptReviewCommand(
        reviewingNodeId,
        newRootNodeId,
        newNodesMap,
        get,
        set,
        autoSave
      );

      state.actions.executeCommand(command);
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
        // Copy node content to clipboard with context instruction
        const formattedContent = exportNodeAsMarkdown(node, state.nodes);
        await navigator.clipboard.writeText(REVIEW_INSTRUCTION_WEB + '\n\n' + formattedContent);
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
     * Writes instruction + content to terminal, executes, and starts file watching
     * The AI tool writes its response to a temp file which we watch for changes
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
        // Create temp file for review response - createTempFile returns the full path
        const reviewFileName = `review-response-${nodeId}.md`;
        const reviewResponseFile = await window.electron.createTempFile(reviewFileName, '');

        // Build instruction for terminal tool
        const formattedContent = exportNodeAsMarkdown(node, state.nodes);
        const terminalInstruction = `${REVIEW_INSTRUCTION_TERMINAL}

IMPORTANT: Write your reviewed/updated list to this file: ${reviewResponseFile}

Here is the content to review:

${formattedContent}`;

        // Write and execute in terminal
        await executeInTerminal(terminalId, terminalInstruction);

        // Start review mode
        set({ reviewingNodeId: nodeId });

        // Start file watching for the response
        await window.electron.startReviewFileWatcher(reviewResponseFile);

        logger.info(`Started terminal review for node: ${nodeId}, watching: ${reviewResponseFile}`, 'ReviewActions');
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
