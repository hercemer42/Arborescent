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
  buildContentWithContext,
  getAppliedContextIdWithInheritance,
  resolveContextMode,
  getContextDeclarations,
} from "../../../utils/nodeHelpers";
import { buildExecutePrompt } from "../../../utils/promptBuilder";
import { executeInTerminal } from "../../../services/terminalExecution";
import { DEFAULT_EXECUTE_CONTEXT } from "./executeActions";
import { usePreferencesStore } from "../../preferences/preferencesStore";
import { notifyWorkflowEvent } from "../../../services/workflowNotification";

export type { WorkflowExecutionEntry };

const NEEDS_REVIEW_INSTRUCTION = `
IMPORTANT: If you encounter issues that require user input (ambiguities, spec problems, technical constraints, or anything that could compromise the quality of your output), run this command:
curl -s -X POST http://127.0.0.1:\${ARBORESCENT_HOOK_PORT}/hook -H 'Authorization: Bearer '\${ARBORESCENT_AUTH_TOKEN} -H 'Content-Type: application/json' -d '{"session_id": "'\${CLAUDE_SESSION_ID}'", "hook_event_name": "NeedsReview", "terminal_id": "'\${ARBORESCENT_TERMINAL_ID}'"}'
Then continue working and summarize your questions at the end of your output. The workflow will pause for review after you finish.
Only use this if there are genuine issues — do not use it for minor concerns.`;

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
  handleAutonomousFeedback: (nodeId: string, content: string) => void;
  findNodeIdByFeedbackFilePath: (filePath: string) => string | null;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
};

function appendNeedsReviewInstruction(
  context: string,
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
): string {
  const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
  if (!position) return context;

  const stepNode = nodes[position.currentStepId];
  const stepType = (stepNode?.metadata.stepType as StepType) || "manual";
  if (stepType !== "autonomous") return context;

  return context + "\n" + NEEDS_REVIEW_INSTRUCTION;
}

export const createWorkflowExecutionActions = (
  get: () => StoreState,
  set: (partial: Partial<StoreState>) => void,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  autonomousCollaborateInTerminal?: (nodeId: string, terminalId: string) => Promise<string>,
  executeCommand?: (command: { execute: () => void; undo: () => void; description?: string }) => void,
): WorkflowExecutionActions => {
  const DEFAULT_STEP_TIMEOUT_MINUTES = 15;
  const MAX_RECURSE_ITERATIONS = 50;
  const stepTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  const recurseCounters = new Map<string, number>();
  const autonomousCollaborations = new Map<string, { filePath: string; terminalId: string }>();

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
          notifyWorkflowEvent("alert", "Step timeout", message);
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
    cleanupAutonomousCollaboration(nodeId);
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
      notifyWorkflowEvent("alert", "Recurse limit reached", "Stopping automatic processing");
      recurseCounters.delete(terminalId);
      return;
    }

    recurseCounters.set(terminalId, counter + 1);
    setTimeout(() => startWorkflow(nextNodeId, terminalId), 2000);
  }

  function completeWorkflow(nodeId: string): void {
    clearStepTimeout(nodeId);
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
    notifyWorkflowEvent("success", "Workflow complete", nodeName);

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
      setTimeout(
        () => sendContentToTerminal(nodeId, entry.terminalTabId),
        1000,
      );
    }

    if (currentParentId) {
      checkRecurse(currentParentId, entry.terminalTabId);
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

      if (mode === "collaborate" && autonomousCollaborateInTerminal) {
        setCollaboratingFlag(nodeId);
        autonomousCollaborateInTerminal(nodeId, terminalId).then((feedbackFilePath) => {
          registerAutonomousCollaboration(nodeId, terminalId, feedbackFilePath);
        }).catch((error) => {
          logger.error(
            "Failed to start collaboration in terminal",
            error as Error,
            "WorkflowExecution",
          );
          stopWorkflow(nodeId);
          useToastStore
            .getState()
            .addToast("Failed to send to terminal — workflow stopped", "error");
          notifyWorkflowEvent("alert", "Workflow error", "Failed to send to terminal");
        });
        return;
      }

      const { contextPrefix, nodeContent } = buildContentWithContext(
        nodeId,
        nodes,
        ancestorRegistry,
        true,
      );

      const effectiveContext = appendNeedsReviewInstruction(
        contextPrefix || DEFAULT_EXECUTE_CONTEXT,
        nodeId,
        nodes,
        ancestorRegistry,
      );

      const terminalContent = buildExecutePrompt(effectiveContext, nodeContent);

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
        notifyWorkflowEvent("alert", "Workflow error", "Failed to send to terminal");
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
      notifyWorkflowEvent("alert", "Workflow error", "Failed to send to terminal");
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

    if (event.hook_event_name === "NeedsReview") {
      const { workflowExecutionStates: currentStates } = get();
      const currentEntry = currentStates[runningNodeId];
      if (currentEntry?.state === "running") {
        set({
          workflowExecutionStates: {
            ...currentStates,
            [runningNodeId]: { ...currentEntry, needsReview: true },
          },
        });
      }
      return;
    }

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
        const { workflowExecutionStates: execStates } = get();
        const execEntry = execStates[runningNodeId];
        if (execEntry?.needsReview) {
          clearStepTimeout(runningNodeId);
          set({
            workflowExecutionStates: {
              ...execStates,
              [runningNodeId]: {
                ...execEntry,
                state: "awaiting-validation",
                needsReview: false,
              },
            },
          });
          useToastStore
            .getState()
            .addToast(
              "AI flagged questions for review — check the terminal output",
              "warning",
              {
                persistent: true,
                actions: [{ label: "OK", onClick: () => {} }],
              },
            );
          notifyWorkflowEvent("alert", "Review requested", "AI flagged questions for review");
        } else if (execEntry?.collaborating) {
          set({
            workflowExecutionStates: {
              ...execStates,
              [runningNodeId]: {
                ...execEntry,
                stopReceived: true,
              },
            },
          });
          logger.info(
            `Stop deferred for collaborating node ${runningNodeId} — waiting for feedback`,
            "WorkflowExecution",
          );
        } else {
          advanceNode(runningNodeId);
        }
      } else if (stepType === "checkpoint") {
        clearStepTimeout(runningNodeId);
        const { nodes: currentNodes, ancestorRegistry: currentRegistry } =
          get();
        const hasNextStep = !!findNextStepTarget(
          runningNodeId,
          currentNodes,
          currentRegistry,
        );

        if (!hasNextStep) {
          completeWorkflow(runningNodeId);
        } else {
          const { workflowExecutionStates: currentStates } = get();
          const currentEntry = currentStates[runningNodeId];
          if (currentEntry) {
            set({
              workflowExecutionStates: {
                ...currentStates,
                [runningNodeId]: {
                  ...currentEntry,
                  state: "awaiting-validation",
                },
              },
            });
          }
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
      }
    } else if (event.hook_event_name === "Notification") {
      stopWorkflow(runningNodeId);
      const message = event.message || "Workflow notification received";
      useToastStore.getState().addToast(message, "warning");
      notifyWorkflowEvent("alert", "Workflow notification", message);
    }
  }

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
    for (const nodeId of autonomousCollaborations.keys()) {
      cleanupAutonomousCollaboration(nodeId);
    }

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

  function handleTerminalClosed(terminalId: string): void {
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.terminalTabId === terminalId && entry.state === "running") {
        delete updatedStates[nodeId];
        cleanupAutonomousCollaboration(nodeId);
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

    cleanupAutonomousCollaboration(nodeId);
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
    cleanupAutonomousCollaboration(nodeId);
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];
    set({ workflowExecutionStates: updatedStates });

    logger.info(
      `Cleared execution state for manually moved node ${nodeId}`,
      "WorkflowExecution",
    );
  }

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
    autonomousCollaborations.set(nodeId, { filePath: feedbackFilePath, terminalId });
  }

  function cleanupAutonomousCollaboration(nodeId: string): void {
    const collab = autonomousCollaborations.get(nodeId);
    if (collab) {
      window.electron.stopFeedbackFileWatcher(collab.filePath);
      autonomousCollaborations.delete(nodeId);
    }
  }

  function findNodeIdByFeedbackFilePath(filePath: string): string | null {
    for (const [nodeId, collab] of autonomousCollaborations) {
      if (filePath.endsWith(collab.filePath)) return nodeId;
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
      notifyWorkflowEvent("alert", "Feedback parse error", "Feedback could not be parsed");
      return;
    }

    const archiveConfig = getArchiveConfigForNode(nodeId, nodes, ancestorRegistry);
    const rootNodeIdOrIds = decomposition && parsed.rootNodeIds.length > 1
      ? parsed.rootNodeIds
      : parsed.rootNodeId;

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
    handleTerminalClosed,
    handleNodeDeleted,
    handleStepDeleted,
    handleAllStepsRemoved,
    handleNodeMovedManually,
    handleAutonomousFeedback,
    findNodeIdByFeedbackFilePath,
  };
};
