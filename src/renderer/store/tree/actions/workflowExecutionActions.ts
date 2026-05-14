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
  findNextDecomposedSibling,
  findDecompositionStepInWorkflow,
  getArchiveConfigForNode,
  isDecompositionEnabled,
  WorkflowExecutionEntry,
} from "../../../utils/workflowHelpers";
import { getParentIdOrNull } from "../../../utils/parentLookup";
import { parseFeedbackContent } from "../../../services/feedback/feedbackService";
import { AcceptFeedbackCommand } from "../commands/AcceptFeedbackCommand";
import { StepType } from "../commands/SetStepTypeCommand";
import {
  getAppliedContextIdWithInheritance,
  resolveContextFlags,
  getContextDeclarations,
} from "../../../utils/nodeHelpers";
import { usePreferencesStore } from "../../preferences/preferencesStore";
import { notifyWorkflowEvent } from "../../../services/workflowNotification";
import { findAllParentsOf, removeNodeFromAllParents } from "../../../utils/treeInvariants";
import { createStepTimeoutManager, isNodeRunning } from "./workflowStepTimeouts";
import { createDisruptionReactions } from "./workflowDisruptionReactions";
import { createHookEventHandler } from "./workflowHookEventHandler";
import { createClearSessionManager } from "./workflowClearSession";
import { createClaudeLaunchManager } from "./workflowClaudeLaunch";
import {
  createSessionResumeManager,
  captureSessionOnNode,
  clearBrokenChainOnNode,
  inheritSessionOnNode,
  markBrokenChainOnNode,
} from "./workflowSessionResume";
import { decideWorkflowStartRoute } from "../../../utils/workflowStartRoute";
import { useTerminalStore } from "../../terminal/terminalStore";

export type { WorkflowExecutionEntry };

export interface WorkflowExecutionActions {
  startWorkflow: (nodeId: string, terminalId: string | null) => Promise<void>;
  stopWorkflow: (nodeId: string) => void;
  continueWorkflow: (nodeId: string, terminalId: string | null) => void;
  resendStep: (nodeId: string, terminalId: string | null) => void;
  completeWorkflow: (nodeId: string) => void;
  advanceNode: (nodeId: string) => void;
  registerSession: (sessionId: string, terminalId: string, source?: string) => void;
  resumeSession: (nodeId: string) => Promise<void>;
  handleHookEvent: (event: {
    session_id: string;
    hook_event_name: string;
    message?: string;
    terminal_id?: string;
    source?: string;
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
  sessionRegistry: Record<string, { cwd: string }>;
  terminalNodeAssignments?: Record<string, string>;
  activeNodeId?: string | null;
};


export const createWorkflowExecutionActions = (
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  autonomousCollaborateInTerminal?: (nodeId: string, terminalId: string, flags?: import('../../../utils/nodeHelpers').ContextFlags) => Promise<string>,
  executeCommand?: (command: { execute: () => void; undo: () => void; description?: string }) => void,
): WorkflowExecutionActions => {
  const DEFAULT_STEP_TIMEOUT_MINUTES = 15;
  const MAX_RECURSE_ITERATIONS = 50;
  const ACK_TIMEOUT_MS = 5000;
  const ACK_RETRY_CAP = 3;
  const recurseCounters = new Map<string, number>();
  const recurseWithoutDecompositionWarned = new Set<string>();
  const feedbackCollaborations = new Map<string, { filePath: string; terminalId?: string; kind: 'manual' | 'autonomous' }>();
  const pendingAcks = new Map<string, { terminalId: string; attempts: number; timer: ReturnType<typeof setTimeout> }>();
  // ACKs that arrived before their pending entry was registered (the
  // autonomousCollaborate promise had not yet resolved). Prevents the
  // late-registered timer from firing a spurious retry.
  const preconsumedAcks = new Set<string>();

  function clearPendingAck(nodeId: string): void {
    const entry = pendingAcks.get(nodeId);
    if (entry) {
      clearTimeout(entry.timer);
      pendingAcks.delete(nodeId);
    }
    preconsumedAcks.delete(nodeId);
  }

  function consumePendingAck(nodeId: string): void {
    const entry = pendingAcks.get(nodeId);
    if (entry) {
      clearTimeout(entry.timer);
      pendingAcks.delete(nodeId);
      return;
    }
    preconsumedAcks.add(nodeId);
  }

  function registerPendingAck(nodeId: string, terminalId: string): void {
    if (preconsumedAcks.has(nodeId)) {
      preconsumedAcks.delete(nodeId);
      return;
    }

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

  const claudeLaunchManager = createClaudeLaunchManager({
    get,
    sendPrompt: (id, tid) => sendContentToTerminal(id, tid),
  });

  const sessionResumeManager = createSessionResumeManager({ get, set });

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
    const explicit = get().terminalNodeAssignments?.[terminalId];
    if (explicit) return explicit;
    const { workflowExecutionStates } = get();
    for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
      if (
        (entry.state === "running" || entry.state === "awaiting-validation") &&
        entry.terminalTabId === terminalId
      ) {
        return nodeId;
      }
    }
    return null;
  }

  function assignTerminalToNode(terminalId: string, nodeId: string): void {
    const { terminalNodeAssignments = {} } = get();
    const updated: Record<string, string> = {};
    for (const [tid, nid] of Object.entries(terminalNodeAssignments)) {
      if (tid === terminalId || nid === nodeId) continue;
      updated[tid] = nid;
    }
    updated[terminalId] = nodeId;
    set({ terminalNodeAssignments: updated });
  }

  function releaseTerminalAssignmentForNode(nodeId: string): void {
    const { terminalNodeAssignments = {} } = get();
    let changed = false;
    const updated: Record<string, string> = {};
    for (const [tid, nid] of Object.entries(terminalNodeAssignments)) {
      if (nid === nodeId) {
        changed = true;
        continue;
      }
      updated[tid] = nid;
    }
    if (changed) set({ terminalNodeAssignments: updated });
  }

  async function startWorkflow(nodeId: string, terminalId: string | null): Promise<void> {
    const { nodes, ancestorRegistry, workflowExecutionStates, workflowSessionMap, sessionRegistry } = get();

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

    const node = nodes[nodeId];
    const openTerminalIds = new Set(
      useTerminalStore.getState().terminals.map((t) => t.id),
    );
    const route = decideWorkflowStartRoute({
      sessionId: node?.metadata.sessionId,
      workflowSessionMap,
      sessionRegistry,
      openTerminalIds,
    });

    if (route.kind === "focus-existing-tab") {
      useTerminalStore.getState().setActiveTerminal(route.terminalId);
      startWorkflowOnTerminal(nodeId, route.terminalId, "reattach");
      return;
    }

    if (route.kind === "resume-in-new-tab" && route.cwd) {
      try {
        const created = await useTerminalStore.getState().createNewTerminal("Resume", route.cwd);
        if (!created) throw new Error("Terminal not created");
        await window.electron.terminalWrite(created.id, `claude --resume ${route.sessionId}\r`);
        sessionResumeManager.bindSessionTab(created.id, route.sessionId);
        startWorkflowOnTerminal(nodeId, created.id, "reattach");
        return;
      } catch (error) {
        logger.error("Failed to resume session for workflow start — falling back to fresh", error as Error, "WorkflowExecution");
        // Fall through to spawn-fresh on the provided terminalId
      }
    }

    if (terminalId === null) {
      useToastStore
        .getState()
        .addToast(
          "No terminal tab available. Open a terminal to start workflow execution.",
          "warning",
        );
      return;
    }
    startWorkflowOnTerminal(nodeId, terminalId, "spawn");
  }

  function startWorkflowOnTerminal(
    nodeId: string,
    terminalId: string,
    mode: "spawn" | "reattach" | "recurse",
  ): void {
    const { nodes, workflowExecutionStates } = get();

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
      nodes: mode === "spawn" ? clearBrokenChainOnNode(nodes, nodeId) : nodes,
    });
    assignTerminalToNode(terminalId, nodeId);

    void window.electron.startKeepAwake();

    stepTimeouts.start(nodeId);
    if (mode !== "reattach") {
      const { workflowSessionMap } = get();
      const terminalAlreadyHasSession = Object.values(workflowSessionMap).includes(terminalId);
      if (terminalAlreadyHasSession) {
        clearSessionManager.maybeClearThenSend(nodeId, terminalId);
      } else {
        claudeLaunchManager.launchIfNeededThenSend(nodeId, terminalId);
      }
    }
    logger.info(
      `Started workflow execution for node ${nodeId} on terminal ${terminalId} (${mode})`,
      "WorkflowExecution",
    );
    triggerAutosave?.();
  }

  function stopWorkflow(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || (entry.state !== "running" && entry.state !== "awaiting-validation")) return;

    stepTimeouts.clear(nodeId);
    cleanupAutonomousCollaboration(nodeId);
    clearPendingAck(nodeId);
    clearSessionManager.clearPending(nodeId);
    claudeLaunchManager.clearPending(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });
    releaseTerminalAssignmentForNode(nodeId);

    void window.electron.stopKeepAwake();

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
    assignTerminalToNode(terminalId, nodeId);

    logger.info(
      `Continuing workflow execution for node ${nodeId} on terminal ${terminalId}`,
      "WorkflowExecution",
    );

    advanceNode(nodeId);
  }

  function resendStep(nodeId: string, terminalId: string | null): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== "awaiting-validation") return;

    if (terminalId === null) {
      useToastStore
        .getState()
        .addToast(
          "No terminal tab available. Open a terminal to resend the step.",
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
    assignTerminalToNode(terminalId, nodeId);

    stepTimeouts.start(nodeId);
    clearSessionManager.maybeClearThenSend(nodeId, terminalId);

    logger.info(
      `Resending step for node ${nodeId} on terminal ${terminalId}`,
      "WorkflowExecution",
    );
  }

  function recurseChainKey(parentNodeId: string, terminalId: string): string {
    const parentSessionId = get().nodes[parentNodeId]?.metadata.sessionId;
    return parentSessionId && parentSessionId.trim().length > 0
      ? `session:${parentSessionId}`
      : `terminal:${terminalId}`;
  }

  function scheduleRecurseStart(nextNodeId: string, terminalId: string, parentNodeId: string): boolean {
    const chainKey = recurseChainKey(parentNodeId, terminalId);
    const counter = recurseCounters.get(chainKey) || 0;
    if (counter >= MAX_RECURSE_ITERATIONS) {
      useToastStore
        .getState()
        .addToast("Recurse limit reached — stopping automatic processing", "warning");
      void notifyWorkflowEvent("alert", "Recurse limit reached", "Stopping automatic processing");
      recurseCounters.delete(chainKey);
      return false;
    }
    recurseCounters.set(chainKey, counter + 1);
    setTimeout(() => { void dispatchRecurseStart(nextNodeId, terminalId, parentNodeId); }, 2000);
    return true;
  }

  async function dispatchRecurseStart(nextNodeId: string, terminalId: string, parentNodeId: string): Promise<void> {
    const parent = get().nodes[parentNodeId]?.metadata;
    const { workflowSessionMap, sessionRegistry } = get();
    const route = decideWorkflowStartRoute({
      sessionId: parent?.sessionId,
      workflowSessionMap,
      sessionRegistry,
      openTerminalIds: new Set(useTerminalStore.getState().terminals.map((t) => t.id)),
    });

    if (route.kind === 'focus-existing-tab' && parent?.sessionId) {
      const inherited = inheritSessionOnNode(get().nodes, nextNodeId, parent.sessionId);
      if (inherited !== get().nodes) set({ nodes: inherited });
      startWorkflowOnTerminal(nextNodeId, route.terminalId, 'recurse');
      return;
    }

    if (route.kind === 'resume-in-new-tab' && route.cwd) {
      try {
        const newTabId = await openInheritedResumeTerminal(route.sessionId, route.cwd);
        const inherited = inheritSessionOnNode(get().nodes, nextNodeId, route.sessionId);
        if (inherited !== get().nodes) set({ nodes: inherited });
        sessionResumeManager.bindSessionTab(newTabId, route.sessionId);
        startWorkflowOnTerminal(nextNodeId, newTabId, 'recurse');
        return;
      } catch (error) {
        logger.error('Failed to resume parent session for recurse — falling back to fresh', error as Error, 'WorkflowExecution');
        await dispatchFreshStartWithBrokenChain(nextNodeId, terminalId, parentNodeId);
        return;
      }
    }

    await dispatchFreshStartWithBrokenChain(nextNodeId, terminalId, parentNodeId);
  }

  async function dispatchFreshStartWithBrokenChain(
    nextNodeId: string,
    terminalId: string,
    orchestratorNodeId: string,
  ): Promise<void> {
    await startWorkflow(nextNodeId, terminalId);
    if (get().workflowExecutionStates[nextNodeId]?.state === 'running') {
      announceBrokenChain(nextNodeId);
      return;
    }
    releaseTerminalAssignmentForNode(orchestratorNodeId);
    useToastStore
      .getState()
      .addToast(
        'Recurse halted — next step could not start (terminal busy or step ineligible)',
        'warning',
      );
  }

  async function openInheritedResumeTerminal(sessionId: string, cwd: string): Promise<string> {
    const created = await useTerminalStore.getState().createNewTerminal('Resume', cwd);
    if (!created) throw new Error('Resume terminal was not created');
    await window.electron.terminalWrite(created.id, `claude --resume ${sessionId}\r`);
    return created.id;
  }

  function announceBrokenChain(nodeId: string): void {
    const updated = markBrokenChainOnNode(get().nodes, nodeId);
    if (updated !== get().nodes) {
      set({ nodes: updated });
      triggerAutosave?.();
    }
    useToastStore.getState().addToast(
      'Recurse chain broken — previous session unavailable, starting a fresh one for this step',
      'warning',
    );
  }

  function advanceDecomposedSiblingToNextStep(siblingId: string): boolean {
    const { nodes, ancestorRegistry } = get();
    const nextStepId = findNextStepTarget(siblingId, nodes, ancestorRegistry);
    if (!nextStepId) return false;

    let updatedNodes = removeNodeFromAllParents(nodes, siblingId);
    if (!updatedNodes[nextStepId].children.includes(siblingId)) {
      updatedNodes = {
        ...updatedNodes,
        [nextStepId]: {
          ...updatedNodes[nextStepId],
          children: [...updatedNodes[nextStepId].children, siblingId],
        },
      };
    }
    const updatedRegistry = moveNodeInRegistry(
      ancestorRegistry,
      siblingId,
      nextStepId,
      updatedNodes,
    );
    set({ nodes: updatedNodes, ancestorRegistry: updatedRegistry });
    triggerAutosave?.();
    return true;
  }

  function checkRecurse(stepId: string, terminalId: string, completedNodeId: string): void {
    const { nodes, ancestorRegistry, workflowExecutionStates } = get();

    const decompositionStepId = findDecompositionStepInWorkflow(stepId, nodes, ancestorRegistry);

    const sibling =
      findNextDecomposedSibling(stepId, nodes, workflowExecutionStates)
      ?? (decompositionStepId
        ? findNextDecomposedSibling(decompositionStepId, nodes, workflowExecutionStates)
        : null);

    if (sibling) {
      // Recurse-marked and completeWorkflow paths pre-delete the orchestrator's state
      // before calling checkRecurse; if it is still running we are in the intermediate
      // autonomous-to-autonomous advance from advanceNode, where scheduling would
      // dispatch to a still-busy terminal and surface a false halt toast.
      if (workflowExecutionStates[completedNodeId]?.state === 'running') {
        return;
      }
      if (!advanceDecomposedSiblingToNextStep(sibling)) {
        recurseCounters.delete(recurseChainKey(completedNodeId, terminalId));
        useToastStore
          .getState()
          .addToast(
            "Decomposition at final step — children retained, no downstream step to run",
            "info",
          );
        return;
      }
      scheduleRecurseStart(sibling, terminalId, completedNodeId);
      return;
    }

    const stepNode = nodes[stepId];
    if (!stepNode || stepNode.metadata.recurse !== true) return;

    if (!decompositionStepId) {
      warnRecurseWithoutDecomposition(terminalId);
    }

    recurseCounters.delete(recurseChainKey(completedNodeId, terminalId));
  }

  function warnRecurseWithoutDecomposition(terminalId: string): void {
    if (recurseWithoutDecompositionWarned.has(terminalId)) return;
    recurseWithoutDecompositionWarned.add(terminalId);
    useToastStore
      .getState()
      .addToast("Warning, you have recursion set without decomposition", "warning");
    void notifyWorkflowEvent(
      "alert",
      "Recursion without decomposition",
      "Recurse only processes decomposed siblings — set decomposition on a step in this workflow to make recurse take effect.",
    );
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
    releaseTerminalAssignmentForNode(nodeId);

    if (entry) {
      void window.electron.stopKeepAwake();
    }

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
      checkRecurse(position.currentStepId, terminalId, nodeId);
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
    const previousParentId = actualParentIds[0];

    if (previousParentId) {
      const previousStep = nodes[previousParentId];
      const decompositionStepId = findDecompositionStepInWorkflow(
        previousParentId,
        nodes,
        ancestorRegistry,
      );
      if (previousStep?.metadata.recurse === true && decompositionStepId !== null) {
        const terminalId = entry.terminalTabId;
        const nodeName = nodes[nodeId]?.content || nodeId;
        stopWorkflow(nodeId);
        useToastStore
          .getState()
          .addToast(
            `"${nodeName}" halted at recurse step — handing off to next decomposed sibling`,
            "info",
          );
        triggerAutosave?.();
        checkRecurse(previousParentId, terminalId, nodeId);
        return;
      }
    }

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

    if (previousParentId) {
      checkRecurse(previousParentId, entry.terminalTabId, nodeId);
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
      const flags = resolveContextFlags(contextId, nodes, contextDeclarations);

      if (!autonomousCollaborateInTerminal) return;

      if (contextId && flags.collaborate) {
        setCollaboratingFlag(nodeId);
      }

      autonomousCollaborateInTerminal(nodeId, terminalId, flags).then((feedbackFilePath) => {
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
    const trimmed = sessionId.trim();
    if (trimmed.length === 0) {
      logger.warn(
        `Ignoring SessionStart with empty session id for terminal ${terminalId}`,
        "WorkflowExecution",
      );
      return;
    }

    const { workflowSessionMap, nodes } = get();

    const updatedMap = { ...workflowSessionMap };
    for (const [existingSession, existingTerminal] of Object.entries(updatedMap)) {
      if (existingTerminal === terminalId) {
        delete updatedMap[existingSession];
      }
    }
    updatedMap[trimmed] = terminalId;

    const runningNodeId = findRunningNodeOnTerminal(terminalId);
    const nodesWithCapture = runningNodeId
      ? captureSessionOnNode(nodes, runningNodeId, trimmed)
      : nodes;

    set({
      workflowSessionMap: updatedMap,
      nodes: nodesWithCapture,
    });

    if (runningNodeId && nodesWithCapture !== nodes) {
      triggerAutosave?.();
    }

    // Async: write live cwd to sessionRegistry
    const getCwd = window.electron.terminalGetCwd;
    if (typeof getCwd === 'function') {
      void getCwd(terminalId).then((cwd) => {
        if (!cwd) return;
        const { sessionRegistry } = get();
        set({ sessionRegistry: { ...sessionRegistry, [trimmed]: { cwd } } });
        triggerAutosave?.();
      }).catch((error) => {
        logger.warn(`terminalGetCwd failed for ${terminalId}: ${(error as Error).message}`, 'WorkflowExecution');
      });
    }

    if (!usePreferencesStore.getState().hasReceivedHookEvent) {
      usePreferencesStore.getState().markHookEventReceived();
    }

    logger.info(
      `Registered session ${trimmed} for terminal ${terminalId}${source ? ` (source=${source})` : ''}`,
      "WorkflowExecution",
    );

    if (source === 'clear' && runningNodeId) {
      clearSessionManager.onClearConfirmed(runningNodeId);
    }

    claudeLaunchManager.onSessionStartConfirmed(terminalId, runningNodeId ?? '');
  }

  const handleHookEvent = createHookEventHandler({
    get,
    set,
    findRunningNodeOnTerminal,
    clearStepTimeout: stepTimeouts.clear,
    consumePendingAck,
    advanceNode,
    completeWorkflow,
    stopWorkflow,
  });

  function initializeExecutionState(): void {
    const { workflowExecutionStates } = get();
    let stoppedCount = 0;
    const updatedStates: Record<string, WorkflowExecutionEntry> = {};
    const rebuiltAssignments: Record<string, string> = {};

    for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
      if (entry.state === "running") {
        stoppedCount++;
      } else {
        updatedStates[nodeId] = entry;
        rebuiltAssignments[entry.terminalTabId] = nodeId;
      }
    }

    // Clean up all autonomous collaborations on restart
    for (const nodeId of Array.from(feedbackCollaborations.keys())) {
      cleanupAutonomousCollaboration(nodeId);
    }

    for (const nodeId of Array.from(pendingAcks.keys())) {
      clearPendingAck(nodeId);
    }
    preconsumedAcks.clear();

    clearSessionManager.clearAllPending();

    set({
      workflowExecutionStates: updatedStates,
      workflowSessionMap: {},
      terminalNodeAssignments: rebuiltAssignments,
      // sessionRegistry is NOT reset — it is persistent data loaded from file
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
    clearPendingLaunch: claudeLaunchManager.clearPending,
    releaseTerminalAssignmentForNode,
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

    const archiveConfig = getArchiveConfigForNode(nodeId, nodes, ancestorRegistry);
    const rootNodeIdOrIds = decomposition && parsed.rootNodeIds.length > 1
      ? parsed.rootNodeIds
      : parsed.rootNodeId;

    const decompositionStepId = Array.isArray(rootNodeIdOrIds)
      ? getParentIdOrNull(nodeId, ancestorRegistry)
      : null;

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

    if (decompositionStepId && entry.terminalTabId) {
      checkRecurse(decompositionStepId, entry.terminalTabId, nodeId);
    }
  }

  return {
    startWorkflow,
    stopWorkflow,
    continueWorkflow,
    resendStep,
    completeWorkflow,
    advanceNode,
    registerSession,
    resumeSession: sessionResumeManager.resumeSession,
    handleHookEvent,
    initializeExecutionState,
    ...disruptionReactions,
    handleAutonomousFeedback,
    findCollaborationByFeedbackFilePath,
    registerManualCollaboration,
    unregisterCollaboration,
  };
};
