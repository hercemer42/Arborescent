import { TreeNode } from '../../../../shared/types';
import { logger } from '../../../services/logger';

export interface SummaryActions {
  toggleSummaryMode: () => void;
  setSummaryDates: (dateFrom: string | null, dateTo: string | null) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  summaryModeEnabled: boolean;
  summaryDateFrom: string | null;
  summaryDateTo: string | null;
  activeNodeId: string | null;
  blueprintModeEnabled: boolean;
};
type StoreSetter = (partial: Partial<StoreState> | ((state: StoreState) => Partial<StoreState>)) => void;

function getDefaultDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  return {
    dateFrom: weekAgo.toISOString().split('T')[0],
    dateTo: today.toISOString().split('T')[0],
  };
}

export const createSummaryActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): SummaryActions => {
  function toggleSummaryMode(): void {
    const { summaryModeEnabled, summaryDateFrom, summaryDateTo } = get();
    const newMode = !summaryModeEnabled;

    if (newMode) {
      // If no dates set, use default (last week including today)
      if (!summaryDateFrom && !summaryDateTo) {
        const { dateFrom, dateTo } = getDefaultDateRange();
        set({
          summaryModeEnabled: true,
          blueprintModeEnabled: false,
          activeNodeId: null,
          summaryDateFrom: dateFrom,
          summaryDateTo: dateTo,
        });
        triggerAutosave?.();
      } else {
        set({ summaryModeEnabled: true, blueprintModeEnabled: false, activeNodeId: null });
      }
      logger.info('Summary mode enabled', 'Summary');
    } else {
      set({ summaryModeEnabled: false });
      logger.info('Summary mode disabled', 'Summary');
    }
  }

  function setSummaryDates(dateFrom: string | null, dateTo: string | null): void {
    set({ summaryDateFrom: dateFrom, summaryDateTo: dateTo });
    triggerAutosave?.();
    logger.info(`Summary dates set: ${dateFrom || 'any'} to ${dateTo || 'any'}`, 'Summary');
  }

  return {
    toggleSummaryMode,
    setSummaryDates,
  };
};
