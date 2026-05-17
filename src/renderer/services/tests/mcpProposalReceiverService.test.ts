import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// PR7 — renderer-side IPC receiver for proposals. Listens for
// mcp:proposal-request, finds the file store that owns the bound nodeId,
// appends to the proposals store with that file's path, and replies on the
// matching response channel with the assigned proposalId (or an error).
import { handleProposalRequest } from '../mcpProposalReceiverService';
import { useProposalsStore } from '../../store/proposals/proposalsStore';
import type { ProposalRequest } from '../../../shared/types/electronApi';

const FILE_A = '/test/a.arbo';
const NODE = 'node-1';
const SESSION = 'sess-1';

beforeEach(() => {
  useProposalsStore.setState({ proposalsByFile: {} });
  vi.clearAllMocks();
});

describe('handleProposalRequest', () => {
  function makeRequest(overrides?: Partial<ProposalRequest>): ProposalRequest {
    return {
      requestId: 'req-1',
      sessionId: SESSION,
      nodeId: NODE,
      request: { kind: 'add-child', parentId: NODE, content: 'pending' },
      ...overrides,
    };
  }

  function makeStoreLookup(filePath: string | null) {
    return vi.fn(() => filePath);
  }

  it('appends the proposal to the file store that owns the bound nodeId and returns ok with the assigned proposalId', () => {
    const findFileForNode = makeStoreLookup(FILE_A);
    const result = handleProposalRequest(makeRequest(), { findFileForNode });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.proposalId).toEqual(expect.any(String));
    const proposals = useProposalsStore.getState().getProposalsForFile(FILE_A);
    expect(proposals).toHaveLength(1);
    expect(proposals[0].nodeId).toBe(NODE);
    expect(proposals[0].sessionId).toBe(SESSION);
  });

  it('returns an error when no open file contains the bound nodeId', () => {
    const findFileForNode = makeStoreLookup(null);
    const result = handleProposalRequest(makeRequest(), { findFileForNode });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not found|no open file/i);
    expect(useProposalsStore.getState().getProposalsForFile(FILE_A)).toEqual([]);
  });

  it('a submit-step-output proposal is stored with its content', () => {
    const findFileForNode = makeStoreLookup(FILE_A);
    handleProposalRequest(
      makeRequest({ request: { kind: 'submit-step-output', content: 'AI response' } }),
      { findFileForNode },
    );
    const proposal = useProposalsStore.getState().getProposalsForFile(FILE_A)[0];
    expect(proposal.request).toEqual({ kind: 'submit-step-output', content: 'AI response' });
  });
});

describe('startMcpProposalReceiverService — IPC wiring', () => {
  it.todo('subscribes to onMcpProposalRequest and responds on respondToMcpProposal with the same requestId');
  it.todo('returns an unsubscribe function that detaches the listener');
  it.todo('exceptions inside handleProposalRequest do not propagate — error result is sent instead');
});
