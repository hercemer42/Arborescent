import { claudeCodePreloadAPI } from '../claude-code/preload/claudeCodePreload';

export const pluginPreloadAPI = {
  ...claudeCodePreloadAPI,
};

export interface PluginPreloadAPI {
  claudeGetProjectPath: () => Promise<string>;
  claudeListSessions: (projectPath: string) => Promise<unknown[]>;
  claudeSendToSession: (sessionId: string, context: string, projectPath: string) => Promise<void>;
}
