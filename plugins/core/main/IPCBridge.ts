type IPCHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

/**
 * Secure registry for IPC handlers that can be called from both the renderer process
 * and the worker thread (by plugins).
 *
 * This is the controlled API surface that the renderer and plugins have access to - only
 * handlers registered here can be invoked. This prevents arbitrary access to main process
 * functionality.
 *
 * Example: A plugin in the worker calls `context.invokeIPC('claude:list-sessions')`
 * → Worker sends 'ipc-call' message → Main process looks up handler in this bridge
 * → Handler executes → Result sent back to worker
 *
 * Example: Renderer calls `window.arborescent.invoke('open-file', path)`
 * → Renderer sends IPC message → Main process looks up handler in this bridge
 * → Handler executes → Result sent back to renderer
 */
export class PluginIPCBridge {
  private handlers: Map<string, IPCHandler> = new Map();

  registerHandler(channel: string, handler: IPCHandler): void {
    if (this.handlers.has(channel)) {
      throw new Error(`IPC handler already registered for channel: ${channel}`);
    }
    this.handlers.set(channel, handler);
  }

  unregisterHandler(channel: string): void {
    this.handlers.delete(channel);
  }

  async invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No IPC handler registered for channel: ${channel}`);
    }

    const mockEvent = {
      processId: process.pid,
      frameId: 0,
      sender: {
        send: () => {},
      },
    };

    return handler(mockEvent, ...args);
  }

  hasHandler(channel: string): boolean {
    return this.handlers.has(channel);
  }

  getRegisteredChannels(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const pluginIPCBridge = new PluginIPCBridge();
