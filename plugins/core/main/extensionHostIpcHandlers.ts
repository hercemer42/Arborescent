import { ipcMain, app } from 'electron';
import path from 'node:path';
import { ExtensionHostConnection } from './extensionHost/ExtensionHostConnection';
import { MessageType } from './extensionHost/types/messages';
import { logger } from '../../../src/main/services/logger';

let extensionHost: ExtensionHostConnection | null = null;

type HandlerResult = { success: boolean; error?: string; [key: string]: unknown };
type HandlerFunction = (...args: unknown[]) => Promise<HandlerResult>;

function wrapHandler(
  handlerName: string,
  requiresExtensionHost: boolean,
  handler: HandlerFunction
): HandlerFunction {
  return async (...args: unknown[]): Promise<HandlerResult> => {
    if (requiresExtensionHost && !extensionHost) {
      return { success: false, error: 'Extension host not started' };
    }

    try {
      return await handler(...args);
    } catch (error) {
      logger.error(handlerName, error as Error, 'Extension Host IPC');
      return { success: false, error: (error as Error).message };
    }
  };
}

export function registerExtensionHostIpcHandlers(): void {
  ipcMain.handle('extension-host:start', wrapHandler('Failed to start extension host', false, async () => {
    if (extensionHost) {
      logger.warn('Extension host already started', 'Extension Host IPC');
      return { success: true };
    }

    extensionHost = new ExtensionHostConnection();
    await extensionHost.start();
    return { success: true };
  }));

  ipcMain.handle('extension-host:stop', wrapHandler('Failed to stop extension host', false, async () => {
    if (!extensionHost) {
      return { success: true };
    }

    await extensionHost.stop();
    extensionHost = null;
    return { success: true };
  }));

  ipcMain.handle('extension-host:register-plugin', async (_, pluginName: string, pluginPath: string, manifestPath: string) =>
    wrapHandler(`Failed to register plugin ${pluginName}`, true, async () => {
      const appPath = app.getAppPath();
      const absolutePluginPath = path.isAbsolute(pluginPath)
        ? pluginPath
        : path.resolve(appPath, pluginPath);
      const absoluteManifestPath = path.isAbsolute(manifestPath)
        ? manifestPath
        : path.resolve(appPath, manifestPath);

      const response = await extensionHost!.sendMessage(MessageType.RegisterPlugin, {
        pluginName,
        pluginPath: absolutePluginPath,
        manifestPath: absoluteManifestPath,
      }) as { manifest: unknown };
      return { success: true, manifest: response.manifest };
    })()
  );

  ipcMain.handle('extension-host:unregister-plugin', async (_, pluginName: string) =>
    wrapHandler(`Failed to unregister plugin ${pluginName}`, false, async () => {
      if (!extensionHost) {
        return { success: true };
      }

      await extensionHost.sendMessage(MessageType.UnregisterPlugin, {
        pluginName,
      });
      return { success: true };
    })()
  );

  ipcMain.handle('extension-host:initialize-plugins', wrapHandler('Failed to initialize plugins', true, async () => {
    await extensionHost!.sendMessage(MessageType.InitializePlugins, {});
    return { success: true };
  }));

  ipcMain.handle('extension-host:dispose-plugins', wrapHandler('Failed to dispose plugins', false, async () => {
    if (!extensionHost) {
      return { success: true };
    }

    await extensionHost.sendMessage(MessageType.DisposePlugins, {});
    return { success: true };
  }));

  ipcMain.handle('extension-host:invoke-extension', async (_, pluginName: string, extensionPoint: string, args: unknown[]) =>
    wrapHandler(`Failed to invoke extension ${extensionPoint} on plugin ${pluginName}`, true, async () => {
      const response = await extensionHost!.sendMessage(MessageType.InvokeExtension, {
        pluginName,
        extensionPoint,
        args,
      });
      return { success: true, result: response };
    })()
  );
}
