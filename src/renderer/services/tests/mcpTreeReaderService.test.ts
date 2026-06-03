import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { startMcpTreeReaderService } from '../mcpTreeReaderService';
import { findStoreOwningSession } from '../../store/storeOwnership';
import type { TreeStore } from '../../store/tree/treeStore';
import type { TreeReadRequest } from '../../../shared/types/electronApi';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../store/storeOwnership', () => ({
  findStoreOwningSession: vi.fn(),
}));

// Ticket A: a tree-read must resolve a node only within the file (store) its
// session is bound to — found via findStoreOwningSession — never by sweeping
// other open files, even when a same-id node exists in one of them.

const ownerOf = findStoreOwningSession as unknown as Mock;

type ReadableState = {
  nodes: Record<string, { id: string; content?: string }>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
};

function fakeStore(state: ReadableState): TreeStore {
  return { getState: () => state } as unknown as TreeStore;
}

function captureHandler(): (req: TreeReadRequest) => void {
  let handler!: (req: TreeReadRequest) => void;
  (window.electron.onMcpTreeReadRequest as unknown as Mock).mockImplementation(
    (cb: (req: TreeReadRequest) => void) => {
      handler = cb;
      return () => {};
    },
  );
  startMcpTreeReaderService();
  return handler;
}

function respondMock(): Mock {
  return window.electron.respondToMcpTreeRead as unknown as Mock;
}

describe('mcpTreeReaderService — file-scoped node resolution (Ticket A)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ownerOf.mockReset();
    (window.electron.onMcpTreeReadRequest as unknown as Mock).mockReturnValue(vi.fn());
    (window.electron.respondToMcpTreeRead as unknown as Mock).mockResolvedValue(undefined);
  });

  it('resolves the node from the store bound to the session, not by sweeping open files', async () => {
    const boundFile: ReadableState = { nodes: { X: { id: 'X', content: 'from bound file' } }, rootNodeId: 'X', ancestorRegistry: {} };
    ownerOf.mockReturnValue(fakeStore(boundFile));

    const handler = captureHandler();
    await handler({ requestId: 'r1', sessionId: 'sess-1', nodeId: 'X' });

    expect(ownerOf).toHaveBeenCalledWith('sess-1');
    expect(respondMock()).toHaveBeenCalledWith({
      requestId: 'r1',
      state: { kind: 'ok', state: { nodes: boundFile.nodes, rootNodeId: 'X', ancestorRegistry: {} } },
    });
  });

  it('returns node-not-in-open-store when the id is absent from the bound file (never a same-id node in another file)', async () => {
    const boundFile: ReadableState = { nodes: {}, rootNodeId: 'root', ancestorRegistry: {} };
    ownerOf.mockReturnValue(fakeStore(boundFile));

    const handler = captureHandler();
    await handler({ requestId: 'r2', sessionId: 'sess-1', nodeId: 'X' });

    expect(respondMock()).toHaveBeenCalledWith({ requestId: 'r2', state: { kind: 'node-not-in-open-store' } });
  });

  it('fails closed to no-session-store when no open file owns the session (registration race or closed file)', async () => {
    ownerOf.mockReturnValue(null);

    const handler = captureHandler();
    await handler({ requestId: 'r3', sessionId: 'sess-unknown', nodeId: 'X' });

    expect(respondMock()).toHaveBeenCalledWith({ requestId: 'r3', state: { kind: 'no-session-store' } });
  });

  it('a node id present only in a non-owning store still yields node-not-in-open-store, never a false ok', async () => {
    const boundFile: ReadableState = { nodes: {}, rootNodeId: 'root', ancestorRegistry: {} };
    ownerOf.mockReturnValue(fakeStore(boundFile));

    const handler = captureHandler();
    await handler({ requestId: 'r4', sessionId: 'sess-1', nodeId: 'X' });

    expect(ownerOf).toHaveBeenCalledTimes(1);
    expect(respondMock()).toHaveBeenCalledWith({ requestId: 'r4', state: { kind: 'node-not-in-open-store' } });
  });
});
