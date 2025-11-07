import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerClaudeCodeCommands, unregisterClaudeCodeCommands } from '../commands';
import { PluginCommandRegistry, CommandContext } from '../../../core/renderer/CommandRegistry';
import { logger } from '../../../../src/renderer/services/logger';
import { TreeNode } from '../../../../src/shared/types';

vi.mock('../../../core/renderer/CommandRegistry', () => ({
  PluginCommandRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
}));

vi.mock('../../../../src/renderer/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Claude Code Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerClaudeCodeCommands', () => {
    it('should register send-to-last-session command', () => {
      registerClaudeCodeCommands();

      expect(PluginCommandRegistry.register).toHaveBeenCalledWith(
        'claude-code:send-to-last-session',
        expect.any(Function)
      );
    });

    it('should register send-to-session command', () => {
      registerClaudeCodeCommands();

      expect(PluginCommandRegistry.register).toHaveBeenCalledWith(
        'claude-code:send-to-session',
        expect.any(Function)
      );
    });

    it('should register both commands', () => {
      registerClaudeCodeCommands();

      expect(PluginCommandRegistry.register).toHaveBeenCalledTimes(2);
    });
  });

  describe('send-to-last-session command', () => {
    let sendToLastSessionHandler: (context: CommandContext) => Promise<void>;

    beforeEach(() => {
      registerClaudeCodeCommands();

      // Extract the handler function
      const registerCalls = vi.mocked(PluginCommandRegistry.register).mock.calls;
      const sendToLastSessionCall = registerCalls.find(
        call => call[0] === 'claude-code:send-to-last-session'
      );
      sendToLastSessionHandler = sendToLastSessionCall![1] as (context: CommandContext) => Promise<void>;
    });

    it('should log error when no node is provided', async () => {
      const context: CommandContext = { node: undefined };

      await sendToLastSessionHandler(context);

      expect(logger.error).toHaveBeenCalledWith(
        'No node provided for send-to-last-session command',
        expect.any(Error),
        'Claude Code Plugin'
      );
    });

    it('should log error when node has no session ID', async () => {
      const node: TreeNode = {
        id: 'test-node',
        content: 'Test',
        children: [],
        metadata: {},
      };
      const context: CommandContext = { node };

      await sendToLastSessionHandler(context);

      expect(logger.error).toHaveBeenCalledWith(
        'No session ID found on node',
        expect.any(Error),
        'Claude Code Plugin'
      );
    });

    it('should log error when node has plugins metadata but no claude data', async () => {
      const node: TreeNode = {
        id: 'test-node',
        content: 'Test',
        children: [],
        metadata: {
          plugins: {},
        },
      };
      const context: CommandContext = { node };

      await sendToLastSessionHandler(context);

      expect(logger.error).toHaveBeenCalledWith(
        'No session ID found on node',
        expect.any(Error),
        'Claude Code Plugin'
      );
    });

    it('should log info when node has valid session ID', async () => {
      const node: TreeNode = {
        id: 'test-node',
        content: 'Test',
        children: [],
        metadata: {
          plugins: {
            claude: {
              sessionId: 'session-123',
            },
          },
        },
      };
      const context: CommandContext = { node };

      await sendToLastSessionHandler(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Send to last session: session-123',
        'Claude Code Plugin'
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should handle nested plugin metadata structure', async () => {
      const node: TreeNode = {
        id: 'test-node',
        content: 'Test',
        children: [],
        metadata: {
          plugins: {
            claude: {
              sessionId: 'abc-def-ghi',
              otherData: 'ignored',
            },
          },
        },
      };
      const context: CommandContext = { node };

      await sendToLastSessionHandler(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Send to last session: abc-def-ghi',
        'Claude Code Plugin'
      );
    });
  });

  describe('send-to-session command', () => {
    let sendToSessionHandler: (context: CommandContext) => Promise<void>;

    beforeEach(() => {
      registerClaudeCodeCommands();

      // Extract the handler function
      const registerCalls = vi.mocked(PluginCommandRegistry.register).mock.calls;
      const sendToSessionCall = registerCalls.find(
        call => call[0] === 'claude-code:send-to-session'
      );
      sendToSessionHandler = sendToSessionCall![1] as (context: CommandContext) => Promise<void>;
    });

    it('should log error when no node is provided', async () => {
      const context: CommandContext = { node: undefined };

      await sendToSessionHandler(context);

      expect(logger.error).toHaveBeenCalledWith(
        'No node provided for send-to-session command',
        expect.any(Error),
        'Claude Code Plugin'
      );
    });

    it('should log info to show session picker when node is provided', async () => {
      const node: TreeNode = {
        id: 'test-node',
        content: 'Test',
        children: [],
        metadata: {},
      };
      const context: CommandContext = { node };

      await sendToSessionHandler(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Show session picker',
        'Claude Code Plugin'
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should show session picker regardless of node metadata', async () => {
      const node: TreeNode = {
        id: 'test-node',
        content: 'Test',
        children: [],
        metadata: {
          plugins: {
            claude: {
              sessionId: 'existing-session',
            },
          },
        },
      };
      const context: CommandContext = { node };

      await sendToSessionHandler(context);

      expect(logger.info).toHaveBeenCalledWith(
        'Show session picker',
        'Claude Code Plugin'
      );
    });
  });

  describe('unregisterClaudeCodeCommands', () => {
    it('should unregister send-to-last-session command', () => {
      unregisterClaudeCodeCommands();

      expect(PluginCommandRegistry.unregister).toHaveBeenCalledWith(
        'claude-code:send-to-last-session'
      );
    });

    it('should unregister send-to-session command', () => {
      unregisterClaudeCodeCommands();

      expect(PluginCommandRegistry.unregister).toHaveBeenCalledWith(
        'claude-code:send-to-session'
      );
    });

    it('should unregister both commands', () => {
      unregisterClaudeCodeCommands();

      expect(PluginCommandRegistry.unregister).toHaveBeenCalledTimes(2);
    });
  });

  describe('command lifecycle', () => {
    it('should allow register and unregister in sequence', () => {
      registerClaudeCodeCommands();
      expect(PluginCommandRegistry.register).toHaveBeenCalledTimes(2);

      unregisterClaudeCodeCommands();
      expect(PluginCommandRegistry.unregister).toHaveBeenCalledTimes(2);
    });
  });
});
