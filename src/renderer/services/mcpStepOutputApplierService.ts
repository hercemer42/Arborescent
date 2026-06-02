import type {
  StepOutputApplyRequest,
} from '../../shared/types/electronApi';
import { TreeStore } from '../store/tree/treeStore';
import { findStoreOwningSession } from '../store/storeOwnership';
import { logger } from './logger';
import {
  getAutonomousStepContext,
  isStructurallyAutonomous,
} from '../../shared/utils/autonomousStepContext';

export type ApplyResult = { ok: true } | { ok: false; error: string };

interface StoreActionsForApply {
  autoSave?: () => void;
  handleAutonomousFeedback?: (nodeId: string, content: string) => void;
}

function getActions(store: TreeStore): StoreActionsForApply | undefined {
  return (store.getState() as { actions?: StoreActionsForApply }).actions;
}

function triggerAutoSave(store: TreeStore): void {
  getActions(store)?.autoSave?.();
}

export function applyStepOutput(
  store: TreeStore,
  nodeId: string,
  content: string,
): ApplyResult {
  const state = store.getState();
  const node = state.nodes[nodeId];
  if (!node) return { ok: false, error: `Node ${nodeId} not found` };

  // Autonomous workflow steps must route through handleAutonomousFeedback so
  // submitted markdown is parsed, decomposition children are created, the
  // AcceptFeedbackCommand fires, and the workflow advances and recurses. A
  // direct content write would dump a decomposed step's "# Item 1 / # Item 2"
  // output verbatim into one node and skip child creation, advance, and
  // recurse.
  const context = getAutonomousStepContext(nodeId, state);
  if (context !== null) {
    const handler = getActions(store)?.handleAutonomousFeedback;
    if (!handler) {
      return { ok: false, error: `Workflow handler unavailable for node ${nodeId}` };
    }
    handler(nodeId, content);
    return { ok: true };
  }

  // Server gate 1 admitted this as autonomous but the unified context is
  // missing — refuse rather than blob-write raw markdown into the node.
  if (isStructurallyAutonomous(nodeId, state)) {
    logger.warn(
      `gate-miss gate=1+2 node=${nodeId} reason=missing-context`,
      'McpStepOutputApplier',
    );
    return {
      ok: false,
      error: `Routing gate disagreement for node ${nodeId} — autonomous step has no execution context`,
    };
  }

  store.setState({
    nodes: {
      ...state.nodes,
      [nodeId]: { ...node, content },
    },
  });
  triggerAutoSave(store);
  return { ok: true };
}

export function startMcpStepOutputApplierService(): () => void {
  return window.electron.onMcpStepOutputApplyRequest((request: StepOutputApplyRequest) => {
    const result = handleRequest(request);
    void window.electron.respondToMcpStepOutputApply({ requestId: request.requestId, result });
  });
}

function handleRequest(request: StepOutputApplyRequest): ApplyResult {
  const store = findStoreOwningSession(request.sessionId);
  if (!store) {
    logger.warn(
      `step-output-apply: no open file owns session ${request.sessionId}`,
      'McpStepOutputApplier',
    );
    return { ok: false, error: `No open file owns session ${request.sessionId}` };
  }
  try {
    return applyStepOutput(store, request.nodeId, request.content);
  } catch (error) {
    logger.error('step-output-apply threw', error as Error, 'McpStepOutputApplier');
    return { ok: false, error: (error as Error).message };
  }
}
