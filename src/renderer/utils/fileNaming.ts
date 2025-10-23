export function getUntitledNumber(path: string): string {
  return path.match(/untitled-(\d+)/)?.[1] || '1';
}

export function getFilename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function getDisplayName(path: string, isTemporary: boolean): string {
  if (isTemporary) {
    return `Untitled ${getUntitledNumber(path)}`;
  }
  return getFilename(path);
}
