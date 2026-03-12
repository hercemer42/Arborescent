import { TreeNode } from '../../../../shared/types';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';
import { AncestorRegistry, moveNodeInRegistry } from '../../../utils/ancestry';
import { VisualEffectsActions } from './visualEffectsActions';
import {
  isEligibleForExecution,
  findNextStepTarget,
  getWorkflowStepPosition,
  getWorkflowStepNumber,
  WorkflowExecutionEntry,
} from '../../../utils/workflowHelpers';
import { StepType } from '../commands/SetStepTypeCommand';
import { buildContentWithContext } from '../../../utils/nodeHelpers';
import { buildExecutePrompt } from '../../../utils/promptBuilder';
import { executeInTerminal } from '../../../services/terminalExecution';
import { DEFAULT_EXECUTE_CONTEXT } from './executeActions';
import { usePreferencesStore } from '../../preferences/preferencesStore';

export type { WorkflowExecutionEntry };

export interface WorkflowExecutionActions {
  startWorkflow: (nodeId: string, terminalId: string | null) => void;
  pauseWorkflow: (nodeId: string) => void;
  resumeWorkflow: (nodeId: string) => void;
  completeWorkflow: (nodeId: string) => void;
  advanceNode: (nodeId: string) => void;
  registerSession: (sessionId: string, terminalId: string) => void;
  handleHookEvent: (event: { session_id: string; hook_event_name: string; message?: string }) => void;
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
  visualEffects?: VisualEffectsActions
): WorkflowExecutionActions => {

  const DEFAULT_STEP_TIMEOUT_MINUTES = 10;
  const stepTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  function startStepTimeout(nodeId: string): void {
    clearStepTimeout(nodeId);
    const timeoutMinutes = usePreferencesStore.getState().stepTimeoutMinutes ?? DEFAULT_STEP_TIMEOUT_MINUTES;
    if (timeoutMinutes <= 0) return;
    stepTimeouts.set(nodeId, setTimeout(() => {
      const { workflowExecutionStates } = get();
      const entry = workflowExecutionStates[nodeId];
      if (entry?.state !== 'running') return;
      useToastStore.getState().addToast(
        'Step is taking longer than expected. Verify your AI tool is running.',
        'warning',
        {
          actions: [
            { label: 'Dismiss', onClick: () => {} },
            { label: 'Pause', onClick: () => pauseWorkflow(nodeId) },
          ],
        }
      );
    }, timeoutMinutes * 60 * 1000));
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
      if (entry.state === 'running' && entry.terminalTabId === terminalId) {
        return nodeId;
      }
    }
    return null;
  }

  function moveNodeToFirstStepIfAtRoot(
    nodeId: string,
    nodes: Record<string, TreeNode>,
    registry: AncestorRegistry
  ): { nodes: Record<string, TreeNode>; ancestorRegistry: AncestorRegistry } {
    const ancestors = registry[nodeId];
    const parentId = ancestors[ancestors.length - 1];
    if (!parentId || nodes[parentId]?.metadata.isWorkflow !== true) {
      return { nodes, ancestorRegistry: registry };
    }

    const workflow = nodes[parentId];
    let firstStepId: string | null = null;
    for (const childId of workflow.children) {
      const child = nodes[childId];
      if (child && child.metadata.isWorkflow !== true && child.children !== undefined && childId !== nodeId) {
        firstStepId = childId;
        break;
      }
    }

    if (!firstStepId) {
      return { nodes, ancestorRegistry: registry };
    }

    const updatedNodes = {
      ...nodes,
      [parentId]: {
        ...nodes[parentId],
        children: nodes[parentId].children.filter(id => id !== nodeId),
      },
      [firstStepId]: {
        ...nodes[firstStepId],
        children: [...nodes[firstStepId].children, nodeId],
      },
    };
    return {
      nodes: updatedNodes,
      ancestorRegistry: moveNodeInRegistry(registry, nodeId, firstStepId, updatedNodes),
    };
  }

  function startWorkflow(nodeId: string, terminalId: string | null): void {
    if (terminalId === null) {
      useToastStore.getState().addToast('No terminal tab available. Open a terminal to start workflow execution.', 'warning');
      return;
    }

    const { nodes, ancestorRegistry, workflowExecutionStates } = get();

    if (!isEligibleForExecution(nodeId, nodes, ancestorRegistry, workflowExecutionStates)) {
      return;
    }

    const existingNodeId = findRunningNodeOnTerminal(terminalId);
    if (existingNodeId && existingNodeId !== nodeId) {
      useToastStore.getState().addToast('Terminal tab is already assigned to a running workflow node.', 'warning');
      return;
    }

    const moved = moveNodeToFirstStepIfAtRoot(nodeId, nodes, ancestorRegistry);

    set({
      nodes: moved.nodes,
      ancestorRegistry: moved.ancestorRegistry,
      workflowExecutionStates: {
        ...get().workflowExecutionStates,
        [nodeId]: { state: 'running' as const, terminalTabId: terminalId },
      },
    });

    if (!usePreferencesStore.getState().hasReceivedHookEvent) {
      useToastStore.getState().addToast(
        'Configure Claude Code hooks to enable automatic workflow advancement. Run `echo $ARBORESCENT_HOOK_PORT` in your terminal to verify environment variables are set. See docs/workflows.md for setup instructions.',
        'info'
      );
    }

    startStepTimeout(nodeId);
    logger.info(`Started workflow execution for node ${nodeId} on terminal ${terminalId}`, 'WorkflowExecution');
    triggerAutosave?.();
  }

  function pauseWorkflow(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== 'running') return;

    clearStepTimeout(nodeId);
    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { ...entry, state: 'paused' },
      },
    });

    logger.info(`Paused workflow execution for node ${nodeId}`, 'WorkflowExecution');
  }

  function resumeWorkflow(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== 'paused') return;

    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { ...entry, state: 'running' },
      },
    });

    logger.info(`Resumed workflow execution for node ${nodeId}`, 'WorkflowExecution');
  }

  function completeWorkflow(nodeId: string): void {
    clearStepTimeout(nodeId);
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    delete updatedStates[nodeId];

    set({ workflowExecutionStates: updatedStates });

    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;
    useToastStore.getState().addToast(`Workflow complete for "${nodeName}"`, 'success');

    logger.info(`Completed workflow execution for node ${nodeId}`, 'WorkflowExecution');
    triggerAutosave?.();
  }

  function advanceNode(nodeId: string): void {
    const { workflowExecutionStates, nodes, ancestorRegistry } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== 'running') return;

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
          children: updatedNodes[currentParentId].children.filter(id => id !== nodeId),
        },
        [nextStepId]: {
          ...updatedNodes[nextStepId],
          children: [...updatedNodes[nextStepId].children, nodeId],
        },
      };
    }

    const updatedRegistry = moveNodeInRegistry(ancestorRegistry, nodeId, nextStepId, updatedNodes);

    set({
      nodes: updatedNodes,
      ancestorRegistry: updatedRegistry,
    });

    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;
    const stepNumber = getWorkflowStepNumber(nextStepId, updatedNodes, updatedRegistry);
    const stepLabel = stepNumber !== null ? `Step ${stepNumber}` : 'next step';

    const nextStepNode = updatedNodes[nextStepId];
    const nextStepType: StepType = (nextStepNode?.metadata.stepType as StepType) || 'manual';

    visualEffects?.flashNode(nodeId, 'advance');
    triggerAutosave?.();

    if (nextStepType === 'manual') {
      pauseWorkflow(nodeId);
      useToastStore.getState().addToast(`"${nodeName}" waiting at ${stepLabel}`, 'info');
    } else {
      useToastStore.getState().addToast(`Advanced "${nodeName}" to ${stepLabel}`, 'info');
      startStepTimeout(nodeId);
      sendContentToTerminal(nodeId, entry.terminalTabId);
    }
  }

  function sendContentToTerminal(nodeId: string, terminalId: string): void {
    const { nodes, ancestorRegistry } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const { contextPrefix, nodeContent } = buildContentWithContext(nodeId, nodes, ancestorRegistry, true);

    const terminalContent = buildExecutePrompt(contextPrefix || DEFAULT_EXECUTE_CONTEXT, nodeContent);

    executeInTerminal(terminalId, terminalContent).catch((error) => {
      logger.error('Failed to send content to terminal after advancement', error as Error, 'WorkflowExecution');
      pauseWorkflow(nodeId);
      useToastStore.getState().addToast('Failed to send to terminal — workflow paused', 'error');
    });
  }

  function registerSession(sessionId: string, terminalId: string): void {
    const { workflowSessionMap } = get();

    const updatedMap = { ...workflowSessionMap };
    for (const [existingSession, existingTerminal] of Object.entries(updatedMap)) {
      if (existingTerminal === terminalId) {
        delete updatedMap[existingSession];
      }
    }

    updatedMap[sessionId] = terminalId;
    set({ workflowSessionMap: updatedMap });

    if (!usePreferencesStore.getState().hasReceivedHookEvent) {
      usePreferencesStore.getState().markHookEventReceived();
    }

    logger.info(`Registered session ${sessionId} for terminal ${terminalId}`, 'WorkflowExecution');
  }

  function handleHookEvent(event: { session_id: string; hook_event_name: string; message?: string }): void {
    const { workflowSessionMap } = get();
    const terminalId = workflowSessionMap[event.session_id];
    if (!terminalId) return;

    const runningNodeId = findRunningNodeOnTerminal(terminalId);
    if (!runningNodeId) return;

    if (event.hook_event_name === 'Stop') {
      const { nodes, ancestorRegistry } = get();
      const position = getWorkflowStepPosition(runningNodeId, nodes, ancestorRegistry);
      if (!position) return;

      const stepNode = nodes[position.currentStepId];
      const stepType: StepType = (stepNode?.metadata.stepType as StepType) || 'manual';

      if (stepType === 'autonomous') {
        advanceNode(runningNodeId);
      } else if (stepType === 'checkpoint') {
        pauseWorkflow(runningNodeId);
        const { nodes: currentNodes } = get();
        const runningNode = currentNodes[runningNodeId];
        const runningNodeName = runningNode?.content || runningNodeId;
        useToastStore.getState().addToast(`Step complete for "${runningNodeName}"`, 'info');
      }
    } else if (event.hook_event_name === 'Notification') {
      pauseWorkflow(runningNodeId);
      const message = event.message || 'Workflow notification received';
      useToastStore.getState().addToast(message, 'warning');
    }
  }

  function initializeExecutionState(): void {
    const { workflowExecutionStates } = get();
    let pausedCount = 0;
    const updatedStates: Record<string, WorkflowExecutionEntry> = {};

    for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
      if (entry.state === 'running') {
        updatedStates[nodeId] = { ...entry, state: 'paused' };
        pausedCount++;
      } else {
        updatedStates[nodeId] = entry;
      }
    }

    set({
      workflowExecutionStates: updatedStates,
      workflowSessionMap: {},
    });

    if (pausedCount > 0) {
      useToastStore.getState().addToast(
        `${pausedCount} workflow(s) paused on restart. Resume when ready.`,
        'warning'
      );
    }

    logger.info(`Initialized execution state, paused ${pausedCount} workflows`, 'WorkflowExecution');
  }

  function handleTerminalClosed(terminalId: string): void {
    const { workflowExecutionStates, nodes } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.state === 'running' && entry.terminalTabId === terminalId) {
        updatedStates[nodeId] = { ...entry, state: 'paused' };
        const node = nodes[nodeId];
        const nodeName = node?.content || nodeId;
        useToastStore.getState().addToast(
          `"${nodeName}" paused — terminal closed`,
          'warning'
        );
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

    logger.info(`Cleared execution state for deleted node ${nodeId}`, 'WorkflowExecution');
  }

  function handleStepDeleted(stepId: string): void {
    const { workflowExecutionStates, ancestorRegistry } = get();
    const updatedStates = { ...workflowExecutionStates };
    let changed = false;

    for (const [nodeId, entry] of Object.entries(updatedStates)) {
      if (entry.state === 'running') {
        const ancestors = ancestorRegistry[nodeId];
        if (ancestors) {
          const parentId = ancestors[ancestors.length - 1];
          if (parentId === stepId) {
            updatedStates[nodeId] = { ...entry, state: 'paused' };
            changed = true;
          }
        }
      }
    }

    if (changed) {
      set({ workflowExecutionStates: updatedStates });
      useToastStore.getState().addToast('Step removed — affected workflows paused', 'warning');
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
        useToastStore.getState().addToast(`Workflow complete for "${nodeName}"`, 'success');
      }
      triggerAutosave?.();
    }
  }

  function handleNodeMovedManually(nodeId: string): void {
    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== 'running') return;

    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { ...entry, state: 'paused' },
      },
    });

    logger.info(`Paused workflow for manually moved node ${nodeId}`, 'WorkflowExecution');
  }

  return {
    startWorkflow,
    pauseWorkflow,
    resumeWorkflow,
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
