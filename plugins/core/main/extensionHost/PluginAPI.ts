import { parentPort } from 'node:worker_threads';
import { IPCResponseMessageSchema, safeValidatePayload } from './types/messageValidation';

export class PluginAPI {
  private messageIdCounter = 0;
  private pendingCalls: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();

  constructor() {
    if (parentPort) {
      parentPort.on('message', (message: unknown) => {
        const validation = safeValidatePayload(IPCResponseMessageSchema, message);
        if (!validation.success) {
          return;
        }

        const ipcResponse = validation.data;
        if (ipcResponse.type === 'ipc-response') {
          const pending = this.pendingCalls.get(ipcResponse.id);
          if (pending) {
            this.pendingCalls.delete(ipcResponse.id);
            if (ipcResponse.error) {
              pending.reject(new Error(ipcResponse.error));
            } else {
              pending.resolve(ipcResponse.result);
            }
          }
        }
      });
    }
  }

  async invokeIPC<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
    if (!parentPort) {
      throw new Error('Plugin API not available: not running in worker thread');
    }

    return new Promise<T>((resolve, reject) => {
      const id = `ipc-${this.messageIdCounter++}`;

      this.pendingCalls.set(id, { resolve: resolve as (value: unknown) => void, reject });

      parentPort!.postMessage({
        type: 'ipc-call',
        id,
        channel,
        args,
      });

      setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          this.pendingCalls.delete(id);
          reject(new Error(`IPC call to ${channel} timed out`));
        }
      }, 30000);
    });
  }
}
