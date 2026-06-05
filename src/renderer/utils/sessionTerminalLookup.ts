// workflowSessionMap maps sessionId -> terminalId; the reverse lookup answers
// "which Claude session is bound to this terminal" so a terminal's sessionId can
// be persisted at save time.
export function findSessionIdForTerminal(
  workflowSessionMap: Record<string, string>,
  terminalId: string,
): string | undefined {
  for (const [sessionId, mappedTerminalId] of Object.entries(workflowSessionMap)) {
    if (mappedTerminalId === terminalId) return sessionId;
  }
  return undefined;
}
