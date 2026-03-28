export function parseZoomPath(filePath: string): { sourceFilePath: string; nodeId: string } | null {
  if (!filePath.startsWith('zoom://')) return null;
  const withoutPrefix = filePath.slice('zoom://'.length);
  const hashIndex = withoutPrefix.lastIndexOf('#');
  if (hashIndex === -1) return null;
  return {
    sourceFilePath: withoutPrefix.slice(0, hashIndex),
    nodeId: withoutPrefix.slice(hashIndex + 1),
  };
}

export function resolveToSourceFilePath(filePath: string | null): string | null {
  if (!filePath) return null;
  const zoomInfo = parseZoomPath(filePath);
  return zoomInfo ? zoomInfo.sourceFilePath : filePath;
}
