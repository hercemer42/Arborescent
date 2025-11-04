import { PluginRegistry } from './PluginRegistry';
import { ExtensionHostManager } from './ExtensionHostManager';
import { registerClaudeCodeCommands } from '../claude-code/renderer/claudeCodeCommands';

export async function initializeBuiltinPlugins(): Promise<void> {
  await ExtensionHostManager.start();
  registerClaudeCodeCommands();

  // Path is relative to app root
  const claudeCodePlugin = await ExtensionHostManager.registerPlugin({
    name: 'claude-code',
    pluginPath: '.vite/build/plugins/claude-code.cjs',
  });

  await PluginRegistry.register(claudeCodePlugin);
}

export async function disposeBuiltinPlugins(): Promise<void> {
  await ExtensionHostManager.disposePlugins();
  await ExtensionHostManager.stop();
}
