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
  workflowSessionMap?: Record<string, string>;
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
    nodes?: Record<string, TreeNode>;
  }) => void;
  /** Stop any outstanding autonomous feedback-file watcher for this node. */
  cleanupAutonomousCollaboration: (nodeId: string) => void;
  /** Clear any pending step-timeout timer. */
  clearStepTimeout: (nodeId: string) => void;
  /** Clear any pending prompt-delivery ACK timer/retry for this node. */
  clearPendingAck: (nodeId: string) => void;
  /** Clear any pending /clear-confirmation timer/retry for this node. */
  clearPendingClear: (nodeId: string) => void;
  /** Release the authoritative terminal→node binding for a node so the terminal becomes free again. */
  releaseTerminalAssignmentForNode: (nodeId: string) => void;
  triggerAutosave?: () => void;
}

/**
 * Disruption reactions are how the workflow engine reacts to external
 * events that interfere with in-flight execution — a terminal being
 * closed by the user, a running node being deleted, a step being
 * removed, or a node being dragged/indented out of its workflow.
 *
 * All five handlers are self-contained state cleanups: they delete
 * entries from workflowExecutionStates and release auxiliary resources.
 * Extracted so the main factory can focus on the happy-path execution
 * state machine.
 */
export function createDisruptionReactions(deps: DisruptionReactionDeps): WorkflowDisruptionReactions {
  const { get, set, cleanupAutonomousCollaboration, clearStepTimeout, clearPendingAck, clearPendingClear, releaseTerminalAssignmentForNode, triggerAutosave } = deps;

  function handleTerminalClosed(terminalId: string): void {
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    let updatedNodes = nodes;
    let nodesChanged = false;
    let statesChanged = false;
    const releasedNodes: string[] = [];

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.terminalTabId !== terminalId || entry.state !== 'running') continue;

      delete updatedStates[nodeId];
      statesChanged = true;
      cleanupAutonomousCollaboration(nodeId);
      clearPendingAck(nodeId);
      clearPendingClear(nodeId);
      releasedNodes.push(nodeId);

      const detached = detachSessionFromTab(updatedNodes, nodeId, terminalId);
      if (detached !== updatedNodes) {
        updatedNodes = detached;
        nodesChanged = true;
      }

      const node = nodes[nodeId];
      const nodeName = node?.content || nodeId;
      const sessionDetached = updatedNodes[nodeId]?.metadata.sessionLiveness === 'alive-detached';
      const message = sessionDetached
        ? `"${nodeName}" detached — session can be resumed from another tab`
        : `"${nodeName}" stopped — terminal closed`;
      useToastStore.getState().addToast(message, 'warning');
    }

    for (const [nodeId, node] of Object.entries(updatedNodes)) {
      if (node.metadata.sessionTabId !== terminalId) continue;
      if (workflowExecutionStates[nodeId]?.state === 'running') continue;
      const detached = detachSessionFromTab(updatedNodes, nodeId, terminalId);
      if (detached !== updatedNodes) {
        updatedNodes = detached;
        nodesChanged = true;
      }
    }

    if (statesChanged || nodesChanged) {
      const partial: {
        workflowExecutionStates?: Record<string, WorkflowExecutionEntry>;
        nodes?: Record<string, TreeNode>;
      } = {};
      if (statesChanged) partial.workflowExecutionStates = updatedStates;
      if (nodesChanged) partial.nodes = updatedNodes;
      set(partial);
      for (const nodeId of releasedNodes) {
        releaseTerminalAssignmentForNode(nodeId);
      }
      if (nodesChanged) triggerAutosave?.();
    }
  }

  function detachSessionFromTab(
    nodes: Record<string, TreeNode>,
    nodeId: string,
    terminalId: string,
  ): Record<string, TreeNode> {
    const node = nodes[nodeId];
    if (!node) return nodes;
    if (node.metadata.sessionTabId !== terminalId) return nodes;

    const hasSessionId = node.metadata.sessionId !== undefined;
    const wasStarting = node.metadata.sessionStarting === true;
    if (!hasSessionId && !wasStarting) return nodes;

    const nextMetadata = {
      ...node.metadata,
      sessionLiveness: hasSessionId ? ('alive-detached' as const) : ('lost' as const),
    };
    delete nextMetadata.sessionTabId;
    delete nextMetadata.sessionStarting;
    return { ...nodes, [nodeId]: { ...node, metadata: nextMetadata } };
  }

  function handleNodeDeleted(nodeId: string): void {
    const { workflowExecutionStates } = get();
    if (!workflowExecutionStates[nodeId]) return;

    cleanupAutonomousCollaboration(nodeId);
    clearPendingAck(nodeId);
    clearPendingClear(nodeId);
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
      triggerAutosave?.();
    }
  }

  function handleNodeMovedManually(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry) return;

    clearStepTimeout(nodeId);
    cleanupAutonomousCollaboration(nodeId);
    clearPendingAck(nodeId);
    clearPendingClear(nodeId);
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
