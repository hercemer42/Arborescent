import { createContext, useContext } from 'react';
import type { TreeStore } from './treeStore';

export const TreeStoreContext = createContext<TreeStore | null>(null);

export function useActiveTreeStore(): TreeStore {
  const store = useContext(TreeStoreContext);
  if (!store) {
    throw new Error('useActiveTreeStore must be used within a TreeStoreProvider');
  }
  return store;
}
