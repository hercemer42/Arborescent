import { ipcRenderer } from 'electron';
import { PluginManifest } from '../pluginInterface';

export const extensionHostPreloadAPI = {
  extensionHostStart: () =>
    ipcRenderer.invoke('extension-host:start'),

  extensionHostStop: () =>
    ipcRenderer.invoke('extension-host:stop'),

  extensionHostRegisterPlugin: (pluginName: string, pluginPath: string) =>
    ipcRenderer.invoke('extension-host:register-plugin', pluginName, pluginPath) as Promise<{
      success: boolean;
      manifest?: PluginManifest;
      error?: string;
    }>,

  extensionHostUnregisterPlugin: (pluginName: string) =>
    ipcRenderer.invoke('extension-host:unregister-plugin', pluginName),

  extensionHostInitializePlugins: () =>
    ipcRenderer.invoke('extension-host:initialize-plugins'),

  extensionHostDisposePlugins: () =>
    ipcRenderer.invoke('extension-host:dispose-plugins'),

  extensionHostInvokeExtension: (pluginName: string, extensionPoint: string, args: unknown[]) =>
    ipcRenderer.invoke('extension-host:invoke-extension', pluginName, extensionPoint, args) as Promise<{
      success: boolean;
      result?: unknown;
      error?: string;
    }>,
};
