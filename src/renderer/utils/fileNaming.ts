/**
 * Extract the untitled file number from a temp file path
 * @param path - The file path (e.g., "/tmp/untitled-1.arbo")
 * @returns The untitled number as a string (e.g., "1")
 */
export function getUntitledNumber(path: string): string {
  return path.match(/untitled-(\d+)/)?.[1] || '1';
}

/**
 * Extract the filename from a file path
 * @param path - The file path
 * @returns The filename
 */
export function getFilename(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

/**
 * Get the display name for a file based on whether it's temporary
 * @param path - The file path
 * @param isTemporary - Whether the file is temporary
 * @returns The display name (e.g., "Untitled 1" or "myfile.arbo")
 */
export function getDisplayName(path: string, isTemporary: boolean): string {
  if (isTemporary) {
    return `Untitled ${getUntitledNumber(path)}`;
  }
  return getFilename(path);
}
