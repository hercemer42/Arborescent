import type {
  StepOutputApplyRequest,
} from '../../shared/types/electronApi';
import { TreeStore } from '../store/tree/treeStore';
import { storeManager } from '../store/storeManager';
import { logger } from './logger';

export type ApplyResult = { ok: true } | { ok: false; error: string };

function findStoreForNode(nodeId: string): TreeStore | null {
  for (const store of storeManager.getAllStores()) {
    if (store.getState().nodes[nodeId]) return store;
  }
  return null;
}

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
  if (state.workflowExecutionStates[nodeId]) {
    const handler = getActions(store)?.handleAutonomousFeedback;
    if (!handler) {
      return { ok: false, error: `Workflow handler unavailable for node ${nodeId}` };
    }
    handler(nodeId, content);
    return { ok: true };
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
  const store = findStoreForNode(request.nodeId);
  if (!store) {
    logger.warn(
      `step-output-apply: node ${request.nodeId} not found in any open store`,
      'McpStepOutputApplier',
    );
    return { ok: false, error: `Node ${request.nodeId} not found in any open file` };
  }
  try {
    return applyStepOutput(store, request.nodeId, request.content);
  } catch (error) {
    logger.error('step-output-apply threw', error as Error, 'McpStepOutputApplier');
    return { ok: false, error: (error as Error).message };
  }
}
