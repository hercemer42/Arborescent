import { ipcMain, app } from 'electron';
import path from 'node:path';
import { PluginWorkerConnection } from './WorkerConnection';
import { MessageType } from '../worker/types/messages';
import { logger } from '../../../src/main/services/logger';

/**
 * Registers system-level IPC handlers for plugin lifecycle management.
 *
 * These handlers enable the renderer to control the plugin system itself:
 * - plugin:start/stop - Start/stop the worker thread
 * - plugin:register/unregister - Load/unload plugins
 * - plugin:initialize-all/dispose-all - Lifecycle management
 * - plugin:invoke-extension - Execute plugin extension points
 *
 * Flow: Renderer (UI) → Electron IPC → Main (this file) → Worker (plugin execution)
 */

let pluginWorker: PluginWorkerConnection | null = null;

type HandlerResult = { success: boolean; error?: string; [key: string]: unknown };
type HandlerFunction = (...args: unknown[]) => Promise<HandlerResult>;

function wrapHandler(
  handlerName: string,
  requiresPluginWorker: boolean,
  handler: HandlerFunction
): HandlerFunction {
  return async (...args: unknown[]): Promise<HandlerResult> => {
    if (requiresPluginWorker && !pluginWorker) {
      return { success: false, error: 'Plugin system not started' };
    }

    try {
      return await handler(...args);
    } catch (error) {
      logger.error(handlerName, error as Error, 'Plugin IPC');
      return { success: false, error: (error as Error).message };
    }
  };
}

export function registerPluginIpcHandlers(): void {
  ipcMain.handle('plugin:start', wrapHandler('Failed to start plugin system', false, async () => {
    if (pluginWorker) {
      logger.warn('Plugin system already started', 'Plugin IPC');
      return { success: true };
    }

    pluginWorker = new PluginWorkerConnection();
    await pluginWorker.start();
    return { success: true };
  }));

  ipcMain.handle('plugin:stop', wrapHandler('Failed to stop plugin system', false, async () => {
    if (!pluginWorker) {
      return { success: true };
    }

    await pluginWorker.stop();
    pluginWorker = null;
    return { success: true };
  }));

  ipcMain.handle('plugin:register', async (_, pluginName: string, pluginPath: string, manifestPath: string) =>
    wrapHandler(`Failed to register plugin ${pluginName}`, true, async () => {
      const appPath = app.getAppPath();
      const isAbsolute = path.isAbsolute(manifestPath);
      const absolutePluginPath = isAbsolute
        ? pluginPath
        : path.resolve(appPath, pluginPath);
      const absoluteManifestPath = isAbsolute
        ? manifestPath
        : path.resolve(appPath, manifestPath);

      const response = await pluginWorker!.sendMessage(MessageType.RegisterPlugin, {
        pluginName,
        pluginPath: absolutePluginPath,
        manifestPath: absoluteManifestPath,
      }) as { manifest: unknown };
      return { success: true, manifest: response.manifest };
    })()
  );

  ipcMain.handle('plugin:unregister', async (_, pluginName: string) =>
    wrapHandler(`Failed to unregister plugin ${pluginName}`, false, async () => {
      if (!pluginWorker) {
        return { success: true };
      }

      await pluginWorker.sendMessage(MessageType.UnregisterPlugin, {
        pluginName,
      });
      return { success: true };
    })()
  );

  ipcMain.handle('plugin:initialize-all', wrapHandler('Failed to initialize plugins', true, async () => {
    await pluginWorker!.sendMessage(MessageType.InitializePlugins, {});
    return { success: true };
  }));

  ipcMain.handle('plugin:dispose-all', wrapHandler('Failed to dispose plugins', false, async () => {
    if (!pluginWorker) {
      return { success: true };
    }

    await pluginWorker.sendMessage(MessageType.DisposePlugins, {});
    return { success: true };
  }));

  ipcMain.handle('plugin:invoke-extension', async (_, pluginName: string, extensionPoint: string, args: unknown[]) =>
    wrapHandler(`Failed to invoke extension ${extensionPoint} on plugin ${pluginName}`, true, async () => {
      const response = await pluginWorker!.sendMessage(MessageType.InvokeExtension, {
        pluginName,
        extensionPoint,
        args,
      });
      return { success: true, result: response };
    })()
  );
}
