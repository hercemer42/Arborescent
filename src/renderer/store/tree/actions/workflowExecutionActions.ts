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
  WorkflowExecutionEntry,
} from "../../../utils/workflowHelpers";
import { StepType } from "../commands/SetStepTypeCommand";
import { buildContentWithContext } from "../../../utils/nodeHelpers";
import { buildExecutePrompt } from "../../../utils/promptBuilder";
import { executeInTerminal } from "../../../services/terminalExecution";
import { DEFAULT_EXECUTE_CONTEXT } from "./executeActions";
import { usePreferencesStore } from "../../preferences/preferencesStore";

export type { WorkflowExecutionEntry };

export interface WorkflowExecutionActions {
  startWorkflow: (nodeId: string, terminalId: string | null) => void;
  stopWorkflow: (nodeId: string) => void;
  continueWorkflow: (nodeId: string, terminalId: string | null) => void;
  completeWorkflow: (nodeId: string) => void;
  advanceNode: (nodeId: string) => void;
  registerSession: (sessionId: string, terminalId: string) => void;
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
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
};

export const createWorkflowExecutionActions = (
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
): WorkflowExecutionActions => {
  const DEFAULT_STEP_TIMEOUT_MINUTES = 10;
  const stepTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  function startStepTimeout(nodeId: string): void {
    clearStepTimeout(nodeId);
    const timeoutMinutes =
      usePreferencesStore.getState().stepTimeoutMinutes ??
      DEFAULT_STEP_TIMEOUT_MINUTES;
    if (timeoutMinutes <= 0) return;
    stepTimeouts.set(
      nodeId,
      setTimeout(
        () => {
          const { workflowExecutionStates } = get();
          const entry = workflowExecutionStates[nodeId];
          if (entry?.state !== "running") return;
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
        },
        timeoutMinutes * 60 * 1000,
      ),
    );
  }

  function clearStepTimeout(nodeId: string): void {
    const existing = stepTimeouts.get(nodeId);
    if (existing) {
      clearTimeout(existing);
      stepTimeouts.delete(nodeId);
    }
  }

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

    startStepTimeout(nodeId);
    sendContentToTerminal(nodeId, terminalId);
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

    clearStepTimeout(nodeId);
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

    // Set to running on the terminal, then advance to next step
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

  function completeWorkflow(nodeId: string): void {
    clearStepTimeout(nodeId);
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];

    set({ workflowExecutionStates: updatedStates });

    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;
    useToastStore
      .getState()
      .addToast(`Workflow complete for "${nodeName}"`, "success");

    logger.info(
      `Completed workflow execution for node ${nodeId}`,
      "WorkflowExecution",
    );
    triggerAutosave?.();
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

    const currentAncestors = ancestorRegistry[nodeId];
    const currentParentId = currentAncestors[currentAncestors.length - 1];

    let updatedNodes = { ...nodes };
    if (currentParentId && updatedNodes[currentParentId]) {
      updatedNodes = {
        ...updatedNodes,
        [currentParentId]: {
          ...updatedNodes[currentParentId],
          children: updatedNodes[currentParentId].children.filter(
            (id) => id !== nodeId,
          ),
        },
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
      startStepTimeout(nodeId);
      sendContentToTerminal(nodeId, entry.terminalTabId);
    }
  }

  function sendContentToTerminal(nodeId: string, terminalId: string): void {
    try {
      const { nodes, ancestorRegistry } = get();
      const node = nodes[nodeId];
      if (!node) return;

      const { contextPrefix, nodeContent } = buildContentWithContext(
        nodeId,
        nodes,
        ancestorRegistry,
        true,
      );

      const terminalContent = buildExecutePrompt(
        contextPrefix || DEFAULT_EXECUTE_CONTEXT,
        nodeContent,
      );

      executeInTerminal(terminalId, terminalContent).catch((error) => {
        logger.error(
          "Failed to send content to terminal after advancement",
          error as Error,
          "WorkflowExecution",
        );
        stopWorkflow(nodeId);
        useToastStore
          .getState()
          .addToast("Failed to send to terminal — workflow stopped", "error");
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
    }
  }

  function registerSession(sessionId: string, terminalId: string): void {
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
      `Registered session ${sessionId} for terminal ${terminalId}`,
      "WorkflowExecution",
    );
  }

  function handleHookEvent(event: {
    session_id: string;
    hook_event_name: string;
    message?: string;
  }): void {
    const { workflowSessionMap } = get();
    const terminalId = workflowSessionMap[event.session_id];
    if (!terminalId) {
      logger.info(
        `Hook event ${event.hook_event_name} ignored: no terminal mapped for session ${event.session_id}`,
        "WorkflowExecution",
      );
      return;
    }

    const runningNodeId = findRunningNodeOnTerminal(terminalId);
    if (!runningNodeId) {
      logger.info(
        `Hook event ${event.hook_event_name} ignored: no running node on terminal ${terminalId}`,
        "WorkflowExecution",
      );
      return;
    }

    logger.info(
      `Hook event ${event.hook_event_name} for node ${runningNodeId} on terminal ${terminalId}`,
      "WorkflowExecution",
    );

    if (event.hook_event_name === "Stop") {
      const { nodes, ancestorRegistry } = get();
      const position = getWorkflowStepPosition(
        runningNodeId,
        nodes,
        ancestorRegistry,
      );
      if (!position) {
        logger.info(
          `Hook Stop ignored: node ${runningNodeId} has no workflow step position`,
          "WorkflowExecution",
        );
        return;
      }

      const stepNode = nodes[position.currentStepId];
      const stepType: StepType =
        (stepNode?.metadata.stepType as StepType) || "manual";
      logger.info(
        `Hook Stop at step ${position.currentStepId} (type=${stepType}) for node ${runningNodeId}`,
        "WorkflowExecution",
      );

      if (stepType === "autonomous") {
        advanceNode(runningNodeId);
      } else if (stepType === "checkpoint") {
        // Set to awaiting-validation — user must explicitly continue
        const { workflowExecutionStates: currentStates } = get();
        const currentEntry = currentStates[runningNodeId];
        if (currentEntry) {
          clearStepTimeout(runningNodeId);
          set({
            workflowExecutionStates: {
              ...currentStates,
              [runningNodeId]: { ...currentEntry, state: "awaiting-validation" },
            },
          });
        }
        const { nodes: currentNodes, ancestorRegistry: currentRegistry } =
          get();
        const runningNode = currentNodes[runningNodeId];
        const runningNodeName = runningNode?.content || runningNodeId;
        const stepNumber = getWorkflowStepNumber(
          position.currentStepId,
          currentNodes,
          currentRegistry,
        );
        const stepLabel =
          stepNumber !== null ? `Step ${stepNumber}` : "Current step";
        useToastStore
          .getState()
          .addToast(
            `${stepLabel} complete for "${runningNodeName}". Review the output before continuing.`,
            "info",
            { persistent: true, actions: [{ label: "OK", onClick: () => {} }] },
          );
      }
    } else if (event.hook_event_name === "Notification") {
      stopWorkflow(runningNodeId);
      const message = event.message || "Workflow notification received";
      useToastStore.getState().addToast(message, "warning");
    }
  }

  function initializeExecutionState(): void {
    const { workflowExecutionStates } = get();
    let stoppedCount = 0;
    const updatedStates: Record<string, WorkflowExecutionEntry> = {};

    for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
      if (entry.state === "running") {
        // Clear running entries on restart — terminal sessions are gone
        stoppedCount++;
      } else {
        updatedStates[nodeId] = entry;
      }
    }

    set({
      workflowExecutionStates: updatedStates,
      workflowSessionMap: {},
    });

    if (stoppedCount > 0) {
      useToastStore
        .getState()
        .addToast(
          `${stoppedCount} workflow(s) stopped on restart.`,
          "warning",
        );
    }

    logger.info(
      `Initialized execution state, stopped ${stoppedCount} workflows`,
      "WorkflowExecution",
    );
  }

  function handleTerminalClosed(terminalId: string): void {
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.terminalTabId === terminalId && entry.state === "running") {
        delete updatedStates[nodeId];
        const node = nodes[nodeId];
        const nodeName = node?.content || nodeId;
        useToastStore
          .getState()
          .addToast(`"${nodeName}" stopped — terminal closed`, "warning");
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

    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });

    logger.info(
      `Cleared execution state for deleted node ${nodeId}`,
      "WorkflowExecution",
    );
  }

  function handleStepDeleted(stepId: string): void {
    const { workflowExecutionStates, ancestorRegistry } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.state === "running") {
        const ancestors = ancestorRegistry[nodeId];
        if (ancestors) {
          const parentId = ancestors[ancestors.length - 1];
          if (parentId === stepId) {
            delete updatedStates[nodeId];
            changed = true;
          }
        }
      }
    }

    if (changed) {
      set({ workflowExecutionStates: updatedStates });
      useToastStore
        .getState()
        .addToast("Step removed — affected workflows stopped", "warning");
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
          .addToast(`Workflow complete for "${nodeName}"`, "success");
      }
      triggerAutosave?.();
    }
  }

  function handleNodeMovedManually(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry) return;

    clearStepTimeout(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });

    logger.info(
      `Cleared execution state for manually moved node ${nodeId}`,
      "WorkflowExecution",
    );
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
    handleTerminalClosed,
    handleNodeDeleted,
    handleStepDeleted,
    handleAllStepsRemoved,
    handleNodeMovedManually,
  };
};
