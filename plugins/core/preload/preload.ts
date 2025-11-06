import { ipcRenderer } from 'electron';
import { PluginManifest } from '../shared/interface';

export interface PluginPreloadAPI {
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

export const pluginPreloadAPI: PluginPreloadAPI = {
  pluginStart: () =>
    ipcRenderer.invoke('plugin:start'),

  pluginStop: () =>
    ipcRenderer.invoke('plugin:stop'),

  pluginRegister: (pluginName: string, pluginPath: string, manifestPath: string) =>
    ipcRenderer.invoke('plugin:register', pluginName, pluginPath, manifestPath) as Promise<{
      success: boolean;
      manifest?: PluginManifest;
      error?: string;
    }>,

  pluginUnregister: (pluginName: string) =>
    ipcRenderer.invoke('plugin:unregister', pluginName),

  pluginInitializeAll: () =>
    ipcRenderer.invoke('plugin:initialize-all'),

  pluginDisposeAll: () =>
    ipcRenderer.invoke('plugin:dispose-all'),

  pluginInvokeExtension: (pluginName: string, extensionPoint: string, args: unknown[]) =>
    ipcRenderer.invoke('plugin:invoke-extension', pluginName, extensionPoint, args) as Promise<{
      success: boolean;
      result?: unknown;
      error?: string;
    }>,
};
