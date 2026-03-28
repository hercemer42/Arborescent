import { create } from 'zustand';
import { resolveToSourceFilePath } from '../../utils/zoomPath';

export interface TabIndicatorState {
  feedbackPending: boolean;
  workflowRunning: boolean;
  actionRequired: boolean;
}

interface TabIndicatorStore {
  indicators: Record<string, TabIndicatorState>;
  updateIndicator: (filePath: string, state: TabIndicatorState) => void;
  removeIndicator: (filePath: string) => void;
}

const EMPTY_INDICATOR: TabIndicatorState = { feedbackPending: false, workflowRunning: false, actionRequired: false };

export function getIndicatorForFile(indicators: Record<string, TabIndicatorState>, filePath: string): TabIndicatorState {
  const resolved = resolveToSourceFilePath(filePath);
  if (!resolved) return EMPTY_INDICATOR;
  return indicators[resolved] || EMPTY_INDICATOR;
}

export const useTabIndicatorStore = create<TabIndicatorStore>((set) => ({
  indicators: {},

  updateIndicator: (filePath: string, state: TabIndicatorState) =>
    set((prev) => ({
      indicators: { ...prev.indicators, [filePath]: state },
    })),

  removeIndicator: (filePath: string) =>
    set((prev) => {
      const updated = { ...prev.indicators };
      delete updated[filePath];
      return { indicators: updated };
    }),
}));
