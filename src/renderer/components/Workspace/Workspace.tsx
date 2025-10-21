import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { storeManager } from '../../store/storeManager';
import './Workspace.css';

export function Workspace() {
  const activeFilePath = useTabsStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;

  if (!activeStore) {
    return null;
  }

  return (
    <main className="workspace">
      <TreeStoreContext.Provider value={activeStore}>
        <TabBar />
        <Tree />
      </TreeStoreContext.Provider>
    </main>
  );
}
