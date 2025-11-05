import { claudeCodePreloadAPI } from '../claude-code/preload/claudeCodePreload';
import { pluginPreloadAPI as corePluginPreloadAPI } from '../core/preload/pluginPreload';
import { PluginManifest } from '../../src/shared/types';

export const pluginPreloadAPI = {
  ...claudeCodePreloadAPI,
  ...corePluginPreloadAPI,
};

export interface PluginPreloadAPI {
  // Claude Code Plugin
  claudeGetProjectPath: () => Promise<string>;
  claudeListSessions: (projectPath: string) => Promise<unknown[]>;
  claudeSendToSession: (sessionId: string, context: string, projectPath: string) => Promise<void>;

  // Plugin System
  pluginStart: () => Promise<{ success: boolean; error?: string }>;
  pluginStop: () => Promise<{ success: boolean; error?: string }>;
  pluginRegister: (
    pluginName: string,
    pluginPath: string,
    manifestPath: string
  ) => Promise<{ success: boolean; manifest?: PluginManifest; error?: string }>;
  pluginUnregister: (pluginName: string) => Promise<{ success: boolean; error?: string }>;
  pluginInitializeAll: () => Promise<{ success: boolean; error?: string }>;
  pluginDisposeAll: () => Promise<{ success: boolean; error?: string }>;
  pluginInvokeExtension: (
    pluginName: string,
    extensionPoint: string,
    args: unknown[]
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>;
}
