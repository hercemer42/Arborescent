import { PluginAPI } from './API';

/**
 * The typed API surface that plugins receive.
 *
 * This is what plugins interact with - a clean, typed interface for calling
 * main process functionality. Plugins never directly access Node.js APIs or
 * Electron APIs - everything goes through this controlled interface.
 *
 * Example:
 * ```
 * class MyPlugin {
 *   constructor(private context: PluginContext) {}
 *
 *   async doSomething() {
 *     // This calls a handler registered in IPCBridge
 *     const result = await this.context.invokeIPC('my-plugin:get-data');
 *   }
 * }
 * ```
 */
export class PluginContext {
  private pluginAPI: PluginAPI;

  constructor(pluginAPI: PluginAPI) {
    this.pluginAPI = pluginAPI;
  }

  async invokeIPC<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    return this.pluginAPI.invokeIPC<T>(channel, ...args);
  }
}
