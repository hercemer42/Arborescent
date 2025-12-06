import { File } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

export interface TabProps {
  isZoomTab: boolean;
  fullName: string | undefined;
  isLastInGroup: boolean;
  hasZoomToRight: boolean;
}

export function getTabProps(file: File, nextFile: File | undefined): TabProps {
  const isZoomTab = !!file.zoomSource;

  let fullName: string | undefined;
  if (isZoomTab && file.zoomSource) {
    const store = storeManager.getStoreForFile(file.path);
    const node = store.getState().nodes[file.zoomSource.zoomedNodeId];
    fullName = node?.content || '(untitled)';
  }

  const isLastInGroup = isZoomTab && (
    !nextFile ||
    !nextFile.zoomSource ||
    nextFile.zoomSource.sourceFilePath !== file.zoomSource?.sourceFilePath
  );

  const hasZoomToRight = !isZoomTab && nextFile?.zoomSource?.sourceFilePath === file.path;

  return { isZoomTab, fullName, isLastInGroup, hasZoomToRight };
}
