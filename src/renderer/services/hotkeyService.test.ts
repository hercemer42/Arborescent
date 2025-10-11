import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hotkeyService } from './hotkeyService';

describe('hotkeyService', () => {
  let unregisterFn: (() => void) | undefined;
  const unregisterFns: (() => void)[] = [];

  beforeEach(() => {
    hotkeyService.clearAllHandlers();

    unregisterFns.forEach(fn => fn());
    unregisterFns.length = 0;

    if (unregisterFn) {
      unregisterFn();
      unregisterFn = undefined;
    }
  });

  describe('register', () => {
    it('should register a handler for an action', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('navigation.moveUp', handler);

      expect(unregisterFn).toBeInstanceOf(Function);
    });

    it('should allow multiple handlers for the same action', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unregister1 = hotkeyService.register('navigation.moveUp', handler1);
      const unregister2 = hotkeyService.register('navigation.moveUp', handler2);
      unregisterFns.push(unregister1, unregister2);

      expect(unregister1).toBeInstanceOf(Function);
      expect(unregister2).toBeInstanceOf(Function);
    });

    it('should return unregister function that removes the handler', () => {
      const handler = vi.fn();
      const unregister = hotkeyService.register('navigation.moveUp', handler);

      unregister();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('handleKeyDown', () => {
    it('should call handler when matching key is pressed', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('navigation.moveUp', handler);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(true);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should not call handler when non-matching key is pressed', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('navigation.moveUp', handler);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should call all registered handlers for an action', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const unregister1 = hotkeyService.register('navigation.moveUp', handler1);
      const unregister2 = hotkeyService.register('navigation.moveUp', handler2);
      unregisterFns.push(unregister1, unregister2);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      hotkeyService.handleKeyDown(event);

      expect(handler1).toHaveBeenCalledWith(event);
      expect(handler2).toHaveBeenCalledWith(event);
    });

    it('should return false when no handlers match', () => {
      const event = new KeyboardEvent('keydown', { key: 'z' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(false);
    });
  });

  describe('matchesKey', () => {
    it('should match simple key presses', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('navigation.moveDown', handler);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      hotkeyService.handleKeyDown(event);

      expect(handler).toHaveBeenCalled();
    });

    it('should match Mod key on Mac (metaKey)', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      const handler = vi.fn();
      unregisterFn = hotkeyService.register('file.save', handler);

      const event = new KeyboardEvent('keydown', { key: 'S', metaKey: true });
      hotkeyService.handleKeyDown(event);

      expect(handler).toHaveBeenCalled();

      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });

    it('should match Mod key on Windows (ctrlKey)', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });

      const handler = vi.fn();
      unregisterFn = hotkeyService.register('file.save', handler);

      const event = new KeyboardEvent('keydown', { key: 'S', ctrlKey: true });
      hotkeyService.handleKeyDown(event);

      expect(handler).toHaveBeenCalled();

      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });

    it('should not match Mod key without correct modifier', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('file.save', handler);

      const event = new KeyboardEvent('keydown', { key: 'S' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should match Shift modifier', () => {
      const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
      Object.defineProperty(navigator, 'platform', {
        value: 'Win32',
        configurable: true,
      });

      const handler = vi.fn();
      unregisterFn = hotkeyService.register('file.saveAs', handler);

      const event = new KeyboardEvent('keydown', {
        key: 'S',
        ctrlKey: true,
        shiftKey: true
      });
      hotkeyService.handleKeyDown(event);

      expect(handler).toHaveBeenCalled();

      if (originalPlatform) {
        Object.defineProperty(navigator, 'platform', originalPlatform);
      }
    });

    it('should not match when Shift modifier is required but not pressed', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('file.saveAs', handler);

      const event = new KeyboardEvent('keydown', { key: 'S', ctrlKey: true });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return hotkey configuration', () => {
      const config = hotkeyService.getConfig();

      expect(config).toBeDefined();
      expect(config.navigation).toBeDefined();
      expect(config.file).toBeDefined();
    });
  });

  describe('getKeyBinding', () => {
    it('should return key binding for valid action', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('navigation.moveUp', handler);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(true);
    });

    it('should handle invalid action gracefully', () => {
      const handler = vi.fn();
      unregisterFn = hotkeyService.register('invalid.action', handler);

      const event = new KeyboardEvent('keydown', { key: 'x' });
      const handled = hotkeyService.handleKeyDown(event);

      expect(handled).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });
  });
});
