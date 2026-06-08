import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

let managerStores: Array<{ getState: () => { reviews: ReviewMap } }>;
vi.mock('../../store/storeManager', () => ({
  storeManager: {
    getAllStores: () => managerStores,
  },
}));

import { handleProposalRequest } from '../mcpProposalReceiverService';
import type { ProposalRequest } from '../../../shared/types/electronApi';
import type { ReviewMap } from '../../store/tree/reviews';

const FILE_A = '/test/a.arbo';
const NODE = 'node-1';

let reviews: ReviewMap;
let processResult: { success: boolean; reason?: string };
let openReviewZoom: ReturnType<typeof vi.fn>;

const mockStore = {
  getState: () => ({
    reviews,
    ancestorRegistry: {},
    nodes: { [NODE]: { id: NODE, content: 'Reviewed node', children: [], metadata: {} } },
    actions: {
      processIncomingFeedbackContent: vi.fn(async () => processResult),
    },
  }),
  setState: (partial: { reviews?: ReviewMap }) => {
    if (partial.reviews !== undefined) reviews = partial.reviews;
  },
};

function makeRequest(overrides?: Partial<ProposalRequest>): ProposalRequest {
  return {
    requestId: 'req-1',
    sessionId: 'sess-1',
    nodeId: NODE,
    request: { kind: 'submit-step-output', content: 'AI response' },
    ...overrides,
  };
}

function makeDeps(filePath: string | null) {
  return {
    findFileForNode: vi.fn(() => filePath),
    getStoreForFile: vi.fn(() => (filePath ? (mockStore as never) : null)),
    openReviewZoom,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  reviews = {};
  processResult = { success: true };
  managerStores = [];
  openReviewZoom = vi.fn();
});

describe('handleProposalRequest — background review zoom', () => {
  it('opens a background review zoom for the reviewed node after a successful submit', async () => {
    const result = await handleProposalRequest(makeRequest(), makeDeps(FILE_A));

    expect(result.ok).toBe(true);
    expect(openReviewZoom).toHaveBeenCalledWith(FILE_A, NODE, 'Reviewed node');
  });

  it('does not open a zoom when the submitted content fails to parse', async () => {
    processResult = { success: false, reason: 'Content has 2 root nodes, expected 1' };

    const result = await handleProposalRequest(makeRequest(), makeDeps(FILE_A));

    expect(result.ok).toBe(false);
    expect(openReviewZoom).not.toHaveBeenCalled();
  });

  it('does not open a zoom when the target overlaps another review in progress', async () => {
    const ancestor = 'ancestor-1';
    reviews = { [ancestor]: { source: 'terminal', terminalId: null } };
    const overlapStore = {
      getState: () => ({
        reviews,
        ancestorRegistry: { [NODE]: [ancestor] },
        nodes: { [NODE]: { id: NODE, content: 'x', children: [], metadata: {} } },
        actions: { processIncomingFeedbackContent: vi.fn() },
      }),
      setState: vi.fn(),
    };

    const result = await handleProposalRequest(makeRequest(), {
      findFileForNode: vi.fn(() => FILE_A),
      getStoreForFile: vi.fn(() => overlapStore as never),
      openReviewZoom,
    });

    expect(result.ok).toBe(false);
    expect(openReviewZoom).not.toHaveBeenCalled();
  });

  it('does not open a zoom when a browser review is in progress', async () => {
    managerStores = [
      { getState: () => ({ reviews: { 'browser-node': { source: 'browser', terminalId: null } } }) },
    ];

    const result = await handleProposalRequest(makeRequest(), makeDeps(FILE_A));

    expect(result.ok).toBe(false);
    expect(openReviewZoom).not.toHaveBeenCalled();
  });

  it('does not open a zoom when the node is not found in any open file', async () => {
    const result = await handleProposalRequest(makeRequest(), makeDeps(null));

    expect(result.ok).toBe(false);
    expect(openReviewZoom).not.toHaveBeenCalled();
  });
});
