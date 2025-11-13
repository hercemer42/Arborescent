import type { PluginConfig } from '../core/shared/config';

export const config: PluginConfig = {
  name: 'claude-code',
  pluginPath: '.vite/build/plugins/claude-code.cjs',
  manifestPath: '.vite/build/plugins/claude-code-manifest.json',
  mainHandlersPath: '.vite/build/plugins/claude-code.cjs',
};
