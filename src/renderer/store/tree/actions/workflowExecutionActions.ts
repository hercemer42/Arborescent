import { TreeNode } from "../../../../shared/types";
import { useToastStore } from "../../toast/toastStore";
import { logger } from "../../../services/logger";
import { AncestorRegistry, moveNodeInRegistry } from "../../../utils/ancestry";
import { VisualEffectsActions } from "./visualEffectsActions";
import {
  isEligibleForExecution,
  findNextStepTarget,
  getWorkflowStepPosition,
  getWorkflowStepNumber,
  findFirstAutonomousStepInChain,
  findNextWaitingNode,
  getArchiveConfigForNode,
  isDecompositionEnabled,
  WorkflowExecutionEntry,
} from "../../../utils/workflowHelpers";
import { parseFeedbackContent } from "../../../services/feedback/feedbackService";
import { AcceptFeedbackCommand } from "../commands/AcceptFeedbackCommand";
import { StepType } from "../commands/SetStepTypeCommand";
import {
  getAppliedContextIdWithInheritance,
  resolveContextMode,
  getContextDeclarations,
} from "../../../utils/nodeHelpers";
import { usePreferencesStore } from "../../preferences/preferencesStore";
import { notifyWorkflowEvent } from "../../../services/workflowNotification";
import { findAllParentsOf, removeNodeFromAllParents } from "../../../utils/treeInvariants";
import { createStepTimeoutManager, isNodeRunning } from "./workflowStepTimeouts";
import { createDisruptionReactions } from "./workflowDisruptionReactions";
import { createHookEventHandler } from "./workflowHookEventHandler";
import { createClearSessionManager } from "./workflowClearSession";

export type { WorkflowExecutionEntry };

export interface WorkflowExecutionActions {
  startWorkflow: (nodeId: string, terminalId: string | null) => void;
  stopWorkflow: (nodeId: string) => void;
  continueWorkflow: (nodeId: string, terminalId: string | null) => void;
  completeWorkflow: (nodeId: string) => void;
  advanceNode: (nodeId: string) => void;
  registerSession: (sessionId: string, terminalId: string, source?: string) => void;
  handleHookEvent: (event: {
    session_id: string;
    hook_event_name: string;
    message?: string;
  }) => void;
  initializeExecutionState: () => void;
  handleTerminalClosed: (terminalId: string) => void;
  handleNodeDeleted: (nodeId: string) => void;
  handleStepDeleted: (stepId: string) => void;
  handleAllStepsRemoved: (workflowId: string) => void;
  handleNodeMovedManually: (nodeId: string) => void;
  handleAutonomousFeedback: (nodeId: string, content: string) => void;
  findCollaborationByFeedbackFilePath: (filePath: string) => { nodeId: string; kind: 'manual' | 'autonomous' } | null;
  registerManualCollaboration: (nodeId: string, filePath: string) => void;
  unregisterCollaboration: (nodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
  activeNodeId?: string | null;
};


export const createWorkflowExecutionActions = (
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  autonomousCollaborateInTerminal?: (nodeId: string, terminalId: string, mode?: 'collaborate' | 'execute') => Promise<string>,
  executeCommand?: (command: { execute: () => void; undo: () => void; description?: string }) => void,
): WorkflowExecutionActions => {
  const DEFAULT_STEP_TIMEOUT_MINUTES = 15;
  const MAX_RECURSE_ITERATIONS = 50;
  const ACK_TIMEOUT_MS = 5000;
  const ACK_RETRY_CAP = 3;
  const recurseCounters = new Map<string, number>();
  const feedbackCollaborations = new Map<string, { filePath: string; terminalId?: string; kind: 'manual' | 'autonomous' }>();
  const pendingAcks = new Map<string, { terminalId: string; attempts: number; timer: ReturnType<typeof setTimeout> }>();

  function clearPendingAck(nodeId: string): void {
    const entry = pendingAcks.get(nodeId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingAcks.delete(nodeId);
  }

  function registerPendingAck(nodeId: string, terminalId: string): void {
    const existing = pendingAcks.get(nodeId);
    if (existing) clearTimeout(existing.timer);
    const attempts = existing ? existing.attempts + 1 : 1;

    const timer = setTimeout(() => {
      if (attempts >= ACK_RETRY_CAP) {
        failAckRetryCap(nodeId);
      } else {
        sendContentToTerminal(nodeId, terminalId);
      }
    }, ACK_TIMEOUT_MS);

    pendingAcks.set(nodeId, { terminalId, attempts, timer });
  }

  function failAckRetryCap(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;

    clearPendingAck(nodeId);
    stopWorkflow(nodeId);

    useToastStore.getState().addToast(
      `Workflow step "${nodeName}" could not be delivered after ${ACK_RETRY_CAP} attempts. Check that UserPromptSubmit is configured in ~/.claude/settings.json.`,
      'error',
    );
    void notifyWorkflowEvent('alert', 'Workflow delivery failed', `"${nodeName}" could not be delivered`);
  }

  const clearSessionManager = createClearSessionManager({
    get,
    set,
    sendPrompt: (id, tid) => sendContentToTerminal(id, tid),
    stopWorkflow: (id) => stopWorkflow(id),
  });

  // Step-timeout lifecycle lives in its own module so the toast-action
  // callback (which loops back into stopWorkflow) has an explicit seam.
  const stepTimeouts = createStepTimeoutManager({
    getTimeoutMinutes: () =>
      usePreferencesStore.getState().stepTimeoutMinutes ?? DEFAULT_STEP_TIMEOUT_MINUTES,
    isStillRunning: (nodeId) => isNodeRunning(get().workflowExecutionStates, nodeId),
    onTimeout: (nodeId) => {
      const hasHooks = usePreferencesStore.getState().hasReceivedHookEvent;
      const message = hasHooks
        ? "Step is taking longer than expected. Verify your AI tool is running."
        : "Step is taking longer than expected. Ensure Claude Code hooks are configured for automatic advancement. See docs/workflows.md for setup.";
      useToastStore.getState().addToast(message, "warning", {
        actions: [
          { label: "Dismiss", onClick: () => {} },
          { label: "Stop", onClick: () => stopWorkflow(nodeId) },
        ],
      });
      void notifyWorkflowEvent("alert", "Step timeout", message);
    },
  });

  function findRunningNodeOnTerminal(terminalId: string): string | null {
    const { workflowExecutionStates } = get();
    for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
      if (entry.state === "running" && entry.terminalTabId === terminalId) {
        return nodeId;
      }
    }
    return null;
  }

  function startWorkflow(nodeId: string, terminalId: string | null): void {
    if (terminalId === null) {
      useToastStore
        .getState()
        .addToast(
          "No terminal tab available. Open a terminal to start workflow execution.",
          "warning",
        );
      return;
    }

    const { nodes, ancestorRegistry, workflowExecutionStates } = get();

    if (
      !isEligibleForExecution(
        nodeId,
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
      )
    ) {
      return;
    }

    const existingNodeId = findRunningNodeOnTerminal(terminalId);
    if (existingNodeId && existingNodeId !== nodeId) {
      useToastStore
        .getState()
        .addToast(
          "Terminal tab is already assigned to a running workflow node.",
          "warning",
        );
      return;
    }

    const prefsState = usePreferencesStore.getState();
    if (!prefsState.hasLaunchedWorkflow) {
      prefsState.markWorkflowLaunched();
      useToastStore
        .getState()
        .addToast(
          "First workflow launch! Please verify that Claude Code hooks are configured for automatic step advancement. See docs/workflows.md for setup instructions.",
          "info",
          { persistent: true, actions: [{ label: "OK", onClick: () => {} }] },
        );
    }

    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { state: "running" as const, terminalTabId: terminalId },
      },
    });

    stepTimeouts.start(nodeId);
    clearSessionManager.maybeClearThenSend(nodeId, terminalId);
    logger.info(
      `Started workflow execution for node ${nodeId} on terminal ${terminalId}`,
      "WorkflowExecution",
    );
    triggerAutosave?.();
  }

  function stopWorkflow(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== "running") return;

    stepTimeouts.clear(nodeId);
    cleanupAutonomousCollaboration(nodeId);
    clearPendingAck(nodeId);
    clearSessionManager.clearPending(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });

    logger.info(
      `Stopped workflow execution for node ${nodeId}`,
      "WorkflowExecution",
    );
  }

  function continueWorkflow(nodeId: string, terminalId: string | null): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== "awaiting-validation") return;

    if (terminalId === null) {
      useToastStore
        .getState()
        .addToast(
          "No terminal tab available. Open a terminal to continue workflow execution.",
          "warning",
        );
      return;
    }

    const existingNodeId = findRunningNodeOnTerminal(terminalId);
    if (existingNodeId && existingNodeId !== nodeId) {
      useToastStore
        .getState()
        .addToast(
          "Terminal tab is already assigned to a running workflow node.",
          "warning",
        );
      return;
    }

    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { state: "running", terminalTabId: terminalId },
      },
    });

    logger.info(
      `Continuing workflow execution for node ${nodeId} on terminal ${terminalId}`,
      "WorkflowExecution",
    );

    advanceNode(nodeId);
  }

  function checkRecurse(stepId: string, terminalId: string): void {
    const { nodes, ancestorRegistry, workflowExecutionStates } = get();
    const stepNode = nodes[stepId];
    if (!stepNode || stepNode.metadata.recurse !== true) return;

    const firstStepId = findFirstAutonomousStepInChain(stepId, nodes, ancestorRegistry);
    if (!firstStepId) return;

    const nextNodeId = findNextWaitingNode(firstStepId, nodes, workflowExecutionStates);
    if (!nextNodeId) {
      recurseCounters.delete(terminalId);
      return;
    }

    const counter = recurseCounters.get(terminalId) || 0;
    if (counter >= MAX_RECURSE_ITERATIONS) {
      useToastStore
        .getState()
        .addToast("Recurse limit reached — stopping automatic processing", "warning");
      void notifyWorkflowEvent("alert", "Recurse limit reached", "Stopping automatic processing");
      recurseCounters.delete(terminalId);
      return;
    }

    recurseCounters.set(terminalId, counter + 1);
    setTimeout(() => startWorkflow(nextNodeId, terminalId), 2000);
  }

  function completeWorkflow(nodeId: string): void {
    stepTimeouts.clear(nodeId);
    const { workflowExecutionStates, nodes, ancestorRegistry } = get();
    const entry = workflowExecutionStates[nodeId];
    const terminalId = entry?.terminalTabId;
    const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);

    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];

    set({ workflowExecutionStates: updatedStates });

    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;
    useToastStore
      .getState()
      .addToast(`Workflow complete for "${nodeName}"`, "success");
    void notifyWorkflowEvent("success", "Workflow complete", nodeName);

    logger.info(
      `Completed workflow execution for node ${nodeId}`,
      "WorkflowExecution",
    );
    triggerAutosave?.();

    if (position && terminalId) {
      checkRecurse(position.currentStepId, terminalId);
    }
  }

  function advanceNode(nodeId: string): void {
    const { workflowExecutionStates, nodes, ancestorRegistry } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== "running") return;

    const nextStepId = findNextStepTarget(nodeId, nodes, ancestorRegistry);

    if (!nextStepId) {
      completeWorkflow(nodeId);
      return;
    }

    const actualParentIds = findAllParentsOf(nodes, nodeId);
    let updatedNodes = removeNodeFromAllParents(nodes, nodeId);

    if (!updatedNodes[nextStepId].children.includes(nodeId)) {
      updatedNodes = {
        ...updatedNodes,
        [nextStepId]: {
          ...updatedNodes[nextStepId],
          children: [...updatedNodes[nextStepId].children, nodeId],
        },
      };
    }

    const updatedRegistry = moveNodeInRegistry(
      ancestorRegistry,
      nodeId,
      nextStepId,
      updatedNodes,
    );

    set({
      nodes: updatedNodes,
      ancestorRegistry: updatedRegistry,
    });

    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;
    const stepNumber = getWorkflowStepNumber(
      nextStepId,
      updatedNodes,
      updatedRegistry,
    );
    const stepLabel = stepNumber !== null ? `Step ${stepNumber}` : "next step";

    const nextStepNode = updatedNodes[nextStepId];
    const nextStepType: StepType =
      (nextStepNode?.metadata.stepType as StepType) || "manual";

    visualEffects?.flashNode(nodeId, "advance");
    triggerAutosave?.();

    if (nextStepType === "manual") {
      stopWorkflow(nodeId);
      useToastStore
        .getState()
        .addToast(`"${nodeName}" waiting at ${stepLabel}`, "info");
    } else {
      useToastStore
        .getState()
        .addToast(`Advanced "${nodeName}" to ${stepLabel}`, "info");
      stepTimeouts.start(nodeId);
      setTimeout(
        () => clearSessionManager.maybeClearThenSend(nodeId, entry.terminalTabId),
        1000,
      );
    }

    const previousParentId = actualParentIds[0];
    if (previousParentId) {
      checkRecurse(previousParentId, entry.terminalTabId);
    }
  }

  function sendContentToTerminal(nodeId: string, terminalId: string): void {
    try {
      const { nodes, ancestorRegistry } = get();
      const node = nodes[nodeId];
      if (!node) return;

      const contextId = getAppliedContextIdWithInheritance(
        nodeId,
        nodes,
        ancestorRegistry,
      );
      const contextDeclarations = getContextDeclarations(nodes);
      const mode = resolveContextMode(contextId, nodes, contextDeclarations);

      if (!autonomousCollaborateInTerminal) return;

      if (contextId && mode === "collaborate") {
        setCollaboratingFlag(nodeId);
      }

      autonomousCollaborateInTerminal(nodeId, terminalId, mode).then((feedbackFilePath) => {
        if (feedbackFilePath) {
          registerAutonomousCollaboration(nodeId, terminalId, feedbackFilePath);
          registerPendingAck(nodeId, terminalId);
        }
      }).catch((error) => {
        logger.error(
          "Failed to send to terminal",
          error as Error,
          "WorkflowExecution",
        );
        stopWorkflow(nodeId);
        useToastStore
          .getState()
          .addToast("Failed to send to terminal — workflow stopped", "error");
        void notifyWorkflowEvent("alert", "Workflow error", "Failed to send to terminal");
      });
    } catch (error) {
      logger.error(
        "Failed to build terminal content",
        error as Error,
        "WorkflowExecution",
      );
      stopWorkflow(nodeId);
      useToastStore
        .getState()
        .addToast("Failed to send to terminal — workflow stopped", "error");
      void notifyWorkflowEvent("alert", "Workflow error", "Failed to send to terminal");
    }
  }

  function registerSession(sessionId: string, terminalId: string, source?: string): void {
    const { workflowSessionMap } = get();

    const updatedMap = { ...workflowSessionMap };
    for (const [existingSession, existingTerminal] of Object.entries(
      updatedMap,
    )) {
      if (existingTerminal === terminalId) {
        delete updatedMap[existingSession];
      }
    }

    updatedMap[sessionId] = terminalId;
    set({ workflowSessionMap: updatedMap });

    if (!usePreferencesStore.getState().hasReceivedHookEvent) {
      usePreferencesStore.getState().markHookEventReceived();
    }

    logger.info(
      `Registered session ${sessionId} for terminal ${terminalId}${source ? ` (source=${source})` : ''}`,
      "WorkflowExecution",
    );

    if (source === 'clear') {
      const runningNodeId = findRunningNodeOnTerminal(terminalId);
      if (runningNodeId) {
        clearSessionManager.onClearConfirmed(runningNodeId);
      }
    }
  }

  const handleHookEvent = createHookEventHandler({
    get,
    set,
    findRunningNodeOnTerminal,
    clearStepTimeout: stepTimeouts.clear,
    clearPendingAck,
    advanceNode,
    completeWorkflow,
    stopWorkflow,
  });

  function initializeExecutionState(): void {
    const { workflowExecutionStates } = get();
    let stoppedCount = 0;
    const updatedStates: Record<string, WorkflowExecutionEntry> = {};

    for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
      if (entry.state === "running") {
        stoppedCount++;
      } else {
        updatedStates[nodeId] = entry;
      }
    }

    // Clean up all autonomous collaborations on restart
    for (const nodeId of Array.from(feedbackCollaborations.keys())) {
      cleanupAutonomousCollaboration(nodeId);
    }

    for (const nodeId of Array.from(pendingAcks.keys())) {
      clearPendingAck(nodeId);
    }

    clearSessionManager.clearAllPending();

    set({
      workflowExecutionStates: updatedStates,
      workflowSessionMap: {},
    });

    if (stoppedCount > 0) {
      useToastStore
        .getState()
        .addToast(`${stoppedCount} workflow(s) stopped on restart.`, "warning");
    }

    logger.info(
      `Initialized execution state, stopped ${stoppedCount} workflows`,
      "WorkflowExecution",
    );
  }

  const disruptionReactions = createDisruptionReactions({
    get,
    set,
    cleanupAutonomousCollaboration: (nodeId) => cleanupAutonomousCollaboration(nodeId),
    clearStepTimeout: stepTimeouts.clear,
    clearPendingAck,
    clearPendingClear: clearSessionManager.clearPending,
    triggerAutosave,
  });

  function setCollaboratingFlag(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry) return;

    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { ...entry, collaborating: true },
      },
    });
  }

  function registerAutonomousCollaboration(nodeId: string, terminalId: string, feedbackFilePath: string): void {
    feedbackCollaborations.set(nodeId, { filePath: feedbackFilePath, terminalId, kind: 'autonomous' });
  }

  function registerManualCollaboration(nodeId: string, feedbackFilePath: string): void {
    feedbackCollaborations.set(nodeId, { filePath: feedbackFilePath, kind: 'manual' });
  }

  function unregisterCollaboration(nodeId: string): void {
    feedbackCollaborations.delete(nodeId);
  }

  function cleanupAutonomousCollaboration(nodeId: string): void {
    const collab = feedbackCollaborations.get(nodeId);
    if (collab && collab.kind === 'autonomous') {
      void window.electron.stopFeedbackFileWatcher(collab.filePath);
      feedbackCollaborations.delete(nodeId);
    }
  }

  function findCollaborationByFeedbackFilePath(filePath: string): { nodeId: string; kind: 'manual' | 'autonomous' } | null {
    const incomingBasename = filePath.split(/[\\/]/).pop() ?? filePath;

    for (const [nodeId, collab] of feedbackCollaborations.entries()) {
      const basename = collab.filePath.split(/[\\/]/).pop() ?? collab.filePath;
      if (filePath === collab.filePath || basename === incomingBasename || filePath.endsWith(collab.filePath)) {
        return { nodeId, kind: collab.kind };
      }
    }
    return null;
  }

  function advanceOrClearCollaborating(nodeId: string): void {
    const currentEntry = get().workflowExecutionStates[nodeId];
    if (currentEntry?.stopReceived) {
      advanceNode(nodeId);
    } else if (currentEntry) {
      const { workflowExecutionStates: states } = get();
      set({
        workflowExecutionStates: {
          ...states,
          [nodeId]: { ...states[nodeId], collaborating: false },
        },
      });
    }
  }

  function handleAutonomousFeedback(nodeId: string, content: string): void {
    const { workflowExecutionStates, nodes, ancestorRegistry } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || !nodes[nodeId]) {
      cleanupAutonomousCollaboration(nodeId);
      return;
    }

    const decomposition = isDecompositionEnabled(nodeId, nodes, ancestorRegistry);
    const parsed = parseFeedbackContent(content, decomposition);

    if (!parsed) {
      logger.error(
        `Failed to parse autonomous feedback for node ${nodeId}`,
        new Error("Feedback parse failure"),
        "WorkflowExecution",
      );
      stopWorkflow(nodeId);
      cleanupAutonomousCollaboration(nodeId);
      useToastStore
        .getState()
        .addToast("Feedback could not be parsed — workflow stopped", "error");
      void notifyWorkflowEvent("alert", "Feedback parse error", "Feedback could not be parsed");
      return;
    }

    // Guard against the AI writing the CONTEXT tree instead of the CONTENT
    // list back to the temp file. Without this check, AcceptFeedbackCommand
    // would silently swap the workflow node with the context how-to. We only
    // enforce it for non-decomposition steps since decomposition legitimately
    // produces roots whose content differs from the single input.
    if (!decomposition) {
      const parsedRoot = parsed.nodes[parsed.rootNodeId];
      const originalContent = nodes[nodeId].content;
      if (parsedRoot && parsedRoot.content !== originalContent) {
        logger.error(
          `Content-root mismatch on auto-accept for node ${nodeId}: parsed "${parsedRoot.content}" vs original "${originalContent}"`,
          new Error("Feedback root mismatch"),
          "WorkflowExecution",
        );
        stopWorkflow(nodeId);
        cleanupAutonomousCollaboration(nodeId);
        useToastStore
          .getState()
          .addToast(
            "Auto-accept rejected — feedback root does not match the node. Workflow stopped.",
            "error",
          );
        void notifyWorkflowEvent(
          "alert",
          "Feedback root mismatch",
          "AI returned a different root than the node — accept was rejected",
        );
        return;
      }
    }

    const archiveConfig = getArchiveConfigForNode(nodeId, nodes, ancestorRegistry);
    const rootNodeIdOrIds = decomposition && parsed.rootNodeIds.length > 1
      ? parsed.rootNodeIds
      : parsed.rootNodeId;

    // AcceptFeedbackCommand sets activeNodeId to the accepted root, which
    // via useNodeCursor calls .focus() and triggers a browser scrollIntoView.
    // Capture the user's prior focus so it can be restored after the command
    // when the user was not already watching this specific running node.
    const priorActiveNodeId = get().activeNodeId ?? null;

    if (executeCommand) {
      const getStateForCommand = () => ({
        ...get(),
        blueprintModeEnabled: false,
      });
      executeCommand(
        new AcceptFeedbackCommand(
          nodeId,
          rootNodeIdOrIds,
          parsed.nodes,
          getStateForCommand,
          set,
          triggerAutosave,
          archiveConfig,
        ),
      );

      if (priorActiveNodeId !== nodeId) {
        set({ activeNodeId: priorActiveNodeId });
      }
    }

    cleanupAutonomousCollaboration(nodeId);
    useToastStore.getState().addToast("Feedback auto-accepted", "info");
    logger.info(`Auto-accepted feedback for node ${nodeId} (${parsed.nodeCount} nodes)`, "WorkflowExecution");

    advanceOrClearCollaborating(nodeId);
  }

  return {
    startWorkflow,
    stopWorkflow,
    continueWorkflow,
    completeWorkflow,
    advanceNode,
    registerSession,
    handleHookEvent,
    initializeExecutionState,
    ...disruptionReactions,
    handleAutonomousFeedback,
    findCollaborationByFeedbackFilePath,
    registerManualCollaboration,
    unregisterCollaboration,
  };
};
