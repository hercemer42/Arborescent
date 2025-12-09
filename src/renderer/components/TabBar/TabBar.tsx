import { memo } from 'react';
import { Tab } from '../Tab';
import { PanelActions } from '../PanelActions';
import { useFilesStore } from '../../store/files/filesStore';
import { useStore } from '../../store/tree/useStore';
import { getTabProps } from './hooks/useTabProps';
import './TabBar.css';

export const TabBar = memo(function TabBar() {
  const files = useFilesStore((state) => state.files);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const setActiveFile = useFilesStore((state) => state.setActiveFile);
  const closeFile = useFilesStore((state) => state.actions.closeFile);
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);

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
