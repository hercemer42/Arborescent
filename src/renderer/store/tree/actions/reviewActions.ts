import { TreeState } from '../treeStore';
import { TreeNode } from '../../../../shared/types';
import { exportNodeAsMarkdown, parseMarkdown } from '../../../utils/markdown';
import { wrapNodesWithHiddenRoot } from '../../../utils/nodeHelpers';
import { executeInTerminal } from '../../../services/terminalExecution';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { usePanelStore } from '../../panel/panelStore';
import { VisualEffectsActions } from './visualEffectsActions';
import { loadReviewContent, saveReviewContent, deleteReviewTempFile } from '../../../services/review/reviewTempFileService';
import { AcceptReviewCommand } from '../commands/AcceptReviewCommand';
import { reviewTreeStore } from '../../review/reviewTreeStore';
import { ReviewSession } from '../../../../shared/interfaces';

export type ContentSource = 'clipboard' | 'file' | 'restore';

/**
 * Save active review to session for persistence across restarts
 */
async function saveReviewToSession(filePath: string, nodeId: string): Promise<void> {
  try {
    const sessionData = await window.electron.getReviewSession();
    const session: ReviewSession = sessionData ? JSON.parse(sessionData) : { activeReviews: {} };
    session.activeReviews[filePath] = nodeId;
    await window.electron.saveReviewSession(JSON.stringify(session));
    logger.info(`Saved review session: ${filePath} -> ${nodeId}`, 'ReviewActions');
  } catch (error) {
    logger.error('Failed to save review session', error as Error, 'ReviewActions');
  }
}

/**
 * Remove review from session (on cancel/accept)
 */
async function removeReviewFromSession(filePath: string): Promise<void> {
  try {
    const sessionData = await window.electron.getReviewSession();
    if (!sessionData) return;
    const session: ReviewSession = JSON.parse(sessionData);
    delete session.activeReviews[filePath];
    await window.electron.saveReviewSession(JSON.stringify(session));
    logger.info(`Removed review from session: ${filePath}`, 'ReviewActions');
  } catch (error) {
    logger.error('Failed to remove review from session', error as Error, 'ReviewActions');
  }
}

/**
 * Get review nodeId for a file from session
 */
async function getReviewFromSession(filePath: string): Promise<string | null> {
  try {
    const sessionData = await window.electron.getReviewSession();
    if (!sessionData) return null;
    const session: ReviewSession = JSON.parse(sessionData);
    return session.activeReviews[filePath] || null;
  } catch {
    return null;
  }
}

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

export interface ProcessReviewContentResult {
  success: boolean;
  nodeCount?: number;
}

export interface ReviewActions {
  startReview: (nodeId: string) => void;
  cancelReview: () => void;
  acceptReview: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => void;
  requestReview: (nodeId: string) => Promise<void>;
  requestReviewInTerminal: (nodeId: string, terminalId: string) => Promise<void>;
  restoreReviewState: () => Promise<void>;
  updateReviewMetadata: (nodeId: string, tempFile: string, contentHash: string) => void;
  processIncomingReviewContent: (content: string, source: ContentSource, skipSave?: boolean) => Promise<ProcessReviewContentResult>;
  /** Full cancel workflow with cleanup - stops monitors, deletes temp files, clears state */
  finishCancel: () => Promise<void>;
  /** Full accept workflow - extracts nodes from review store, accepts, and cleans up */
  finishAccept: () => Promise<void>;
}

export function createReviewActions(
  get: () => TreeState,
  set: (partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void,
  visualEffects: VisualEffectsActions,
  autoSave: () => void
): ReviewActions {
  /**
   * Stop all review monitors (clipboard, file watcher)
   */
  async function stopReviewMonitors(): Promise<void> {
    await window.electron.stopClipboardMonitor();
    await window.electron.stopReviewFileWatcher();
  }

  /**
   * Clean up review resources for a file
   */
  async function cleanupReview(filePath: string, tempFilePath?: string): Promise<void> {
    await stopReviewMonitors();
    if (tempFilePath) {
      await deleteReviewTempFile(tempFilePath);
    }
    reviewTreeStore.clearFile(filePath);
  }

  /**
   * Extract content nodes from review store, excluding hidden root
   * Returns null if review store is empty or invalid
   */
  function extractReviewContent(filePath: string): { rootNodeId: string; nodes: Record<string, TreeNode> } | null {
    const reviewStore = reviewTreeStore.getStoreForFile(filePath);
    if (!reviewStore) {
      logger.error('No review store available', new Error('Review store not initialized'), 'ReviewActions');
      return null;
    }

    const { nodes: reviewNodes, rootNodeId: reviewRootNodeId } = reviewStore.getState();
    const hiddenRoot = reviewNodes[reviewRootNodeId];

    if (!hiddenRoot || hiddenRoot.children.length === 0) {
      logger.error('Review store has no content', new Error('Empty review'), 'ReviewActions');
      return null;
    }

    // Get actual content root (first child of hidden root)
    const actualRootNodeId = hiddenRoot.children[0];

    // Filter out the hidden root from the nodes map
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [reviewRootNodeId]: _hiddenRoot, ...contentNodes } = reviewNodes;

    return { rootNodeId: actualRootNodeId, nodes: contentNodes };
  }

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
      // Note: We don't save to session here - only when content is received
      // User can easily redo the "start review" action if app restarts
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
     * Copies node content to clipboard, opens browser panel, and starts monitoring for response
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
        // Note: We don't save to session here - only when content is received

        // Open browser panel
        usePanelStore.getState().showBrowser();

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
        // Note: We don't save to session here - only when content is received

        // Start file watching for the response
        await window.electron.startReviewFileWatcher(reviewResponseFile);

        logger.info(`Started terminal review for node: ${nodeId}, watching: ${reviewResponseFile}`, 'ReviewActions');
      } catch (error) {
        logger.error('Failed to request review in terminal', error as Error, 'ReviewActions');
        throw error;
      }
    },

    /**
     * Restore review state from session and node metadata
     * Called after loading a file to check if there was a review in progress
     */
    restoreReviewState: async () => {
      const state = get();
      const { nodes, currentFilePath } = state;

      if (!currentFilePath) {
        logger.info('No current file path, skipping review restore', 'ReviewActions');
        return;
      }

      // First check session for saved review state
      const sessionNodeId = await getReviewFromSession(currentFilePath);
      logger.info(`Review restore check: file=${currentFilePath}, sessionNodeId=${sessionNodeId}`, 'ReviewActions');

      // Find node with review metadata (fallback or validation)
      const reviewingNode = Object.entries(nodes).find(
        ([, node]) => node.metadata.reviewTempFile && node.metadata.reviewContentHash
      );

      // Determine which nodeId to use: prefer session, fall back to metadata
      let nodeId: string | null = null;
      let node: TreeNode | null = null;

      if (sessionNodeId && nodes[sessionNodeId]) {
        nodeId = sessionNodeId;
        node = nodes[sessionNodeId];
      } else if (reviewingNode) {
        [nodeId, node] = reviewingNode;
      }

      if (!nodeId || !node) {
        logger.info('No review state to restore', 'ReviewActions');
        return;
      }

      const { reviewTempFile, reviewContentHash } = node.metadata;

      if (!reviewTempFile || !reviewContentHash) {
        // No temp file content - don't restore (user can easily redo "start review" action)
        // Clean up stale session entry if it exists
        if (sessionNodeId) {
          await removeReviewFromSession(currentFilePath);
          logger.info('Cleared stale review session (no content to restore)', 'ReviewActions');
        }
        return;
      }

      try {
        // Try to load the review content from temp file
        // Don't validate hash - content may have been edited since initial save
        const content = await loadReviewContent(reviewTempFile);

        if (content) {
          // Start review mode for this node
          set({ reviewingNodeId: nodeId });

          // Process the content to populate the review panel
          const stateWithActions = get() as TreeState & { actions?: { processIncomingReviewContent?: (content: string, source: ContentSource, skipSave?: boolean) => Promise<ProcessReviewContentResult> } };
          if (stateWithActions.actions?.processIncomingReviewContent) {
            await stateWithActions.actions.processIncomingReviewContent(content, 'restore', true);
          }

          // Enable auto-save for review edits (since we skipped save above, setTempFilePath wasn't called)
          reviewTreeStore.setTempFilePath(currentFilePath, reviewTempFile, nodeId);

          // Start clipboard monitoring
          await window.electron.startClipboardMonitor();

          logger.info(`Restored review state with content for node: ${nodeId}`, 'ReviewActions');
          useToastStore.getState().addToast(
            'Review restored - Continue your previous review',
            'info'
          );
        } else {
          // Temp file not found or hash mismatch - clean up metadata and session
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
          await removeReviewFromSession(currentFilePath);
          // Save to persist the cleared metadata
          autoSave();
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

    /**
     * Process incoming review content from clipboard, file watcher, or temp file restore.
     * Parses markdown, initializes review store, saves to temp file, and updates metadata.
     */
    processIncomingReviewContent: async (
      content: string,
      source: ContentSource,
      skipSave: boolean = false
    ): Promise<ProcessReviewContentResult> => {
      const state = get();
      const { reviewingNodeId, currentFilePath } = state;

      if (!reviewingNodeId) {
        logger.warn(`Received ${source} content but no node is being reviewed`, 'ReviewActions');
        return { success: false };
      }

      if (!currentFilePath) {
        logger.warn(`Received ${source} content but no active file`, 'ReviewActions');
        return { success: false };
      }

      logger.info(`Processing ${source} content`, 'ReviewActions');

      // Parse markdown content
      let rootNodes, allNodes;
      try {
        ({ rootNodes, allNodes } = parseMarkdown(content));
      } catch {
        logger.info(`${source} content is not valid markdown`, 'ReviewActions');
        return { success: false };
      }

      // Must have exactly 1 root node
      if (rootNodes.length !== 1) {
        if (rootNodes.length === 0) {
          logger.info(`${source} content has no valid nodes`, 'ReviewActions');
        } else {
          logger.info(`${source} content has ${rootNodes.length} root nodes, expected 1`, 'ReviewActions');
        }
        return { success: false };
      }

      // Wrap with hidden root and initialize review store
      const { nodes: nodesWithHiddenRoot, rootNodeId: hiddenRootId } = wrapNodesWithHiddenRoot(
        allNodes,
        rootNodes[0].id,
        'review-root'
      );
      reviewTreeStore.initialize(currentFilePath, nodesWithHiddenRoot, hiddenRootId);
      logger.info(`Initialized review store with ${Object.keys(allNodes).length} nodes`, 'ReviewActions');

      // Show the review panel
      usePanelStore.getState().showReview();

      // Save content to temp file and update node metadata (skip if restoring)
      if (!skipSave) {
        try {
          const { filePath: tempFilePath, contentHash } = await saveReviewContent(reviewingNodeId, content);
          const updatedNodes = {
            ...get().nodes,
            [reviewingNodeId]: {
              ...get().nodes[reviewingNodeId],
              metadata: {
                ...get().nodes[reviewingNodeId].metadata,
                reviewTempFile: tempFilePath,
                reviewContentHash: contentHash,
              },
            },
          };
          set({ nodes: updatedNodes });
          logger.info('Saved review content to temp file', 'ReviewActions');

          // Enable auto-save for review edits
          reviewTreeStore.setTempFilePath(currentFilePath, tempFilePath, reviewingNodeId);

          // Persist the metadata to the .arbo file
          autoSave();

          // Now that content exists, save to session for persistence across restarts
          logger.info(`Saving review to session: file=${currentFilePath}, nodeId=${reviewingNodeId}`, 'ReviewActions');
          await saveReviewToSession(currentFilePath, reviewingNodeId);
        } catch (error) {
          logger.error('Failed to save review content to temp file', error as Error, 'ReviewActions');
        }
      }

      return { success: true, nodeCount: Object.keys(allNodes).length };
    },

    /**
     * Full cancel workflow with cleanup
     */
    finishCancel: async () => {
      try {
        const { reviewingNodeId, currentFilePath, nodes } = get();
        if (!reviewingNodeId || !currentFilePath) {
          logger.warn('No review in progress to cancel', 'ReviewActions');
          return;
        }

        const node = nodes[reviewingNodeId];
        const tempFilePath = node?.metadata.reviewTempFile;

        // Clear the node's review metadata
        if (node && (node.metadata.reviewTempFile || node.metadata.reviewContentHash)) {
          const updatedNodes = {
            ...nodes,
            [reviewingNodeId]: {
              ...node,
              metadata: {
                ...node.metadata,
                reviewTempFile: undefined,
                reviewContentHash: undefined,
              },
            },
          };
          set({ nodes: updatedNodes, reviewingNodeId: null });
          autoSave(); // Persist the cleared metadata
        } else {
          set({ reviewingNodeId: null });
        }

        await cleanupReview(currentFilePath, tempFilePath);
        await removeReviewFromSession(currentFilePath);

        window.dispatchEvent(new Event('review-canceled'));
        logger.info('Review cancelled', 'ReviewActions');
      } catch (error) {
        logger.error('Failed to cancel review', error as Error, 'ReviewActions');
      }
    },

    /**
     * Full accept workflow
     */
    finishAccept: async () => {
      try {
        const { reviewingNodeId, currentFilePath, nodes } = get();
        if (!reviewingNodeId || !currentFilePath) {
          logger.error('No review in progress to accept', new Error('No active review'), 'ReviewActions');
          return;
        }

        // Extract content from review store
        const reviewContent = extractReviewContent(currentFilePath);
        if (!reviewContent) return;

        logger.info(`Accepting review with ${Object.keys(reviewContent.nodes).length} nodes`, 'ReviewActions');

        // Get executeCommand from state
        const stateWithActions = get() as TreeState & { actions?: { executeCommand?: (cmd: unknown) => void } };
        if (!stateWithActions.actions?.executeCommand) {
          logger.error('executeCommand not available', new Error('Cannot accept review without command system'), 'ReviewActions');
          return;
        }

        // Execute accept command (handles undo support)
        const command = new AcceptReviewCommand(
          reviewingNodeId,
          reviewContent.rootNodeId,
          reviewContent.nodes,
          get,
          set,
          autoSave
        );
        stateWithActions.actions.executeCommand(command);

        // Cleanup
        const tempFilePath = nodes[reviewingNodeId]?.metadata.reviewTempFile;
        await cleanupReview(currentFilePath, tempFilePath);
        await removeReviewFromSession(currentFilePath);
        usePanelStore.getState().hidePanel();

        window.dispatchEvent(new Event('review-accepted'));
        logger.info('Review accepted and node replaced', 'ReviewActions');
      } catch (error) {
        logger.error('Failed to accept review', error as Error, 'ReviewActions');
      }
    },
  };
}
