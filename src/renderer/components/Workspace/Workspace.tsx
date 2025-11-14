import { memo, useEffect } from 'react';
import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { setActiveStore } from '../../services/keyboard/keyboard';
import './Workspace.css';

export const Workspace = memo(function Workspace() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;

  // Update the navigation service when the active store changes
  useEffect(() => {
    setActiveStore(activeStore);
  }, [activeStore]);

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
});
