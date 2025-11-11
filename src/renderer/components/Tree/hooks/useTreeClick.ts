import { useCallback } from 'react';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';

export function useTreeClick() {
  const store = useActiveTreeStore();

  const handleTreeClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const { actions } = store.getState();

    // Only clear selection on normal clicks (not Ctrl/Shift clicks)
    const hasModifierKey = e.ctrlKey || e.metaKey || e.shiftKey;
    if (hasModifierKey) {
      return;
    }

    // Clear if clicking on:
    // 1. Tree container (empty whitespace)
    // 2. Node wrapper (indentation area, not node content)
    if (target.classList.contains('tree') || target.classList.contains('tree-node-wrapper')) {
      actions.clearSelection();
    }
  }, [store]);

  return {
    handleTreeClick,
  };
}
