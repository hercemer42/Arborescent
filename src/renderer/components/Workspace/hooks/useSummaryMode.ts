import { useSyncExternalStore } from 'react';
import { TreeStore } from '../../../store/tree/treeStore';

export function useSummaryMode(store: TreeStore | null): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (!store) return () => {};
      return store.subscribe(callback);
    },
    () => store?.getState().summaryModeEnabled ?? false
  );
}
