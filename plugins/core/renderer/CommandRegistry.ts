import { TreeNode } from '../../../src/shared/types';
import { logger } from '../../../src/renderer/services/logger';
import type { NodeActions } from '../../../src/renderer/store/tree/actions/nodeActions';

export type CommandHandler = (context: CommandContext) => Promise<void> | void;

export interface CommandContext {
  node?: TreeNode;
  actions?: NodeActions;
  nodes?: Record<string, TreeNode>;
  [key: string]: unknown;
}

/**
 * PluginCommandRegistry manages command handlers that execute in the renderer process.
 *
 * Commands are the bridge between plugin extension points (which return data) and user actions.
 * When a plugin's extension point returns a menu item with an ID like 'my-plugin:my-command',
 * the corresponding command handler registered here is executed when the user clicks it.
 *
 * Key characteristics:
 * - Commands run in the renderer process (have access to UI state, React, DOM)
 * - Plugins define commands during registration phase (startup)
 * - Commands receive a context object with the relevant node and other data
 * - Errors are caught and logged without crashing the app
 *
 * Example flow:
 * 1. Plugin extension point returns: { id: 'my-plugin:action', label: 'Do Something' }
 * 2. User clicks menu item
 * 3. PluginCommandRegistry.execute('my-plugin:action', { node }) is called
 * 4. Registered handler executes with access to renderer/UI APIs
 */
class PluginCommandRegistryClass {
  private commands: Map<string, CommandHandler> = new Map();

  /**
   * Registers a command handler for a specific command ID.
   * Command IDs should be namespaced with plugin name: 'plugin-name:command-name'
   */
  register(commandId: string, handler: CommandHandler): void {
    if (this.commands.has(commandId)) {
      logger.warn(`Command ${commandId} is already registered`, 'Plugin Command Registry');
      return;
    }

    this.commands.set(commandId, handler);
    logger.info(`Command ${commandId} registered`, 'Plugin Command Registry');
  }

  /**
   * Unregisters a command handler.
   * Used when plugins are disabled or unloaded.
   */
  unregister(commandId: string): void {
    this.commands.delete(commandId);
    logger.info(`Command ${commandId} unregistered`, 'Plugin Command Registry');
  }

  /**
   * Executes a registered command handler with the given context.
   * Errors are caught and logged without propagating to prevent UI crashes.
   *
   * @param commandId - The command to execute (e.g., 'my-plugin:my-command')
   * @param context - Context object passed to the handler (typically includes the node)
   */
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

  /**
   * Checks if a command is registered.
   */
  has(commandId: string): boolean {
    return this.commands.has(commandId);
  }

  /**
   * Clears all registered commands.
   * Used during cleanup or testing.
   */
  clear(): void {
    this.commands.clear();
  }
}

export const PluginCommandRegistry = new PluginCommandRegistryClass();
