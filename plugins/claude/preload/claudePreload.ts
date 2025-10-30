import { ipcRenderer } from 'electron';

export const claudePreloadAPI = {
  claudeGetProjectPath: () => ipcRenderer.invoke('claude:get-project-path'),
  claudeListSessions: (projectPath: string) =>
    ipcRenderer.invoke('claude:list-sessions', projectPath),
  claudeSendToSession: (sessionId: string, context: string, projectPath: string) =>
    ipcRenderer.invoke('claude:send-to-session', sessionId, context, projectPath),
};
