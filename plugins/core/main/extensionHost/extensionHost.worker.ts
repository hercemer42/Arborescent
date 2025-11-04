import { parentPort } from 'node:worker_threads';
import { ExtensionHostMessage, RendererMessage, MessageType } from './types/messages';
import { Plugin } from '../../pluginInterface';
import { logger } from './workerLogger';
import { PluginAPI } from './PluginAPI';

// Make the plugin API available globally for plugins to use
(global as { pluginAPI: PluginAPI }).pluginAPI = new PluginAPI();

class ExtensionHost {
  private plugins: Map<string, Plugin> = new Map();
  private initialized = false;

  constructor() {
    if (!parentPort) {
      throw new Error('ExtensionHost must be run as a worker thread');
    }

    parentPort.on('message', (message: RendererMessage) => {
      this.handleMessage(message).catch((error) => {
        logger.error('Error handling message in extension host', error as Error, 'Extension Host');
        this.sendError(message.id, error);
      });
    });

    this.sendReady();
  }

  private async handleMessage(message: RendererMessage): Promise<void> {
    switch (message.type) {
      case MessageType.RegisterPlugin:
        await this.handleRegisterPlugin(message);
        break;
      case MessageType.UnregisterPlugin:
        await this.handleUnregisterPlugin(message);
        break;
      case MessageType.InitializePlugins:
        await this.handleInitializePlugins(message);
        break;
      case MessageType.DisposePlugins:
        await this.handleDisposePlugins(message);
        break;
      case MessageType.InvokeExtension:
        await this.handleInvokeExtension(message);
        break;
      default:
        throw new Error(`Unknown message type: ${(message as { type: string }).type}`);
    }
  }

  private async handleRegisterPlugin(message: RendererMessage): Promise<void> {
    const payload = message.payload as { pluginName: string; pluginPath: string };
    const { pluginName, pluginPath } = payload;

    try {
      const PluginModule = await import(pluginPath);

      // Handle different export patterns (ES modules, CommonJS, etc.)
      let PluginClass: new () => Plugin;

      if (typeof PluginModule.default === 'function') {
        PluginClass = PluginModule.default as new () => Plugin;
      } else if (typeof PluginModule === 'function') {
        PluginClass = PluginModule as unknown as new () => Plugin;
      } else {
        // Try to find a class export by looking for capitalized keys
        const classKey = Object.keys(PluginModule).find(key =>
          key[0] === key[0].toUpperCase() && typeof PluginModule[key] === 'function'
        );
        if (classKey) {
          PluginClass = PluginModule[classKey] as new () => Plugin;
        } else {
          throw new Error('Could not find plugin class export');
        }
      }

      const plugin: Plugin = new PluginClass();

      this.plugins.set(pluginName, plugin);

      this.sendResponse(message.id, {
        success: true,
        manifest: plugin.manifest,
      });
    } catch (error) {
      this.sendError(message.id, error);
    }
  }

  private async handleUnregisterPlugin(message: RendererMessage): Promise<void> {
    const payload = message.payload as { pluginName: string };
    const { pluginName } = payload;
    const plugin = this.plugins.get(pluginName);

    if (plugin) {
      plugin.dispose();
      this.plugins.delete(pluginName);
    }

    this.sendResponse(message.id, { success: true });
  }

  private async handleInitializePlugins(message: RendererMessage): Promise<void> {
    const enabledPlugins = Array.from(this.plugins.values()).filter(
      (p) => p.manifest.enabled
    );

    await Promise.all(enabledPlugins.map((plugin) => plugin.initialize()));
    this.initialized = true;

    this.sendResponse(message.id, { success: true });
  }

  private async handleDisposePlugins(message: RendererMessage): Promise<void> {
    this.plugins.forEach((plugin) => plugin.dispose());
    this.plugins.clear();
    this.initialized = false;

    this.sendResponse(message.id, { success: true });
  }

  private async handleInvokeExtension(message: RendererMessage): Promise<void> {
    const payload = message.payload as { pluginName: string; extensionPoint: string; args: unknown[] };
    const { pluginName, extensionPoint, args } = payload;
    const plugin = this.plugins.get(pluginName);

    if (!plugin) {
      throw new Error(`Plugin ${pluginName} not found`);
    }

    const extensionFn = plugin.extensions[extensionPoint as keyof typeof plugin.extensions];
    if (!extensionFn) {
      this.sendResponse(message.id, { result: null });
      return;
    }

    try {
      const result = await (extensionFn as (...args: unknown[]) => unknown)(...(args as unknown[]));
      this.sendResponse(message.id, { result });
    } catch (error) {
      this.sendError(message.id, error);
    }
  }

  private sendResponse(id: string, payload: unknown): void {
    if (!parentPort) return;

    const response: ExtensionHostMessage = {
      type: MessageType.Response,
      id,
      payload,
    };

    parentPort.postMessage(response);
  }

  private sendError(id: string, error: unknown): void {
    if (!parentPort) return;

    const response: ExtensionHostMessage = {
      type: MessageType.Error,
      id,
      payload: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };

    parentPort.postMessage(response);
  }

  private sendReady(): void {
    if (!parentPort) return;

    const message: ExtensionHostMessage = {
      type: MessageType.Ready,
      id: 'ready',
      payload: {},
    };

    parentPort.postMessage(message);
  }
}

new ExtensionHost();
