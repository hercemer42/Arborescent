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

  it('togglePanel opens the panel and marks the latest entry as seen when closed', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1), makeEntry(2)] });

    useActivityLogViewStore.getState().togglePanel();

    const state = useActivityLogViewStore.getState();
    expect(state.isPanelOpen).toBe(true);
    expect(state.lastSeenTimestamp).toBe(1_700_000_000_000 + 2);
  });

  it('togglePanel closes the panel when it is open', () => {
    useActivityLogStore.setState({ entries: [makeEntry(1)] });
    useActivityLogViewStore.getState().openPanel();

    useActivityLogViewStore.getState().togglePanel();

    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(false);
  });

  it('togglePanel flips open and closed across repeated calls', () => {
    const toggle = () => useActivityLogViewStore.getState().togglePanel();

    toggle();
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(true);
    toggle();
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(false);
    toggle();
    expect(useActivityLogViewStore.getState().isPanelOpen).toBe(true);
  });

  it('togglePanel opening with no entries marks-seen at 0', () => {
    useActivityLogViewStore.getState().togglePanel();
    expect(useActivityLogViewStore.getState().lastSeenTimestamp).toBe(0);
  });

  it('togglePanel closing leaves the seen marker unchanged — only the open branch marks-seen', () => {
    useActivityLogStore.setState({ entries: [makeEntry(5)] });
    useActivityLogViewStore.getState().togglePanel();
    const seen = useActivityLogViewStore.getState().lastSeenTimestamp;
    expect(seen).toBe(1_700_000_000_000 + 5);

    // A newer entry arrives while the panel is open; closing must not re-mark or reset.
    useActivityLogStore.setState({ entries: [makeEntry(5), makeEntry(9)] });
    useActivityLogViewStore.getState().togglePanel();

    const state = useActivityLogViewStore.getState();
    expect(state.isPanelOpen).toBe(false);
    expect(state.lastSeenTimestamp).toBe(seen);
  });
});
