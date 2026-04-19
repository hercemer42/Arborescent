import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata, BASIC_EXECUTE_CONTEXT_ID, getParentIdOrNull } from '../../../utils/nodeHelpers';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { ContextDeclarationInfo, ContextMode } from '../treeStore';
import { AncestorRegistry } from '../../../utils/ancestry';
import { Command } from '../commands/Command';
import { DeclareContextCommand } from '../commands/DeclareContextCommand';
import { RemoveContextCommand } from '../commands/RemoveContextCommand';

export interface ContextActions {
  declareAsContext: (nodeId: string, icon?: string, color?: string, mode?: ContextMode) => void;
  removeContextDeclaration: (nodeId: string) => void;
  applyContext: (nodeId: string, contextNodeId: string) => void;
  removeAppliedContext: (nodeId: string, contextNodeId?: string) => void;
  setAppliedContext: (nodeId: string, contextNodeId: string | null) => void;
  refreshContextDeclarations: () => void;
}

function buildContextDeclarations(nodes: Record<string, TreeNode>): ContextDeclarationInfo[] {
  return Object.values(nodes)
    .filter(node => node.metadata.isContextDeclaration === true)
    .map(node => ({
      nodeId: node.id,
      content: node.content || 'Untitled context',
      icon: (node.metadata.blueprintIcon as string) || 'lightbulb',
      color: node.metadata.blueprintColor as string | undefined,
      mode: (node.metadata.contextMode as ContextMode) || 'collaborate',
    }))
    .sort((a, b) => a.content.localeCompare(b.content));
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
  triggerAutosave?: () => void,
  executeCommand?: (command: Command) => void
): ContextActions => {
  function refreshContextDeclarations(): void {
    set({ contextDeclarations: buildContextDeclarations(get().nodes) });
  }

  function declareAsContext(nodeId: string, icon?: string, color?: string, mode?: ContextMode): void {
    const { nodes, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
    const parent = parentId ? nodes[parentId] : null;
    if (!parent || parent.metadata.isBlueprint !== true) {
      useToastStore.getState().addToast('Can only declare context on branches with a blueprint parent', 'error');
      return;
    }

    const blueprintIcon = icon || 'lightbulb';
    const blueprintColor = color || undefined;
    const contextMode = mode || 'collaborate';

    const command = new DeclareContextCommand(
      nodeId,
      blueprintIcon,
      blueprintColor,
      contextMode,
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave,
      refreshContextDeclarations
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    logger.info(`Node ${nodeId} declared as context with icon ${blueprintIcon}`, 'Context');
  }

  function removeContextDeclaration(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const command = new RemoveContextCommand(
      nodeId,
      () => get().nodes,
      () => get().ancestorRegistry,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave,
      refreshContextDeclarations
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    useToastStore.getState().addToast('Context declaration removed', 'info');
    logger.info(`Context declaration removed from node ${nodeId}`, 'Context');
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

  function setAppliedContext(nodeId: string, contextNodeId: string | null): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    if (contextNodeId !== null && contextNodeId !== BASIC_EXECUTE_CONTEXT_ID && !nodes[contextNodeId]) {
      useToastStore.getState().addToast('Context does not exist', 'error');
      return;
    }

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        appliedContextId: contextNodeId === null ? undefined : contextNodeId,
      }),
    });

    if (contextNodeId === null) {
      logger.info(`Applied context cleared for node ${nodeId}`, 'Context');
    } else {
      logger.info(`Applied context set to ${contextNodeId} for node ${nodeId}`, 'Context');
    }

    triggerAutosave?.();
  }

  return {
    declareAsContext,
    removeContextDeclaration,
    applyContext,
    removeAppliedContext,
    setAppliedContext,
    refreshContextDeclarations,
  };
};
