import { memo, useRef } from 'react';
import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { useWorkspaceKeyboard } from './hooks/useWorkspaceKeyboard';
import { useBlueprintMode } from './hooks/useBlueprintMode';
import './Workspace.css';

export const Workspace = memo(function Workspace() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;
  const workspaceRef = useRef<HTMLElement>(null);

  useWorkspaceKeyboard(workspaceRef, activeStore);
  const blueprintModeEnabled = useBlueprintMode(activeStore);

  if (!activeStore) {
    return null;
  }

  return (
    <main className={`workspace ${blueprintModeEnabled ? 'blueprint-mode' : ''}`} ref={workspaceRef}>
      <TreeStoreContext.Provider value={activeStore}>
        <TabBar />
        <Tree />
      </TreeStoreContext.Provider>
    </main>
  );
});
