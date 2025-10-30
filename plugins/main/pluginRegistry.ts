import { registerClaudeIpcHandlers } from '../claude/main/claudeIpcHandlers';

export function registerPluginHandlers(): void {
  registerClaudeIpcHandlers();
}
