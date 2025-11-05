import { PluginRegistry } from './core';
import { ClaudePlugin } from '../../../plugins/claude/renderer';

export async function initializeBuiltinPlugins(): Promise<void> {
  const claudePlugin = new ClaudePlugin();
  await PluginRegistry.register(claudePlugin);
}
