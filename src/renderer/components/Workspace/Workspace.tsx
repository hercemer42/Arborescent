import { memo } from 'react';
import { Tree } from '../Tree';
import { TabBar } from '../TabBar';
import { SummaryDateBar } from '../SummaryDateBar';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { StepConfigDialogContainer } from '../ui/StepConfigDialog';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { useBlueprintMode } from './hooks/useBlueprintMode';
import { useSummaryMode } from './hooks/useSummaryMode';
import './Workspace.css';

export const Workspace = memo(function Workspace() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;
  const zoomInfo = activeFilePath ? storeManager.getZoomInfo(activeFilePath) : null;

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
    <main className={classNames}>
      <TreeStoreContext.Provider value={activeStore}>
        <TabBar />
        <SummaryDateBar />
        <Tree zoomedNodeId={zoomInfo?.nodeId} />
        <StepConfigDialogContainer />
      </TreeStoreContext.Provider>
    </main>
  );
});
