export type WorkflowStartRoute =
  | { kind: 'spawn-fresh' }
  | { kind: 'focus-existing-tab'; terminalId: string }
  | { kind: 'resume-in-new-tab'; sessionId: string; cwd: string | undefined };

export interface WorkflowStartRouteInput {
  sessionId: string | undefined;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
  openTerminalIds: ReadonlySet<string>;
}

export function decideWorkflowStartRoute(input: WorkflowStartRouteInput): WorkflowStartRoute {
  const { sessionId, workflowSessionMap, sessionRegistry, openTerminalIds } = input;

  if (!sessionId) return { kind: 'spawn-fresh' };

  const mappedTerminalId = workflowSessionMap[sessionId];
  if (mappedTerminalId && openTerminalIds.has(mappedTerminalId)) {
    return { kind: 'focus-existing-tab', terminalId: mappedTerminalId };
  }

  return {
    kind: 'resume-in-new-tab',
    sessionId,
    cwd: sessionRegistry[sessionId]?.cwd,
  };
}
