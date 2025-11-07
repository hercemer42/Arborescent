import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { PluginWorkerConnection } from '../WorkerConnection';
import { MessageType } from '../../worker/types/messages';
import { logger } from '../../../../src/main/services/logger';

// Mock Worker
class MockWorker extends EventEmitter {
  postMessage = vi.fn();
  terminate = vi.fn().mockResolvedValue(undefined);
}

let lastCreatedWorker: MockWorker | null = null;

vi.mock('node:worker_threads', () => {
  const Worker = vi.fn(() => {
    const worker = new MockWorker();
    lastCreatedWorker = worker;
    return worker;
  });
  return {
    Worker,
    default: { Worker },
  };
});

vi.mock('../../../../src/main/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../worker/utils/messageId', () => ({
  generateMessageId: vi.fn(() => 'msg-123'),
}));

vi.mock('../../worker/constants', () => ({
  IPC_MESSAGE_TIMEOUT_MS: 1000,
}));

vi.mock('../../worker/types/messageValidation', () => ({
  safeValidatePayload: vi.fn((schema, data) => ({
    success: true,
    data,
  })),
  LogMessageSchema: {},
  IPCCallMessageSchema: {},
}));

// Mock IPCBridge
const mockPluginIPCBridge = {
  invoke: vi.fn(),
};

vi.mock('../IPCBridge', () => ({
  pluginIPCBridge: mockPluginIPCBridge,
}));

import { Worker } from 'node:worker_threads';

describe('PluginWorkerConnection', () => {
  let connection: PluginWorkerConnection;
  let mockWorker: MockWorker;

  beforeEach(() => {
    vi.clearAllMocks();
    lastCreatedWorker = null;
    connection = new PluginWorkerConnection();
    // Get the mock worker that was just created
    mockWorker = lastCreatedWorker!;
  });

  afterEach(() => {
    mockWorker?.removeAllListeners();
  });

  describe('start', () => {
    it('should start worker and wait for ready message', async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;

      // Emit ready message
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });

      await startPromise;

      expect(Worker).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Plugin system started', 'Plugin System');
    });

    it('should not start twice', async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;

      vi.clearAllMocks();

      await connection.start();

      expect(Worker).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Plugin system already started', 'Plugin System');
    });

    it('should handle worker error events', async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;

      const error = new Error('Worker error');
      mockWorker.emit('error', error);

      expect(logger.error).toHaveBeenCalledWith('Plugin worker error', error, 'Plugin System');
    });

    it('should handle worker exit with non-zero code', async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;

      mockWorker.emit('exit', 1);

      expect(logger.error).toHaveBeenCalledWith(
        'Plugin worker exited with error',
        expect.any(Error),
        'Plugin System'
      );
    });

    it('should not log error on clean exit (code 0)', async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;

      vi.clearAllMocks();

      mockWorker.emit('exit', 0);

      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('should terminate worker', async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;

      await connection.stop();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Plugin system stopped', 'Plugin System');
    });

    it('should do nothing if not started', async () => {
      await connection.stop();

      // Should not throw or call logger
      expect(logger.info).not.toHaveBeenCalledWith('Plugin system stopped', 'Plugin System');
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      // Update mockWorker reference after start() creates the worker
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;
      vi.clearAllMocks();
    });

    it('should send message and receive response', async () => {
      const promise = connection.sendMessage(MessageType.RegisterPlugin, {
        pluginName: 'test',
      });

      // Respond
      mockWorker.emit('message', {
        type: MessageType.Response,
        id: 'msg-123',
        payload: { success: true },
      });

      const result = await promise;

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: MessageType.RegisterPlugin,
        id: 'msg-123',
        payload: { pluginName: 'test' },
      });
      expect(result).toEqual({ success: true });
    });

    it('should reject on error response', async () => {
      const promise = connection.sendMessage(MessageType.RegisterPlugin, {});

      mockWorker.emit('message', {
        type: MessageType.Error,
        id: 'msg-123',
        payload: {
          message: 'Plugin failed',
          stack: 'Error: Plugin failed\n  at test.ts:10:5',
        },
      });

      await expect(promise).rejects.toThrow('Plugin failed');
    });

    it('should timeout if no response', async () => {
      vi.useFakeTimers();

      const promise = connection.sendMessage(MessageType.RegisterPlugin, {});

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toThrow('Message msg-123 timed out');

      vi.useRealTimers();
    });

    it('should throw if worker not started', async () => {
      await connection.stop();

      await expect(connection.sendMessage(MessageType.RegisterPlugin, {})).rejects.toThrow(
        'Plugin system not started'
      );
    });

  });

  describe('message routing', () => {
    beforeEach(async () => {
      const startPromise = connection.start();
      mockWorker = lastCreatedWorker!;
      // Update mockWorker reference after start() creates the worker
      mockWorker = lastCreatedWorker!;
      mockWorker.emit('message', {
        type: MessageType.Ready,
        id: 'ready',
        payload: {},
      });
      await startPromise;
      vi.clearAllMocks();
    });

    it('should route log messages to logger', () => {
      mockWorker.emit('message', {
        type: 'log',
        level: 'info',
        message: 'Test log',
        context: 'Test Context',
      });

      expect(logger.info).toHaveBeenCalledWith('Test log', 'Test Context');
    });

    it('should route error log messages', () => {
      const error = {
        message: 'Test error',
        stack: 'Error: Test error\n  at test.ts:10:5',
      };

      mockWorker.emit('message', {
        type: 'log',
        level: 'error',
        message: 'Error occurred',
        context: 'Test Context',
        error,
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Error occurred',
        expect.objectContaining({
          message: 'Test error',
          stack: 'Error: Test error\n  at test.ts:10:5',
        }),
        'Test Context'
      );
    });

    it('should route warn log messages', () => {
      mockWorker.emit('message', {
        type: 'log',
        level: 'warn',
        message: 'Warning message',
        context: 'Test Context',
      });

      expect(logger.warn).toHaveBeenCalledWith('Warning message', 'Test Context');
    });

    it('should use default context for log messages without context', () => {
      mockWorker.emit('message', {
        type: 'log',
        level: 'info',
        message: 'Test log',
      });

      expect(logger.info).toHaveBeenCalledWith('Test log', 'Plugin Worker');
    });

    it('should handle IPC call messages', async () => {
      mockPluginIPCBridge.invoke.mockResolvedValue('ipc-result');

      mockWorker.emit('message', {
        type: 'ipc-call',
        id: 'ipc-123',
        channel: 'test-channel',
        args: ['arg1', 'arg2'],
      });

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockPluginIPCBridge.invoke).toHaveBeenCalledWith('test-channel', 'arg1', 'arg2');
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'ipc-response',
        id: 'ipc-123',
        result: 'ipc-result',
      });
    });

    it('should handle IPC call errors', async () => {
      const error = new Error('IPC failed');
      mockPluginIPCBridge.invoke.mockRejectedValue(error);

      mockWorker.emit('message', {
        type: 'ipc-call',
        id: 'ipc-123',
        channel: 'test-channel',
        args: [],
      });

      // Wait for async handling
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'ipc-response',
        id: 'ipc-123',
        error: 'IPC failed',
      });
      expect(logger.error).toHaveBeenCalled();
    });

    it('should warn on unknown message ID', async () => {
      mockWorker.emit('message', {
        type: MessageType.Response,
        id: 'unknown-id',
        payload: {},
      });

      expect(logger.warn).toHaveBeenCalledWith('No handler for message unknown-id', 'Plugin Worker');
    });
  });
});
