import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { AncestorRegistry } from '../../../services/ancestry';
import { BlueprintCommand } from '../commands/BlueprintCommand';
import { Command } from '../commands/Command';

export const DEFAULT_BLUEPRINT_ICON = 'Layers2';

export interface BlueprintActions {
  addToBlueprint: (nodeId: string) => void;
  removeFromBlueprint: (nodeId: string, cascade?: boolean) => void;
  setBlueprintIcon: (nodeId: string, icon: string, color?: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

export const createBlueprintActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void,
  executeCommand?: (command: Command) => void
): BlueprintActions => {
  function runBlueprintCommand(nodeId: string, action: 'add' | 'remove', cascade: boolean): void {
    const command = new BlueprintCommand(
      nodeId,
      action,
      cascade,
      () => get().nodes,
      () => get().rootNodeId,
      () => get().ancestorRegistry,
      (nodes) => set({ nodes }),
      triggerAutosave
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }
  }

  function addToBlueprint(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    if (node.metadata.isBlueprint === true) {
      useToastStore.getState().addToast('Node is already a blueprint', 'info');
      return;
    }

    runBlueprintCommand(nodeId, 'add', false);

    useToastStore.getState().addToast('Added to blueprint', 'success');
    logger.info(`Node ${nodeId} added to blueprint`, 'Blueprint');
  }

  function removeFromBlueprint(nodeId: string, cascade: boolean = false): void {
    const { nodes, rootNodeId } = get();
    const node = nodes[nodeId];
    if (!node) return;

    if (nodeId === rootNodeId) {
      useToastStore.getState().addToast('Cannot remove root from blueprint', 'error');
      return;
    }

    if (node.metadata.isBlueprint !== true) {
      return;
    }

    runBlueprintCommand(nodeId, 'remove', cascade);

    useToastStore.getState().addToast('Removed from blueprint', 'info');
    logger.info(`Node ${nodeId} removed from blueprint${cascade ? ' (with descendants)' : ''}`, 'Blueprint');
  }

  function setBlueprintIcon(nodeId: string, icon: string, color?: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: updateNodeMetadata(nodes, nodeId, {
        blueprintIcon: icon,
        blueprintColor: color,
      }),
    });

    logger.info(`Blueprint icon updated to ${icon} for node ${nodeId}`, 'Blueprint');
    triggerAutosave?.();
  }

  return {
    addToBlueprint,
    removeFromBlueprint,
    setBlueprintIcon,
  };
};
