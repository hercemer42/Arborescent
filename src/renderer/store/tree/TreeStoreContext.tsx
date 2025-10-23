import { createContext, useContext } from 'react';
import type { TreeStore } from './treeStore';

/**
 * Context to hold the currently active tree store instance.
 * The Workspace component switches this context value when the user changes files,
 * allowing all child components to automatically access the correct file's tree state.
 */
export const TreeStoreContext = createContext<TreeStore | null>(null);

export function useActiveTreeStore(): TreeStore {
  const store = useContext(TreeStoreContext);
  if (!store) {
    throw new Error('useActiveTreeStore must be used within a TreeStoreProvider');
  }
  return store;
}
