import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodePlugin } from '../Plugin';
import { PluginContext } from '../../../core/worker/Context';
import { logger } from '../../../core/worker/services/Logger';
import { TreeNode } from '../../../../src/shared/types';
import { NodeContext } from '../../../core/shared/interface';

// Mock logger
vi.mock('../../../core/worker/services/Logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ClaudeCodePlugin', () => {
  let mockContext: PluginContext;
  let plugin: ClaudeCodePlugin;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock PluginContext
    mockContext = {
      invokeIPC: vi.fn(),
    } as unknown as PluginContext;

    plugin = new ClaudeCodePlugin(mockContext);
  });

  describe('constructor', () => {
    it('should create plugin with manifest', () => {
      expect(plugin.manifest).toBeDefined();
      expect(plugin.manifest.name).toBe('claude-code-integration');
      expect(plugin.manifest.version).toBe('1.0.0');
    });

    it('should have extension points defined', () => {
      expect(plugin.extensionPoints).toBeDefined();
      expect(plugin.extensionPoints.provideNodeContextMenuItems).toBeInstanceOf(Function);
      expect(plugin.extensionPoints.provideNodeIndicator).toBeInstanceOf(Function);
    });
  });

  describe('initialize', () => {
    it('should get project path from IPC', async () => {
      vi.mocked(mockContext.invokeIPC).mockResolvedValue('/test/project');

      await plugin.initialize();

      expect(mockContext.invokeIPC).toHaveBeenCalledWith('claude:get-project-path');
      expect(logger.info).toHaveBeenCalledWith(
        'Plugin initialized for project: /test/project',
        'Claude Code Plugin'
      );
    });

    it('should store project path internally', async () => {
      vi.mocked(mockContext.invokeIPC).mockResolvedValue('/test/project');

      await plugin.initialize();

      // Verify by checking getSessions uses the stored path
      vi.mocked(mockContext.invokeIPC).mockResolvedValue([]);
      await plugin.getSessions();

      expect(mockContext.invokeIPC).toHaveBeenCalledWith('claude:list-sessions', '/test/project');
    });
  });

  describe('dispose', () => {
    it('should log disposal', () => {
      plugin.dispose();

      expect(logger.info).toHaveBeenCalledWith('Plugin disposed', 'Claude Code Plugin');
    });
  });

  describe('getSessions', () => {
    beforeEach(async () => {
      vi.mocked(mockContext.invokeIPC).mockResolvedValue('/test/project');
      await plugin.initialize();
      vi.clearAllMocks();
    });

    it('should get sessions from IPC and transform them', async () => {
      const mockSessions = [
        {
          id: 'session-123',
          projectPath: '/test/project',
          lastModified: '2024-01-01T12:00:00Z',
          firstMessage: 'Test session',
        },
        {
          id: 'session-456',
          projectPath: '/test/project',
          lastModified: '2024-01-02T12:00:00Z',
        },
      ];

      vi.mocked(mockContext.invokeIPC).mockResolvedValue(mockSessions);

      const result = await plugin.getSessions();

      expect(mockContext.invokeIPC).toHaveBeenCalledWith('claude:list-sessions', '/test/project');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'session-123',
        displayName: 'Test session',
        projectPath: '/test/project',
        lastModified: new Date('2024-01-01T12:00:00Z'),
      });
      expect(result[1]).toEqual({
        id: 'session-456',
        displayName: 'session-', // First 8 chars of id
        projectPath: '/test/project',
        lastModified: new Date('2024-01-02T12:00:00Z'),
      });
    });

    it('should return empty array on error', async () => {
      const error = new Error('IPC error');
      vi.mocked(mockContext.invokeIPC).mockRejectedValue(error);

      const result = await plugin.getSessions();

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get Claude Code sessions',
        error,
        'Claude Code Plugin'
      );
    });

    it('should handle sessions with no firstMessage', async () => {
      const mockSessions = [
        {
          id: 'abcdefghijk',
          projectPath: '/test/project',
          lastModified: '2024-01-01T12:00:00Z',
        },
      ];

      vi.mocked(mockContext.invokeIPC).mockResolvedValue(mockSessions);

      const result = await plugin.getSessions();

      expect(result[0].displayName).toBe('abcdefgh'); // First 8 chars
    });
  });

  describe('sendToSession', () => {
    beforeEach(async () => {
      vi.mocked(mockContext.invokeIPC).mockResolvedValue('/test/project');
      await plugin.initialize();
      vi.clearAllMocks();
    });

    it('should send context to session via IPC', async () => {
      vi.mocked(mockContext.invokeIPC).mockResolvedValue(undefined);

      await plugin.sendToSession('session-123', 'Test context');

      expect(mockContext.invokeIPC).toHaveBeenCalledWith(
        'claude:send-to-session',
        'session-123',
        'Test context',
        '/test/project'
      );
    });

    it('should throw error on failure', async () => {
      const error = new Error('Send failed');
      vi.mocked(mockContext.invokeIPC).mockRejectedValue(error);

      await expect(plugin.sendToSession('session-123', 'Test context')).rejects.toThrow(
        'Send failed'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send context to Claude Code session',
        error,
        'Claude Code Plugin'
      );
    });
  });

  describe('getContextMenuItems', () => {
    const createNode = (sessionId?: string): TreeNode => ({
      id: 'node-1',
      name: 'Test Node',
      type: 'task',
      collapsed: false,
      children: [],
      metadata: {
        plugins: sessionId
          ? {
              claude: { sessionId },
            }
          : undefined,
      },
    });

    it('should return empty array when hasAncestorSession is true', () => {
      const node = createNode();
      const context: NodeContext = { hasAncestorSession: true };

      const items = plugin.extensionPoints.provideNodeContextMenuItems!(node, context);

      expect(items).toEqual([]);
    });

    it('should return only "Send to Session..." when no sessionId', () => {
      const node = createNode();
      const context: NodeContext = { hasAncestorSession: false };

      const items = plugin.extensionPoints.provideNodeContextMenuItems!(node, context);

      expect(items).toHaveLength(1);
      expect(items[0]).toEqual({
        id: 'claude-code:send-to-session',
        label: 'Send to Session...',
      });
    });

    it('should return both menu items when sessionId exists', () => {
      const node = createNode('session-123');
      const context: NodeContext = { hasAncestorSession: false };

      const items = plugin.extensionPoints.provideNodeContextMenuItems!(node, context);

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({
        id: 'claude-code:send-to-last-session',
        label: 'Send to Last Session',
      });
      expect(items[1]).toEqual({
        id: 'claude-code:send-to-session',
        label: 'Send to Session...',
      });
    });

    it('should handle missing plugins metadata', () => {
      const node: TreeNode = {
        id: 'node-1',
        name: 'Test Node',
        type: 'task',
        collapsed: false,
        children: [],
        metadata: {},
      };
      const context: NodeContext = { hasAncestorSession: false };

      const items = plugin.extensionPoints.provideNodeContextMenuItems!(node, context);

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('claude-code:send-to-session');
    });
  });

  describe('getNodeIndicator', () => {
    const createNode = (sessionId?: string): TreeNode => ({
      id: 'node-1',
      name: 'Test Node',
      type: 'task',
      collapsed: false,
      children: [],
      metadata: {
        plugins: sessionId
          ? {
              claude: { sessionId },
            }
          : undefined,
      },
    });

    it('should return robot emoji indicator when sessionId exists', () => {
      const node = createNode('session-123');

      const indicator = plugin.extensionPoints.provideNodeIndicator!(node);

      expect(indicator).toEqual({
        type: 'text',
        value: '🤖',
      });
    });

    it('should return null when no sessionId', () => {
      const node = createNode();

      const indicator = plugin.extensionPoints.provideNodeIndicator!(node);

      expect(indicator).toBeNull();
    });

    it('should return null when plugins metadata is missing', () => {
      const node: TreeNode = {
        id: 'node-1',
        name: 'Test Node',
        type: 'task',
        collapsed: false,
        children: [],
        metadata: {},
      };

      const indicator = plugin.extensionPoints.provideNodeIndicator!(node);

      expect(indicator).toBeNull();
    });
  });
});
