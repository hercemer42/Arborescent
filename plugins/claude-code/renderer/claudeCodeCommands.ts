import { PluginCommandRegistry, CommandContext } from '../../core/renderer/PluginCommandRegistry';
import { logger } from '../../../src/renderer/services/logger';

export function registerClaudeCodeCommands(): void {
  PluginCommandRegistry.register('claude-code:send-to-last-session', async (context: CommandContext) => {
    const { node } = context;
    if (!node) {
      logger.error(
        'No node provided for send-to-last-session command',
        new Error('No node provided'),
        'Claude Code Plugin'
      );
      return;
    }

    const sessionId = node.metadata.plugins?.claude?.sessionId;
    if (!sessionId) {
      logger.error(
        'No session ID found on node',
        new Error('No session ID found'),
        'Claude Code Plugin'
      );
      return;
    }

    logger.info(`Send to last session: ${sessionId}`, 'Claude Code Plugin');
  });

  PluginCommandRegistry.register('claude-code:send-to-session', async (context: CommandContext) => {
    const { node } = context;
    if (!node) {
      logger.error(
        'No node provided for send-to-session command',
        new Error('No node provided'),
        'Claude Code Plugin'
      );
      return;
    }

    logger.info('Show session picker', 'Claude Code Plugin');
  });
}

export function unregisterClaudeCodeCommands(): void {
  PluginCommandRegistry.unregister('claude-code:send-to-last-session');
  PluginCommandRegistry.unregister('claude-code:send-to-session');
}
