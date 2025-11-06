import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { PluginMessage, RendererMessage, MessageType } from '../worker/types/messages';
import { logger } from '../../../src/main/services/logger';
import { LogMessageSchema, IPCCallMessageSchema, safeValidatePayload } from '../worker/types/messageValidation';
import { generateMessageId } from '../worker/utils/messageId';
import { IPC_MESSAGE_TIMEOUT_MS } from '../worker/constants';

/**
 * Manages the plugin worker thread lifecycle and communication.
 *
 * The worker thread provides process isolation for plugins - if a plugin crashes,
 * it won't take down the main app. Communication happens via message passing:
 * - Renderer → Main → Worker (plugin execution)
 * - Worker → Main → Renderer (responses)
 *
 * Special message types:
 * - 'log': Worker logging routed to main process logger
 * - 'ipc-call': Worker requesting main process APIs (via IPCBridge)
 * - Standard plugin messages: Register, initialize, invoke, dispose
 */
export class PluginWorkerConnection {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, (response: PluginMessage) => void> = new Map();
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  async start(): Promise<void> {
    if (this.worker) {
      logger.warn('Plugin system already started', 'Plugin System');
      return;
    }

    const workerPath = path.join(__dirname, 'worker.cjs');

    this.worker = new Worker(workerPath);

    this.worker.on('message', (message) => this.routeMessage(message));
    this.worker.on('error', (error) => this.handleWorkerError(error));

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(
          'Plugin worker exited with error',
          new Error(`Worker exited with code ${code}`),
          'Plugin System'
        );
      }
      this.worker = null;
    });

    await this.readyPromise;
    logger.info('Plugin system started', 'Plugin System');
  }

  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.terminate();
    this.worker = null;
    this.messageHandlers.clear();

    logger.info('Plugin system stopped', 'Plugin System');
  }

  async sendMessage(type: MessageType, payload: unknown): Promise<unknown> {
    if (!this.worker) {
      throw new Error('Plugin system not started');
    }

    const id = generateMessageId('msg');

    const message: RendererMessage = {
      type: type as RendererMessage['type'],
      id,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Message ${id} timed out`));
      }, IPC_MESSAGE_TIMEOUT_MS);

      this.messageHandlers.set(id, (response: PluginMessage) => {
        clearTimeout(timeout);
        this.messageHandlers.delete(id);

        if (response.type === MessageType.Error) {
          const payload = response.payload as { message: string; stack?: string };
          const error = new Error(payload.message);
          error.stack = payload.stack;
          reject(error);
        } else {
          resolve(response.payload);
        }
      });

      this.worker!.postMessage(message);
    });
  }

  /**
   * Routes incoming worker messages to appropriate handlers based on message type.
   */
  private routeMessage(message: unknown): void {
    if (typeof message === 'object' && message !== null && 'type' in message) {
      const msg = message as { type: string };
      if (msg.type === 'log') {
        this.handleLogMessage(message);
        return;
      }
      if (msg.type === 'ipc-call') {
        this.handleIPCCall(message);
        return;
      }
    }
    this.handleMessage(message as PluginMessage);
  }

  private handleWorkerError(error: Error): void {
    logger.error('Plugin worker error', error, 'Plugin System');
  }

  private handleMessage(message: PluginMessage): void {
    if (message.type === MessageType.Ready) {
      this.readyResolve();
      return;
    }

    const handler = this.messageHandlers.get(message.id);
    if (handler) {
      handler(message);
    } else {
      logger.warn(`No handler for message ${message.id}`, 'Plugin Worker');
    }
  }

  private handleLogMessage(message: unknown): void {
    const validation = safeValidatePayload(LogMessageSchema, message);
    if (!validation.success) {
      logger.warn(`Invalid log message: ${validation.error}`, 'Plugin Worker');
      return;
    }

    const logMsg = validation.data;
    const context = logMsg.context || 'Plugin Worker';
    const error = this.reconstructError(logMsg.error);

    switch (logMsg.level) {
      case 'error':
        logger.error(logMsg.message, error, context);
        break;
      case 'warn':
        logger.warn(logMsg.message, context);
        break;
      case 'info':
      default:
        logger.info(logMsg.message, context);
        break;
    }
  }

  /**
   * Reconstructs an Error object from serialized error data.
   */
  private reconstructError(errorData?: { message: string; stack?: string }): Error | undefined {
    if (!errorData) return undefined;

    const error = new Error(errorData.message);
    if (errorData.stack) {
      error.stack = errorData.stack;
    }
    return error;
  }

  private async handleIPCCall(message: unknown): Promise<void> {
    if (!this.worker) return;

    const validation = safeValidatePayload(IPCCallMessageSchema, message);
    if (!validation.success) {
      logger.warn(`Invalid IPC call message: ${validation.error}`, 'Plugin Worker');
      return;
    }

    const ipcMsg = validation.data;

    try {
      const { pluginIPCBridge } = await import('./IPCBridge');

      const result = await pluginIPCBridge.invoke(ipcMsg.channel, ...ipcMsg.args);

      this.worker.postMessage({
        type: 'ipc-response',
        id: ipcMsg.id,
        result,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `IPC handler ${ipcMsg.channel} failed: ${errorMsg}`,
        error instanceof Error ? error : new Error(errorMsg),
        'Plugin Worker'
      );
      this.worker.postMessage({
        type: 'ipc-response',
        id: ipcMsg.id,
        error: errorMsg,
      });
    }
  }
}
