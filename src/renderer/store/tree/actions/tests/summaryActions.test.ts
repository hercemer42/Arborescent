import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createSummaryActions } from '../summaryActions';
import type { TreeNode } from '@shared/types';

vi.mock('../../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('summaryActions', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    summaryModeEnabled: boolean;
    summaryDateFrom: string | null;
    summaryDateTo: string | null;
    activeNodeId: string | null;
    blueprintModeEnabled: boolean;
  };
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;
  let actions: ReturnType<typeof createSummaryActions>;

  beforeEach(() => {
    vi.clearAllMocks();

    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Test Project',
          children: [],
          metadata: {},
        },
      },
      summaryModeEnabled: false,
      summaryDateFrom: null,
      summaryDateTo: null,
      activeNodeId: 'root',
      blueprintModeEnabled: false,
    };

    setState = vi.fn((partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    });

    triggerAutosave = vi.fn();

    actions = createSummaryActions(
      () => state,
      setState,
      triggerAutosave
    );
  });

  describe('toggleSummaryMode', () => {
    it('should enable summary mode and set default dates when no dates exist', () => {
      actions.toggleSummaryMode();

      expect(setState).toHaveBeenCalled();
      expect(state.summaryModeEnabled).toBe(true);
      expect(state.summaryDateFrom).not.toBeNull();
      expect(state.summaryDateTo).not.toBeNull();
      expect(state.activeNodeId).toBeNull();
    });

    it('should set default dates to last 7 days including today', () => {
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const expectedDateTo = today.toISOString().split('T')[0];
      const expectedDateFrom = weekAgo.toISOString().split('T')[0];

      actions.toggleSummaryMode();

      expect(state.summaryDateFrom).toBe(expectedDateFrom);
      expect(state.summaryDateTo).toBe(expectedDateTo);
    });

    it('should trigger autosave when enabling with default dates', () => {
      actions.toggleSummaryMode();

      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should enable summary mode without changing existing dates', () => {
      state.summaryDateFrom = '2025-01-01';
      state.summaryDateTo = '2025-01-15';

      actions.toggleSummaryMode();

      expect(state.summaryModeEnabled).toBe(true);
      expect(state.summaryDateFrom).toBe('2025-01-01');
      expect(state.summaryDateTo).toBe('2025-01-15');
    });

    it('should not trigger autosave when enabling with existing dates', () => {
      state.summaryDateFrom = '2025-01-01';
      state.summaryDateTo = '2025-01-15';

      actions.toggleSummaryMode();

      expect(triggerAutosave).not.toHaveBeenCalled();
    });

    it('should enable without setting default dates if only dateFrom exists', () => {
      state.summaryDateFrom = '2025-01-01';

      actions.toggleSummaryMode();

      expect(state.summaryModeEnabled).toBe(true);
      expect(state.summaryDateFrom).toBe('2025-01-01');
      expect(state.summaryDateTo).toBeNull();
      expect(triggerAutosave).not.toHaveBeenCalled();
    });

    it('should enable without setting default dates if only dateTo exists', () => {
      state.summaryDateTo = '2025-01-15';

      actions.toggleSummaryMode();

      expect(state.summaryModeEnabled).toBe(true);
      expect(state.summaryDateFrom).toBeNull();
      expect(state.summaryDateTo).toBe('2025-01-15');
      expect(triggerAutosave).not.toHaveBeenCalled();
    });

    it('should disable summary mode', () => {
      state.summaryModeEnabled = true;
      state.summaryDateFrom = '2025-01-01';
      state.summaryDateTo = '2025-01-15';

      actions.toggleSummaryMode();

      expect(state.summaryModeEnabled).toBe(false);
      // Dates should be preserved
      expect(state.summaryDateFrom).toBe('2025-01-01');
      expect(state.summaryDateTo).toBe('2025-01-15');
    });

    it('should not trigger autosave when disabling', () => {
      state.summaryModeEnabled = true;

      actions.toggleSummaryMode();

      expect(triggerAutosave).not.toHaveBeenCalled();
    });

    it('should clear activeNodeId when enabling', () => {
      state.activeNodeId = 'some-node';

      actions.toggleSummaryMode();

      expect(state.activeNodeId).toBeNull();
    });

    it('should disable blueprint mode when enabling summary mode', () => {
      state.blueprintModeEnabled = true;

      actions.toggleSummaryMode();

      expect(state.summaryModeEnabled).toBe(true);
      expect(state.blueprintModeEnabled).toBe(false);
    });

    it('should disable blueprint mode when enabling summary mode with existing dates', () => {
      state.blueprintModeEnabled = true;
      state.summaryDateFrom = '2025-01-01';
      state.summaryDateTo = '2025-01-15';

      actions.toggleSummaryMode();

      expect(state.summaryModeEnabled).toBe(true);
      expect(state.blueprintModeEnabled).toBe(false);
    });
  });

  describe('setSummaryDates', () => {
    it('should set both dates', () => {
      actions.setSummaryDates('2025-01-01', '2025-01-15');

      expect(setState).toHaveBeenCalledWith({
        summaryDateFrom: '2025-01-01',
        summaryDateTo: '2025-01-15',
      });
    });

    it('should set only dateFrom (dateTo null)', () => {
      actions.setSummaryDates('2025-01-01', null);

      expect(setState).toHaveBeenCalledWith({
        summaryDateFrom: '2025-01-01',
        summaryDateTo: null,
      });
    });

    it('should set only dateTo (dateFrom null)', () => {
      actions.setSummaryDates(null, '2025-01-15');

      expect(setState).toHaveBeenCalledWith({
        summaryDateFrom: null,
        summaryDateTo: '2025-01-15',
      });
    });

    it('should clear both dates', () => {
      state.summaryDateFrom = '2025-01-01';
      state.summaryDateTo = '2025-01-15';

      actions.setSummaryDates(null, null);

      expect(setState).toHaveBeenCalledWith({
        summaryDateFrom: null,
        summaryDateTo: null,
      });
    });

    it('should trigger autosave when setting dates', () => {
      actions.setSummaryDates('2025-01-01', '2025-01-15');

      expect(triggerAutosave).toHaveBeenCalled();
    });
  });

  describe('without triggerAutosave', () => {
    beforeEach(() => {
      actions = createSummaryActions(
        () => state,
        setState
      );
    });

    it('should work without triggerAutosave function', () => {
      expect(() => {
        actions.toggleSummaryMode();
      }).not.toThrow();
    });

    it('should work setSummaryDates without triggerAutosave', () => {
      expect(() => {
        actions.setSummaryDates('2025-01-01', '2025-01-15');
      }).not.toThrow();
    });
  });
});
