import { File } from '../../../store/files/filesStore';

export interface TabProps {
  isZoomTab: boolean;
  fullName: string | undefined;
  isLastInGroup: boolean;
  hasZoomToRight: boolean;
}

export function getTabProps(file: File, nextFile: File | undefined): TabProps {
  const isZoomTab = !!file.zoomSource;

  // Show full file path on hover for saved files only (not temp files or zoom tabs)
  const fullName = (!isZoomTab && !file.isTemporary) ? file.path : undefined;

  const isLastInGroup = isZoomTab && (
    !nextFile ||
    !nextFile.zoomSource ||
    nextFile.zoomSource.sourceFilePath !== file.zoomSource?.sourceFilePath
  );

  const hasZoomToRight = !isZoomTab && nextFile?.zoomSource?.sourceFilePath === file.path;

  return { isZoomTab, fullName, isLastInGroup, hasZoomToRight };
}
