import { registerClaudeCodeIpcHandlers } from '../../claude-code/main/claudeCodeIpcHandlers';
import { registerPluginIpcHandlers } from './pluginIpcHandlers';

export function registerPluginHandlers(): void {
  registerPluginIpcHandlers();
  registerClaudeCodeIpcHandlers();
}
