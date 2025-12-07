import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata, getEffectiveContextIds, getAllDescendants } from '../../../utils/nodeHelpers';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { ContextDeclarationInfo } from '../treeStore';
import { AncestorRegistry } from '../../../services/ancestry';

export type ContextActionType = 'execute' | 'collaborate';

export interface ContextActions {
  declareAsContext: (nodeId: string, icon?: string, color?: string) => void;
  removeContextDeclaration: (nodeId: string) => void;
  applyContext: (nodeId: string, contextNodeId: string) => void;
  removeAppliedContext: (nodeId: string, contextNodeId?: string) => void;
  setActiveContext: (nodeId: string, contextNodeId: string, actionType?: ContextActionType) => void;
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
      icon: (node.metadata.blueprintIcon as string) || 'lightbulb',
      color: node.metadata.blueprintColor as string | undefined,
    }))
    .sort((a, b) => a.content.localeCompare(b.content));
}

/**
 * Remove a context ID from appliedContextIds across all nodes.
 */
function removeAppliedContextFromAllNodes(
  contextNodeId: string,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  let updatedNodes = nodes;

  for (const node of Object.values(nodes)) {
    const ids = (node.metadata.appliedContextIds as string[]) || [];
    if (ids.includes(contextNodeId)) {
      const newIds = ids.filter(id => id !== contextNodeId);
      const metadataUpdates: Record<string, unknown> = {
        appliedContextIds: newIds.length > 0 ? newIds : undefined,
      };

      const currentActiveContextId = node.metadata.activeContextId as string | undefined;
      if (newIds.length === 0) {
        metadataUpdates.activeContextId = undefined;
      } else if (currentActiveContextId === contextNodeId) {
        metadataUpdates.activeContextId = newIds[0];
      }

      updatedNodes = updateNodeMetadata(updatedNodes, node.id, metadataUpdates);
    }
  }

  return updatedNodes;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  contextDeclarations: ContextDeclarationInfo[];
  ancestorRegistry: AncestorRegistry;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

export const createContextActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): ContextActions => {
  function refreshContextDeclarations(): void {
    const { nodes } = get();
    setTimeout(() => {
      set({ contextDeclarations: buildContextDeclarations(nodes) });
    }, 0);
  }

  function declareAsContext(nodeId: string, icon?: string, color?: string): void {
    const { nodes, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const parentId = ancestors[ancestors.length - 1];
    const parent = parentId ? nodes[parentId] : null;
    if (!parent || parent.metadata.isBlueprint !== true) {
      useToastStore.getState().addToast('Can only declare context on nodes with a blueprint parent', 'error');
      return;
    }

    const blueprintIcon = icon || 'lightbulb';
    const blueprintColor = color || undefined;

    let updatedNodes = updateNodeMetadata(nodes, nodeId, {
      isContextDeclaration: true,
      blueprintIcon,
      blueprintColor,
      isBlueprint: true,
    });

    const descendantIds = getAllDescendants(nodeId, nodes);
    const nestedContextIds = new Set<string>();

    for (const descendantId of descendantIds) {
      const descendant = updatedNodes[descendantId];
      if (descendant?.metadata.isContextDeclaration === true) {
        nestedContextIds.add(descendantId);
        const nestedDescendants = getAllDescendants(descendantId, nodes);
        for (const nestedId of nestedDescendants) {
          nestedContextIds.add(nestedId);
        }
      }
    }

    for (const descendantId of descendantIds) {
      if (nestedContextIds.has(descendantId)) continue;

      updatedNodes = updateNodeMetadata(updatedNodes, descendantId, {
        isBlueprint: true,
      });
    }

    set({ nodes: updatedNodes });

    logger.info(`Node ${nodeId} declared as context with icon ${blueprintIcon}`, 'Context');

    triggerAutosave?.();
    refreshContextDeclarations();
  }

  function removeContextDeclaration(nodeId: string): void {
    const { nodes, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const hasAncestorContext = ancestors.some(
      ancestorId => nodes[ancestorId]?.metadata.isContextDeclaration === true
    );

    let updatedNodes: Record<string, TreeNode>;
    if (hasAncestorContext) {
      updatedNodes = updateNodeMetadata(nodes, nodeId, {
        isContextDeclaration: false,
        blueprintIcon: undefined,
        blueprintColor: undefined,
      });
    } else {
      updatedNodes = updateNodeMetadata(nodes, nodeId, {
        isContextDeclaration: false,
        blueprintIcon: undefined,
        blueprintColor: undefined,
        isBlueprint: false,
      });

      const descendantIds = getAllDescendants(nodeId, nodes);
      for (const descendantId of descendantIds) {
        const descendant = updatedNodes[descendantId];
        if (!descendant) continue;
        if (descendant.metadata.isContextDeclaration === true) continue;

        updatedNodes = updateNodeMetadata(updatedNodes, descendantId, {
          isBlueprint: false,
        });
      }
    }

    updatedNodes = removeAppliedContextFromAllNodes(nodeId, updatedNodes);

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

    const existingContextIds = (node.metadata.appliedContextIds as string[]) || [];

    if (existingContextIds.includes(contextNodeId)) {
      useToastStore.getState().addToast('Context already applied', 'info');
      return;
    }

    const newContextIds = [...existingContextIds, contextNodeId];

    const metadataUpdates: Record<string, unknown> = {
      appliedContextIds: newContextIds,
    };

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
      newContextIds = existingContextIds.filter(id => id !== contextNodeId);
      if (newContextIds.length === 0) {
        newContextIds = undefined;
      }
    } else {
      newContextIds = undefined;
    }

    const metadataUpdates: Record<string, unknown> = {
      appliedContextIds: newContextIds,
    };

    if (!newContextIds || newContextIds.length === 0) {
      metadataUpdates.activeContextId = undefined;
    } else if (contextNodeId && currentActiveContextId === contextNodeId) {
      metadataUpdates.activeContextId = newContextIds[0];
    }

    set({
      nodes: updateNodeMetadata(nodes, nodeId, metadataUpdates),
    });

    useToastStore.getState().addToast('Context removed', 'info');
    logger.info(`Applied context removed from node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  function setActiveContext(nodeId: string, contextNodeId: string, actionType?: ContextActionType): void {
    const { nodes, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const effectiveContextIds = getEffectiveContextIds(nodeId, nodes, ancestorRegistry);
    if (!effectiveContextIds.includes(contextNodeId)) {
      useToastStore.getState().addToast('Context is not available for this node', 'error');
      return;
    }

    const metadataKey = actionType === 'execute' ? 'activeExecuteContextId'
      : actionType === 'collaborate' ? 'activeCollaborateContextId'
      : 'activeContextId';

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        [metadataKey]: contextNodeId,
      }),
    });

    logger.info(`Active ${actionType || 'default'} context set to ${contextNodeId} for node ${nodeId}`, 'Context');

    triggerAutosave?.();
  }

  return {
    declareAsContext,
    removeContextDeclaration,
    applyContext,
    removeAppliedContext,
    setActiveContext,
    refreshContextDeclarations,
  };
};
