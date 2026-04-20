import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata, getParentIdOrNull } from '../../../utils/nodeHelpers';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { usePreferencesStore } from '../../preferences/preferencesStore';
import { AncestorRegistry } from '../../../utils/ancestry';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';
import { DeclareWorkflowCommand } from '../commands/DeclareWorkflowCommand';
import { RemoveWorkflowCommand } from '../commands/RemoveWorkflowCommand';
import { SetStepTypeCommand, StepType } from '../commands/SetStepTypeCommand';
import { Command } from '../commands/Command';
import { VisualEffectsActions } from './visualEffectsActions';
import {
  collectDescendantWorkflows,
  findNextStepTarget,
  findPreviousStepTarget,
} from '../../../utils/workflowHelpers';

export interface WorkflowActions {
  declareAsWorkflow: (nodeId: string) => void;
  removeFromWorkflow: (nodeId: string) => void;
  moveToNextStep: (nodeId: string) => void;
  moveToPreviousStep: (nodeId: string) => void;
  setStepType: (nodeId: string, stepType: StepType) => void;
  setDecomposition: (nodeId: string, decomposition: boolean) => void;
  setRecurse: (nodeId: string, recurse: boolean) => void;
  setClearSession: (nodeId: string, clearSession: boolean) => void;
  setArchiveSettings: (nodeId: string, settings: { archiveDestinationId?: string; archiveSideLinkName?: string; replacementSideLinkName?: string; resolveLinkedContent?: boolean }) => void;
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

    const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
    if (parentId) {
      const parent = nodes[parentId];
      if (!parent || parent.metadata.isBlueprint !== true) return;
    }

    if (node.metadata.isWorkflow === true) return;

    const command = new DeclareWorkflowCommand(
      nodeId,
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    useToastStore.getState().addToast('Declared as workflow', 'success');

    const prefs = usePreferencesStore.getState();
    if (!prefs.hasSeenWorkflowDeclarationToast) {
      useToastStore.getState().addToast(
        'All steps default to Manual. Right-click a step to change its type.',
        'info'
      );
      prefs.markWorkflowDeclarationToastSeen();
    }

    logger.info(`Node ${nodeId} declared as workflow`, 'Workflow');
  }

  function removeFromWorkflow(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node || node.metadata.isWorkflow !== true) return;

    const descendantWorkflows = collectDescendantWorkflows(nodeId, nodes);

    const command = new RemoveWorkflowCommand(
      nodeId,
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    if (descendantWorkflows.length > 0) {
      useToastStore.getState().addToast(
        'Removed workflow and nested workflows',
        'warning'
      );
    } else {
      useToastStore.getState().addToast('Removed from workflow', 'info');
    }
    logger.info(`Node ${nodeId} removed from workflow`, 'Workflow');
  }

  function expandAncestorsToStep(stepId: string): void {
    const { nodes, ancestorRegistry } = get();
    const ancestors = ancestorRegistry[stepId] || [];
    let updatedNodes = nodes;
    let needsUpdate = false;

    for (const ancestorId of ancestors) {
      const ancestor = updatedNodes[ancestorId];
      if (ancestor && ancestor.children.length > 0 && ancestor.metadata.expanded === false) {
        updatedNodes = updateNodeMetadata(updatedNodes, ancestorId, { expanded: true });
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      set({ nodes: updatedNodes });
    }
  }

  function moveToNextStep(nodeId: string): void {
    const { nodes, ancestorRegistry } = get();
    const nextStepId = findNextStepTarget(nodeId, nodes, ancestorRegistry);
    if (!nextStepId) return;

    expandAncestorsToStep(nextStepId);

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
  }

  function moveToPreviousStep(nodeId: string): void {
    const { nodes, ancestorRegistry } = get();
    const prevStepId = findPreviousStepTarget(nodeId, nodes, ancestorRegistry);
    if (!prevStepId) return;

    expandAncestorsToStep(prevStepId);

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
  }

  function setStepType(nodeId: string, stepType: StepType): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const command = new SetStepTypeCommand(
      nodeId,
      stepType,
      () => get().nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      triggerAutosave
    );

    if (executeCommand) {
      executeCommand(command);
    } else {
      command.execute();
    }

    logger.info(`Step type set to ${stepType} for node ${nodeId}`, 'Workflow');
  }

  function setDecomposition(nodeId: string, decomposition: boolean): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            decomposition,
          },
        },
      },
    });

    triggerAutosave?.();
  }

  function setRecurse(nodeId: string, recurse: boolean): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            recurse,
          },
        },
      },
    });

    triggerAutosave?.();
  }

  function setClearSession(nodeId: string, clearSession: boolean): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            clearSession,
          },
        },
      },
    });

    triggerAutosave?.();
  }

  function setArchiveSettings(nodeId: string, settings: { archiveDestinationId?: string; archiveSideLinkName?: string; replacementSideLinkName?: string; resolveLinkedContent?: boolean }): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    if (!node) return;

    set({
      nodes: {
        ...nodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            archiveDestinationId: settings.archiveDestinationId,
            archiveSideLinkName: settings.archiveSideLinkName,
            replacementSideLinkName: settings.replacementSideLinkName,
            resolveLinkedContent: settings.resolveLinkedContent,
          },
        },
      },
    });

    triggerAutosave?.();
  }

  return {
    declareAsWorkflow,
    removeFromWorkflow,
    moveToNextStep,
    moveToPreviousStep,
    setStepType,
    setDecomposition,
    setRecurse,
    setClearSession,
    setArchiveSettings,
  };
};
