import path from 'node:path';

/**
 * Path-traversal guard for IPC handlers that accept filesystem paths
 * from the renderer. Electron's IPC boundary is a trust seam: the
 * renderer is user-facing JavaScript, so inputs can be hostile or
 * simply malformed.
 *
 * The guards intentionally reject early on unusable inputs rather than
 * letting Node's fs calls fail opaquely later.
 */

const MAX_PATH_LENGTH = 4096;

export function assertNonEmptyPath(filePath: unknown, context: string): asserts filePath is string {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error(`[${context}] path must be a non-empty string`);
  }
  if (filePath.length > MAX_PATH_LENGTH) {
    throw new Error(`[${context}] path exceeds maximum length`);
  }
  if (filePath.includes('\0')) {
    throw new Error(`[${context}] path contains null byte`);
  }
}

/**
 * Validate that `candidate` resolves inside `baseDir`. Normalises both
 * sides via path.resolve, which collapses `..` components; prevents
 * renderer-supplied paths from escaping the temp directory.
 *
 * Returns the fully-resolved absolute path on success; throws on escape.
 */
export function assertInsideDir(candidate: string, baseDir: string, context: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidate);

  const baseWithSep = resolvedBase.endsWith(path.sep) ? resolvedBase : resolvedBase + path.sep;
  if (resolvedCandidate !== resolvedBase && !resolvedCandidate.startsWith(baseWithSep)) {
    throw new Error(`[${context}] path escapes allowed directory`);
  }

  return resolvedCandidate;
}

/**
 * Validate that a user-supplied filename is a bare filename with no
 * directory components. Used when the renderer names a file to create
 * inside a fixed directory (e.g. temp-files/<name>).
 */
export function assertBareFileName(fileName: unknown, context: string): asserts fileName is string {
  if (typeof fileName !== 'string' || fileName.length === 0) {
    throw new Error(`[${context}] file name must be a non-empty string`);
  }
  if (fileName.length > 255) {
    throw new Error(`[${context}] file name exceeds maximum length`);
  }
  if (fileName.includes('\0') || fileName.includes('/') || fileName.includes('\\')) {
    throw new Error(`[${context}] file name contains illegal characters`);
  }
  if (fileName === '.' || fileName === '..') {
    throw new Error(`[${context}] file name cannot be relative marker`);
  }
}
