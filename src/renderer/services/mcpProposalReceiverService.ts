import { storeManager } from '../store/storeManager';
import { useProposalsStore } from '../store/proposals/proposalsStore';
import { logger } from './logger';
import type { ProposalRequest, ProposalResponse, ProposalPayload } from '../../shared/types/electronApi';

export type HandleProposalResult =
  | { ok: true; proposalId: string }
  | { ok: false; error: string };

export interface HandleProposalDeps {
  findFileForNode: (nodeId: string) => string | null;
}

function defaultFindFileForNode(nodeId: string): string | null {
  for (const { filePath, store } of storeManager.getAllStoreEntries()) {
    if (store.getState().nodes[nodeId]) return filePath;
  }
  return null;
}

export function handleProposalRequest(
  request: ProposalRequest,
  deps: HandleProposalDeps = { findFileForNode: defaultFindFileForNode },
): HandleProposalResult {
  const filePath = deps.findFileForNode(request.nodeId);
  if (!filePath) {
    return { ok: false, error: `Node ${request.nodeId} not found in any open file` };
  }
  try {
    const proposalId = useProposalsStore.getState().addProposal(filePath, {
      sessionId: request.sessionId,
      nodeId: request.nodeId,
      request: request.request as ProposalPayload,
    });
    return { ok: true, proposalId };
  } catch (error) {
    logger.error('proposal-request handler threw', error as Error, 'McpProposalReceiver');
    return { ok: false, error: (error as Error).message };
  }
}

export function startMcpProposalReceiverService(): () => void {
  return window.electron.onMcpProposalRequest((request: ProposalRequest) => {
    const result = handleProposalRequest(request);
    const response: ProposalResponse = { requestId: request.requestId, result };
    void window.electron.respondToMcpProposal(response);
  });
}
