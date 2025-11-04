import { TreeNode } from '../../src/shared/types';
import { logger } from '../../src/renderer/services/logger';

export type CommandHandler = (context: CommandContext) => Promise<void> | void;

export interface CommandContext {
  node?: TreeNode;
  [key: string]: unknown;
}

class PluginCommandRegistryClass {
  private commands: Map<string, CommandHandler> = new Map();

  register(commandId: string, handler: CommandHandler): void {
    if (this.commands.has(commandId)) {
      logger.warn(`Command ${commandId} is already registered`, 'Plugin Command Registry');
      return;
    }

    this.commands.set(commandId, handler);
    logger.info(`Command ${commandId} registered`, 'Plugin Command Registry');
  }

  unregister(commandId: string): void {
    this.commands.delete(commandId);
    logger.info(`Command ${commandId} unregistered`, 'Plugin Command Registry');
  }

  async execute(commandId: string, context: CommandContext = {}): Promise<void> {
    const handler = this.commands.get(commandId);
    if (!handler) {
      logger.error(
        `Command ${commandId} not found`,
        new Error(`Command ${commandId} not found`),
        'Plugin Command Registry'
      );
      return;
    }

    try {
      await handler(context);
    } catch (error) {
      logger.error(
        `Error executing command ${commandId}`,
        error as Error,
        'Plugin Command Registry'
      );
    }
  }

  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  clear(): void {
    this.commands.clear();
  }
}

export const PluginCommandRegistry = new PluginCommandRegistryClass();
