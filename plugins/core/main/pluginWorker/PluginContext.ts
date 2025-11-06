import { PluginAPI } from './PluginAPI';

export interface ClaudeCodeSession {
  id: string;
  projectPath: string;
  lastModified: string;
  firstMessage?: string;
}

export class PluginContext {
  private pluginAPI: PluginAPI;

  constructor(pluginAPI: PluginAPI) {
    this.pluginAPI = pluginAPI;
  }

  private async invokeIPC<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    return this.pluginAPI.invokeIPC<T>(channel, ...args);
  }

  async getProjectPath(): Promise<string> {
    return this.invokeIPC<string>('claude:get-project-path');
  }

  async listClaudeSessions(projectPath: string): Promise<ClaudeCodeSession[]> {
    return this.invokeIPC<ClaudeCodeSession[]>('claude:list-sessions', projectPath);
  }

  async sendToClaudeSession(
    sessionId: string,
    context: string,
    projectPath: string
  ): Promise<void> {
    return this.invokeIPC<void>('claude:send-to-session', sessionId, context, projectPath);
  }
}
