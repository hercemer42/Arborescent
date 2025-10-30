import { claudePreloadAPI } from '../claude/preload/claudePreload';

export const pluginPreloadAPI = {
  ...claudePreloadAPI,
};

export interface PluginPreloadAPI {
  claudeGetProjectPath: () => Promise<string>;
  claudeListSessions: (projectPath: string) => Promise<unknown[]>;
  claudeSendToSession: (sessionId: string, context: string, projectPath: string) => Promise<void>;
}
