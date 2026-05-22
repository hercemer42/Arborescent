import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleProposalRequest } from '../mcpProposalReceiverService';
import type { ProposalRequest } from '../../../shared/types/electronApi';

const FILE_A = '/test/a.arbo';
const NODE = 'node-1';
const SESSION = 'sess-1';

let processedContent: { content: string; source: string; skipSave: boolean } | null;
let processResult: { success: boolean; reason?: string };
let collaboratingNodeId: string | null;
let collaborationSource: string | null;

const mockStore = {
  getState: () => ({
    collaboratingNodeId,
    collaborationSource,
    actions: {
      processIncomingFeedbackContent: vi.fn(async (content: string, source: string, skipSave: boolean) => {
        processedContent = { content, source, skipSave };
        return processResult;
      }),
    },
  }),
  setState: (partial: { collaboratingNodeId?: string | null; collaborationSource?: string | null }) => {
    if (partial.collaboratingNodeId !== undefined) collaboratingNodeId = partial.collaboratingNodeId;
    if (partial.collaborationSource !== undefined) collaborationSource = partial.collaborationSource;
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  processedContent = null;
  processResult = { success: true };
  collaboratingNodeId = null;
  collaborationSource = null;
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
    expect(processedContent).toEqual({
      content: 'AI response',
      source: 'mcp-proposal',
      skipSave: true,
    });
  });

  it('sets collaboratingNodeId on the file store to the proposal node so processIncomingFeedbackContent can land its content (workflow-step path where no manual collab was started)', async () => {
    const deps = makeDeps(FILE_A);
    await handleProposalRequest(makeRequest(), deps);
    expect(collaboratingNodeId).toBe(NODE);
    expect(collaborationSource).toBe('terminal');
  });

  it('returns an error when no open file contains the bound nodeId', async () => {
    const deps = makeDeps(null);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found|no open file/i);
    expect(processedContent).toBeNull();
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

  it('restores the prior collaboratingNodeId/collaborationSource on parse failure so the node is not stuck highlighted (regression: was leaving collaboratingNodeId set after failed parse)', async () => {
    collaboratingNodeId = null;
    collaborationSource = null;
    processResult = { success: false, reason: 'Content has 2 root nodes, expected 1' };

    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    expect(collaboratingNodeId).toBeNull();
    expect(collaborationSource).toBeNull();
  });

  it('restores a pre-existing collaboratingNodeId on parse failure rather than overwriting it with null (do not clobber an unrelated active collaboration)', async () => {
    collaboratingNodeId = 'unrelated-node';
    collaborationSource = 'browser';
    processResult = { success: false, reason: 'no headings' };

    const deps = makeDeps(FILE_A);
    await handleProposalRequest(makeRequest(), deps);

    expect(collaboratingNodeId).toBe('unrelated-node');
    expect(collaborationSource).toBe('browser');
  });

  it('restores prior collaboration state when the handler throws (defensive: try/catch must not leak state)', async () => {
    collaboratingNodeId = null;
    collaborationSource = null;

    const throwingStore = {
      getState: () => ({
        collaboratingNodeId,
        collaborationSource,
        actions: {
          processIncomingFeedbackContent: vi.fn(async () => {
            throw new Error('boom');
          }),
        },
      }),
      setState: (partial: { collaboratingNodeId?: string | null; collaborationSource?: string | null }) => {
        if (partial.collaboratingNodeId !== undefined) collaboratingNodeId = partial.collaboratingNodeId;
        if (partial.collaborationSource !== undefined) collaborationSource = partial.collaborationSource;
      },
    };

    const deps = {
      findFileForNode: vi.fn(() => FILE_A),
      getStoreForFile: vi.fn(() => throwingStore as never),
    };

    const result = await handleProposalRequest(makeRequest(), deps);

    expect(result.ok).toBe(false);
    expect(collaboratingNodeId).toBeNull();
    expect(collaborationSource).toBeNull();
  });

  it('rejects write-tool proposals with a clear error directing Claude to use submit_step_output', async () => {
    const deps = makeDeps(FILE_A);
    const result = await handleProposalRequest(
      makeRequest({ request: { kind: 'add-child', parentId: NODE, content: 'new' } }),
      deps,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/submit_step_output/i);
    expect(processedContent).toBeNull();
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
