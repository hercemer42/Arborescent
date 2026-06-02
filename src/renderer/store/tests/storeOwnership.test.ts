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
});
