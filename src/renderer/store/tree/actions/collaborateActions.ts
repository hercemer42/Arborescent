import { TreeState } from '../treeStore';
import { TreeNode } from '../../../../shared/types';
import { buildContentWithContext } from '../../../utils/nodeHelpers';
import { executeInTerminal } from '../../../services/terminalExecution';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { usePanelStore } from '../../panel/panelStore';
import { VisualEffectsActions } from './visualEffectsActions';
import { AcceptFeedbackCommand } from '../commands/AcceptFeedbackCommand';
import { DEFAULT_BLUEPRINT_ICON } from './blueprintActions';
import {
  parseFeedbackContent,
  initializeFeedbackStore,
  extractFeedbackContent,
  cleanupFeedback,
  findCollaboratingNode,
  ParsedFeedbackContent,
} from '../../../services/feedback/feedbackService';
import { feedbackTreeStore } from '../../feedback/feedbackTreeStore';
import { AncestorRegistry } from '../../../services/ancestry';

export type ContentSource = 'clipboard' | 'file' | 'restore';

// Default review instructions when no custom context is applied
const DEFAULT_REVIEW_CONTEXT = `You are reviewing a hierarchical task list. Please:
- Analyze the content and suggest improvements, additions or reorganization
- Add any missing items that would make the list more complete
- Fix any issues or inconsistencies that you find

`;

// Base instruction for collaboration requests
const COLLABORATE_INSTRUCTION_BASE = `OUTPUT FORMAT:
- Must have exactly one root node (single # heading)
- Use markdown headings for hierarchy (# root, ## child, ### grandchild)
- Use [ ] for pending items, [x] for completed, [-] for failed
- Example: "## [ ] Task name" or "### [x] Completed task"`;

// Web version - output in code block for easy copying
const COLLABORATE_INSTRUCTION_WEB = `${COLLABORATE_INSTRUCTION_BASE}

Output the complete updated list in a markdown code block.`;

// Terminal version - just the base instruction (file path added separately)
const COLLABORATE_INSTRUCTION_TERMINAL = `${COLLABORATE_INSTRUCTION_BASE}

Output the complete updated list.`;

export interface ProcessFeedbackContentResult {
  success: boolean;
  nodeCount?: number;
}

export interface CollaborateActions {
  startCollaboration: (nodeId: string) => void;
  cancelCollaboration: () => void;
  acceptFeedback: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => void;
  collaborate: (nodeId: string) => Promise<void>;
  collaborateInTerminal: (nodeId: string, terminalId: string) => Promise<void>;
  restoreCollaborationState: () => Promise<void>;
  processIncomingFeedbackContent: (content: string, source: ContentSource, skipSave?: boolean) => Promise<ProcessFeedbackContentResult>;
  finishCancel: () => Promise<void>;
  finishAccept: () => Promise<void>;
}

function getEffectiveBlueprintIcon(
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { icon: string; color?: string } {
  if (node.metadata.blueprintIcon) {
    return {
      icon: node.metadata.blueprintIcon as string,
      color: node.metadata.blueprintColor as string | undefined,
    };
  }

  const ancestors = ancestorRegistry[node.id] || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.blueprintIcon) {
      return {
        icon: ancestor.metadata.blueprintIcon as string,
        color: ancestor.metadata.blueprintColor as string | undefined,
      };
    }
  }

  return { icon: DEFAULT_BLUEPRINT_ICON };
}

function applyBlueprintMetadataToFeedback(
  parsedContent: ParsedFeedbackContent,
  blueprintIcon: { icon: string; color?: string }
): ParsedFeedbackContent {
  const updatedNodes: Record<string, TreeNode> = {};

  for (const [id, node] of Object.entries(parsedContent.nodes)) {
    const isRootNode = id === parsedContent.rootNodeId;
    updatedNodes[id] = {
      ...node,
      metadata: {
        ...node.metadata,
        isBlueprint: true,
        ...(isRootNode && { blueprintIcon: blueprintIcon.icon }),
        ...(isRootNode && blueprintIcon.color && { blueprintColor: blueprintIcon.color }),
      },
    };
  }

  return {
    ...parsedContent,
    nodes: updatedNodes,
  };
}

export function createCollaborateActions(
  get: () => TreeState,
  set: (partial: Partial<TreeState> | ((state: TreeState) => Partial<TreeState>)) => void,
  _visualEffects: VisualEffectsActions,
  autoSave: () => void
): CollaborateActions {
  function setFeedbackTempFile(nodeId: string, tempFilePath: string | undefined): void {
    const nodes = get().nodes;
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...node,
          metadata: { ...node.metadata, feedbackTempFile: tempFilePath },
        },
      },
    });
  }

  function showCollaborationInProgressError(): void {
    useToastStore.getState().addToast(
      'Collaboration already in progress - Please finish or cancel the current collaboration first',
      'error'
    );
  }

  return {
    startCollaboration: (nodeId: string) => {
      if (get().collaboratingNodeId) {
        showCollaborationInProgressError();
        return;
      }
      set({ collaboratingNodeId: nodeId });
    },

    cancelCollaboration: () => {
      set({ collaboratingNodeId: null });
    },

    acceptFeedback: (newRootNodeId: string, newNodesMap: Record<string, TreeNode>) => {
      const state = get() as TreeState & { actions?: { executeCommand?: (cmd: unknown) => void } };
      const { collaboratingNodeId } = state;

      if (!collaboratingNodeId || !state.nodes[collaboratingNodeId]) return;

      if (!state.actions?.executeCommand) {
        logger.error('executeCommand not available', new Error('Cannot accept feedback without command system'), 'CollaborateActions');
        return;
      }

      state.actions.executeCommand(
        new AcceptFeedbackCommand(collaboratingNodeId, newRootNodeId, newNodesMap, get, set, autoSave)
      );
    },

    collaborate: async (nodeId: string) => {
      const state = get();

      if (state.collaboratingNodeId) {
        showCollaborationInProgressError();
        logger.error('Collaboration already in progress', new Error('Cannot start new collaboration'), 'CollaborateActions');
        return;
      }

      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'CollaborateActions');
        return;
      }

      try {
        const { contextPrefix, nodeContent } = buildContentWithContext(
          nodeId,
          state.nodes,
          state.ancestorRegistry
        );

        const effectiveContext = contextPrefix || DEFAULT_REVIEW_CONTEXT;
        const clipboardContent = effectiveContext + COLLABORATE_INSTRUCTION_WEB + '\n\nHere is the content:\n\n' + nodeContent;
        await navigator.clipboard.writeText(clipboardContent);

        useToastStore.getState().addToast(
          'Content copied to clipboard - Paste to AI, then copy the response.',
          'info'
        );

        set({ collaboratingNodeId: nodeId });
        usePanelStore.getState().showBrowser();
        // Clipboard monitor is managed by useFeedbackClipboard based on collaboratingNodeId state

        logger.info(`Started collaboration for node: ${nodeId}`, 'CollaborateActions');
      } catch (error) {
        logger.error('Failed to start collaboration', error as Error, 'CollaborateActions');
        throw error;
      }
    },

    collaborateInTerminal: async (nodeId: string, terminalId: string) => {
      const state = get();

      if (state.collaboratingNodeId) {
        showCollaborationInProgressError();
        logger.error('Collaboration already in progress', new Error('Cannot start new collaboration'), 'CollaborateActions');
        return;
      }

      if (!terminalId) {
        const error = new Error('No terminal selected');
        logger.error('Cannot collaborate in terminal', error, 'CollaborateActions');
        throw error;
      }

      const node = state.nodes[nodeId];
      if (!node) {
        logger.error('Node not found', new Error(`Node ${nodeId} not found`), 'CollaborateActions');
        return;
      }

      try {
        const feedbackFileName = `feedback-response-${nodeId}.md`;
        const feedbackResponseFile = await window.electron.createTempFile(feedbackFileName, '');

        const { contextPrefix, nodeContent } = buildContentWithContext(
          nodeId,
          state.nodes,
          state.ancestorRegistry
        );

        const effectiveContext = contextPrefix || DEFAULT_REVIEW_CONTEXT;
        const terminalInstruction = `${effectiveContext}${COLLABORATE_INSTRUCTION_TERMINAL}

IMPORTANT: Write your reviewed/updated list to this file: ${feedbackResponseFile}
Do NOT make any changes to the code.
Only write to the file once - fully consider your response beforehand.

Here is the content:

${nodeContent}`;

        await executeInTerminal(terminalId, terminalInstruction);
        set({ collaboratingNodeId: nodeId });
        await window.electron.startFeedbackFileWatcher(feedbackResponseFile);

        logger.info(`Started terminal collaboration for node: ${nodeId}, watching: ${feedbackResponseFile}`, 'CollaborateActions');
      } catch (error) {
        logger.error('Failed to collaborate in terminal', error as Error, 'CollaborateActions');
        throw error;
      }
    },

    restoreCollaborationState: async () => {
      const { nodes, currentFilePath } = get();

      if (!currentFilePath) {
        logger.info('No current file path, skipping collaboration restore', 'CollaborateActions');
        return;
      }

      const collaboratingNode = findCollaboratingNode(nodes);
      if (!collaboratingNode) {
        logger.info('No collaboration state to restore', 'CollaborateActions');
        return;
      }

      const [nodeId, node] = collaboratingNode;
      const tempFilePath = node.metadata.feedbackTempFile as string;

      // Check if temp file still exists before trying to load
      const tempFileContent = await window.electron.readTempFile(tempFilePath);
      if (!tempFileContent) {
        // Temp file was cleaned up or never existed - clear stale metadata
        logger.info(`Clearing stale feedback metadata (temp file not found): ${tempFilePath}`, 'CollaborateActions');
        setFeedbackTempFile(nodeId, undefined);
        autoSave();
        return;
      }

      try {
        // Load feedback store from temp file
        let feedbackStore = feedbackTreeStore.getStoreForFile(currentFilePath);
        if (!feedbackStore) {
          feedbackTreeStore.initialize(currentFilePath, {}, '');
          feedbackStore = feedbackTreeStore.getStoreForFile(currentFilePath)!;
        }
        await feedbackStore.getState().actions.loadFromPath(tempFilePath);
        feedbackTreeStore.setFilePath(currentFilePath, tempFilePath);

        set({ collaboratingNodeId: nodeId });
        usePanelStore.getState().showFeedback();
        // Clipboard monitor is managed by useFeedbackClipboard based on collaboratingNodeId state

        logger.info(`Restored collaboration state for node: ${nodeId}`, 'CollaborateActions');
        useToastStore.getState().addToast('Collaboration restored - Continue your previous session', 'info');
      } catch (error) {
        // File exists but couldn't be loaded (corrupted?)
        logger.error('Failed to restore collaboration state', error as Error, 'CollaborateActions');
        setFeedbackTempFile(nodeId, undefined);
        autoSave();
      }
    },

    processIncomingFeedbackContent: async (
      content: string,
      source: ContentSource,
      skipSave: boolean = false
    ): Promise<ProcessFeedbackContentResult> => {
      const { collaboratingNodeId, currentFilePath, blueprintModeEnabled, nodes, ancestorRegistry } = get();

      if (!collaboratingNodeId || !currentFilePath) {
        logger.warn(`Received ${source} content but no active collaboration or file`, 'CollaborateActions');
        return { success: false };
      }

      logger.info(`Processing ${source} content`, 'CollaborateActions');

      // Parse the content
      let parsedContent = parseFeedbackContent(content);
      if (!parsedContent) {
        return { success: false };
      }

      // Apply blueprint metadata if in blueprint mode
      if (blueprintModeEnabled) {
        const collaboratingNode = nodes[collaboratingNodeId];
        if (collaboratingNode) {
          const effectiveIcon = getEffectiveBlueprintIcon(collaboratingNode, nodes, ancestorRegistry);
          parsedContent = applyBlueprintMetadataToFeedback(parsedContent, effectiveIcon);
        }
      }

      // Initialize feedback store (pass blueprintModeEnabled so new nodes also get blueprint metadata)
      initializeFeedbackStore(currentFilePath, parsedContent, blueprintModeEnabled);
      usePanelStore.getState().showFeedback();

      // Stop clipboard monitor - we have content now
      await window.electron.stopClipboardMonitor();

      // Persist if not restoring
      if (!skipSave) {
        try {
          // Create temp file and save feedback store
          const tempFilePath = await window.electron.createTempFile(`feedback-${collaboratingNodeId}.arbo`, '');
          feedbackTreeStore.setFilePath(currentFilePath, tempFilePath);
          const feedbackStore = feedbackTreeStore.getStoreForFile(currentFilePath);
          if (feedbackStore) {
            await feedbackStore.getState().actions.saveToPath(tempFilePath);
          }
          setFeedbackTempFile(collaboratingNodeId, tempFilePath);
          autoSave();
        } catch (error) {
          logger.error('Failed to save feedback content to temp file', error as Error, 'CollaborateActions');
        }
      }

      return { success: true, nodeCount: parsedContent.nodeCount };
    },

    finishCancel: async () => {
      try {
        const { collaboratingNodeId, currentFilePath, nodes } = get();
        if (!collaboratingNodeId || !currentFilePath) {
          logger.warn('No collaboration in progress to cancel', 'CollaborateActions');
          return;
        }

        const tempFilePath = nodes[collaboratingNodeId]?.metadata.feedbackTempFile as string | undefined;

        if (tempFilePath) {
          setFeedbackTempFile(collaboratingNodeId, undefined);
          set({ collaboratingNodeId: null });
          autoSave();
        } else {
          set({ collaboratingNodeId: null });
        }

        await cleanupFeedback(currentFilePath, tempFilePath);
        window.dispatchEvent(new Event('collaboration-canceled'));
        logger.info('Collaboration cancelled', 'CollaborateActions');
      } catch (error) {
        logger.error('Failed to cancel collaboration', error as Error, 'CollaborateActions');
      }
    },

    finishAccept: async () => {
      try {
        const { collaboratingNodeId, currentFilePath, nodes } = get();
        if (!collaboratingNodeId || !currentFilePath) {
          logger.error('No collaboration in progress to accept', new Error('No active collaboration'), 'CollaborateActions');
          return;
        }

        const feedbackContent = extractFeedbackContent(currentFilePath);
        if (!feedbackContent) return;

        logger.info(`Accepting feedback with ${Object.keys(feedbackContent.nodes).length} nodes`, 'CollaborateActions');

        const stateWithActions = get() as TreeState & { actions?: { executeCommand?: (cmd: unknown) => void } };
        if (!stateWithActions.actions?.executeCommand) {
          logger.error('executeCommand not available', new Error('Cannot accept feedback without command system'), 'CollaborateActions');
          return;
        }

        stateWithActions.actions.executeCommand(
          new AcceptFeedbackCommand(collaboratingNodeId, feedbackContent.rootNodeId, feedbackContent.nodes, get, set, autoSave)
        );

        const tempFilePath = nodes[collaboratingNodeId]?.metadata.feedbackTempFile as string | undefined;
        await cleanupFeedback(currentFilePath, tempFilePath);
        usePanelStore.getState().hidePanel();

        window.dispatchEvent(new Event('collaboration-accepted'));
        logger.info('Feedback accepted and node replaced', 'CollaborateActions');
      } catch (error) {
        logger.error('Failed to accept feedback', error as Error, 'CollaborateActions');
      }
    },
  };
}
