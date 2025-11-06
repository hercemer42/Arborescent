import { PluginAPI } from './API';

export class PluginContext {
  private pluginAPI: PluginAPI;

  constructor(pluginAPI: PluginAPI) {
    this.pluginAPI = pluginAPI;
  }

  async invokeIPC<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    return this.pluginAPI.invokeIPC<T>(channel, ...args);
  }
}
