import { v4 as uuidv4 } from 'uuid';
import { storeManager } from '../store/storeManager';
import { logger } from './logger';
import { addReview, hasBrowserReview, isReviewOverlap } from '../store/tree/reviews';
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

  const targetStore = store;
  const state = targetStore.getState();

  // A browser review is exclusive (its clipboard delivery is session-less), so an MCP submit can't
  // race it — refuse with a retryable message rather than opening a second concurrent review.
  const browserReviewActive = storeManager.getAllStores().some((s) => hasBrowserReview(s.getState().reviews));
  if (browserReviewActive) {
    return { ok: false, error: 'cannot give feedback, browser review in progress, finish and retry' };
  }

  // A review may not nest inside or engulf another.
  if (isReviewOverlap(state.reviews, request.nodeId, state.ancestorRegistry)) {
    return { ok: false, error: 'cannot give feedback, the target overlaps a review already in progress, finish and retry' };
  }

  // Snapshot the review map so we can revert if the submission can't be applied — otherwise a
  // parse failure leaves the node stuck in review with no proposition ever appearing.
  const priorReviews = state.reviews;
  const restorePriorState = (): void => {
    targetStore.setState({ reviews: priorReviews });
  };

  try {
    targetStore.setState({
      reviews: addReview(targetStore.getState().reviews, request.nodeId, { source: 'terminal', terminalId: null }),
    });
    const result = await targetStore
      .getState()
      .actions.processIncomingFeedbackContent(request.request.content, 'mcp-proposal', request.nodeId);
    if (!result.success) {
      restorePriorState();
      const reasonSuffix = result.reason ? ` — ${result.reason}` : '';
      return {
        ok: false,
        error: `Submitted content could not be applied${reasonSuffix}`,
      };
    }
    return { ok: true, proposalId: uuidv4() };
  } catch (error) {
    restorePriorState();
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
