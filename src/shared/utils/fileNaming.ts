/**
 * Extracts the next untitled number from a list of file paths.
 * Looks for patterns like "untitled-1.json", "untitled-2.json", etc.
 *
 * @param filePaths - Array of file paths to scan
 * @returns The next available untitled number (max + 1, or 1 if none exist)
 *
 * @example
 * getNextUntitledNumber(['/path/untitled-1.json', '/path/untitled-3.json']) // returns 4
 * getNextUntitledNumber([]) // returns 1
 */
export function getNextUntitledNumber(filePaths: string[]): number {
  if (filePaths.length === 0) return 1;

  const numbers = filePaths
    .map(path => path.match(/untitled-(\d+)\.json$/)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(n => parseInt(n, 10));

  return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}
