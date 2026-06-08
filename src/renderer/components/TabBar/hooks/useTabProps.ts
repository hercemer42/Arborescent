import { File } from '../../../store/files/filesStore';

export interface TabProps {
  displayName: string;
  isZoomTab: boolean;
  fullName: string | undefined;
  isLastInGroup: boolean;
  hasZoomToRight: boolean;
  isReviewPending: boolean;
}

function stripArboExtension(name: string): string {
  return name.endsWith('.arbo') ? name.slice(0, -5) : name;
}

export function getTabProps(file: File, nextFile: File | undefined, isReviewPending = false): TabProps {
  const isZoomTab = !!file.zoomSource;
  const displayName = stripArboExtension(file.displayName);

  // Show full file path on hover for saved files only (not temp files or zoom tabs)
  const fullName = (!isZoomTab && !file.isTemporary) ? file.path : undefined;

  const isLastInGroup = isZoomTab && (
    !nextFile ||
    !nextFile.zoomSource ||
    nextFile.zoomSource.sourceFilePath !== file.zoomSource?.sourceFilePath
  );

  const hasZoomToRight = !isZoomTab && nextFile?.zoomSource?.sourceFilePath === file.path;

  return { displayName, isZoomTab, fullName, isLastInGroup, hasZoomToRight, isReviewPending: isReviewPending && isZoomTab };
}
