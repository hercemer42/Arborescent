import { parentPort } from 'node:worker_threads';
import { pathToFileURL } from 'node:url';
import { ExtensionHostMessage, RendererMessage, MessageType } from './types/messages';
import { Plugin } from '../../pluginInterface';
import { logger } from './workerLogger';
import { PluginAPI } from './PluginAPI';

// Make the plugin API available globally for plugins to use
(global as { pluginAPI: PluginAPI }).pluginAPI = new PluginAPI();

interface PluginRegistration {
  manifest: unknown;
  pluginPath: string;
  plugin?: Plugin;
  initialized: boolean;
}

class ExtensionHost {
  private plugins: Map<string, PluginRegistration> = new Map();
  private initialized = false;

  constructor() {
    if (!parentPort) {
      throw new Error('ExtensionHost must be run as a worker thread');
    }

    parentPort.on('message', (message: RendererMessage | { type: string }) => {
      // Ignore messages handled by PluginAPI (ipc-response, ipc-call responses)
      if ('type' in message && (message.type === 'ipc-response' || message.type === 'log')) {
        return;
      }

      this.handleMessage(message as RendererMessage).catch((error) => {
        logger.error('Error handling message in extension host', error as Error, 'Extension Host');
        if ('id' in message) {
          this.sendError(message.id, error);
        }
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
    const payload = message.payload as { pluginName: string; pluginPath: string; manifestPath: string };
    const { pluginName, pluginPath, manifestPath } = payload;

    try {
      // Only load manifest, not the plugin code (lazy loading)
      const fs = await import('node:fs/promises');
      const manifestJson = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestJson);

      this.plugins.set(pluginName, {
        manifest,
        pluginPath,
        plugin: undefined,
        initialized: false,
      });

      this.sendResponse(message.id, {
        success: true,
        manifest,
      });
    } catch (error) {
      this.sendError(message.id, error);
    }
  }

  private async ensurePluginLoaded(pluginName: string): Promise<Plugin> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      throw new Error(`Plugin ${pluginName} not registered`);
    }

    if (registration.plugin) {
      return registration.plugin;
    }

    try {
      // Convert absolute path to file URL for dynamic import
      const fileUrl = pathToFileURL(registration.pluginPath).href;
      const PluginModule = await import(fileUrl);

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
      registration.plugin = plugin;

      return plugin;
    } catch (error) {
      logger.error(`Failed to load plugin ${pluginName}`, error as Error, 'Extension Host');
      throw error;
    }
  }

  private async handleUnregisterPlugin(message: RendererMessage): Promise<void> {
    const payload = message.payload as { pluginName: string };
    const { pluginName } = payload;
    const registration = this.plugins.get(pluginName);

    if (registration?.plugin) {
      registration.plugin.dispose();
    }
    this.plugins.delete(pluginName);

    this.sendResponse(message.id, { success: true });
  }

  private async handleInitializePlugins(message: RendererMessage): Promise<void> {
    const enabledRegistrations = Array.from(this.plugins.entries()).filter(
      ([, reg]) => (reg.manifest as { enabled?: boolean }).enabled
    );

    await Promise.all(
      enabledRegistrations.map(async ([pluginName, registration]) => {
        if (!registration.initialized) {
          const plugin = await this.ensurePluginLoaded(pluginName);
          await plugin.initialize();
          registration.initialized = true;
        }
      })
    );

    this.initialized = true;
    this.sendResponse(message.id, { success: true });
  }

  private async handleDisposePlugins(message: RendererMessage): Promise<void> {
    this.plugins.forEach((registration) => {
      if (registration.plugin) {
        registration.plugin.dispose();
      }
    });
    this.plugins.clear();
    this.initialized = false;

    this.sendResponse(message.id, { success: true });
  }

  private async handleInvokeExtension(message: RendererMessage): Promise<void> {
    const payload = message.payload as { pluginName: string; extensionPoint: string; args: unknown[] };
    const { pluginName, extensionPoint, args } = payload;

    try {
      // Lazy load plugin if not already loaded
      const plugin = await this.ensurePluginLoaded(pluginName);

      const registration = this.plugins.get(pluginName);
      if (registration && !registration.initialized) {
        await plugin.initialize();
        registration.initialized = true;
      }

      const extensionFn = plugin.extensions[extensionPoint as keyof typeof plugin.extensions];
      if (!extensionFn) {
        this.sendResponse(message.id, { result: null });
        return;
      }

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
