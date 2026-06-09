import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  useActivityLogStore,
  hydrateActivityLog,
  MAX_ACTIVITY_ENTRIES,
  type ActivityLogEntry,
} from '../activityLogStore';

const makeEntry = (overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry => ({
  id: `${Date.now()}-${Math.random()}`,
  message: 'Advanced "Task" to Step 2',
  type: 'info',
  source: 'workflow',
  timestamp: Date.now(),
  ...overrides,
});

describe('activityLogStore', () => {
  beforeEach(() => {
    useActivityLogStore.setState({ entries: [] });
  });

  describe('addEntry', () => {
    it('appends an entry with message, type and source', () => {
      useActivityLogStore.getState().addEntry('Advanced "Task" to Step 2', 'info', 'workflow');

      const { entries } = useActivityLogStore.getState();
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe('Advanced "Task" to Step 2');
      expect(entries[0].type).toBe('info');
      expect(entries[0].source).toBe('workflow');
    });

    it('stamps a unique id and a timestamp on each entry', () => {
      const before = Date.now();
      useActivityLogStore.getState().addEntry('first', 'info', 'workflow');
      useActivityLogStore.getState().addEntry('second', 'info', 'workflow');
      const after = Date.now();

      const { entries } = useActivityLogStore.getState();
      expect(entries[0].id).not.toBe(entries[1].id);
      expect(entries[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(entries[1].timestamp).toBeLessThanOrEqual(after);
    });

    it('records entries in chronological insertion order (most recent last)', () => {
      useActivityLogStore.getState().addEntry('a', 'info', 'workflow');
      useActivityLogStore.getState().addEntry('b', 'info', 'workflow');
      useActivityLogStore.getState().addEntry('c', 'info', 'workflow');

      const messages = useActivityLogStore.getState().entries.map((e) => e.message);
      expect(messages).toEqual(['a', 'b', 'c']);
    });

    it('treats source as optional', () => {
      useActivityLogStore.getState().addEntry('no source', 'error');

      expect(useActivityLogStore.getState().entries[0].source).toBeUndefined();
    });

    it('records an empty message without dropping the entry', () => {
      useActivityLogStore.getState().addEntry('', 'info', 'workflow');
      expect(useActivityLogStore.getState().entries).toHaveLength(1);
    });

    it('stores an optional originating sessionId on the entry', () => {
      useActivityLogStore.getState().addEntry('Advanced "Task" to Step 2', 'info', 'workflow', 'session-1');
      expect(useActivityLogStore.getState().entries[0].sessionId).toBe('session-1');
    });

    it('leaves sessionId undefined when none is supplied (backward-compatible entries)', () => {
      useActivityLogStore.getState().addEntry('no target', 'info', 'workflow');
      expect(useActivityLogStore.getState().entries[0].sessionId).toBeUndefined();
    });
  });

  describe('bounded buffer', () => {
    it('keeps all entries up to the cap', () => {
      for (let i = 0; i < MAX_ACTIVITY_ENTRIES; i++) {
        useActivityLogStore.getState().addEntry(`entry-${i}`, 'info', 'workflow');
      }
      expect(useActivityLogStore.getState().entries).toHaveLength(MAX_ACTIVITY_ENTRIES);
    });

    it('evicts the oldest entries once the cap is exceeded', () => {
      const overflow = 10;
      for (let i = 0; i < MAX_ACTIVITY_ENTRIES + overflow; i++) {
        useActivityLogStore.getState().addEntry(`entry-${i}`, 'info', 'workflow');
      }
      const { entries } = useActivityLogStore.getState();
      expect(entries).toHaveLength(MAX_ACTIVITY_ENTRIES);
      // The oldest `overflow` entries are dropped; newest is retained last.
      expect(entries[0].message).toBe(`entry-${overflow}`);
      expect(entries[entries.length - 1].message).toBe(`entry-${MAX_ACTIVITY_ENTRIES + overflow - 1}`);
    });
  });

  describe('hydrate', () => {
    it('replaces entries from a persisted array', () => {
      useActivityLogStore.getState().addEntry('stale', 'info', 'workflow');

      const persisted = [makeEntry({ message: 'restored-1' }), makeEntry({ message: 'restored-2' })];
      useActivityLogStore.getState().hydrate(persisted);

      const messages = useActivityLogStore.getState().entries.map((e) => e.message);
      expect(messages).toEqual(['restored-1', 'restored-2']);
    });

    it('caps hydrated entries to the most recent within the bound', () => {
      const extra = 5;
      const persisted = Array.from({ length: MAX_ACTIVITY_ENTRIES + extra }, (_, i) =>
        makeEntry({ message: `h-${i}` }),
      );
      useActivityLogStore.getState().hydrate(persisted);

      const { entries } = useActivityLogStore.getState();
      expect(entries).toHaveLength(MAX_ACTIVITY_ENTRIES);
      expect(entries[entries.length - 1].message).toBe(`h-${MAX_ACTIVITY_ENTRIES + extra - 1}`);
    });

    it('handles an empty persisted array', () => {
      useActivityLogStore.getState().hydrate([]);
      expect(useActivityLogStore.getState().entries).toEqual([]);
    });
  });

  describe('persistence wiring', () => {
    it('persists each appended entry to the activity-log file via the main-process bridge', () => {
      useActivityLogStore.getState().addEntry('Advanced "Task" to Step 2', 'info', 'workflow');

      expect(window.electron.appendActivityLog).toHaveBeenCalledTimes(1);
      expect(window.electron.appendActivityLog).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Advanced "Task" to Step 2', type: 'info', source: 'workflow' }),
      );
    });

    it('rehydrates from the persisted file on startup', async () => {
      const persisted = [makeEntry({ message: 'restored-1' }), makeEntry({ message: 'restored-2' })];
      vi.mocked(window.electron.readRecentActivityLog).mockResolvedValue(persisted);

      await hydrateActivityLog();

      expect(useActivityLogStore.getState().entries.map((e) => e.message)).toEqual([
        'restored-1',
        'restored-2',
      ]);
    });
  });
});
