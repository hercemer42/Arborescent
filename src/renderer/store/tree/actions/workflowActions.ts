import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { AncestorRegistry } from '../../../utils/ancestry';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';
import { Command } from '../commands/Command';
import { VisualEffectsActions } from './visualEffectsActions';
import {
  hasAncestorWorkflow,
  hasDescendantWorkflow,
  getWorkflowStepPosition,
} from '../../../utils/workflowHelpers';

export interface WorkflowActions {
  declareAsWorkflow: (nodeId: string) => void;
  removeFromWorkflow: (nodeId: string) => void;
  moveToNextStep: (nodeId: string) => void;
  moveToPreviousStep: (nodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

export const createWorkflowActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void,
  executeCommand?: (command: Command) => void,
  visualEffects?: VisualEffectsActions
): WorkflowActions => {

  function declareAsWorkflow(nodeId: string): void {
    const { nodes, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const parentId = ancestors[ancestors.length - 1];
    if (parentId) {
      const parent = nodes[parentId];
      if (!parent || parent.metadata.isBlueprint !== true) return;
    }

    if (hasAncestorWorkflow(nodeId, nodes, ancestorRegistry)) return;
    if (hasDescendantWorkflow(nodeId, nodes)) return;
    if (node.metadata.isWorkflow === true) return;

    let updatedNodes = updateNodeMetadata(get().nodes, nodeId, {
      isBlueprint: true,
      isWorkflow: true,
    });

    for (const childId of node.children) {
      const child = updatedNodes[childId];
      if (child && child.metadata.isBlueprint !== true) {
        updatedNodes = updateNodeMetadata(updatedNodes, childId, {
          isBlueprint: true,
        });
      }
    }

    set({ nodes: updatedNodes });

    useToastStore.getState().addToast('Declared as workflow', 'success');
    logger.info(`Node ${nodeId} declared as workflow`, 'Workflow');
    triggerAutosave?.();
  }

  function removeFromWorkflow(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node || node.metadata.isWorkflow !== true) return;

    set({
      nodes: updateNodeMetadata(get().nodes, nodeId, {
        isWorkflow: undefined,
      }),
    });

    useToastStore.getState().addToast('Removed from workflow', 'info');
    logger.info(`Node ${nodeId} removed from workflow`, 'Workflow');
    triggerAutosave?.();
  }

  function moveToNextStep(nodeId: string): void {
    const { nodes, ancestorRegistry } = get();
    const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
    if (!position) return;

    const { workflowNodeId, currentStepIndex, totalSteps } = position;
    if (currentStepIndex >= totalSteps - 1) return;

    const workflow = nodes[workflowNodeId];
    const nextStepId = workflow.children[currentStepIndex + 1];

    const command = new MoveNodeCommand(
      nodeId,
      nextStepId,
      0,
      get,
      (partial) => set(partial),
      triggerAutosave
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    visualEffects?.flashNode(nodeId);
    visualEffects?.scrollToNode(nodeId);
  }

  function moveToPreviousStep(nodeId: string): void {
    const { nodes, ancestorRegistry } = get();
    const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
    if (!position) return;

    const { workflowNodeId, currentStepIndex } = position;
    if (currentStepIndex <= 0) return;

    const workflow = nodes[workflowNodeId];
    const prevStepId = workflow.children[currentStepIndex - 1];

    const command = new MoveNodeCommand(
      nodeId,
      prevStepId,
      0,
      get,
      (partial) => set(partial),
      triggerAutosave
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    visualEffects?.flashNode(nodeId);
    visualEffects?.scrollToNode(nodeId);
  }

  return {
    declareAsWorkflow,
    removeFromWorkflow,
    moveToNextStep,
    moveToPreviousStep,
  };
};
