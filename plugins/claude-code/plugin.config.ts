import type { PluginConfig } from '../core/shared/config';

export const config: PluginConfig = {
  name: 'claude-code',
  pluginPath: '.vite/build/plugins/claude-code.cjs',
  manifestPath: 'plugins/claude-code/manifest.json',
  mainHandlersPath: './plugins/claude-code.cjs',
  rendererCommandsPath: '../../claude-code/renderer/register',
};
