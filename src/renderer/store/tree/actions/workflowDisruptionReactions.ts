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
  set: (partial: { workflowExecutionStates?: Record<string, WorkflowExecutionEntry> }) => void;
  /** Stop any outstanding autonomous feedback-file watcher for this node. */
  cleanupAutonomousCollaboration: (nodeId: string) => void;
  /** Clear any pending step-timeout timer. */
  clearStepTimeout: (nodeId: string) => void;
  /** Clear any pending prompt-delivery ACK timer/retry for this node. */
  clearPendingAck: (nodeId: string) => void;
  /** Clear any pending /clear-confirmation timer/retry for this node. */
  clearPendingClear: (nodeId: string) => void;
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
  const { get, set, cleanupAutonomousCollaboration, clearStepTimeout, clearPendingAck, clearPendingClear, triggerAutosave } = deps;

  function handleTerminalClosed(terminalId: string): void {
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.terminalTabId === terminalId && entry.state === 'running') {
        delete updatedStates[nodeId];
        cleanupAutonomousCollaboration(nodeId);
        clearPendingAck(nodeId);
        clearPendingClear(nodeId);
        const node = nodes[nodeId];
        const nodeName = node?.content || nodeId;
        useToastStore
          .getState()
          .addToast(`"${nodeName}" stopped — terminal closed`, 'warning');
        changed = true;
      }
    }

    if (changed) {
      set({ workflowExecutionStates: updatedStates });
    }
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

    logger.info(`Cleared execution state for deleted node ${nodeId}`, 'WorkflowExecution');
  }

  function handleStepDeleted(stepId: string): void {
    const { workflowExecutionStates, ancestorRegistry } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.state === 'running') {
        const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
        if (parentId === stepId) {
          delete updatedStates[nodeId];
          changed = true;
        }
      }
    }

    if (changed) {
      set({ workflowExecutionStates: updatedStates });
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
