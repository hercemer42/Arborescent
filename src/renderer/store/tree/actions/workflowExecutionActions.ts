import { TreeNode } from "../../../../shared/types";
import { useToastStore } from "../../toast/toastStore";
import { logger } from "../../../services/logger";
import { AncestorRegistry, moveNodeInRegistry } from "../../../utils/ancestry";
import { findLiveNodeWithSessionId } from "../selectors/activeSessionNodeId";
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
  getInheritedContextId,
  resolveContextFlags,
  getContextDeclarations,
  getAllDescendants,
} from "../../../utils/nodeHelpers";
import { usePreferencesStore } from "../../preferences/preferencesStore";
import { notifyWorkflowEvent } from "../../../services/workflowNotification";
import { findAllParentsOf, removeNodeFromAllParents } from "../../../utils/treeInvariants";
import { createDisruptionReactions } from "./workflowDisruptionReactions";
import { createHookEventHandler, HookEventPayload } from "./workflowHookEventHandler";
import { createClearSessionManager } from "./workflowClearSession";
import { createAckRetryManager } from "./workflowAckManager";
import {
  findRunningNodeOnTerminal,
  findCapturableNodeForTerminal,
  findSessionBoundNodeForTerminal,
} from "./terminalBindingResolution";
import { createClaudeLaunchManager } from "./workflowClaudeLaunch";
import {
  createSessionResumeManager,
  captureSessionOnNode,
  checkClaudeSessionExists,
  clearBrokenChainOnNode,
  inheritSessionOnNode,
  markBrokenChainOnNode,
  resumeTabTitle,
  shortSessionId,
} from "./workflowSessionResume";
import { decideWorkflowStartRoute } from "../../../utils/workflowStartRoute";
import { useTerminalStore } from "../../terminal/terminalStore";
import { resyncBoundTerminalTitles } from "../../terminal/syncBoundTerminalTitles";
import { useRebindPreflightStore } from "../../rebindPreflightStore";
import { usePendingRebindDialogStore } from "../../pendingRebindDialogStore";
import { extractTaskTitle } from "../../../utils/terminalTabTitle";
import {
  StepHistoryMap,
  captureStepHistoryEntry,
  appendToStepHistoryMap,
  findOwningWorkflowStepId,
} from "../stepHistory/stepHistory";
import { getAutonomousStepContext } from "../../../../shared/utils/autonomousStepContext";

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
  resumeRestoredTerminal: (terminalId: string, sessionId: string) => Promise<void>;
  handleHookEvent: (event: HookEventPayload) => void;
  initializeExecutionState: () => void;
  handleTerminalClosed: (terminalId: string) => void;
  handleNodeDeleted: (nodeId: string) => void;
  handleStepDeleted: (stepId: string) => void;
  handleAllStepsRemoved: (workflowId: string) => void;
  handleNodeMovedManually: (nodeId: string) => void;
  handleAutonomousFeedback: (nodeId: string, content: string) => void;
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
  stepHistory?: StepHistoryMap;
};

export type AutonomousSendSource = 'workflow-start' | 'workflow-advance';

export const createWorkflowExecutionActions = (
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  autonomousCollaborateInTerminal?: (nodeId: string, terminalId: string, flags?: import('../../../utils/nodeHelpers').ContextFlags, overrideContextId?: string, bindingSource?: AutonomousSendSource) => Promise<string>,
  executeCommand?: (command: { execute: () => void; undo: () => void; description?: string }) => void,
  invalidateUndoEntriesTouching?: (nodeIds: Set<string>) => void,
): WorkflowExecutionActions => {
  const MAX_RECURSE_ITERATIONS = 50;
  const recurseCounters = new Map<string, number>();
  const recurseWithoutDecompositionWarned = new Set<string>();
  const lastAcceptedContentByNode = new Map<string, string>();

  const ackManager = createAckRetryManager({
    get,
    sendContentToTerminal: (id, tid) => sendContentToTerminal(id, tid),
    stopWorkflow: (id) => stopWorkflow(id),
  });

  const clearSessionManager = createClearSessionManager({
    get,
    set,
    sendPrompt: (id, tid, source) => sendContentToTerminal(id, tid, source),
    stopWorkflow: (id) => stopWorkflow(id),
  });

  const claudeLaunchManager = createClaudeLaunchManager({
    get,
    sendPrompt: (id, tid, source) => sendContentToTerminal(id, tid, source),
    sendAfterResume: (id, tid, source) => clearSessionManager.maybeClearThenSend(id, tid, source),
    onResumeTimeout: (id, tid) => handleResumeTimeout(id, tid),
  });

  const sessionResumeManager = createSessionResumeManager({ get, set });

  function handleResumeTimeout(nodeId: string, terminalId: string): void {
    const nodeName = get().nodes[nodeId]?.content || nodeId;
    stopWorkflow(nodeId);
    // The eager bindSessionTab mapped this terminal to the session before SessionStart;
    // the session never came up, so drop that phantom mapping — otherwise a retry would
    // focus-existing-tab into the half-started tab (re-racing the prompt) and liveness
    // would read the dead session as alive.
    const { workflowSessionMap } = get();
    const entries = Object.entries(workflowSessionMap);
    const pruned = entries.filter(([, tid]) => tid !== terminalId);
    if (pruned.length !== entries.length) {
      set({ workflowSessionMap: Object.fromEntries(pruned) });
    }
    useToastStore.getState().addToast(
      `Resumed Claude session for "${nodeName}" did not start in time — workflow stopped. Open the terminal to confirm Claude launched, then retry.`,
      'error',
    );
    void notifyWorkflowEvent('alert', 'Resume timed out', `"${nodeName}" — resumed session did not start`);
  }

  function reattachOriginNodeForResumedSession(terminalId: string, sessionId: string): void {
    const terminalStore = useTerminalStore.getState();
    const terminal = terminalStore.terminals.find((t) => t.id === terminalId);
    if (!terminal) return;

    if (terminal.originNodeId) {
      const originNode = get().nodes[terminal.originNodeId];
      if (originNode) {
        logger.info(
          `Resumed terminal ${terminalId} retained originNodeId ${terminal.originNodeId} (sessionId ${sessionId})`,
          'WorkflowExecution',
        );
        return;
      }
      terminalStore.updateTerminal(terminalId, { originNodeId: undefined });
      useToastStore
        .getState()
        .addToast('Previously-bound node no longer exists — terminal unbound', 'info');
      logger.warn(
        `Terminal ${terminalId} originNodeId ${terminal.originNodeId} no longer exists; cleared (sessionId ${sessionId})`,
        'WorkflowExecution',
      );
      return;
    }

    const reattachNodeId = findLiveNodeWithSessionId(get().nodes, sessionId);
    if (!reattachNodeId) return;
    terminalStore.updateTerminal(terminalId, { originNodeId: reattachNodeId });
    syncTerminalTitleFromNode(terminalId, get().nodes[reattachNodeId]);
    logger.info(
      `Reattached terminal ${terminalId} to node ${reattachNodeId} via sessionId ${sessionId} (legacy fallback)`,
      'WorkflowExecution',
    );
  }

  function syncTerminalTitleFromNode(terminalId: string, node: TreeNode | undefined): void {
    if (!node) return;
    const taskTitle = extractTaskTitle(node);
    if (!taskTitle) return;
    useTerminalStore.getState().updateTerminal(terminalId, { title: taskTitle });
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

  function stampSessionOnStartNode(nodeId: string, sessionId: string): void {
    const inherited = inheritSessionOnNode(get().nodes, nodeId, sessionId);
    if (inherited !== get().nodes) set({ nodes: inherited });
  }

  function writeStartWorkflowSnapshot(nodeId: string): void {
    const { nodes, ancestorRegistry, stepHistory } = get();
    const owningStepId = findOwningWorkflowStepId(nodeId, nodes, ancestorRegistry);
    if (!owningStepId) return;
    const ancestors = ancestorRegistry[nodeId] ?? [];
    const parentId = ancestors[ancestors.length - 1] ?? '';
    const parent = nodes[parentId];
    const position = parent?.children.indexOf(nodeId) ?? 0;
    const entry = captureStepHistoryEntry(nodeId, nodes, parentId, position);
    const updated = appendToStepHistoryMap(stepHistory ?? {}, owningStepId, entry);
    set({ stepHistory: updated });
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

    writeStartWorkflowSnapshot(nodeId);

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
      if (node?.metadata.sessionId) stampSessionOnStartNode(nodeId, node.metadata.sessionId);
      useTerminalStore.getState().setActiveTerminal(route.terminalId);
      startWorkflowOnTerminal(nodeId, route.terminalId, "reattach");
      return;
    }

    if (route.kind === "resume-in-new-tab" && route.cwd) {
      // Abort up front if the session is gone from disk (matches the manual Resume path)
      // so we do not spawn a doomed `claude --resume` and wait out the readiness timeout.
      if ((await checkClaudeSessionExists(route.cwd, route.sessionId)) === false) {
        useToastStore.getState().addToast(
          `Session ${shortSessionId(route.sessionId)} no longer exists on disk — cannot resume`,
          "error",
        );
        return;
      }
      try {
        const title = resumeTabTitle(node, route.sessionId);
        const created = await useTerminalStore.getState().createNewTerminal(title, route.cwd, nodeId);
        if (!created) throw new Error("Terminal not created");
        await window.electron.terminalWrite(created.id, `claude --resume ${route.sessionId}\r`);
        sessionResumeManager.bindSessionTab(created.id, route.sessionId);
        stampSessionOnStartNode(nodeId, route.sessionId);
        startWorkflowOnTerminal(nodeId, created.id, "reattach", true);
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

  // Returns true only when the start was committed on the terminal. A bail
  // (terminal busy) or a deferred rebind returns false so callers can avoid
  // recording bindings for a start that did not happen.
  function startWorkflowOnTerminal(
    nodeId: string,
    terminalId: string,
    mode: "spawn" | "reattach" | "recurse",
    deferSend = false,
  ): boolean {
    const existingNodeId = findRunningNodeOnTerminal(get, terminalId);
    if (existingNodeId && existingNodeId !== nodeId) {
      useToastStore
        .getState()
        .addToast(
          "Terminal tab is already assigned to a running workflow node.",
          "warning",
        );
      return false;
    }

    // A user-initiated start onto a terminal whose live session belongs to a
    // different node is a rebind: defer the reassignment, tab rename, and send
    // until the user confirms. The recurse handoff legitimately moves a terminal
    // from a parent to its decomposed child, so it is never gated.
    if (mode !== "recurse") {
      // A rebind confirmation is already awaiting the user on this terminal;
      // ignore repeat starts so the pending preflight request is not clobbered.
      if (usePendingRebindDialogStore.getState().isPending(terminalId)) {
        return false;
      }
      const boundNodeId = findSessionBoundNodeForTerminal(get, terminalId);
      if (boundNodeId && boundNodeId !== nodeId) {
        requestWorkflowStartRebind(terminalId, boundNodeId, nodeId, mode);
        return false;
      }
    }

    commitWorkflowStartOnTerminal(nodeId, terminalId, mode, false, deferSend);
    return true;
  }

  function requestWorkflowStartRebind(
    terminalId: string,
    previousNodeId: string,
    nodeId: string,
    mode: "spawn" | "reattach" | "recurse",
  ): void {
    usePendingRebindDialogStore.getState().markPending(terminalId);
    useRebindPreflightStore.getState().request({
      terminalId,
      previousNodeId,
      newNodeId: nodeId,
      // The user has authorized the rebind, so the deferred start is now an
      // authorized hand-off — dispatch it as 'workflow-advance' (rebindPreconfirmed)
      // so the main process auto-confirms the session rebind instead of raising a
      // second, reactive confirmation dialog for the rebind just approved.
      replay: async () => {
        commitWorkflowStartOnTerminal(nodeId, terminalId, mode, true);
      },
    });
    logger.info(
      `Preflight rebind queued for workflow start: terminal ${terminalId} bound to ${previousNodeId}, awaiting confirmation to start ${nodeId}`,
      "WorkflowExecution",
    );
  }

  function commitWorkflowStartOnTerminal(
    nodeId: string,
    terminalId: string,
    mode: "spawn" | "reattach" | "recurse",
    rebindPreconfirmed = false,
    deferSend = false,
  ): void {
    const { nodes, workflowExecutionStates } = get();

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

    // isEligibleForExecution upstream already rules out genuinely-running nodes, so
    // every call here is a fresh send; the branch only picks the delivery path. A
    // resumed `claude --resume` tab defers the send until its SessionStart arrives so
    // the prompt does not race startup; a tab already hosting a live session
    // clears-then-sends; an empty tab auto-launches claude first. deferSend is checked
    // first because the resume path eager-binds the session map, so the
    // terminalAlreadyHasSession branch would otherwise capture a not-yet-ready tab.
    const { workflowSessionMap } = get();
    const terminalAlreadyHasSession = Object.values(workflowSessionMap).includes(terminalId);
    const bindingSource: AutonomousSendSource =
      mode === 'recurse' || rebindPreconfirmed ? 'workflow-advance' : 'workflow-start';
    if (deferSend) {
      claudeLaunchManager.deferSendUntilSessionStart(nodeId, terminalId, bindingSource);
    } else if (terminalAlreadyHasSession) {
      clearSessionManager.maybeClearThenSend(nodeId, terminalId, bindingSource);
    } else {
      claudeLaunchManager.launchIfNeededThenSend(nodeId, terminalId, bindingSource);
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
    if (
      !entry ||
      (entry.state !== "running" &&
        entry.state !== "awaiting-validation")
    ) {
      return;
    }

    ackManager.clearPendingAck(nodeId);
    clearSessionManager.clearPending(nodeId);
    claudeLaunchManager.clearPending(nodeId);
    lastAcceptedContentByNode.delete(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });
    releaseTerminalAssignmentForNode(nodeId);

    if (entry.terminalTabId) {
      useTerminalStore.getState().markTerminalProcessing(entry.terminalTabId, false);
    }

    void window.electron.stopKeepAwake();

    logger.info(
      `Stopped workflow execution for node ${nodeId}`,
      "WorkflowExecution",
      { nodeId },
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

    const existingNodeId = findRunningNodeOnTerminal(get, terminalId);
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

    const existingNodeId = findRunningNodeOnTerminal(get, terminalId);
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
      const started = startWorkflowOnTerminal(nextNodeId, route.terminalId, 'recurse');
      finalizeRecurseSessionStamp(started, nextNodeId, parent.sessionId, parentNodeId);
      return;
    }

    if (route.kind === 'resume-in-new-tab' && route.cwd) {
      try {
        const newTabId = await openInheritedResumeTerminal(route.sessionId, route.cwd, nextNodeId);
        sessionResumeManager.bindSessionTab(newTabId, route.sessionId);
        const started = startWorkflowOnTerminal(nextNodeId, newTabId, 'recurse', true);
        finalizeRecurseSessionStamp(started, nextNodeId, route.sessionId, parentNodeId);
        return;
      } catch (error) {
        logger.error('Failed to resume parent session for recurse — falling back to fresh', error as Error, 'WorkflowExecution');
        await dispatchFreshStartWithBrokenChain(nextNodeId, terminalId, parentNodeId);
        return;
      }
    }

    await dispatchFreshStartWithBrokenChain(nextNodeId, terminalId, parentNodeId);
  }

  // The inherited session is a binding, so it is stamped only once the start is
  // confirmed. A bailed hand-off leaves the next node unstamped — otherwise a
  // later manual start would route to the parent's (possibly closed) session —
  // and releases the orchestrator's now-finished terminal assignment.
  function finalizeRecurseSessionStamp(
    started: boolean,
    nextNodeId: string,
    sessionId: string,
    orchestratorNodeId: string,
  ): void {
    if (!started) {
      releaseTerminalAssignmentForNode(orchestratorNodeId);
      return;
    }
    const inherited = inheritSessionOnNode(get().nodes, nextNodeId, sessionId);
    if (inherited !== get().nodes) set({ nodes: inherited });
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

  async function openInheritedResumeTerminal(sessionId: string, cwd: string, originNodeId?: string): Promise<string> {
    const originNode = originNodeId ? get().nodes[originNodeId] : undefined;
    const title = resumeTabTitle(originNode, sessionId);
    const created = await useTerminalStore.getState().createNewTerminal(title, cwd, originNodeId);
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

  // A node only pauses at a recurse step when it has decomposition siblings —
  // either still waiting to run, or already parked at the recurse step. A node
  // that was never decomposed traverses the step like any other. Decomposition
  // always stamps a shared groupId on its outputs, so an undefined group means
  // no decomposed siblings — without that guard, unrelated ungrouped nodes
  // parked at the step would falsely halt each other.
  function hasDecomposedSiblings(recurseStepId: string, completedNodeId: string): boolean {
    const { nodes } = get();
    const originGroupId = nodes[completedNodeId]?.metadata.groupId;
    const parkedSiblingAtRecurseStep = originGroupId !== undefined && (nodes[recurseStepId]?.children.some(
      (childId) => childId !== completedNodeId && nodes[childId]?.metadata.groupId === originGroupId,
    ) ?? false);
    return parkedSiblingAtRecurseStep || findWaitingDecomposedSibling(recurseStepId, completedNodeId) !== null;
  }

  function findWaitingDecomposedSibling(stepId: string, completedNodeId: string): string | null {
    const { nodes, ancestorRegistry, workflowExecutionStates } = get();
    const decompositionStepId = findDecompositionStepInWorkflow(stepId, nodes, ancestorRegistry);
    const originGroupId = nodes[completedNodeId]?.metadata.groupId;

    return (
      findNextDecomposedSibling(stepId, nodes, workflowExecutionStates, completedNodeId, originGroupId)
      ?? (decompositionStepId
        ? findNextDecomposedSibling(decompositionStepId, nodes, workflowExecutionStates, completedNodeId, originGroupId)
        : null)
    );
  }

  function checkRecurse(stepId: string, terminalId: string, completedNodeId: string): void {
    const { nodes, ancestorRegistry, workflowExecutionStates } = get();

    const decompositionStepId = findDecompositionStepInWorkflow(stepId, nodes, ancestorRegistry);

    const sibling = findWaitingDecomposedSibling(stepId, completedNodeId);

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
    lastAcceptedContentByNode.delete(nodeId);
    const { workflowExecutionStates, nodes, ancestorRegistry } = get();
    const entry = workflowExecutionStates[nodeId];
    const terminalId = entry?.terminalTabId;
    const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);

    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];

    set({ workflowExecutionStates: updatedStates });
    releaseTerminalAssignmentForNode(nodeId);

    if (terminalId) {
      useTerminalStore.getState().markTerminalProcessing(terminalId, false);
    }

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

    lastAcceptedContentByNode.delete(nodeId);

    const actualParentIds = findAllParentsOf(nodes, nodeId);
    const previousParentId = actualParentIds[0];

    if (previousParentId) {
      const previousStep = nodes[previousParentId];
      const decompositionStepId = findDecompositionStepInWorkflow(
        previousParentId,
        nodes,
        ancestorRegistry,
      );
      const haltsAtRecurseStep =
        previousStep?.metadata.recurse === true &&
        decompositionStepId !== null &&
        hasDecomposedSiblings(previousParentId, nodeId);
      if (haltsAtRecurseStep) {
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
      setTimeout(
        () => clearSessionManager.maybeClearThenSend(nodeId, entry.terminalTabId),
        1000,
      );
    }

    if (previousParentId) {
      checkRecurse(previousParentId, entry.terminalTabId, nodeId);
    }
  }

  // Autonomous workflow path: a step's context (walked from ancestors only)
  // overrides the working node's own attached context. Manual steps halt the
  // workflow and rely on the user's explicit 'send' action, which does not
  // apply this override — that asymmetry is intentional.
  function sendContentToTerminal(nodeId: string, terminalId: string, bindingSource: AutonomousSendSource = 'workflow-advance'): void {
    try {
      const { nodes, ancestorRegistry } = get();
      const node = nodes[nodeId];
      if (!node) return;

      const stepContextOverride = getInheritedContextId(
        nodeId,
        nodes,
        ancestorRegistry,
      );
      const effectiveContextId = stepContextOverride
        ?? getAppliedContextIdWithInheritance(nodeId, nodes, ancestorRegistry);
      const contextDeclarations = getContextDeclarations(nodes);
      const flags = resolveContextFlags(effectiveContextId, nodes, contextDeclarations);

      if (!autonomousCollaborateInTerminal) return;

      if (effectiveContextId && flags.collaborate) {
        setCollaboratingFlag(nodeId);
      }

      autonomousCollaborateInTerminal(nodeId, terminalId, flags, stepContextOverride, bindingSource).then(() => {
        ackManager.registerPendingAck(nodeId, terminalId);
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

    const runningNodeId = findRunningNodeOnTerminal(get, terminalId);
    const captureNodeId = findCapturableNodeForTerminal(get, terminalId, trimmed);
    const nodesWithCapture = captureNodeId
      ? captureSessionOnNode(nodes, captureNodeId, trimmed)
      : nodes;

    set({
      workflowSessionMap: updatedMap,
      nodes: nodesWithCapture,
    });

    if (captureNodeId && nodesWithCapture !== nodes) {
      triggerAutosave?.();
      syncTerminalTitleFromNode(terminalId, nodesWithCapture[captureNodeId]);
    } else if (!captureNodeId) {
      reattachOriginNodeForResumedSession(terminalId, trimmed);
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
    findRunningNodeOnTerminal: (terminalId) => findRunningNodeOnTerminal(get, terminalId),
    consumePendingAck: ackManager.consumePendingAck,
    advanceNode,
    completeWorkflow,
    stopWorkflow,
    isTerminalLive: (terminalId) => {
      // Check every file's terminals, not the active file's list alone: a
      // background workflow's terminal lives in its own file's state even when
      // another file is focused, so scoping to the active file would falsely
      // report it dead and route the advance to the stuck path.
      const { terminals, fileStates } = useTerminalStore.getState();
      return (
        terminals.some((t) => t.id === terminalId) ||
        Object.values(fileStates).some((fs) => fs.terminals.some((t) => t.id === terminalId))
      );
    },
    revealNode: (nodeId) => {
      visualEffects?.flashNode(nodeId, 'advance');
      visualEffects?.scrollToNode(nodeId);
    },
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

    ackManager.clearAll();

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
    clearPendingAck: ackManager.clearPendingAck,
    clearPendingClear: clearSessionManager.clearPending,
    clearPendingLaunch: claudeLaunchManager.clearPending,
    clearLastAcceptedContent: (nodeId) => lastAcceptedContentByNode.delete(nodeId),
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
      return;
    }

    // Idempotency: an MCP client refining its own submission resends the same
    // payload — accept-and-advance must not stack. Distinct content still
    // flows through normally so the latest payload replaces prior descendants
    // via the underlying AcceptFeedbackCommand snapshot/rebuild.
    if (lastAcceptedContentByNode.get(nodeId) === content) {
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
      const autonomousContext = getAutonomousStepContext(nodeId, {
        nodes,
        ancestorRegistry,
        workflowExecutionStates,
      });
      let acceptMode: 'autonomous' | 'checkpoint-accept' | 'manual-send-accept';
      if (autonomousContext !== null) {
        acceptMode = 'autonomous';
      } else {
        // Defensive fallback: applyStepOutput's gate 2 uses the same unified
        // context, so reaching here means an unexpected configuration — log for
        // visibility. Still reachable for callers that invoke
        // handleAutonomousFeedback without going through applyStepOutput
        // (test harnesses, future internal callers), so keep the warn-log
        // rather than removing the branch as dead code.
        const owningStepId = findOwningWorkflowStepId(nodeId, nodes, ancestorRegistry);
        const owningStepType = owningStepId ? nodes[owningStepId]?.metadata?.stepType : undefined;
        acceptMode = owningStepType === 'checkpoint' ? 'checkpoint-accept' : 'manual-send-accept';
        logger.warn(
          `gate-miss gate=3 node=${nodeId} reason=no-autonomous-context fallback=${acceptMode}`,
          'WorkflowExecution',
        );
      }
      const command = new AcceptFeedbackCommand(
        nodeId,
        rootNodeIdOrIds,
        parsed.nodes,
        getStateForCommand,
        set,
        triggerAutosave,
        archiveConfig,
        undefined,
        { acceptMode },
      );

      // Autonomous mutations bypass the user undo stack — Cmd+Z must never revert
      // a workflow-driven change. Checkpoint-accept and manual-send go through the
      // history manager because the user authored the accept click.
      if (acceptMode === 'autonomous') {
        const mutatedNodeIds = new Set<string>([nodeId, ...getAllDescendants(nodeId, nodes)]);
        command.execute();
        invalidateUndoEntriesTouching?.(mutatedNodeIds);
      } else {
        executeCommand(command);
      }

      if (priorActiveNodeId !== nodeId) {
        set({ activeNodeId: priorActiveNodeId });
      }

      // The command rewrites the bound subtree (and may migrate originNodeId),
      // so re-derive every bound terminal title from the settled tree.
      resyncBoundTerminalTitles(get().nodes);
    }

    if (decompositionStepId) {
      releaseOrchestratorAfterDecompositionHandoff(nodeId);
    }

    lastAcceptedContentByNode.set(nodeId, content);

    useToastStore.getState().addToast("Feedback auto-accepted", "info");
    logger.info(`Auto-accepted feedback for node ${nodeId} (${parsed.nodeCount} nodes)`, "WorkflowExecution");

    advanceOrClearCollaborating(nodeId);

    if (decompositionStepId && entry.terminalTabId) {
      checkRecurse(decompositionStepId, entry.terminalTabId, nodeId);
    }
  }

  function releaseOrchestratorAfterDecompositionHandoff(orchestratorNodeId: string): void {
    releaseTerminalAssignmentForNode(orchestratorNodeId);
    const { workflowExecutionStates: latestStates } = get();
    if (!latestStates[orchestratorNodeId]) return;
    const nextStates = { ...latestStates };
    delete nextStates[orchestratorNodeId];
    set({ workflowExecutionStates: nextStates });
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
    resumeRestoredTerminal: sessionResumeManager.resumeRestoredTerminal,
    handleHookEvent,
    initializeExecutionState,
    ...disruptionReactions,
    handleAutonomousFeedback,
  };
};
