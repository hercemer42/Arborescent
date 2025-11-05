import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { ExtensionHostMessage, RendererMessage, MessageType } from './types/messages';
import { logger } from '../../../../src/main/services/logger';

export class ExtensionHostConnection {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, (response: ExtensionHostMessage) => void> = new Map();
  private messageIdCounter = 0;
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

    this.worker.on('message', (message: ExtensionHostMessage | { type: string }) => {
      if ('type' in message) {
        if (message.type === 'log') {
          this.handleLogMessage(message as {
            type: 'log';
            level: string;
            message: string;
            context?: string;
            error?: { message: string; stack?: string };
          });
          return;
        } else if (message.type === 'ipc-call') {
          this.handleIPCCall(message as {
            type: 'ipc-call';
            id: string;
            channel: string;
            args: unknown[];
          });
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

    const id = `msg-${this.messageIdCounter++}`;

    const message: RendererMessage = {
      type: type as RendererMessage['type'],
      id,
      payload,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.messageHandlers.delete(id);
        reject(new Error(`Message ${id} timed out`));
      }, 30000);

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

  private handleLogMessage(message: {
    type: 'log';
    level: string;
    message: string;
    context?: string;
    error?: { message: string; stack?: string };
  }): void {
    const context = message.context || 'Extension Host Worker';
    const error = message.error ? new Error(message.error.message) : undefined;
    if (error && message.error?.stack) {
      error.stack = message.error.stack;
    }

    switch (message.level) {
      case 'error':
        logger.error(message.message, error, context);
        break;
      case 'warn':
        logger.warn(message.message, context);
        break;
      case 'info':
      default:
        logger.info(message.message, context);
        break;
    }
  }

  private async handleIPCCall(message: {
    type: 'ipc-call';
    id: string;
    channel: string;
    args: unknown[];
  }): Promise<void> {
    if (!this.worker) return;

    try {
      const { pluginIPCBridge } = await import('../PluginIPCBridge');

      const result = await pluginIPCBridge.invoke(message.channel, ...message.args);

      this.worker.postMessage({
        type: 'ipc-response',
        id: message.id,
        result,
      });
    } catch (error) {
      logger.error(
        `IPC handler ${message.channel} failed: ${(error as Error).message}`,
        error as Error,
        'Extension Host Connection'
      );
      this.worker.postMessage({
        type: 'ipc-response',
        id: message.id,
        error: (error as Error).message,
      });
    }
  }
}
