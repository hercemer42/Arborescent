import type { TreeNode } from '../../../../shared/types';
import type { AncestorRegistry } from '../../../utils/ancestry';
import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';
import {
  findNextStepTarget,
  getWorkflowStepPosition,
  getWorkflowStepNumber,
} from '../../../utils/workflowHelpers';
import type { StepType } from '../commands/SetStepTypeCommand';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';
import { notifyWorkflowEvent } from '../../../services/workflowNotification';

interface HookEventState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
}

export interface HookEventPayload {
  session_id: string;
  hook_event_name: string;
  message?: string;
}

export interface HookEventHandlerDeps {
  get: () => HookEventState;
  set: (partial: { workflowExecutionStates?: Record<string, WorkflowExecutionEntry> }) => void;
  findRunningNodeOnTerminal: (terminalId: string) => string | null;
  clearStepTimeout: (nodeId: string) => void;
  clearPendingAck: (nodeId: string) => void;
  advanceNode: (nodeId: string) => void;
  completeWorkflow: (nodeId: string) => void;
  stopWorkflow: (nodeId: string) => void;
}

/**
 * handleHookEvent dispatches Claude Code hook events (NeedsReview, Stop,
 * Notification) into workflow state transitions. The handler branches on
 * the event name and the current step's type (manual / checkpoint /
 * autonomous) to decide whether to pause, advance, complete, or stop.
 *
 * Extracted into its own factory because (a) it was the single largest
 * function in workflowExecutionActions at 160 lines, and (b) its deps
 * (advanceNode / completeWorkflow / stopWorkflow / clearStepTimeout) are
 * the most-referenced "action verbs" of the engine — passing them
 * through an explicit deps interface makes the coupling visible.
 */
export function createHookEventHandler(deps: HookEventHandlerDeps) {
  const {
    get,
    set,
    findRunningNodeOnTerminal,
    clearStepTimeout,
    clearPendingAck,
    advanceNode,
    completeWorkflow,
    stopWorkflow,
  } = deps;

  return function handleHookEvent(event: HookEventPayload): void {
    const { workflowSessionMap } = get();
    const terminalId = workflowSessionMap[event.session_id];
    if (!terminalId) {
      logger.info(
        `Hook event ${event.hook_event_name} ignored: no terminal mapped for session ${event.session_id}`,
        'WorkflowExecution',
      );
      return;
    }

    const runningNodeId = findRunningNodeOnTerminal(terminalId);
    if (!runningNodeId) {
      logger.info(
        `Hook event ${event.hook_event_name} ignored: no running node on terminal ${terminalId}`,
        'WorkflowExecution',
      );
      return;
    }

    logger.info(
      `Hook event ${event.hook_event_name} for node ${runningNodeId} on terminal ${terminalId}`,
      'WorkflowExecution',
    );

    if (event.hook_event_name === 'UserPromptSubmit') {
      clearPendingAck(runningNodeId);
      return;
    }

    if (event.hook_event_name === 'NeedsReview') {
      const { workflowExecutionStates: currentStates } = get();
      const currentEntry = currentStates[runningNodeId];
      if (currentEntry?.state === 'running') {
        set({
          workflowExecutionStates: {
            ...currentStates,
            [runningNodeId]: { ...currentEntry, needsReview: true },
          },
        });
      }
      return;
    }

    if (event.hook_event_name === 'Stop') {
      const { nodes, ancestorRegistry } = get();
      const position = getWorkflowStepPosition(runningNodeId, nodes, ancestorRegistry);
      if (!position) {
        logger.info(
          `Hook Stop ignored: node ${runningNodeId} has no workflow step position`,
          'WorkflowExecution',
        );
        return;
      }

      const stepNode = nodes[position.currentStepId];
      const stepType: StepType = (stepNode?.metadata.stepType as StepType) || 'manual';
      logger.info(
        `Hook Stop at step ${position.currentStepId} (type=${stepType}) for node ${runningNodeId}`,
        'WorkflowExecution',
      );

      if (stepType === 'autonomous') {
        const { workflowExecutionStates: execStates } = get();
        const execEntry = execStates[runningNodeId];
        if (execEntry?.needsReview) {
          clearStepTimeout(runningNodeId);
          set({
            workflowExecutionStates: {
              ...execStates,
              [runningNodeId]: {
                ...execEntry,
                state: 'awaiting-validation',
                needsReview: false,
              },
            },
          });
          useToastStore
            .getState()
            .addToast(
              'AI flagged questions for review — check the terminal output',
              'warning',
              {
                persistent: true,
                actions: [{ label: 'OK', onClick: () => {} }],
              },
            );
          void notifyWorkflowEvent('alert', 'Review requested', 'AI flagged questions for review');
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
            'WorkflowExecution',
          );
        } else {
          advanceNode(runningNodeId);
        }
      } else if (stepType === 'checkpoint') {
        clearStepTimeout(runningNodeId);
        const { nodes: currentNodes, ancestorRegistry: currentRegistry } = get();
        const hasNextStep = !!findNextStepTarget(runningNodeId, currentNodes, currentRegistry);

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
                  state: 'awaiting-validation',
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
          const stepLabel = stepNumber !== null ? `Step ${stepNumber}` : 'Current step';
          useToastStore
            .getState()
            .addToast(
              `${stepLabel} complete for "${runningNodeName}". Review the output before continuing.`,
              'info',
              { persistent: true, actions: [{ label: 'OK', onClick: () => {} }] },
            );
        }
      }
    } else if (event.hook_event_name === 'Notification') {
      stopWorkflow(runningNodeId);
      const message = event.message || 'Workflow notification received';
      useToastStore.getState().addToast(message, 'warning');
      void notifyWorkflowEvent('alert', 'Workflow notification', message);
    }
  };
}
