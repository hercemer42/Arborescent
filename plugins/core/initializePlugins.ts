import { PluginRegistry } from './PluginRegistry';
import { PluginManager } from './PluginManager';
import { registerClaudeCodeCommands } from '../claude-code/renderer/claudeCodeCommands';

export async function initializeBuiltinPlugins(): Promise<void> {
  await PluginManager.start();
  registerClaudeCodeCommands();

  const claudeCodePlugin = await PluginManager.registerPlugin({
    name: 'claude-code',
    pluginPath: '.vite/build/plugins/claude-code.cjs',
    manifestPath: 'plugins/claude-code/manifest.json',
  });

  await PluginRegistry.register(claudeCodePlugin);
}

export async function disposeBuiltinPlugins(): Promise<void> {
  await PluginManager.disposePlugins();
  await PluginManager.stop();
}
