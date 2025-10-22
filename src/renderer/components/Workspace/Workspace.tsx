import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import './Workspace.css';

export function Workspace() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
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
