export type CwdMatchResult = 'match' | 'mismatch';

export function assertCwdMatch(
  sessionId: string,
  sessionRegistry: Record<string, { cwd: string }>,
  terminalCwd: string | null | undefined,
): CwdMatchResult {
  if (!terminalCwd) return 'mismatch';
  const recordedCwd = sessionRegistry[sessionId]?.cwd;
  if (!recordedCwd) return 'mismatch';
  return recordedCwd === terminalCwd ? 'match' : 'mismatch';
}
