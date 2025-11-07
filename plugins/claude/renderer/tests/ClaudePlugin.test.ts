import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClaudePlugin } from '../ClaudePlugin';
import type { TreeNode } from '../../../../src/shared/types';

describe('ClaudePlugin', () => {
  let plugin: ClaudePlugin;

  beforeEach(() => {
    plugin = new ClaudePlugin();

    global.window.electron = {
      ...global.window.electron,
      claudeGetProjectPath: vi.fn().mockResolvedValue('/test/project/path'),
      claudeListSessions: vi.fn(),
      claudeSendToSession: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should set project path from IPC', async () => {
      await plugin.initialize();

      expect(window.electron.claudeGetProjectPath).toHaveBeenCalled();
    });
  });

  describe('getSessions', () => {
    it('should fetch sessions and transform them', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          projectPath: '/test/path',
          lastModified: '2025-10-30T00:00:00.000Z',
          firstMessage: 'Hello world',
        },
        {
          id: 'session-2',
          projectPath: '/test/path',
          lastModified: '2025-10-29T00:00:00.000Z',
          firstMessage: 'Test message',
        },
      ];

      vi.mocked(window.electron.claudeListSessions!).mockResolvedValue(mockSessions);

      const sessions = await plugin.getSessions();

      expect(window.electron.claudeListSessions).toHaveBeenCalled();
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe('session-1');
      expect(sessions[0].displayName).toBe('Hello world');
      expect(sessions[0].lastModified).toBeInstanceOf(Date);
    });

    it('should use session ID substring if no first message', async () => {
      const mockSessions = [
        {
          id: 'abcdef123456',
          projectPath: '/test/path',
          lastModified: '2025-10-30T00:00:00.000Z',
        },
      ];

      vi.mocked(window.electron.claudeListSessions!).mockResolvedValue(mockSessions);

      const sessions = await plugin.getSessions();

      expect(sessions[0].displayName).toBe('abcdef12');
    });

    it('should return empty array on error', async () => {
      vi.mocked(window.electron.claudeListSessions!).mockRejectedValue(new Error('Failed'));

      const sessions = await plugin.getSessions();

      expect(sessions).toEqual([]);
    });
  });

  describe('sendToSession', () => {
    it('should call claudeSendToSession with correct parameters', async () => {
      await plugin.initialize();
      await plugin.sendToSession('session-123', 'test context');

      expect(window.electron.claudeSendToSession).toHaveBeenCalledWith(
        'session-123',
        'test context',
        '/test/project/path'
      );
    });

    it('should throw error if send fails', async () => {
      vi.mocked(window.electron.claudeSendToSession!).mockRejectedValue(
        new Error('Send failed')
      );

      await expect(plugin.sendToSession('session-123', 'test')).rejects.toThrow();
    });
  });

  describe('getContextMenuItems', () => {
    it('should return empty array if ancestor has session', () => {
      const node: TreeNode = {
        id: 'node-1',
        content: 'Test',
        children: [],
        metadata: {},
      };

      const items = plugin.getContextMenuItems(node, true);

      expect(items).toEqual([]);
    });

    it('should return session picker only if no session ID', () => {
      const node: TreeNode = {
        id: 'node-1',
        content: 'Test',
        children: [],
        metadata: {},
      };

      const items = plugin.getContextMenuItems(node, false);

      expect(items).toHaveLength(1);
      expect(items[0].label).toBe('Send to Session...');
    });

    it('should return both menu items if node has session', () => {
      const node: TreeNode = {
        id: 'node-1',
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

      const items = plugin.getContextMenuItems(node, false);

      expect(items).toHaveLength(2);
      expect(items[0].label).toBe('Send to Last Session');
      expect(items[1].label).toBe('Send to Session...');
    });

    it('should handle missing plugin metadata', () => {
      const node: TreeNode = {
        id: 'node-1',
        content: 'Test',
        children: [],
        metadata: {},
      };

      const items = plugin.getContextMenuItems(node, false);

      expect(items).toHaveLength(1);
    });

    it('should handle undefined plugins in metadata', () => {
      const node: TreeNode = {
        id: 'node-1',
        content: 'Test',
        children: [],
        metadata: {
          plugins: undefined,
        },
      };

      const items = plugin.getContextMenuItems(node, false);

      expect(items).toHaveLength(1);
    });
  });

  describe('getNodeIndicator', () => {
    it('should return robot emoji if node has session', () => {
      const node: TreeNode = {
        id: 'node-1',
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

      const indicator = plugin.getNodeIndicator(node);

      expect(indicator).toBe('🤖');
    });

    it('should return null if node has no session', () => {
      const node: TreeNode = {
        id: 'node-1',
        content: 'Test',
        children: [],
        metadata: {},
      };

      const indicator = plugin.getNodeIndicator(node);

      expect(indicator).toBeNull();
    });

    it('should return null if plugins metadata is undefined', () => {
      const node: TreeNode = {
        id: 'node-1',
        content: 'Test',
        children: [],
        metadata: {
          plugins: undefined,
        },
      };

      const indicator = plugin.getNodeIndicator(node);

      expect(indicator).toBeNull();
    });
  });

  describe('manifest', () => {
    it('should have correct manifest properties', () => {
      expect(plugin.manifest).toBeDefined();
      expect(plugin.manifest.name).toBe('claude-integration');
      expect(plugin.manifest.displayName).toBe('Claude Code Integration');
      expect(plugin.manifest.version).toBe('1.0.0');
      expect(plugin.manifest.enabled).toBe(true);
      expect(plugin.manifest.builtin).toBe(true);
    });
  });

  describe('dispose', () => {
    it('should not throw when called', () => {
      expect(() => plugin.dispose()).not.toThrow();
    });
  });
});
