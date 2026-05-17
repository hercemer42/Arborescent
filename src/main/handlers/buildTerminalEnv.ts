export function buildTerminalEnv(
  terminalId: string,
  hookEnv: Record<string, string>,
  nodeUuid?: string
): Record<string, string> | undefined {
  const hasHookEnv = Object.keys(hookEnv).length > 0;
  const hasNodeUuid = typeof nodeUuid === 'string' && nodeUuid.length > 0;
  if (!hasHookEnv && !hasNodeUuid) return undefined;
  return {
    ...hookEnv,
    ARBORESCENT_TERMINAL_ID: terminalId,
    ...(hasNodeUuid ? { ARBORESCENT_NODE_UUID: nodeUuid } : {}),
  };
}
