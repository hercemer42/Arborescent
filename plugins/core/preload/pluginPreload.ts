import { ipcRenderer } from 'electron';
import { PluginManifest } from '../pluginInterface';

export const pluginPreloadAPI = {
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
