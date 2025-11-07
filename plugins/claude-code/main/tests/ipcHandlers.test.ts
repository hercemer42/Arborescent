import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { vol } from 'memfs';
import { EventEmitter } from 'node:events';
import { registerClaudeCodeIpcHandlers } from '../ipcHandlers';
import { logger } from '../../../../src/main/services/logger';
import { pluginIPCBridge } from '../../../core/main/IPCBridge';

// Mock node:fs using memfs
vi.mock('node:fs', async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  return {
    default: memfs.fs,
    ...memfs.fs,
    promises: memfs.fs.promises,
  };
});

// Mock node:os
vi.mock('node:os', () => ({
  default: {
    homedir: vi.fn(() => '/home/testuser'),
  },
  homedir: vi.fn(() => '/home/testuser'),
}));

// Mock logger
vi.mock('../../../../src/main/services/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock pluginIPCBridge
vi.mock('../../../core/main/IPCBridge', () => ({
  pluginIPCBridge: {
    registerHandler: vi.fn(),
  },
}));

// Mock child_process
vi.mock('node:child_process', () => {
  const mockModule = {
    spawn: vi.fn(),
    ChildProcess: class ChildProcess extends EventEmitter {},
  };
  return {
    ...mockModule,
    default: mockModule,
  };
});

import { spawn } from 'node:child_process';

describe('ipcHandlers', () => {
  let handlers: Map<string, (...args: unknown[]) => Promise<unknown>>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();
    vol.reset();

    // Capture registered handlers
    vi.mocked(pluginIPCBridge.registerHandler).mockImplementation((channel: string, handler: Mock) => {
      handlers.set(channel, handler);
    });

    // Mock process.cwd
    vi.spyOn(process, 'cwd').mockReturnValue('/test/project');

    // Register handlers
    registerClaudeCodeIpcHandlers();
  });

  describe('registerClaudeCodeIpcHandlers', () => {
    it('should register all IPC handlers', () => {
      expect(pluginIPCBridge.registerHandler).toHaveBeenCalledWith(
        'claude:get-project-path',
        expect.any(Function)
      );
      expect(pluginIPCBridge.registerHandler).toHaveBeenCalledWith(
        'claude:list-sessions',
        expect.any(Function)
      );
      expect(pluginIPCBridge.registerHandler).toHaveBeenCalledWith(
        'claude:send-to-session',
        expect.any(Function)
      );
    });
  });

  describe('claude:get-project-path handler', () => {
    it('should return current working directory', async () => {
      const handler = handlers.get('claude:get-project-path')!;

      const result = await handler();

      expect(result).toBe('/test/project');
    });
  });

  describe('claude:list-sessions handler', () => {
    it('should return empty array when Claude directory does not exist', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      const result = await handler(null, '/test/project');

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith('Claude directory not found', 'Claude Code Plugin');
    });

    it('should return empty array when project directory does not exist', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      // Create Claude base directory but not project-specific directory
      vol.mkdirSync('/home/testuser/.claude/projects', { recursive: true });

      const result = await handler(null, '/test/project');

      expect(result).toEqual([]);
      expect(logger.info).toHaveBeenCalledWith(
        'No Claude Code sessions for project: /test/project',
        'Claude Code Plugin'
      );
    });

    it('should list sessions from project directory', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      // Create project directory with session files
      const projectDir = '/home/testuser/.claude/projects/-test-project';
      vol.mkdirSync(projectDir, { recursive: true });

      // Create session files with JSONL content
      const session1Content = JSON.stringify({
        message: { content: 'First message for session 1' },
      });
      const session2Content = JSON.stringify({
        message: { content: 'First message for session 2' },
      });

      vol.writeFileSync(`${projectDir}/session-abc123.jsonl`, session1Content);
      vol.writeFileSync(`${projectDir}/session-def456.jsonl`, session2Content);

      // Create a summary file that should be ignored
      vol.writeFileSync(`${projectDir}/session-abc123-summary.jsonl`, '{}');

      // Set explicit modification times to ensure predictable ordering
      const fsModule = await import('node:fs');
      const oldTime = new Date('2024-01-01T12:00:00Z');
      const newTime = new Date('2024-01-02T12:00:00Z');
      await fsModule.promises.utimes(`${projectDir}/session-abc123.jsonl`, oldTime, oldTime);
      await fsModule.promises.utimes(`${projectDir}/session-def456.jsonl`, newTime, newTime);

      const result = await handler(null, '/test/project') as Array<{
        id: string;
        projectPath: string;
        lastModified: Date;
        firstMessage: string;
      }>;

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('session-def456');
      expect(result[0].projectPath).toBe('/test/project');
      expect(result[0].firstMessage).toBe('First message for session 2');
      expect(result[0].lastModified).toBeInstanceOf(Date);

      expect(result[1].id).toBe('session-abc123');
      expect(result[1].projectPath).toBe('/test/project');
      expect(result[1].firstMessage).toBe('First message for session 1');

      expect(logger.info).toHaveBeenCalledWith(
        'Found 2 Claude Code sessions for project: /test/project',
        'Claude Code Plugin'
      );
    });

    it('should handle sessions without messages', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      const projectDir = '/home/testuser/.claude/projects/-test-project';
      vol.mkdirSync(projectDir, { recursive: true });

      // Create session file with no message content
      vol.writeFileSync(`${projectDir}/session-empty.jsonl`, '{}');

      const result = await handler(null, '/test/project') as Array<{
        id: string;
        firstMessage: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-empty');
      expect(result[0].firstMessage).toBe('');
    });

    it('should handle invalid JSONL content', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      const projectDir = '/home/testuser/.claude/projects/-test-project';
      vol.mkdirSync(projectDir, { recursive: true });

      // Create session file with invalid JSON
      vol.writeFileSync(`${projectDir}/session-invalid.jsonl`, 'not valid json');

      const result = await handler(null, '/test/project') as Array<{
        id: string;
        firstMessage: string;
      }>;

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('session-invalid');
      expect(result[0].firstMessage).toBe('');
    });

    it('should truncate long first messages to 100 chars', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      const projectDir = '/home/testuser/.claude/projects/-test-project';
      vol.mkdirSync(projectDir, { recursive: true });

      const longMessage = 'a'.repeat(150);
      const sessionContent = JSON.stringify({
        message: { content: longMessage },
      });

      vol.writeFileSync(`${projectDir}/session-long.jsonl`, sessionContent);

      const result = await handler(null, '/test/project') as Array<{
        id: string;
        firstMessage: string;
      }>;

      expect(result[0].firstMessage).toHaveLength(100);
      expect(result[0].firstMessage).toBe('a'.repeat(100));
    });

    it('should return empty array on error', async () => {
      const handler = handlers.get('claude:list-sessions')!;

      // Create directory but cause error by trying to read it as file
      vol.mkdirSync('/home/testuser/.claude/projects/-test-project', { recursive: true });

      // Mock readdir to throw error
      const fsModule = await import('node:fs');
      vi.spyOn(fsModule.promises, 'readdir').mockRejectedValueOnce(new Error('Read error'));

      const result = await handler(null, '/test/project');

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to list Claude Code sessions',
        expect.any(Error),
        'Claude Code Plugin',
        false
      );
    });
  });

  describe('claude:send-to-session handler', () => {
    it('should spawn Claude process with correct arguments', async () => {
      const handler = handlers.get('claude:send-to-session')!;
      const mockProcess = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      // Call handler and immediately emit close event with success
      const promise = handler(null, 'session-123', 'Test context', '/test/project');
      mockProcess.emit('close', 0);

      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--resume', 'session-123', '-p', 'Test context'],
        {
          cwd: '/test/project',
          stdio: 'inherit',
        }
      );

      expect(logger.info).toHaveBeenCalledWith(
        'Sending context to Claude Code session: session-123',
        'Claude Code Plugin'
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Claude Code session session-123 completed',
        'Claude Code Plugin'
      );
    });

    it('should handle spawn errors', async () => {
      const handler = handlers.get('claude:send-to-session')!;
      const mockProcess = new EventEmitter();
      const error = new Error('Spawn failed');

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      // Call handler and immediately emit error
      const promise = handler(null, 'session-123', 'Test context', '/test/project');
      mockProcess.emit('error', error);

      await expect(promise).rejects.toThrow('Spawn failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to spawn Claude process',
        error,
        'Claude Code Plugin',
        true
      );
    });

    it('should handle non-zero exit codes', async () => {
      const handler = handlers.get('claude:send-to-session')!;
      const mockProcess = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      // Call handler and emit close event with error code
      const promise = handler(null, 'session-123', 'Test context', '/test/project');
      mockProcess.emit('close', 1);

      await expect(promise).rejects.toThrow('Claude process exited with code 1');

      expect(logger.error).toHaveBeenCalledWith(
        'Claude process failed',
        expect.any(Error),
        'Claude Code Plugin',
        true
      );
    });

    it('should propagate errors from handler', async () => {
      const handler = handlers.get('claude:send-to-session')!;
      const error = new Error('Process error');
      const mockProcess = new EventEmitter();

      vi.mocked(spawn).mockReturnValue(mockProcess as any);

      const promise = handler(null, 'session-123', 'Test context', '/test/project');
      mockProcess.emit('error', error);

      await expect(promise).rejects.toThrow('Process error');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to send context to Claude Code session',
        error,
        'Claude Code Plugin',
        true
      );
    });
  });
});
