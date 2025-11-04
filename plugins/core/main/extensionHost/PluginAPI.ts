import { parentPort } from 'node:worker_threads';

/**
 * Plugin API available to plugins running in the extension host.
 * This provides access to main process functionality without requiring
 * renderer process APIs like window.electron.
 */
export class PluginAPI {
  private messageIdCounter = 0;
  private pendingCalls: Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void }> = new Map();

  constructor() {
    // Listen for IPC responses from the main process
    if (parentPort) {
      parentPort.on('message', (message: { type: string; id: string; result?: unknown; error?: string }) => {
        if (message.type === 'ipc-response') {
          const pending = this.pendingCalls.get(message.id);
          if (pending) {
            this.pendingCalls.delete(message.id);
            if (message.error) {
              pending.reject(new Error(message.error));
            } else {
              pending.resolve(message.result);
            }
          }
        }
      });
    }
  }

  /**
   * Invoke an IPC handler from within the extension host.
   * This allows plugins to call the same IPC handlers that the renderer uses.
   */
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
