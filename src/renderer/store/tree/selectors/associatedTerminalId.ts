export interface AssociatedTerminalSelectorState {
  terminalOrigins?: Record<string, string>;
}

export function selectAssociatedTerminalId(
  state: AssociatedTerminalSelectorState,
  focusedNodeId: string | null | undefined,
): string | null {
  if (!focusedNodeId) return null;
  const origins = state.terminalOrigins;
  if (!origins) return null;
  for (const [terminalId, originNodeId] of Object.entries(origins)) {
    if (originNodeId && originNodeId === focusedNodeId) return terminalId;
  }
  return null;
}
