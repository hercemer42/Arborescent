import { v4 as uuidv4 } from 'uuid';
import { storeManager } from '../store/storeManager';
import { logger } from './logger';
import type { ProposalRequest, ProposalResponse } from '../../shared/types/electronApi';
import type { TreeStore } from '../store/tree/treeStore';

export type HandleProposalResult =
  | { ok: true; proposalId: string }
  | { ok: false; error: string };

export interface HandleProposalDeps {
  findFileForNode: (nodeId: string) => string | null;
  getStoreForFile: (filePath: string) => TreeStore | null;
}

const SUBMIT_STEP_OUTPUT_GUIDANCE =
  'Structural write tools are not available for review on non-automatic steps. ' +
  'Call submit_step_output with your updated content instead, and the user will ' +
  'review the diff before it is applied.';

function defaultFindFileForNode(nodeId: string): string | null {
  for (const { filePath, store } of storeManager.getAllStoreEntries()) {
    if (store.getState().nodes[nodeId]) return filePath;
  }
  return null;
}

function defaultGetStoreForFile(filePath: string): TreeStore | null {
  return storeManager.getStoreForFile(filePath);
}

export async function handleProposalRequest(
  request: ProposalRequest,
  deps: HandleProposalDeps = {
    findFileForNode: defaultFindFileForNode,
    getStoreForFile: defaultGetStoreForFile,
  },
): Promise<HandleProposalResult> {
  const filePath = deps.findFileForNode(request.nodeId);
  if (!filePath) {
    return { ok: false, error: `Node ${request.nodeId} not found in any open file` };
  }

  if (request.request.kind !== 'submit-step-output') {
    return { ok: false, error: SUBMIT_STEP_OUTPUT_GUIDANCE };
  }

  const store = deps.getStoreForFile(filePath);
  if (!store) {
    return { ok: false, error: `Tree store unavailable for ${filePath}` };
  }

  try {
    const result = await store
      .getState()
      .actions.processIncomingFeedbackContent(request.request.content, 'mcp-proposal', true);
    if (!result.success) {
      return {
        ok: false,
        error:
          'Feedback panel could not display the submitted content. ' +
          'Make sure the workflow step is the active collaboration.',
      };
    }
    return { ok: true, proposalId: uuidv4() };
  } catch (error) {
    logger.error('proposal-request handler threw', error as Error, 'McpProposalReceiver');
    return { ok: false, error: (error as Error).message };
  }
}

export function startMcpProposalReceiverService(): () => void {
  return window.electron.onMcpProposalRequest((request: ProposalRequest) => {
    void handleProposalRequest(request).then((result) => {
      const response: ProposalResponse = { requestId: request.requestId, result };
      void window.electron.respondToMcpProposal(response);
    });
  });
}
