import { describe, it, expect, beforeEach } from 'vitest';

// PR7 — per-file proposals store. Pending proposals from Claude (via MCP) are
// queued here and rendered in the feedback panel for user accept/reject.
// Accepted proposals route through executeCommand to land in HistoryManager.
import { useProposalsStore, ProposalPayload } from '../proposalsStore';

const FILE_A = '/test/a.arbo';
const FILE_B = '/test/b.arbo';
const SESSION_1 = 'sess-1';
const SESSION_2 = 'sess-2';
const NODE = 'node-1';

function makeRequest(): ProposalPayload {
  return { kind: 'add-child', parentId: NODE, content: 'new' };
}

describe('useProposalsStore — add and list', () => {
  beforeEach(() => {
    useProposalsStore.setState({ proposalsByFile: {} });
  });

  it('add returns the new proposalId and stores the proposal under the given file', () => {
    const proposalId = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1,
      nodeId: NODE,
      request: makeRequest(),
    });
    expect(proposalId).toEqual(expect.any(String));
    const list = useProposalsStore.getState().getProposalsForFile(FILE_A);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(proposalId);
    expect(list[0].nodeId).toBe(NODE);
    expect(list[0].sessionId).toBe(SESSION_1);
    expect(list[0].request).toEqual(makeRequest());
  });

  it('proposals are stamped with a monotonically increasing createdAt', () => {
    const id1 = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    const id2 = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    const list = useProposalsStore.getState().getProposalsForFile(FILE_A);
    const p1 = list.find((p) => p.id === id1)!;
    const p2 = list.find((p) => p.id === id2)!;
    expect(p2.createdAt).toBeGreaterThanOrEqual(p1.createdAt);
  });

  it('proposals from different files are isolated', () => {
    useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    useProposalsStore.getState().addProposal(FILE_B, {
      sessionId: SESSION_2, nodeId: NODE, request: makeRequest(),
    });
    expect(useProposalsStore.getState().getProposalsForFile(FILE_A)).toHaveLength(1);
    expect(useProposalsStore.getState().getProposalsForFile(FILE_B)).toHaveLength(1);
  });

  it('getProposalsForFile returns an empty array for a file with no proposals', () => {
    expect(useProposalsStore.getState().getProposalsForFile('/never/seen.arbo')).toEqual([]);
  });
});

describe('useProposalsStore — remove (accept / reject)', () => {
  beforeEach(() => {
    useProposalsStore.setState({ proposalsByFile: {} });
  });

  it('removeProposal drops the proposal with the given id from the file list', () => {
    const id1 = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    const id2 = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    useProposalsStore.getState().removeProposal(FILE_A, id1);
    const list = useProposalsStore.getState().getProposalsForFile(FILE_A);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id2);
  });

  it('removeProposal for an unknown id is a no-op (no throw, no state change)', () => {
    const id = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    expect(() => {
      useProposalsStore.getState().removeProposal(FILE_A, 'unknown');
    }).not.toThrow();
    expect(useProposalsStore.getState().getProposalsForFile(FILE_A)).toHaveLength(1);
    expect(useProposalsStore.getState().getProposalsForFile(FILE_A)[0].id).toBe(id);
  });
});

describe('useProposalsStore — per-session lifecycle', () => {
  beforeEach(() => {
    useProposalsStore.setState({ proposalsByFile: {} });
  });

  it('clearForSession drops every proposal belonging to that session, leaving others intact', () => {
    const idA = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    const idB = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_2, nodeId: NODE, request: makeRequest(),
    });
    useProposalsStore.getState().clearForSession(SESSION_1);
    const remaining = useProposalsStore.getState().getProposalsForFile(FILE_A);
    expect(remaining.map((p) => p.id)).toEqual([idB]);
    expect(remaining.map((p) => p.id)).not.toContain(idA);
  });

  it('clearForFile drops every proposal for that file, leaving other files intact', () => {
    useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    useProposalsStore.getState().addProposal(FILE_B, {
      sessionId: SESSION_2, nodeId: NODE, request: makeRequest(),
    });
    useProposalsStore.getState().clearForFile(FILE_A);
    expect(useProposalsStore.getState().getProposalsForFile(FILE_A)).toEqual([]);
    expect(useProposalsStore.getState().getProposalsForFile(FILE_B)).toHaveLength(1);
  });
});

describe('useProposalsStore — boundary inputs', () => {
  beforeEach(() => {
    useProposalsStore.setState({ proposalsByFile: {} });
  });

  it('addProposal returns a UUIDv4-shaped id', () => {
    const id = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
    });
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('addProposal generates a unique id per call', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 25; i++) {
      ids.add(useProposalsStore.getState().addProposal(FILE_A, {
        sessionId: SESSION_1, nodeId: NODE, request: makeRequest(),
      }));
    }
    expect(ids.size).toBe(25);
  });

  it('a submit-step-output proposal is stored with kind="submit-step-output"', () => {
    const id = useProposalsStore.getState().addProposal(FILE_A, {
      sessionId: SESSION_1, nodeId: NODE,
      request: { kind: 'submit-step-output', content: 'Claude response' },
    });
    const proposal = useProposalsStore.getState().getProposalsForFile(FILE_A).find((p) => p.id === id)!;
    expect(proposal.request).toEqual({ kind: 'submit-step-output', content: 'Claude response' });
  });
});

describe('useProposalsStore — selector returns a stable reference for the same file when unchanged', () => {
  beforeEach(() => {
    useProposalsStore.setState({ proposalsByFile: {} });
  });

  // Important for memoised consumers (FeedbackPanel) — they should not re-render
  // when a proposal added to a different file does not affect their list.
  it.todo('getProposalsForFile returns the same array reference across calls until the file list changes');
});
