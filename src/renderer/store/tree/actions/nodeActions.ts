import { TreeNode, NodeStatus } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';
import { v4 as uuidv4 } from 'uuid';
import { ContentEditCommand } from '../commands/ContentEditCommand';
import { ToggleStatusCommand } from '../commands/ToggleStatusCommand';
import { CreateNodeCommand } from '../commands/CreateNodeCommand';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { ContextDeclarationInfo } from '../treeStore';

export interface NodeActions {
  selectNode: (nodeId: string, cursorPosition?: number) => void;
  updateContent: (nodeId: string, content: string) => void;
  updateStatus: (nodeId: string, status: NodeStatus) => void;
  toggleStatus: (nodeId: string) => void;
  setCursorPosition: (position: number) => void;
  setRememberedVisualX: (visualX: number | null) => void;
  createNode: (currentNodeId: string) => void;
  declareAsContext: (nodeId: string, icon?: string) => void;
  setContextIcon: (nodeId: string, icon: string) => void;
  removeContextDeclaration: (nodeId: string) => void;
  applyContext: (nodeId: string, contextNodeId: string) => void;
  removeAppliedContext: (nodeId: string, contextNodeId?: string) => void;
  setActiveContext: (nodeId: string, contextNodeId: string) => void;
  addToBundle: (nodeId: string, contextNodeId: string) => void;
  removeFromBundle: (nodeId: string, contextNodeId: string) => void;
  refreshContextDeclarations: () => void;
}

/**
 * Build context declarations array from nodes.
 * Called asynchronously after context-related operations.
 */
function buildContextDeclarations(nodes: Record<string, TreeNode>): ContextDeclarationInfo[] {
  return Object.values(nodes)
    .filter(node => node.metadata.isContextDeclaration === true)
    .map(node => ({
      nodeId: node.id,
      content: node.content || 'Untitled context',
      icon: (node.metadata.contextIcon as string) || 'lightbulb',
    }))
    .sort((a, b) => a.content.localeCompare(b.content));
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  activeNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
  collaboratingNodeId: string | null;
  contextDeclarations: ContextDeclarationInfo[];
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

function generateId(): string {
  return uuidv4();
}

/**
 * Remove a context ID from a metadata array field across all nodes.
 */
function removeContextFromMetadataArray(
  contextNodeId: string,
  nodes: Record<string, TreeNode>,
  metadataKey: 'appliedContextIds' | 'bundledContextIds'
): Record<string, TreeNode> {
  let updatedNodes = nodes;

  for (const node of Object.values(nodes)) {
    const ids = (node.metadata[metadataKey] as string[]) || [];
    if (ids.includes(contextNodeId)) {
      const newIds = ids.filter(id => id !== contextNodeId);
      const metadataUpdates: Record<string, unknown> = {
        [metadataKey]: newIds.length > 0 ? newIds : undefined,
      };

      // Handle activeContextId promotion when removing from appliedContextIds
      if (metadataKey === 'appliedContextIds') {
        const currentActiveContextId = node.metadata.activeContextId as string | undefined;
        if (newIds.length === 0) {
          metadataUpdates.activeContextId = undefined;
        } else if (currentActiveContextId === contextNodeId) {
          metadataUpdates.activeContextId = newIds[0];
        }
      }

      updatedNodes = updateNodeMetadata(updatedNodes, node.id, metadataUpdates);
    }
  }

  return updatedNodes;
}

export const createNodeActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): NodeActions => {
  function selectNode(nodeId: string, cursorPosition?: number): void {
    set({
      activeNodeId: nodeId,
      cursorPosition: cursorPosition ?? 0,
    });
  }

  function updateContent(nodeId: string, content: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes, collaboratingNodeId } = state;
    const node = nodes[nodeId];
    if (!node) return;

    // Prevent editing of node in collaboration
    if (collaboratingNodeId === nodeId) {
      useToastStore.getState().addToast(
        'Cannot edit node in collaboration - Please finish or cancel the collaboration first',
        'error'
      );
      logger.error('Cannot edit node in collaboration', new Error('Node is being collaborated on'), 'TreeStore');
      return;
    }

    const oldContent = node.content;

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot update content with undo/redo support');
    }

    const command = new ContentEditCommand(
      nodeId,
      () => (get() as StoreState).nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      oldContent,
      content,
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  function updateStatus(nodeId: string, status: NodeStatus): void {
    const { nodes } = get();
    set({
      nodes: updateNodeMetadata(nodes, nodeId, { status }),
    });
    triggerAutosave?.();
  }

  function toggleStatus(nodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes } = state;
    const node = nodes[nodeId];
    if (!node) return;

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot toggle status with undo/redo support');
    }

    const command = new ToggleStatusCommand(
      nodeId,
      () => (get() as StoreState).nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  function setCursorPosition(position: number): void {
    set({ cursorPosition: position });
  }

  function setRememberedVisualX(visualX: number | null): void {
    set({ rememberedVisualX: visualX });
  }

  function createNode(currentNodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes, rootNodeId, ancestorRegistry } = state;
    const currentNode = nodes[currentNodeId];
    if (!currentNode) return;

    const newNodeId = generateId();
    const isExpanded = currentNode.metadata.expanded ?? true;
    const hasChildren = currentNode.children.length > 0;

    // Determine where to create the node
    let parentId: string;
    let position: number;

    if (isExpanded && hasChildren) {
      // Create as first child of current node
      parentId = currentNodeId;
      position = 0;
    } else {
      // Create as sibling after current node
      const ancestors = ancestorRegistry[currentNodeId] || [];
      parentId = ancestors[ancestors.length - 1] || rootNodeId;
      const parent = nodes[parentId];
      if (!parent) return;
      position = parent.children.indexOf(currentNodeId) + 1;
    }

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot create node with undo/redo support');
    }

    const command = new CreateNodeCommand(
      newNodeId,
      parentId,
      position,
      '',
      () => {
        const currentState = get() as StoreState;
        return { nodes: currentState.nodes, rootNodeId: currentState.rootNodeId, ancestorRegistry: currentState.ancestorRegistry };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  function refreshContextDeclarations(): void {
    const { nodes } = get();
    // Use setTimeout to make this async and avoid blocking the UI
    setTimeout(() => {
      set({ contextDeclarations: buildContextDeclarations(nodes) });
    }, 0);
  }

  function declareAsContext(nodeId: string, icon?: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        isContextDeclaration: true,
        contextIcon: icon || 'lightbulb',
      }),
    });

    useToastStore.getState().addToast('Node declared as context', 'success');
    logger.info(`Node ${nodeId} declared as context with icon ${icon || 'lightbulb'}`, 'Context');

    triggerAutosave?.();
    refreshContextDeclarations();
  }

  function setContextIcon(nodeId: string, icon: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        contextIcon: icon,
      }),
    });

    useToastStore.getState().addToast('Context icon updated', 'success');
    logger.info(`Context icon updated to ${icon} for node ${nodeId}`, 'Context');

    triggerAutosave?.();
    refreshContextDeclarations();
  }

  function removeContextDeclaration(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    // Update the context declaration node - clear declaration metadata
    let updatedNodes = updateNodeMetadata(nodes, nodeId, {
      isContextDeclaration: false,
      contextIcon: undefined,
      bundledContextIds: undefined,
    });

    // Remove this context from appliedContextIds of all nodes
    updatedNodes = removeContextFromMetadataArray(nodeId, updatedNodes, 'appliedContextIds');

    // Remove this context from bundledContextIds of other context declarations
    updatedNodes = removeContextFromMetadataArray(nodeId, updatedNodes, 'bundledContextIds');

    set({ nodes: updatedNodes });

    useToastStore.getState().addToast('Context declaration removed', 'info');
    logger.info(`Context declaration removed from node ${nodeId}`, 'Context');

    triggerAutosave?.();
    refreshContextDeclarations();
  }

  function applyContext(nodeId: string, contextNodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    const contextNode = nodes[contextNodeId];
    if (!node || !contextNode) return;

    // Get existing applied contexts or initialize empty array
    const existingContextIds = (node.metadata.appliedContextIds as string[]) || [];

    // Don't add duplicate
    if (existingContextIds.includes(contextNodeId)) {
      useToastStore.getState().addToast('Context already applied', 'info');
      return;
    }

    const newContextIds = [...existingContextIds, contextNodeId];

    // Build metadata updates
    const metadataUpdates: Record<string, unknown> = {
      appliedContextIds: newContextIds,
    };

    // Auto-set activeContextId when first context is applied
    if (existingContextIds.length === 0) {
      metadataUpdates.activeContextId = contextNodeId;
    }

    set({
      nodes: updateNodeMetadata(nodes, nodeId, metadataUpdates),
    });

    const contextName = contextNode.content.slice(0, 30) || 'Context';
    useToastStore.getState().addToast(`Context "${contextName}" applied`, 'success');
    logger.info(`Context ${contextNodeId} applied to node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  function removeAppliedContext(nodeId: string, contextNodeId?: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const existingContextIds = (node.metadata.appliedContextIds as string[]) || [];
    const currentActiveContextId = node.metadata.activeContextId as string | undefined;

    let newContextIds: string[] | undefined;
    if (contextNodeId) {
      // Remove specific context
      newContextIds = existingContextIds.filter(id => id !== contextNodeId);
      if (newContextIds.length === 0) {
        newContextIds = undefined;
      }
    } else {
      // Remove all contexts (for backwards compatibility or "remove all")
      newContextIds = undefined;
    }

    // Build metadata updates
    const metadataUpdates: Record<string, unknown> = {
      appliedContextIds: newContextIds,
    };

    // Handle activeContextId promotion/clearing
    if (!newContextIds || newContextIds.length === 0) {
      // All contexts removed - clear activeContextId
      metadataUpdates.activeContextId = undefined;
    } else if (contextNodeId && currentActiveContextId === contextNodeId) {
      // Active context was removed - promote first remaining context to active
      metadataUpdates.activeContextId = newContextIds[0];
    }
    // Otherwise keep existing activeContextId

    set({
      nodes: updateNodeMetadata(nodes, nodeId, metadataUpdates),
    });

    useToastStore.getState().addToast('Context removed', 'info');
    logger.info(`Applied context removed from node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  function setActiveContext(nodeId: string, contextNodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    // Verify the context is actually applied to this node
    const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];
    if (!appliedContextIds.includes(contextNodeId)) {
      useToastStore.getState().addToast('Context is not applied to this node', 'error');
      return;
    }

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        activeContextId: contextNodeId,
      }),
    });

    logger.info(`Active context set to ${contextNodeId} for node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  function addToBundle(nodeId: string, contextNodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    const contextNode = nodes[contextNodeId];
    if (!node || !contextNode) return;

    // Only context declarations can have bundles
    if (node.metadata.isContextDeclaration !== true) return;

    // Only context declarations can be bundled
    if (contextNode.metadata.isContextDeclaration !== true) return;

    // Get existing bundled contexts or initialize empty array
    const existingBundleIds = (node.metadata.bundledContextIds as string[]) || [];

    // Don't add duplicate
    if (existingBundleIds.includes(contextNodeId)) return;

    // Don't allow self-bundling
    if (nodeId === contextNodeId) return;

    const newBundleIds = [...existingBundleIds, contextNodeId];

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        bundledContextIds: newBundleIds,
      }),
    });

    logger.info(`Context ${contextNodeId} added to bundle of node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  function removeFromBundle(nodeId: string, contextNodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const existingBundleIds = (node.metadata.bundledContextIds as string[]) || [];
    const newBundleIds = existingBundleIds.filter(id => id !== contextNodeId);

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        bundledContextIds: newBundleIds.length > 0 ? newBundleIds : undefined,
      }),
    });

    logger.info(`Context ${contextNodeId} removed from bundle of node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  return {
    selectNode,
    updateContent,
    updateStatus,
    toggleStatus,
    setCursorPosition,
    setRememberedVisualX,
    createNode,
    declareAsContext,
    setContextIcon,
    removeContextDeclaration,
    applyContext,
    removeAppliedContext,
    setActiveContext,
    addToBundle,
    removeFromBundle,
    refreshContextDeclarations,
  };
};
