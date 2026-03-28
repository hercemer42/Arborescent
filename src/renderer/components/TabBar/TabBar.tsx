import { memo } from 'react';
import { Tab, TabIndicatorType } from '../Tab';
import { PanelActions } from '../PanelActions';
import { useFilesStore } from '../../store/files/filesStore';
import { useStore } from '../../store/tree/useStore';
import { useTabIndicatorStore, getIndicatorForFile } from '../../store/tabIndicators/tabIndicatorStore';
import { getTabProps } from './hooks/useTabProps';
import './TabBar.css';

function resolveIndicator(filePath: string, indicators: Record<string, { feedbackPending: boolean; workflowRunning: boolean; actionRequired: boolean }>): TabIndicatorType {
  const state = getIndicatorForFile(indicators, filePath);
  if (state.actionRequired) return 'actionRequired';
  if (state.feedbackPending) return 'feedbackPending';
  if (state.workflowRunning) return 'workflowRunning';
  return null;
}

export const TabBar = memo(function TabBar() {
  const files = useFilesStore((state) => state.files);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const setActiveFile = useFilesStore((state) => state.setActiveFile);
  const closeFile = useFilesStore((state) => state.actions.closeFile);
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);
  const indicators = useTabIndicatorStore((state) => state.indicators);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
        {files.map((file, index) => {
          const { displayName, isZoomTab, fullName, isLastInGroup, hasZoomToRight } = getTabProps(file, files[index + 1]);

          return (
            <Tab
              key={file.path}
              displayName={displayName}
              fullName={fullName}
              isActive={file.path === activeFilePath}
              isBlueprintMode={blueprintModeEnabled}
              isSummaryMode={summaryModeEnabled}
              isZoomTab={isZoomTab}
              isLastInGroup={isLastInGroup}
              hasZoomToRight={hasZoomToRight}
              indicator={resolveIndicator(file.path, indicators)}
              onClick={() => setActiveFile(file.path)}
              onClose={() => closeFile(file.path)}
            />
          );
        })}
      </div>
      <PanelActions />
    </div>
  );
});
