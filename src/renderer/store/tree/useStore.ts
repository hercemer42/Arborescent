import { useActiveTreeStore } from './TreeStoreContext';
import { TreeState } from './treeStore';

export function useStore<T>(selector: (state: TreeState) => T): T {
  const storeHook = useActiveTreeStore();
  return storeHook(selector);
}
