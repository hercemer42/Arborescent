import { registerClaudeCodeIpcHandlers } from '../claude-code/main/claudeCodeIpcHandlers';
import { registerPluginIpcHandlers } from '../core/main/pluginIpcHandlers';

export function registerPluginHandlers(): void {
  registerPluginIpcHandlers();
  registerClaudeCodeIpcHandlers();
}
