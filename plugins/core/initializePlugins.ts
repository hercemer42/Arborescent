import { PluginRegistry } from './PluginRegistry';
import { ClaudeCodePlugin } from '../claude-code/renderer/ClaudeCodePlugin';

export async function initializeBuiltinPlugins(): Promise<void> {
  const claudeCodePlugin = new ClaudeCodePlugin();
  await PluginRegistry.register(claudeCodePlugin);
}
