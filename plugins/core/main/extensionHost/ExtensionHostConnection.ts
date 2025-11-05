import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { ExtensionHostMessage, RendererMessage, MessageType } from './types/messages';
import { logger } from '../../../../src/main/services/logger';
import { LogMessageSchema, IPCCallMessageSchema, safeValidatePayload } from './types/messageValidation';
import { generateMessageId } from './utils/messageId';
import { IPC_MESSAGE_TIMEOUT_MS } from './constants';

export class ExtensionHostConnection {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, (response: ExtensionHostMessage) => void> = new Map();
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
  }

  async start(): Promise<void> {
    if (this.worker) {
      logger.warn('Extension host already started', 'Extension Host');
      return;
    }

    const workerPath = path.join(__dirname, 'extensionHost.worker.cjs');

    this.worker = new Worker(workerPath);

    this.worker.on('message', (message: unknown) => {
      if (typeof message === 'object' && message !== null && 'type' in message) {
        const msg = message as { type: string };
        if (msg.type === 'log') {
          this.handleLogMessage(message);
          return;
        } else if (msg.type === 'ipc-call') {
          this.handleIPCCall(message);
          return;
        }
      }
      this.handleMessage(message as ExtensionHostMessage);
    });

    this.worker.on('error', (error) => {
      logger.error('Extension host worker error', error, 'Extension Host');
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        logger.error(
          'Extension host worker exited with error',
          new Error(`Worker exited with code ${code}`),
          'Extension Host'
        );
      }
      this.worker = null;
    });

    await this.readyPromise;
    logger.info('Extension host started', 'Extension Host');
  }

  async stop(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.worker.terminate();
    this.worker = null;
    this.messageHandlers.clear();

    logger.info('Extension host stopped', 'Extension Host');
  }

  async sendMessage(type: MessageType, payload: unknown): Promise<unknown> {
    if (!this.worker) {
      throw new Error('Extension host not started');
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

      this.messageHandlers.set(id, (response: ExtensionHostMessage) => {
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

  private handleMessage(message: ExtensionHostMessage): void {
    if (message.type === MessageType.Ready) {
      this.readyResolve();
      return;
    }

    const handler = this.messageHandlers.get(message.id);
    if (handler) {
      handler(message);
    } else {
      logger.warn(`No handler for message ${message.id}`, 'Extension Host');
    }
  }

  private handleLogMessage(message: unknown): void {
    const validation = safeValidatePayload(LogMessageSchema, message);
    if (!validation.success) {
      logger.warn(`Invalid log message: ${validation.error}`, 'Extension Host Connection');
      return;
    }

    const logMsg = validation.data;
    const context = logMsg.context || 'Extension Host Worker';
    const error = logMsg.error ? new Error(logMsg.error.message) : undefined;
    if (error && logMsg.error?.stack) {
      error.stack = logMsg.error.stack;
    }

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

  private async handleIPCCall(message: unknown): Promise<void> {
    if (!this.worker) return;

    const validation = safeValidatePayload(IPCCallMessageSchema, message);
    if (!validation.success) {
      logger.warn(`Invalid IPC call message: ${validation.error}`, 'Extension Host Connection');
      return;
    }

    const ipcMsg = validation.data;

    try {
      const { pluginIPCBridge } = await import('../PluginIPCBridge');

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
        'Extension Host Connection'
      );
      this.worker.postMessage({
        type: 'ipc-response',
        id: ipcMsg.id,
        error: errorMsg,
      });
    }
  }
}
