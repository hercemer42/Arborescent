import { claudeCodePreloadAPI } from '../claude-code/preload/claudeCodePreload';
import { extensionHostPreloadAPI } from '../core/preload/extensionHostPreload';
import { PluginManifest } from '../../src/shared/types';

export const pluginPreloadAPI = {
  ...claudeCodePreloadAPI,
  ...extensionHostPreloadAPI,
};

export interface PluginPreloadAPI {
  // Claude Code Plugin
  claudeGetProjectPath: () => Promise<string>;
  claudeListSessions: (projectPath: string) => Promise<unknown[]>;
  claudeSendToSession: (sessionId: string, context: string, projectPath: string) => Promise<void>;

  // Extension Host
  extensionHostStart: () => Promise<{ success: boolean; error?: string }>;
  extensionHostStop: () => Promise<{ success: boolean; error?: string }>;
  extensionHostRegisterPlugin: (
    pluginName: string,
    pluginPath: string
  ) => Promise<{ success: boolean; manifest?: PluginManifest; error?: string }>;
  extensionHostUnregisterPlugin: (pluginName: string) => Promise<{ success: boolean; error?: string }>;
  extensionHostInitializePlugins: () => Promise<{ success: boolean; error?: string }>;
  extensionHostDisposePlugins: () => Promise<{ success: boolean; error?: string }>;
  extensionHostInvokeExtension: (
    pluginName: string,
    extensionPoint: string,
    args: unknown[]
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>;
}
