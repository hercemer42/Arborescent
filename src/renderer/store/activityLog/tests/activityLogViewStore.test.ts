import { describe, it, expect, beforeEach } from 'vitest';
import { useActivityLogViewStore } from '../activityLogViewStore';
import { useActivityLogStore, type ActivityLogEntry } from '../activityLogStore';

const makeEntry = (i: number): ActivityLogEntry => ({
  id: `id-${i}`,
  message: `entry-${i}`,
  type: 'info',
  source: 'workflow',
  timestamp: 1_700_000_000_000 + i,
});

describe('activityLogViewStore', () => {
  beforeEach(() => {
    useActivityLogStore.setState({ entries: [] });
    useActivityLogViewStore.setState({ isPanelOpen: false, lastSeenTimestamp: 0 });
  });

  it('openPanel opens the panel and marks the latest entry as seen', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1), makeEntry(2)] });

    useActivityLogViewStore.getState().openPanel();

    const state = useActivityLogViewStore.getState();
    expect(state.isPanelOpen).toBe(true);
    expect(state.lastSeenTimestamp).toBe(1_700_000_000_000 + 2);
  });

  it('openPanel with no entries marks-seen at 0', () => {
    useActivityLogViewStore.getState().openPanel();
    expect(useActivityLogViewStore.getState().lastSeenTimestamp).toBe(0);
  });

  it('closePanel closes the panel without changing the seen marker', () => {
    useActivityLogStore.setState({ entries: [makeEntry(5)] });
    useActivityLogViewStore.getState().openPanel();
    const seen = useActivityLogViewStore.getState().lastSeenTimestamp;

    useActivityLogViewStore.getState().closePanel();

    const state = useActivityLogViewStore.getState();
    expect(state.isPanelOpen).toBe(false);
    expect(state.lastSeenTimestamp).toBe(seen);
  });
});
