import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginIPCBridge } from '../IPCBridge';

describe('PluginIPCBridge', () => {
  let bridge: PluginIPCBridge;

  beforeEach(() => {
    bridge = new PluginIPCBridge();
  });

  describe('registerHandler', () => {
    it('should register a handler', () => {
      const handler = vi.fn();
      bridge.registerHandler('test:channel', handler);

      expect(bridge.hasHandler('test:channel')).toBe(true);
    });

    it('should throw error when registering duplicate handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bridge.registerHandler('test:channel', handler1);

      expect(() => bridge.registerHandler('test:channel', handler2)).toThrow(
        'IPC handler already registered for channel: test:channel'
      );
    });

    it('should register multiple different handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bridge.registerHandler('test:channel1', handler1);
      bridge.registerHandler('test:channel2', handler2);

      expect(bridge.hasHandler('test:channel1')).toBe(true);
      expect(bridge.hasHandler('test:channel2')).toBe(true);
    });
  });

  describe('unregisterHandler', () => {
    it('should unregister a handler', () => {
      const handler = vi.fn();
      bridge.registerHandler('test:channel', handler);
      expect(bridge.hasHandler('test:channel')).toBe(true);

      bridge.unregisterHandler('test:channel');

      expect(bridge.hasHandler('test:channel')).toBe(false);
    });

    it('should handle unregistering non-existent handler', () => {
      expect(() => bridge.unregisterHandler('non-existent')).not.toThrow();
    });
  });

  describe('invoke', () => {
    it('should invoke registered handler', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      bridge.registerHandler('test:channel', handler);

      const result = await bridge.invoke('test:channel', 'arg1', 'arg2');

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          processId: expect.any(Number),
          frameId: 0,
        }),
        'arg1',
        'arg2'
      );
    });

    it('should invoke handler with no arguments', async () => {
      const handler = vi.fn().mockResolvedValue('result');
      bridge.registerHandler('test:channel', handler);

      const result = await bridge.invoke('test:channel');

      expect(result).toBe('result');
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          processId: expect.any(Number),
          frameId: 0,
        })
      );
    });

    it('should invoke async handler', async () => {
      const handler = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });
      bridge.registerHandler('test:async', handler);

      const result = await bridge.invoke('test:async');

      expect(result).toBe('async result');
    });

    it('should throw error when invoking non-existent handler', async () => {
      await expect(bridge.invoke('non-existent')).rejects.toThrow(
        'No IPC handler registered for channel: non-existent'
      );
    });

    it('should propagate handler errors', async () => {
      const error = new Error('Handler failed');
      const handler = vi.fn().mockRejectedValue(error);
      bridge.registerHandler('test:error', handler);

      await expect(bridge.invoke('test:error')).rejects.toThrow('Handler failed');
    });

    it('should pass mock event object to handler', async () => {
      let capturedEvent: unknown;
      const handler = vi.fn(async (event) => {
        capturedEvent = event;
        return 'result';
      });
      bridge.registerHandler('test:event', handler);

      await bridge.invoke('test:event');

      expect(capturedEvent).toMatchObject({
        processId: expect.any(Number),
        frameId: 0,
        sender: {
          send: expect.any(Function),
        },
      });
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      const handler = vi.fn();
      bridge.registerHandler('test:channel', handler);

      expect(bridge.hasHandler('test:channel')).toBe(true);
    });

    it('should return false for non-existent handler', () => {
      expect(bridge.hasHandler('non-existent')).toBe(false);
    });

    it('should return false after unregistering handler', () => {
      const handler = vi.fn();
      bridge.registerHandler('test:channel', handler);
      bridge.unregisterHandler('test:channel');

      expect(bridge.hasHandler('test:channel')).toBe(false);
    });
  });

  describe('getRegisteredChannels', () => {
    it('should return all registered channel names', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bridge.registerHandler('test:channel1', handler1);
      bridge.registerHandler('test:channel2', handler2);

      const channels = bridge.getRegisteredChannels();

      expect(channels).toHaveLength(2);
      expect(channels).toContain('test:channel1');
      expect(channels).toContain('test:channel2');
    });

    it('should return empty array when no handlers registered', () => {
      expect(bridge.getRegisteredChannels()).toEqual([]);
    });

    it('should not include unregistered channels', () => {
      const handler = vi.fn();
      bridge.registerHandler('test:channel', handler);
      bridge.unregisterHandler('test:channel');

      expect(bridge.getRegisteredChannels()).toEqual([]);
    });
  });
});
