import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// The browser-exclusivity guard scans the real storeManager singleton, not the injected deps,
// so we mock it. getAllStores returns whatever managerStores holds; default [] preserves the
// non-browser tests (no browser review anywhere).
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
const SESSION = 'sess-1';

let processedArgs: { content: string; source: string; reviewedNodeId: string } | null;
let processResult: { success: boolean; reason?: string };
let reviews: ReviewMap;

const mockStore = {
  getState: () => ({
    reviews,
    ancestorRegistry: {},
    actions: {
      processIncomingFeedbackContent: vi.fn(
        async (content: string, source: string, reviewedNodeId: string) => {
          processedArgs = { content, source, reviewedNodeId };
          return processResult;
        },
      ),
    },
  }),
  setState: (partial: { reviews?: ReviewMap }) => {
    if (partial.reviews !== undefined) reviews = partial.reviews;
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  processedArgs = null;
  processResult = { success: true };
  reviews = {};
  managerStores = [];
});

describe('handleProposalRequest', () => {
  function makeRequest(overrides?: Partial<ProposalRequest>): ProposalRequest {
    return {
      requestId: 'req-1',
      sessionId: SESSION,
      nodeId: NODE,
      request: { kind: 'submit-step-output', content: 'AI response' },
      ...overrides,
    };
  }

  function makeDeps(filePath: string | null) {
    return {
      findFileForNode: vi.fn(() => filePath),
      getStoreForFile: vi.fn(() => (filePath ? (mockStore as never) : null)),
    };
  }

  it('routes submit-step-output content through processIncomingFeedbackContent on the file store', async () => {
    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(true);
    expect(processedArgs).toEqual({
      content: 'AI response',
      source: 'mcp-proposal',
      reviewedNodeId: NODE,
    });
  });

  it('opens a terminal review on the file store for the proposal node so processIncomingFeedbackContent can land its content (workflow-step path where no manual collab was started)', async () => {
    const deps = makeDeps(FILE_A);
    await handleProposalRequest(makeRequest(), deps);
    expect(reviews[NODE]).toEqual({ source: 'terminal', terminalId: null });
  });

  it('returns an error when no open file contains the bound nodeId', async () => {
    const deps = makeDeps(null);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found|no open file/i);
    expect(processedArgs).toBeNull();
  });

  it('returns an error when feedback content processing fails (e.g. no active collaboration on the file)', async () => {
    processResult = { success: false };
    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/feedback|parse|content/i);
  });

  it('surfaces the parse failure reason from processIncomingFeedbackContent in the AI-facing error so the assistant can self-correct on retry', async () => {
    processResult = { success: false, reason: 'Content has 2 root nodes, expected 1' };
    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/2 root nodes/);
      expect(result.error).toMatch(/expected 1/);
    }
  });

  it('restores the prior reviews on parse failure so the node is not stuck in review (regression: was leaving the node in review after failed parse)', async () => {
    reviews = {};
    processResult = { success: false, reason: 'Content has 2 root nodes, expected 1' };

    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    expect(reviews).toEqual({});
    expect(reviews[NODE]).toBeUndefined();
  });

  it('restores pre-existing reviews on parse failure rather than dropping them (do not clobber an unrelated active review)', async () => {
    const unrelated: ReviewMap = { 'unrelated-node': { source: 'browser', terminalId: null } };
    reviews = unrelated;
    processResult = { success: false, reason: 'no headings' };

    const deps = makeDeps(FILE_A);
    await handleProposalRequest(makeRequest(), deps);

    expect(reviews).toEqual(unrelated);
    expect(reviews[NODE]).toBeUndefined();
  });

  it('restores prior review state when the handler throws (defensive: try/catch must not leak state)', async () => {
    reviews = {};

    const throwingStore = {
      getState: () => ({
        reviews,
        ancestorRegistry: {},
        actions: {
          processIncomingFeedbackContent: vi.fn(async () => {
            throw new Error('boom');
          }),
        },
      }),
      setState: (partial: { reviews?: ReviewMap }) => {
        if (partial.reviews !== undefined) reviews = partial.reviews;
      },
    };

    const deps = {
      findFileForNode: vi.fn(() => FILE_A),
      getStoreForFile: vi.fn(() => throwingStore as never),
    };

    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    expect(reviews).toEqual({});
    expect(reviews[NODE]).toBeUndefined();
  });

  it('rejects write-tool proposals with a clear error directing Claude to use submit_step_output', async () => {
    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(
      makeRequest({ request: { kind: 'add-child', parentId: NODE, content: 'new' } }),
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/submit_step_output/i);
    expect(processedArgs).toBeNull();
  });

  it('rejects each non-submit-step-output proposal kind with the same submit_step_output guidance', async () => {
    const deps = makeDeps(FILE_A);
    const kinds: ProposalRequest['request'][] = [
      { kind: 'add-child', parentId: NODE, content: 'x' },
      { kind: 'append', content: 'x' },
      { kind: 'mark-complete', status: 'completed' },
      { kind: 'set-content', content: 'x' },
      { kind: 'delete' },
      { kind: 'move', newParentId: 'p' },
      { kind: 'set-metadata', key: 'k', value: 'v' },
    ];

    for (const request of kinds) {
      const result = await handleProposalRequest(makeRequest({ request }), deps);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/submit_step_output/i);
    }
  });

  it('refuses when the target node overlaps a review already in progress (ancestor in review) and leaves the store untouched', async () => {
    // request.nodeId (NODE) is a descendant of an in-review node via the ancestorRegistry,
    // so isReviewOverlap returns true.
    const inReviewAncestor = 'ancestor-1';
    const overlapReviews: ReviewMap = {
      [inReviewAncestor]: { source: 'terminal', terminalId: null },
    };
    const processSpy = vi.fn();
    const setStateSpy = vi.fn();

    const overlapStore = {
      getState: () => ({
        reviews: overlapReviews,
        ancestorRegistry: { [NODE]: [inReviewAncestor] },
        actions: { processIncomingFeedbackContent: processSpy },
      }),
      setState: setStateSpy,
    };

    const deps = {
      findFileForNode: vi.fn(() => FILE_A),
      getStoreForFile: vi.fn(() => overlapStore as never),
    };

    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/overlaps another review already in progress/);
    expect(processSpy).not.toHaveBeenCalled();
    expect(setStateSpy).not.toHaveBeenCalled();
    expect(overlapReviews).toEqual({
      [inReviewAncestor]: { source: 'terminal', terminalId: null },
    });
    expect(overlapReviews[NODE]).toBeUndefined();
  });

  it('accepts a submit to a node that is already in its OWN review — a collaborate send marks the node before the AI delivers via submit_step_output, so this is delivery, not a second review (regression: self-overlap used to refuse the awaited response)', async () => {
    reviews = { [NODE]: { source: 'terminal', terminalId: 'term-1' } };

    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(true);
    expect(processedArgs).toEqual({
      content: 'AI response',
      source: 'mcp-proposal',
      reviewedNodeId: NODE,
    });
  });

  it('refuses when a strict descendant of the target is in review (engulfing), even though the target itself is not', async () => {
    const inReviewDescendant = 'descendant-1';
    const overlapReviews: ReviewMap = {
      [inReviewDescendant]: { source: 'terminal', terminalId: null },
    };
    const processSpy = vi.fn();
    const setStateSpy = vi.fn();

    const overlapStore = {
      getState: () => ({
        reviews: overlapReviews,
        ancestorRegistry: { [inReviewDescendant]: [NODE] },
        actions: { processIncomingFeedbackContent: processSpy },
      }),
      setState: setStateSpy,
    };

    const deps = {
      findFileForNode: vi.fn(() => FILE_A),
      getStoreForFile: vi.fn(() => overlapStore as never),
    };

    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/overlaps another review already in progress/);
    expect(processSpy).not.toHaveBeenCalled();
    expect(setStateSpy).not.toHaveBeenCalled();
  });

  it('refuses when a browser review is in progress in any open file (browser is exclusive) and does not process feedback', async () => {
    managerStores = [
      { getState: () => ({ reviews: { 'browser-node': { source: 'browser', terminalId: null } } }) },
    ];

    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/browser review in progress/);
    expect(processedArgs).toBeNull();
  });

  it('returns ok with a synthetic proposalId for submit-step-output (the proposal does not persist in any store)', async () => {
    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposalId).toEqual(expect.any(String));
  });
});

describe('startMcpProposalReceiverService — IPC wiring', () => {
  it.todo('subscribes to onMcpProposalRequest and responds on respondToMcpProposal with the same requestId');
  it.todo('returns an unsubscribe function that detaches the listener');
  it.todo('exceptions inside handleProposalRequest do not propagate — error result is sent instead');
});
