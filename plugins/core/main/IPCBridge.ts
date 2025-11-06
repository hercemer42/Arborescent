type IPCHandler = (event: unknown, ...args: unknown[]) => Promise<unknown>;

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
