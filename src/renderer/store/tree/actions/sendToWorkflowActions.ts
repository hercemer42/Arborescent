import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry } from '../../../utils/ancestry';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';
import { Command } from '../commands/Command';
import { VisualEffectsActions } from './visualEffectsActions';
import { expandCollapsedAncestors } from '../../../utils/nodeExpansion';

export interface SendToWorkflowActions {
  moveNodeToWorkflow: (sourceNodeId: string, destWorkflowId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

export function createSendToWorkflowActions(
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  executeCommand?: (command: Command) => void,
): SendToWorkflowActions {
  function moveNodeToWorkflow(sourceNodeId: string, destWorkflowId: string): void {
    const state = get();
    const sourceNode = state.nodes[sourceNodeId];
    if (!sourceNode) return;

    const destWorkflow = state.nodes[destWorkflowId];
    if (!destWorkflow || destWorkflow.metadata.isWorkflow !== true) return;

    if (destWorkflowId === sourceNodeId) return;
    const destAncestors = state.ancestorRegistry[destWorkflowId] || [];
    if (destAncestors.includes(sourceNodeId)) return;

    const firstStepId = destWorkflow.children[0];
    if (!firstStepId) return;

    const command = new MoveNodeCommand(
      sourceNodeId,
      firstStepId,
      0,
      () => {
        const fresh = get();
        return {
          nodes: fresh.nodes,
          rootNodeId: fresh.rootNodeId,
          ancestorRegistry: fresh.ancestorRegistry,
        };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave,
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    const fresh = get();
    const expansion = expandCollapsedAncestors(fresh.nodes, fresh.ancestorRegistry, sourceNodeId);
    if (expansion.changed) {
      set({ nodes: expansion.nodes });
    }

    visualEffects?.scrollToNode(sourceNodeId);
    visualEffects?.flashNode(sourceNodeId);
  }

  return { moveNodeToWorkflow };
}
