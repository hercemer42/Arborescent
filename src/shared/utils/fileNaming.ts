export function getNextUntitledNumber(filePaths: string[]): number {
  if (filePaths.length === 0) return 1;

  const numbers = filePaths
    .map(path => path.match(/untitled-(\d+)\.json$/)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(n => parseInt(n, 10));

  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

function getUntitledNumber(path: string): string {
  return path.match(/untitled-(\d+)/)?.[1] || '1';
}

function getFilename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function getDisplayName(path: string, isTemporary: boolean): string {
  if (isTemporary) {
    return `Untitled ${getUntitledNumber(path)}`;
  }
  return getFilename(path);
}
