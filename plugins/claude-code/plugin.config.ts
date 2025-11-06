import type { PluginConfig } from '../core/types/pluginConfig';

export const config: PluginConfig = {
  name: 'claude-code',
  pluginPath: '.vite/build/plugins/claude-code.cjs',
  manifestPath: 'plugins/claude-code/manifest.json',
  mainRegisterPath: '../claude-code/main/register',
  rendererRegisterPath: '../claude-code/renderer/register',
};
