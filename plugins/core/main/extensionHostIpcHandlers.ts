import { ipcMain, app } from 'electron';
import path from 'node:path';
import { ExtensionHostConnection } from './extensionHost/ExtensionHostConnection';
import { MessageType } from './extensionHost/types/messages';
import { logger } from '../../../src/main/services/logger';

let extensionHost: ExtensionHostConnection | null = null;

export function registerExtensionHostIpcHandlers(): void {
  ipcMain.handle('extension-host:start', async () => {
    if (extensionHost) {
      logger.warn('Extension host already started', 'Extension Host IPC');
      return { success: true };
    }

    try {
      extensionHost = new ExtensionHostConnection();
      await extensionHost.start();
      return { success: true };
    } catch (error) {
      logger.error('Failed to start extension host', error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('extension-host:stop', async () => {
    if (!extensionHost) {
      return { success: true };
    }

    try {
      await extensionHost.stop();
      extensionHost = null;
      return { success: true };
    } catch (error) {
      logger.error('Failed to stop extension host', error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('extension-host:register-plugin', async (_, pluginName: string, pluginPath: string, manifestPath: string) => {
    if (!extensionHost) {
      return { success: false, error: 'Extension host not started' };
    }

    try {
      // Resolve paths relative to app resources
      // In development: app.getAppPath() is the project root
      // In production: app.getAppPath() is the .app/Contents/Resources/app directory
      const appPath = app.getAppPath();
      const absolutePluginPath = path.isAbsolute(pluginPath)
        ? pluginPath
        : path.resolve(appPath, pluginPath);
      const absoluteManifestPath = path.isAbsolute(manifestPath)
        ? manifestPath
        : path.resolve(appPath, manifestPath);

      const response = await extensionHost.sendMessage(MessageType.RegisterPlugin, {
        pluginName,
        pluginPath: absolutePluginPath,
        manifestPath: absoluteManifestPath,
      }) as { manifest: unknown };
      return { success: true, manifest: response.manifest };
    } catch (error) {
      logger.error(`Failed to register plugin ${pluginName}`, error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('extension-host:unregister-plugin', async (_, pluginName: string) => {
    if (!extensionHost) {
      return { success: true };
    }

    try {
      await extensionHost.sendMessage(MessageType.UnregisterPlugin, {
        pluginName,
      });
      return { success: true };
    } catch (error) {
      logger.error(`Failed to unregister plugin ${pluginName}`, error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('extension-host:initialize-plugins', async () => {
    if (!extensionHost) {
      return { success: false, error: 'Extension host not started' };
    }

    try {
      await extensionHost.sendMessage(MessageType.InitializePlugins, {});
      return { success: true };
    } catch (error) {
      logger.error('Failed to initialize plugins', error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('extension-host:dispose-plugins', async () => {
    if (!extensionHost) {
      return { success: true };
    }

    try {
      await extensionHost.sendMessage(MessageType.DisposePlugins, {});
      return { success: true };
    } catch (error) {
      logger.error('Failed to dispose plugins', error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('extension-host:invoke-extension', async (_, pluginName: string, extensionPoint: string, args: unknown[]) => {
    if (!extensionHost) {
      return { success: false, error: 'Extension host not started' };
    }

    try {
      const response = await extensionHost.sendMessage(MessageType.InvokeExtension, {
        pluginName,
        extensionPoint,
        args,
      });
      return { success: true, result: response };
    } catch (error) {
      logger.error(
        `Failed to invoke extension ${extensionPoint} on plugin ${pluginName}`,
        error as Error,
        'Extension Host IPC'
      );
      return { success: false, error: (error as Error).message };
    }
  });
}
