import { TreeNode } from '../../../../shared/types';
import {
  updateNodeMetadata,
  getParentIdOrNull,
  BASIC_EXECUTE_CONTEXT_ID,
  BASIC_REVIEW_CONTEXT_ID,
  ContextFlags,
} from '../../../utils/nodeHelpers';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import type { ContextDeclarationInfo, ContextMode } from '../treeStore';
import { AncestorRegistry } from '../../../utils/ancestry';
import { Command } from '../commands/Command';
import { DeclareContextCommand } from '../commands/DeclareContextCommand';
import { RemoveContextCommand } from '../commands/RemoveContextCommand';

export interface ContextActions {
  declareAsContext: (nodeId: string, icon?: string, color?: string, mode?: ContextMode) => void;
  declareAsContextWithFlags: (nodeId: string, icon?: string, color?: string, flags?: ContextFlags) => void;
  removeContextDeclaration: (nodeId: string) => void;
  applyContext: (nodeId: string, contextNodeId: string) => void;
  removeAppliedContext: (nodeId: string, contextNodeId?: string) => void;
  setAppliedContext: (nodeId: string, contextNodeId: string | null) => void;
  refreshContextDeclarations: () => void;
}

function modeToFlags(mode: ContextMode | undefined): ContextFlags {
  if (mode === 'execute') return { collaborate: true, execute: true };
  return { collaborate: true, execute: false };
}

function buildContextDeclarations(nodes: Record<string, TreeNode>): ContextDeclarationInfo[] {
  return Object.values(nodes)
    .filter(node => node.metadata.isContextDeclaration === true)
    .map(node => ({
      nodeId: node.id,
      content: node.content || 'Untitled context',
      icon: (node.metadata.blueprintIcon as string) || 'lightbulb',
      color: node.metadata.blueprintColor as string | undefined,
      collaborate: node.metadata.collaborate === true,
      execute: node.metadata.execute === true,
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

  function declareAsContextWithFlags(nodeId: string, icon?: string, color?: string, flags?: ContextFlags): void {
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
    const resolvedFlags = flags ?? { collaborate: true, execute: false };

    const command = new DeclareContextCommand(
      nodeId,
      blueprintIcon,
      blueprintColor,
      resolvedFlags,
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

  function declareAsContext(nodeId: string, icon?: string, color?: string, mode?: ContextMode): void {
    declareAsContextWithFlags(nodeId, icon, color, modeToFlags(mode));
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

    const isSyntheticBuiltIn =
      contextNodeId === BASIC_EXECUTE_CONTEXT_ID || contextNodeId === BASIC_REVIEW_CONTEXT_ID;
    if (contextNodeId !== null && !isSyntheticBuiltIn && !nodes[contextNodeId]) {
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
    declareAsContextWithFlags,
    removeContextDeclaration,
    applyContext,
    removeAppliedContext,
    setAppliedContext,
    refreshContextDeclarations,
  };
};
