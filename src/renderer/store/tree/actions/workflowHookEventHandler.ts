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
  terminal_id?: string;
  source?: string;
  // Completion gate: false means no explicit submit_step_output happened
  // this turn and the bound step must not advance. Absent is permissive.
  explicit_submit_seen?: boolean;
}

export interface HookEventHandlerDeps {
  get: () => HookEventState;
  set: (partial: { workflowExecutionStates?: Record<string, WorkflowExecutionEntry> }) => void;
  findRunningNodeOnTerminal: (terminalId: string) => string | null;
  consumePendingAck: (nodeId: string) => void;
  advanceNode: (nodeId: string) => void;
  completeWorkflow: (nodeId: string) => void;
  stopWorkflow: (nodeId: string) => void;
}

/**
 * handleHookEvent dispatches Claude Code hook events (NeedsReview, Stop,
 * Notification) into workflow state transitions. The handler branches on
 * the event name and the current step's type (manual / checkpoint /
 * autonomous) to decide whether to pause, advance, complete, or stop.
 */
export function createHookEventHandler(deps: HookEventHandlerDeps) {
  const {
    get,
    set,
    findRunningNodeOnTerminal,
    consumePendingAck,
    advanceNode,
    completeWorkflow,
    stopWorkflow,
  } = deps;

  return function handleHookEvent(event: HookEventPayload): void {
    const { workflowSessionMap } = get();
    const terminalId = workflowSessionMap[event.session_id] || event.terminal_id;
    if (!terminalId) {
      logger.warn(
        `Hook event ${event.hook_event_name} dropped: no terminal mapped for session ${event.session_id}`,
        'WorkflowExecution',
      );
      return;
    }

    const runningNodeId = findRunningNodeOnTerminal(terminalId);
    if (!runningNodeId) {
      logger.warn(
        `Hook event ${event.hook_event_name} dropped: no running node on terminal ${terminalId}`,
        'WorkflowExecution',
      );
      return;
    }

    logger.info(
      `Hook event ${event.hook_event_name} for node ${runningNodeId} on terminal ${terminalId}`,
      'WorkflowExecution',
      { nodeId: runningNodeId },
    );

    if (event.hook_event_name === 'UserPromptSubmit') {
      consumePendingAck(runningNodeId);
      return;
    }

    if (event.hook_event_name === 'NeedsReview') {
      const { workflowExecutionStates: currentStates } = get();
      const currentEntry = currentStates[runningNodeId];
      if (currentEntry?.state === 'running') {
        set({
          workflowExecutionStates: {
            ...currentStates,
            [runningNodeId]: { ...currentEntry, needsReview: true, needsReviewNotified: true },
          },
        });
      }
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
      return;
    }

    if (event.hook_event_name === 'Stop') {
      const { nodes, ancestorRegistry } = get();
      const position = getWorkflowStepPosition(runningNodeId, nodes, ancestorRegistry);
      if (!position) {
        logger.info(
          `Hook Stop ignored: node ${runningNodeId} has no workflow step position`,
          'WorkflowExecution',
          { nodeId: runningNodeId },
        );
        return;
      }

      const stepNode = nodes[position.currentStepId];
      const stepType: StepType = (stepNode?.metadata.stepType as StepType) || 'manual';
      // Production routes every Stop through hookEventDispatcher, which sets
      // explicit_submit_seen from the store. Absent means a non-dispatcher
      // caller (tests, fallback when no MCP server) and is treated as
      // permissive — any new Stop path must keep that invariant or set the
      // flag explicitly.
      const explicitSubmitSeen = event.explicit_submit_seen !== false;
      logger.info(
        `Hook Stop at step ${position.currentStepId} (type=${stepType}) explicit_submit_seen=${explicitSubmitSeen} for node ${runningNodeId}`,
        'WorkflowExecution',
        { nodeId: runningNodeId },
      );

      if (!explicitSubmitSeen && stepType !== 'manual') {
        logger.info(
          `Hook Stop gated: no explicit submit this turn — bound step ${position.currentStepId} remains in flight`,
          'WorkflowExecution',
          { nodeId: runningNodeId },
        );
        return;
      }

      if (stepType === 'autonomous') {
        const { workflowExecutionStates: execStates } = get();
        const execEntry = execStates[runningNodeId];
        if (execEntry?.needsReview) {
          const alreadyNotified = execEntry.needsReviewNotified === true;
          set({
            workflowExecutionStates: {
              ...execStates,
              [runningNodeId]: {
                ...execEntry,
                state: 'awaiting-validation',
                needsReview: false,
                needsReviewNotified: false,
              },
            },
          });
          if (!alreadyNotified) {
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
          }
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
            { nodeId: runningNodeId },
          );
        } else {
          advanceNode(runningNodeId);
        }
      } else if (stepType === 'manual') {
        logger.info(
          `Hook Stop ignored: manual step ${position.currentStepId} — user drives advancement`,
          'WorkflowExecution',
          { nodeId: runningNodeId },
        );
      } else if (stepType === 'checkpoint') {
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
