import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { findStoreOwningSession } from '../storeOwnership';
import { storeManager } from '../storeManager';
import type { TreeStore } from '../tree/treeStore';

vi.mock('../storeManager', () => ({
  storeManager: { getAllStoreEntries: vi.fn() },
}));

const entries = storeManager.getAllStoreEntries as unknown as Mock;

function storeWithSessions(workflowSessionMap: Record<string, string>): TreeStore {
  return { getState: () => ({ workflowSessionMap }) } as unknown as TreeStore;
}

describe('findStoreOwningSession', () => {
  beforeEach(() => {
    entries.mockReset();
  });

  it('returns the store whose workflowSessionMap holds the session', () => {
    const a = storeWithSessions({ 'sess-A': 'term-1' });
    const b = storeWithSessions({ 'sess-B': 'term-2' });
    entries.mockReturnValue([
      { filePath: '/a.arbo', store: a },
      { filePath: '/b.arbo', store: b },
    ]);

    expect(findStoreOwningSession('sess-B')).toBe(b);
  });

  it('returns null when no open store has the session, and for an empty session id', () => {
    entries.mockReturnValue([{ filePath: '/a.arbo', store: storeWithSessions({}) }]);

    expect(findStoreOwningSession('sess-missing')).toBeNull();
    expect(findStoreOwningSession('')).toBeNull();
  });

  it('routes each session to its own file even when two open files share the same node id (multi-file scoping)', () => {
    // Both files contain a node with the SAME id; resolution keys off the unique
    // sessionId via workflowSessionMap, never the node id, so a shared id can
    // never cross-route. Regression anchor for the multi-file AC.
    const sharedNodes = { 'dup-node': { id: 'dup-node', content: '', children: [], metadata: {} } };
    const fileA = {
      getState: () => ({ workflowSessionMap: { 'sess-A': 'term-1' }, nodes: sharedNodes }),
    } as unknown as TreeStore;
    const fileB = {
      getState: () => ({ workflowSessionMap: { 'sess-B': 'term-2' }, nodes: sharedNodes }),
    } as unknown as TreeStore;
    entries.mockReturnValue([
      { filePath: '/a.arbo', store: fileA },
      { filePath: '/b.arbo', store: fileB },
    ]);

    expect(findStoreOwningSession('sess-A')).toBe(fileA);
    expect(findStoreOwningSession('sess-B')).toBe(fileB);
  });
});
