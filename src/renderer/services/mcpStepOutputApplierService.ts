import type {
  StepOutputApplyRequest,
} from '../../shared/types/electronApi';
import { TreeStore } from '../store/tree/treeStore';
import { storeManager } from '../store/storeManager';
import { logger } from './logger';

type ApplyResult = { ok: true } | { ok: false; error: string };

function findStoreForNode(nodeId: string): TreeStore | null {
  for (const store of storeManager.getAllStores()) {
    if (store.getState().nodes[nodeId]) return store;
  }
  return null;
}

interface StoreActionsWithAutosave {
  autoSave?: () => void;
}

function triggerAutoSave(store: TreeStore): void {
  const actions = (store.getState() as { actions?: StoreActionsWithAutosave }).actions;
  actions?.autoSave?.();
}

export function applyStepOutput(store: TreeStore, nodeId: string, content: string): ApplyResult {
  const state = store.getState();
  const node = state.nodes[nodeId];
  if (!node) return { ok: false, error: `Node ${nodeId} not found` };

  // The feedback-file pipeline owns content for any node currently routed through
  // file-watcher collab: autonomous workflow steps (workflowExecutionStates entry)
  // and manual terminal collaborations awaiting feedback-panel review
  // (collaboratingNodeId === nodeId). The Stop-hook safety net carries chat text,
  // not parsed feedback markdown — applying it would clobber the file-watcher's
  // result before the user gets to review it. Skip; main-side marker still sets so
  // an explicit submit later in the turn is also deduped. PR8 retires this gate
  // when prompts move to MCP-only.
  if (state.workflowExecutionStates[nodeId] || state.collaboratingNodeId === nodeId) {
    logger.info(
      `step-output-apply: skipping node ${nodeId} (file-watcher collab owns this turn)`,
      'McpStepOutputApplier',
    );
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
