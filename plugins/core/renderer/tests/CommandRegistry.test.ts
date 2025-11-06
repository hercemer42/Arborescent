import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginCommandRegistry, CommandContext, CommandHandler } from '../CommandRegistry';
import { logger } from '../../../../src/renderer/services/logger';
import { TreeNode } from '../../../../src/shared/types';

vi.mock('../../../../src/renderer/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('PluginCommandRegistry', () => {
  beforeEach(() => {
    PluginCommandRegistry.clear();
    vi.clearAllMocks();
  });

  describe('register', () => {
    it('should register a command handler', () => {
      const handler: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command', handler);

      expect(PluginCommandRegistry.has('test:command')).toBe(true);
      expect(logger.info).toHaveBeenCalledWith(
        'Command test:command registered',
        'Plugin Command Registry'
      );
    });

    it('should warn when registering duplicate command', () => {
      const handler1: CommandHandler = vi.fn();
      const handler2: CommandHandler = vi.fn();

      PluginCommandRegistry.register('test:command', handler1);
      PluginCommandRegistry.register('test:command', handler2);

      expect(logger.warn).toHaveBeenCalledWith(
        'Command test:command is already registered',
        'Plugin Command Registry'
      );
      expect(PluginCommandRegistry.has('test:command')).toBe(true);
    });

    it('should register multiple different commands', () => {
      const handler1: CommandHandler = vi.fn();
      const handler2: CommandHandler = vi.fn();

      PluginCommandRegistry.register('test:command1', handler1);
      PluginCommandRegistry.register('test:command2', handler2);

      expect(PluginCommandRegistry.has('test:command1')).toBe(true);
      expect(PluginCommandRegistry.has('test:command2')).toBe(true);
    });
  });

  describe('unregister', () => {
    it('should unregister a command', () => {
      const handler: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command', handler);
      expect(PluginCommandRegistry.has('test:command')).toBe(true);

      PluginCommandRegistry.unregister('test:command');

      expect(PluginCommandRegistry.has('test:command')).toBe(false);
      expect(logger.info).toHaveBeenCalledWith(
        'Command test:command unregistered',
        'Plugin Command Registry'
      );
    });

    it('should handle unregistering non-existent command', () => {
      PluginCommandRegistry.unregister('non-existent:command');

      expect(logger.info).toHaveBeenCalledWith(
        'Command non-existent:command unregistered',
        'Plugin Command Registry'
      );
    });
  });

  describe('execute', () => {
    it('should execute a registered command', async () => {
      const handler: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command', handler);

      const context: CommandContext = { node: { id: '1' } as unknown as TreeNode };
      await PluginCommandRegistry.execute('test:command', context);

      expect(handler).toHaveBeenCalledWith(context);
    });

    it('should execute async command handlers', async () => {
      const handler: CommandHandler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      PluginCommandRegistry.register('test:async', handler);

      const context: CommandContext = {};
      await PluginCommandRegistry.execute('test:async', context);

      expect(handler).toHaveBeenCalledWith(context);
    });

    it('should execute command with empty context when not provided', async () => {
      const handler: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command', handler);

      await PluginCommandRegistry.execute('test:command');

      expect(handler).toHaveBeenCalledWith({});
    });

    it('should log error when executing non-existent command', async () => {
      await PluginCommandRegistry.execute('non-existent:command');

      expect(logger.error).toHaveBeenCalledWith(
        'Command non-existent:command not found',
        expect.any(Error),
        'Plugin Command Registry'
      );
    });

    it('should catch and log errors from command handlers', async () => {
      const error = new Error('Command failed');
      const handler: CommandHandler = vi.fn(() => {
        throw error;
      });
      PluginCommandRegistry.register('test:error', handler);

      await PluginCommandRegistry.execute('test:error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error executing command test:error',
        error,
        'Plugin Command Registry'
      );
    });

    it('should catch and log errors from async command handlers', async () => {
      const error = new Error('Async command failed');
      const handler: CommandHandler = vi.fn(async () => {
        throw error;
      });
      PluginCommandRegistry.register('test:async-error', handler);

      await PluginCommandRegistry.execute('test:async-error');

      expect(logger.error).toHaveBeenCalledWith(
        'Error executing command test:async-error',
        error,
        'Plugin Command Registry'
      );
    });
  });

  describe('has', () => {
    it('should return true for registered command', () => {
      const handler: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command', handler);

      expect(PluginCommandRegistry.has('test:command')).toBe(true);
    });

    it('should return false for non-existent command', () => {
      expect(PluginCommandRegistry.has('non-existent:command')).toBe(false);
    });

    it('should return false after unregistering command', () => {
      const handler: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command', handler);
      PluginCommandRegistry.unregister('test:command');

      expect(PluginCommandRegistry.has('test:command')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all registered commands', () => {
      const handler1: CommandHandler = vi.fn();
      const handler2: CommandHandler = vi.fn();
      PluginCommandRegistry.register('test:command1', handler1);
      PluginCommandRegistry.register('test:command2', handler2);

      PluginCommandRegistry.clear();

      expect(PluginCommandRegistry.has('test:command1')).toBe(false);
      expect(PluginCommandRegistry.has('test:command2')).toBe(false);
    });

    it('should work on empty registry', () => {
      PluginCommandRegistry.clear();

      expect(PluginCommandRegistry.has('any:command')).toBe(false);
    });
  });
});
