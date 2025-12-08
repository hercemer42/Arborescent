import { TreeNode } from '../../../../shared/types';
import { logger } from '../../../services/logger';
import { computeSummaryVisibleNodeIds } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

export interface SummaryActions {
  toggleSummaryMode: () => void;
  setSummaryDates: (dateFrom: string | null, dateTo: string | null) => void;
  refreshSummaryVisibleNodeIds: () => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  summaryModeEnabled: boolean;
  summaryDateFrom: string | null;
  summaryDateTo: string | null;
  summaryVisibleNodeIds: Set<string> | null;
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
  function computeAndCacheVisibleNodeIds(): Set<string> {
    const { nodes, rootNodeId, ancestorRegistry, summaryDateFrom, summaryDateTo } = get();
    return computeSummaryVisibleNodeIds(nodes, rootNodeId, ancestorRegistry, summaryDateFrom, summaryDateTo);
  }

  function refreshSummaryVisibleNodeIds(): void {
    const { summaryModeEnabled } = get();
    if (summaryModeEnabled) {
      set({ summaryVisibleNodeIds: computeAndCacheVisibleNodeIds() });
    }
  }

  function toggleSummaryMode(): void {
    const { summaryModeEnabled, summaryDateFrom, summaryDateTo, nodes, rootNodeId, ancestorRegistry } = get();
    const newMode = !summaryModeEnabled;

    if (newMode) {
      // If no dates set, use default (last week including today)
      if (!summaryDateFrom && !summaryDateTo) {
        const { dateFrom, dateTo } = getDefaultDateRange();
        const visibleIds = computeSummaryVisibleNodeIds(nodes, rootNodeId, ancestorRegistry, dateFrom, dateTo);
        set({
          summaryModeEnabled: true,
          blueprintModeEnabled: false,
          activeNodeId: null,
          summaryDateFrom: dateFrom,
          summaryDateTo: dateTo,
          summaryVisibleNodeIds: visibleIds,
        });
        triggerAutosave?.();
      } else {
        const visibleIds = computeAndCacheVisibleNodeIds();
        set({ summaryModeEnabled: true, blueprintModeEnabled: false, activeNodeId: null, summaryVisibleNodeIds: visibleIds });
      }
      logger.info('Summary mode enabled', 'Summary');
    } else {
      set({ summaryModeEnabled: false, summaryVisibleNodeIds: null });
      logger.info('Summary mode disabled', 'Summary');
    }
  }

  function setSummaryDates(dateFrom: string | null, dateTo: string | null): void {
    const { summaryModeEnabled, nodes, rootNodeId, ancestorRegistry } = get();
    if (summaryModeEnabled) {
      const visibleIds = computeSummaryVisibleNodeIds(nodes, rootNodeId, ancestorRegistry, dateFrom, dateTo);
      set({ summaryDateFrom: dateFrom, summaryDateTo: dateTo, summaryVisibleNodeIds: visibleIds });
    } else {
      set({ summaryDateFrom: dateFrom, summaryDateTo: dateTo });
    }
    triggerAutosave?.();
    logger.info(`Summary dates set: ${dateFrom || 'any'} to ${dateTo || 'any'}`, 'Summary');
  }

  return {
    toggleSummaryMode,
    setSummaryDates,
    refreshSummaryVisibleNodeIds,
  };
};
