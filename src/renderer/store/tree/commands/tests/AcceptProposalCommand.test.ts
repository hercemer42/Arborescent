import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const applyMutationMock = vi.fn();
const applyDirectDeleteMock = vi.fn();
const applyStepOutputMock = vi.fn();

vi.mock('../../../../services/mcpTreeMutatorService', () => ({
  applyMutation: (...args: unknown[]) => applyMutationMock(...args),
  applyDirectDelete: (...args: unknown[]) => applyDirectDeleteMock(...args),
}));

vi.mock('../../../../services/mcpStepOutputApplierService', () => ({
  applyStepOutput: (...args: unknown[]) => applyStepOutputMock(...args),
}));

import { AcceptProposalCommand } from '../AcceptProposalCommand';
import type { Proposal } from '../../../proposals/proposalsStore';
import type { TreeStore } from '../../treeStore';

const NODE = 'node-1';
const SESSION = 'sess-1';

function makeFakeStore() {
  let state = {
    nodes: { [NODE]: { id: NODE, content: 'before', children: [], metadata: {} } },
    ancestorRegistry: { [NODE]: [] as string[] },
  };
  const store = {
    getState: () => state,
    setState: (partial: Partial<typeof state>) => {
      state = { ...state, ...partial };
    },
  } as unknown as TreeStore;
  return { store, setNodes: (n: typeof state.nodes) => { state = { ...state, nodes: n }; } };
}

function makeProposal(request: Proposal['request']): Proposal {
  return {
    id: 'prop-1',
    sessionId: SESSION,
    nodeId: NODE,
    request,
    createdAt: 0,
  };
}

beforeEach(() => {
  applyMutationMock.mockReset();
  applyMutationMock.mockReturnValue({ ok: true });
  applyDirectDeleteMock.mockReset();
  applyDirectDeleteMock.mockReturnValue({ ok: true });
  applyStepOutputMock.mockReset();
  applyStepOutputMock.mockReturnValue({ ok: true });
});

describe('AcceptProposalCommand — dispatch', () => {
  it('routes add-child through applyMutation', () => {
    const { store } = makeFakeStore();
    const proposal = makeProposal({ kind: 'add-child', parentId: NODE, content: 'new' });
    new AcceptProposalCommand(store, proposal).execute();
    expect(applyMutationMock).toHaveBeenCalledWith(store, NODE, proposal.request);
    expect(applyDirectDeleteMock).not.toHaveBeenCalled();
    expect(applyStepOutputMock).not.toHaveBeenCalled();
  });

  it('routes delete through applyDirectDelete (NOT applyMutation) to avoid double-undo via the inner DeleteNodeCommand', () => {
    const { store } = makeFakeStore();
    const proposal = makeProposal({ kind: 'delete' });
    new AcceptProposalCommand(store, proposal).execute();
    expect(applyDirectDeleteMock).toHaveBeenCalledWith(store, NODE);
    expect(applyMutationMock).not.toHaveBeenCalled();
  });

  it('routes submit-step-output through applyStepOutput', () => {
    const { store } = makeFakeStore();
    const proposal = makeProposal({ kind: 'submit-step-output', content: 'response' });
    new AcceptProposalCommand(store, proposal).execute();
    expect(applyStepOutputMock).toHaveBeenCalledWith(store, NODE, 'response');
  });
});

describe('AcceptProposalCommand — undo / redo', () => {
  it('undo restores the pre-execute snapshot', () => {
    const { store, setNodes } = makeFakeStore();
    const before = store.getState().nodes;
    applyMutationMock.mockImplementation(() => {
      setNodes({ [NODE]: { id: NODE, content: 'after', children: [], metadata: {} } });
      return { ok: true };
    });
    const command = new AcceptProposalCommand(store, makeProposal({ kind: 'set-content', content: 'after' }));
    command.execute();
    expect(store.getState().nodes[NODE].content).toBe('after');
    command.undo();
    expect(store.getState().nodes).toBe(before);
    expect(store.getState().nodes[NODE].content).toBe('before');
  });

  it('redo restores the post-execute snapshot', () => {
    const { store, setNodes } = makeFakeStore();
    applyMutationMock.mockImplementation(() => {
      setNodes({ [NODE]: { id: NODE, content: 'after', children: [], metadata: {} } });
      return { ok: true };
    });
    const command = new AcceptProposalCommand(store, makeProposal({ kind: 'set-content', content: 'after' }));
    command.execute();
    command.undo();
    command.redo();
    expect(store.getState().nodes[NODE].content).toBe('after');
  });

  it('undo is a no-op when execute itself failed', () => {
    const { store } = makeFakeStore();
    const before = store.getState().nodes;
    applyMutationMock.mockReturnValue({ ok: false, error: 'parent missing' });
    const command = new AcceptProposalCommand(store, makeProposal({ kind: 'add-child', parentId: 'missing', content: 'x' }));
    command.execute();
    expect(store.getState().nodes).toBe(before);
    command.undo();
    expect(store.getState().nodes).toBe(before);
  });
});
