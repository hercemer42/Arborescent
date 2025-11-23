import { TreeState } from '../treeStore';
import { TreeNode } from '../../../../shared/types';
import { exportNodeAsMarkdown } from '../../../utils/markdown';
import { executeInTerminal } from '../../../services/terminalExecution';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { usePanelStore } from '../../panel/panelStore';
import { VisualEffectsActions } from './visualEffectsActions';
import { AcceptReviewCommand } from '../commands/AcceptReviewCommand';
import {
  parseReviewContent,
  initializeReviewStore,
  extractReviewContent,
  cleanupReview,
  findReviewingNode,
} from '../../../services/review/reviewService';
import { reviewTreeStore } from '../../review/reviewTreeStore';

export type ContentSource = 'clipboard' | 'file' | 'restore';

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
  processIncomingReviewContent: (content: string, source: ContentSource, skipSave?: boolean) => Promise<ProcessReviewContentResult>;
  finishCancel: () => Promise<void>;
  finishAccept: () => Promise<void>;
}

export function createReviewActions(
  get: () => TreeState,
  set: (partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void,
  _visualEffects: VisualEffectsActions,
  autoSave: () => void
): ReviewActions {
  /**
   * Update node metadata with review temp file path
   */
  function setReviewTempFile(nodeId: string, tempFilePath: string | undefined): void {
    const nodes = get().nodes;
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...node,
          metadata: { ...node.metadata, reviewTempFile: tempFilePath },
        },
      },
    });
  }

  /**
   * Show error toast for review already in progress
   */
  function showReviewInProgressError(): void {
    useToastStore.getState().addToast(
      'Review already in progress - Please finish or cancel the current review first',
      'error'
    );
  }

  return {
    startReview: (nodeId: string) => {
      if (get().reviewingNodeId) {
        showReviewInProgressError();
        return;
      }
      set({ reviewingNodeId: nodeId });
    },

    cancelReview: () => {
      set({ reviewingNodeId: null });
    },

    acceptReview: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => {
      const state = get() as TreeState & { actions?: { executeCommand?: (cmd: unknown) => void } };
      const { reviewingNodeId } = state;

      if (!reviewingNodeId || !state.nodes[reviewingNodeId]) return;

      if (!state.actions?.executeCommand) {
        logger.error('executeCommand not available', new Error('Cannot accept review without command system'), 'ReviewActions');
        return;
      }

      state.actions.executeCommand(
        new AcceptReviewCommand(reviewingNodeId, newRootNodeId, newNodesMap, get, set, autoSave)
      );
    },

    requestReview: async (nodeId: string) => {
      const state = get();

      if (state.reviewingNodeId) {
        showReviewInProgressError();
        logger.error('Review already in progress', new Error('Cannot start new review'), 'ReviewActions');
        return;
      }

      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'ReviewActions');
        return;
      }

      try {
        const formattedContent = exportNodeAsMarkdown(node, state.nodes);
        await navigator.clipboard.writeText(REVIEW_INSTRUCTION_WEB + '\n\n' + formattedContent);

        useToastStore.getState().addToast(
          'Content copied to clipboard - Paste to review tool, then copy response to continue',
          'info'
        );

        set({ reviewingNodeId: nodeId });
        usePanelStore.getState().showBrowser();
        await window.electron.startClipboardMonitor();

        logger.info(`Started review for node: ${nodeId}`, 'ReviewActions');
      } catch (error) {
        logger.error('Failed to request review', error as Error, 'ReviewActions');
        throw error;
      }
    },

    requestReviewInTerminal: async (nodeId: string, terminalId: string) => {
      const state = get();

      if (state.reviewingNodeId) {
        showReviewInProgressError();
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
        const reviewFileName = `review-response-${nodeId}.md`;
        const reviewResponseFile = await window.electron.createTempFile(reviewFileName, '');

        const formattedContent = exportNodeAsMarkdown(node, state.nodes);
        const terminalInstruction = `${REVIEW_INSTRUCTION_TERMINAL}

IMPORTANT: Write your reviewed/updated list to this file: ${reviewResponseFile}

Here is the content to review:

${formattedContent}`;

        await executeInTerminal(terminalId, terminalInstruction);
        set({ reviewingNodeId: nodeId });
        await window.electron.startReviewFileWatcher(reviewResponseFile);

        logger.info(`Started terminal review for node: ${nodeId}, watching: ${reviewResponseFile}`, 'ReviewActions');
      } catch (error) {
        logger.error('Failed to request review in terminal', error as Error, 'ReviewActions');
        throw error;
      }
    },

    restoreReviewState: async () => {
      const { nodes, currentFilePath } = get();

      if (!currentFilePath) {
        logger.info('No current file path, skipping review restore', 'ReviewActions');
        return;
      }

      const reviewingNode = findReviewingNode(nodes);
      if (!reviewingNode) {
        logger.info('No review state to restore', 'ReviewActions');
        return;
      }

      const [nodeId, node] = reviewingNode;
      const tempFilePath = node.metadata.reviewTempFile as string;

      try {
        // Load review store from temp file
        let reviewStore = reviewTreeStore.getStoreForFile(currentFilePath);
        if (!reviewStore) {
          reviewTreeStore.initialize(currentFilePath, {}, '');
          reviewStore = reviewTreeStore.getStoreForFile(currentFilePath)!;
        }
        await reviewStore.getState().actions.loadFromPath(tempFilePath);
        reviewTreeStore.setFilePath(currentFilePath, tempFilePath);

        set({ reviewingNodeId: nodeId });
        usePanelStore.getState().showReview();
        await window.electron.startClipboardMonitor();

        logger.info(`Restored review state for node: ${nodeId}`, 'ReviewActions');
        useToastStore.getState().addToast('Review restored - Continue your previous review', 'info');
      } catch (error) {
        logger.warn(`Review temp file not found or invalid: ${tempFilePath}`, 'ReviewActions');
        setReviewTempFile(nodeId, undefined);
        autoSave();
        logger.error('Failed to restore review state', error as Error, 'ReviewActions');
      }
    },

    processIncomingReviewContent: async (
      content: string,
      source: ContentSource,
      skipSave: boolean = false
    ): Promise<ProcessReviewContentResult> => {
      const { reviewingNodeId, currentFilePath } = get();

      if (!reviewingNodeId || !currentFilePath) {
        logger.warn(`Received ${source} content but no active review or file`, 'ReviewActions');
        return { success: false };
      }

      logger.info(`Processing ${source} content`, 'ReviewActions');

      // Parse the content
      const parsedContent = parseReviewContent(content);
      if (!parsedContent) {
        return { success: false };
      }

      // Initialize review store
      initializeReviewStore(currentFilePath, parsedContent);
      usePanelStore.getState().showReview();

      // Persist if not restoring
      if (!skipSave) {
        try {
          // Create temp file and save review store
          const tempFilePath = await window.electron.createTempFile(`review-${reviewingNodeId}.arbo`, '');
          reviewTreeStore.setFilePath(currentFilePath, tempFilePath);
          const reviewStore = reviewTreeStore.getStoreForFile(currentFilePath);
          if (reviewStore) {
            await reviewStore.getState().actions.saveToPath(tempFilePath);
          }
          setReviewTempFile(reviewingNodeId, tempFilePath);
          autoSave();
        } catch (error) {
          logger.error('Failed to save review content to temp file', error as Error, 'ReviewActions');
        }
      }

      return { success: true, nodeCount: parsedContent.nodeCount };
    },

    finishCancel: async () => {
      try {
        const { reviewingNodeId, currentFilePath, nodes } = get();
        if (!reviewingNodeId || !currentFilePath) {
          logger.warn('No review in progress to cancel', 'ReviewActions');
          return;
        }

        const tempFilePath = nodes[reviewingNodeId]?.metadata.reviewTempFile as string | undefined;

        if (tempFilePath) {
          setReviewTempFile(reviewingNodeId, undefined);
          set({ reviewingNodeId: null });
          autoSave();
        } else {
          set({ reviewingNodeId: null });
        }

        await cleanupReview(currentFilePath, tempFilePath);
        window.dispatchEvent(new Event('review-canceled'));
        logger.info('Review cancelled', 'ReviewActions');
      } catch (error) {
        logger.error('Failed to cancel review', error as Error, 'ReviewActions');
      }
    },

    finishAccept: async () => {
      try {
        const { reviewingNodeId, currentFilePath, nodes } = get();
        if (!reviewingNodeId || !currentFilePath) {
          logger.error('No review in progress to accept', new Error('No active review'), 'ReviewActions');
          return;
        }

        const reviewContent = extractReviewContent(currentFilePath);
        if (!reviewContent) return;

        logger.info(`Accepting review with ${Object.keys(reviewContent.nodes).length} nodes`, 'ReviewActions');

        const stateWithActions = get() as TreeState & { actions?: { executeCommand?: (cmd: unknown) => void } };
        if (!stateWithActions.actions?.executeCommand) {
          logger.error('executeCommand not available', new Error('Cannot accept review without command system'), 'ReviewActions');
          return;
        }

        stateWithActions.actions.executeCommand(
          new AcceptReviewCommand(reviewingNodeId, reviewContent.rootNodeId, reviewContent.nodes, get, set, autoSave)
        );

        const tempFilePath = nodes[reviewingNodeId]?.metadata.reviewTempFile as string | undefined;
        await cleanupReview(currentFilePath, tempFilePath);
        usePanelStore.getState().hidePanel();

        window.dispatchEvent(new Event('review-accepted'));
        logger.info('Review accepted and node replaced', 'ReviewActions');
      } catch (error) {
        logger.error('Failed to accept review', error as Error, 'ReviewActions');
      }
    },
  };
}
