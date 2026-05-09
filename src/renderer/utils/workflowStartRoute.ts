import type { SessionLiveness } from '@shared/types';

export type WorkflowStartRoute =
  | { kind: 'spawn-fresh' }
  | { kind: 'focus-existing-tab'; terminalId: string }
  | { kind: 'resume-in-new-tab'; sessionId: string; cwd: string | undefined };

export interface WorkflowStartRouteInput {
  sessionId: string | undefined;
  sessionLiveness: SessionLiveness | undefined;
  sessionTabId: string | undefined;
  sessionWorkingDirectory: string | undefined;
  openTerminalIds: ReadonlySet<string>;
}

export function decideWorkflowStartRoute(input: WorkflowStartRouteInput): WorkflowStartRoute {
  const { sessionId, sessionLiveness, sessionTabId, sessionWorkingDirectory, openTerminalIds } = input;

  if (!sessionId) return { kind: 'spawn-fresh' };
  if (sessionLiveness === 'lost') return { kind: 'spawn-fresh' };

  if (sessionTabId && openTerminalIds.has(sessionTabId)) {
    return { kind: 'focus-existing-tab', terminalId: sessionTabId };
  }

  return { kind: 'resume-in-new-tab', sessionId, cwd: sessionWorkingDirectory };
}
