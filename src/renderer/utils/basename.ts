// The final path segment (file name) of a slash-separated path, falling back to the whole
// string when there is no separator.
export function basename(path: string): string {
  return path.split('/').pop() || path;
}
