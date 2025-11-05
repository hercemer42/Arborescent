import { PluginAPI } from './PluginAPI';

declare global {
  // TypeScript requires 'var' for global ambient declarations
  // eslint-disable-next-line no-var
  var pluginAPI: PluginAPI;
}

export {};
