import type { TreeNode } from '../../../../shared/types';
import type { AncestorRegistry } from '../../../utils/ancestry';
import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';
import { getParentIdOrNull } from '../../../utils/nodeHelpers';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';

interface DisruptionState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
}

export interface WorkflowDisruptionReactions {
  handleTerminalClosed: (terminalId: string) => void;
  handleNodeDeleted: (nodeId: string) => void;
  handleStepDeleted: (stepId: string) => void;
  handleAllStepsRemoved: (workflowId: string) => void;
  handleNodeMovedManually: (nodeId: string) => void;
}

export interface DisruptionReactionDeps {
  get: () => DisruptionState;
  set: (partial: {
    workflowExecutionStates?: Record<string, WorkflowExecutionEntry>;
    workflowSessionMap?: Record<string, string>;
  }) => void;
  clearStepTimeout: (nodeId: string) => void;
  clearPendingAck: (nodeId: string) => void;
  clearPendingClear: (nodeId: string) => void;
  clearPendingLaunch: (nodeId: string) => void;
  releaseTerminalAssignmentForNode: (nodeId: string) => void;
  triggerAutosave?: () => void;
}

export function createDisruptionReactions(deps: DisruptionReactionDeps): WorkflowDisruptionReactions {
  const { get, set, clearStepTimeout, clearPendingAck, clearPendingClear, clearPendingLaunch, releaseTerminalAssignmentForNode } = deps;

  function handleTerminalClosed(terminalId: string): void {
    const { workflowExecutionStates, nodes, workflowSessionMap } = get();
    const updatedStates = { ...workflowExecutionStates };
    let statesChanged = false;
    const releasedNodes: string[] = [];

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.terminalTabId !== terminalId || entry.state !== 'running') continue;

      delete updatedStates[nodeId];
      statesChanged = true;
      clearPendingAck(nodeId);
      clearPendingClear(nodeId);
      clearPendingLaunch(nodeId);
      releasedNodes.push(nodeId);

      const node = nodes[nodeId];
      const nodeName = node?.content || nodeId;
      const hasSession = typeof node?.metadata.sessionId === 'string' && node.metadata.sessionId.length > 0;
      const message = hasSession
        ? `"${nodeName}" detached — session can be resumed from another tab`
        : `"${nodeName}" stopped — terminal closed`;
      useToastStore.getState().addToast(message, 'warning');
    }

    // Remove session mapping for the closed terminal so liveness derives as alive-detached
    const updatedSessionMap = { ...workflowSessionMap };
    let sessionMapChanged = false;
    for (const [sessionId, tid] of Object.entries(updatedSessionMap)) {
      if (tid === terminalId) {
        delete updatedSessionMap[sessionId];
        sessionMapChanged = true;
      }
    }

    if (statesChanged || sessionMapChanged) {
      const partial: {
        workflowExecutionStates?: Record<string, WorkflowExecutionEntry>;
        workflowSessionMap?: Record<string, string>;
      } = {};
      if (statesChanged) partial.workflowExecutionStates = updatedStates;
      if (sessionMapChanged) partial.workflowSessionMap = updatedSessionMap;
      set(partial);
      for (const nodeId of releasedNodes) {
        releaseTerminalAssignmentForNode(nodeId);
      }
    }
  }

  function handleNodeDeleted(nodeId: string): void {
    const { workflowExecutionStates } = get();
    if (!workflowExecutionStates[nodeId]) return;

    clearPendingAck(nodeId);
    clearPendingClear(nodeId);
    clearPendingLaunch(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });
    releaseTerminalAssignmentForNode(nodeId);

    logger.info(`Cleared execution state for deleted node ${nodeId}`, 'WorkflowExecution');
  }

  function handleStepDeleted(stepId: string): void {
    const { workflowExecutionStates, ancestorRegistry } = get();
    const updatedStates = { ...workflowExecutionStates };
    const releasedNodes: string[] = [];

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.state === 'running') {
        const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
        if (parentId === stepId) {
          delete updatedStates[nodeId];
          releasedNodes.push(nodeId);
        }
      }
    }

    if (releasedNodes.length > 0) {
      set({ workflowExecutionStates: updatedStates });
      for (const nodeId of releasedNodes) {
        clearPendingLaunch(nodeId);
        releaseTerminalAssignmentForNode(nodeId);
      }
      useToastStore
        .getState()
        .addToast('Step removed — affected workflows stopped', 'warning');
    }
  }

  function handleAllStepsRemoved(workflowId: string): void {
    const { workflowExecutionStates, ancestorRegistry } = get();
    const updatedStates = { ...workflowExecutionStates };
    const completedNodes: string[] = [];

    for (const nodeId of Object.keys(updatedStates)) {
      const ancestors = ancestorRegistry[nodeId];
      if (ancestors && ancestors.includes(workflowId)) {
        delete updatedStates[nodeId];
        completedNodes.push(nodeId);
      }
    }

    if (completedNodes.length > 0) {
      set({ workflowExecutionStates: updatedStates });
      for (const nodeId of completedNodes) {
        clearPendingLaunch(nodeId);
        releaseTerminalAssignmentForNode(nodeId);
      }
      const { nodes } = get();
      for (const nodeId of completedNodes) {
        const node = nodes[nodeId];
        const nodeName = node?.content || nodeId;
        useToastStore
          .getState()
          .addToast(`Workflow complete for "${nodeName}"`, 'success');
      }
      deps.triggerAutosave?.();
    }
  }

  function handleNodeMovedManually(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry) return;

    clearStepTimeout(nodeId);
    clearPendingAck(nodeId);
    clearPendingClear(nodeId);
    clearPendingLaunch(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });
    releaseTerminalAssignmentForNode(nodeId);

    logger.info(`Cleared execution state for manually moved node ${nodeId}`, 'WorkflowExecution');
  }

  return {
    handleTerminalClosed,
    handleNodeDeleted,
    handleStepDeleted,
    handleAllStepsRemoved,
    handleNodeMovedManually,
  };
}
