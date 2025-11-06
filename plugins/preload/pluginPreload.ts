import { pluginPreloadAPI as corePluginPreloadAPI } from '../core/preload/pluginPreload';

// Re-export only the core plugin system API
// Plugin-specific functionality uses the generic plugin IPC bridge
export const pluginPreloadAPI = corePluginPreloadAPI;

export interface PluginPreloadAPI {
  // Plugin System - Generic APIs for managing plugins
  pluginStart: () => Promise<{ success: boolean; error?: string }>;
  pluginStop: () => Promise<{ success: boolean; error?: string }>;
  pluginRegister: (
    pluginName: string,
    pluginPath: string,
    manifestPath: string
  ) => Promise<{ success: boolean; manifest?: unknown; error?: string }>;
  pluginUnregister: (pluginName: string) => Promise<{ success: boolean; error?: string }>;
  pluginInitializeAll: () => Promise<{ success: boolean; error?: string }>;
  pluginDisposeAll: () => Promise<{ success: boolean; error?: string }>;
  pluginInvokeExtension: (
    pluginName: string,
    extensionPoint: string,
    args: unknown[]
  ) => Promise<{ success: boolean; result?: unknown; error?: string }>;
}
