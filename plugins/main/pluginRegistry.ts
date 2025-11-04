import { registerClaudeCodeIpcHandlers } from '../claude-code/main/claudeCodeIpcHandlers';
import { registerExtensionHostIpcHandlers } from '../core/main/extensionHostIpcHandlers';

export function registerPluginHandlers(): void {
  registerExtensionHostIpcHandlers();
  registerClaudeCodeIpcHandlers();
}
