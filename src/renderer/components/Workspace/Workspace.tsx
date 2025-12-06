import { memo, useRef } from 'react';
import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { SummaryDateBar } from '../SummaryDateBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { useWorkspaceKeyboard } from './hooks/useWorkspaceKeyboard';
import { useBlueprintMode } from './hooks/useBlueprintMode';
import { useSummaryMode } from './hooks/useSummaryMode';
import './Workspace.css';

export const Workspace = memo(function Workspace() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;
  const zoomInfo = activeFilePath ? storeManager.getZoomInfo(activeFilePath) : null;
  const workspaceRef = useRef<HTMLElement>(null);

  useWorkspaceKeyboard(workspaceRef, activeStore);
  const blueprintModeEnabled = useBlueprintMode(activeStore);
  const summaryModeEnabled = useSummaryMode(activeStore);

  if (!activeStore) {
    return null;
  }

  const classNames = [
    'workspace',
    blueprintModeEnabled && 'blueprint-mode',
    summaryModeEnabled && 'summary-mode',
  ].filter(Boolean).join(' ');

  return (
    <main className={classNames} ref={workspaceRef}>
      <TreeStoreContext.Provider value={activeStore}>
        <TabBar />
        <SummaryDateBar />
        <Tree zoomedNodeId={zoomInfo?.nodeId} />
      </TreeStoreContext.Provider>
    </main>
  );
});
