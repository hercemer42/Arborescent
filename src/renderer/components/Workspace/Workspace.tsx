import { memo, useEffect, useRef } from 'react';
import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { setActiveStore, initializeKeyboardServices } from '../../services/keyboard/keyboard';
import './Workspace.css';

export const Workspace = memo(function Workspace() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;
  const workspaceRef = useRef<HTMLElement>(null);

  // Update the navigation service when the active store changes
  useEffect(() => {
    setActiveStore(activeStore);
  }, [activeStore]);

  // Initialize keyboard services scoped to workspace
  useEffect(() => {
    if (!workspaceRef.current) return;
    const cleanup = initializeKeyboardServices(workspaceRef.current);
    return cleanup;
  }, []);

  if (!activeStore) {
    return null;
  }

  return (
    <main className="workspace" ref={workspaceRef}>
      <TreeStoreContext.Provider value={activeStore}>
        <TabBar />
        <Tree />
      </TreeStoreContext.Provider>
    </main>
  );
});
