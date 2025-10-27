import { describe, it, expect } from 'vitest';
import { parseKeyNotation, matchesKeyNotation } from '../hotkeyUtils';

describe('hotkeyUtils', () => {
  describe('parseKeyNotation', () => {
    it('should parse simple key', () => {
      const binding = parseKeyNotation('Enter');
      expect(binding).toEqual({
        key: 'Enter',
        ctrl: false,
        shift: false,
        alt: false,
        meta: false,
      });
    });

    it('should parse Mod+key as both ctrl and meta', () => {
      const binding = parseKeyNotation('Mod+D');
      expect(binding).toEqual({
        key: 'd',
        ctrl: true,
        shift: false,
        alt: false,
        meta: true,
      });
    });

    it('should parse Shift+key', () => {
      const binding = parseKeyNotation('Shift+Tab');
      expect(binding).toEqual({
        key: 'Tab',
        ctrl: false,
        shift: true,
        alt: false,
        meta: false,
      });
    });

    it('should parse Mod+Shift+key', () => {
      const binding = parseKeyNotation('Mod+Shift+Z');
      expect(binding).toEqual({
        key: 'z',
        ctrl: true,
        shift: true,
        alt: false,
        meta: true,
      });
    });

    it('should parse Alt+key', () => {
      const binding = parseKeyNotation('Alt+F4');
      expect(binding).toEqual({
        key: 'F4',
        ctrl: false,
        shift: false,
        alt: true,
        meta: false,
      });
    });

    it('should handle lowercase key normalization', () => {
      const binding = parseKeyNotation('Mod+w');
      expect(binding.key).toBe('w');
    });

    it('should preserve special key names', () => {
      const binding = parseKeyNotation('ArrowUp');
      expect(binding.key).toBe('ArrowUp');
    });
  });

  describe('matchesKeyNotation', () => {
    it('should match simple key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(matchesKeyNotation(event, 'Enter')).toBe(true);
    });

    it('should not match different key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(matchesKeyNotation(event, 'Enter')).toBe(false);
    });

    it('should match Mod with Ctrl on Windows/Linux', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
      });
      expect(matchesKeyNotation(event, 'Mod+D')).toBe(true);
    });

    it('should match Mod with Meta on Mac', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        metaKey: true,
      });
      expect(matchesKeyNotation(event, 'Mod+D')).toBe(true);
    });

    it('should not match Mod if neither ctrl nor meta pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'd' });
      expect(matchesKeyNotation(event, 'Mod+D')).toBe(false);
    });

    it('should match Shift+key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
      });
      expect(matchesKeyNotation(event, 'Shift+Tab')).toBe(true);
    });

    it('should not match if Shift required but not pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      expect(matchesKeyNotation(event, 'Shift+Tab')).toBe(false);
    });

    it('should not match if Shift pressed but not required', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
      });
      expect(matchesKeyNotation(event, 'Enter')).toBe(false);
    });

    it('should match Mod+Shift+key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
      });
      expect(matchesKeyNotation(event, 'Mod+Shift+Z')).toBe(true);
    });

    it('should match Alt+key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'F4',
        altKey: true,
      });
      expect(matchesKeyNotation(event, 'Alt+F4')).toBe(true);
    });

    it('should be case insensitive for letter keys', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'D',
        ctrlKey: true,
      });
      expect(matchesKeyNotation(event, 'Mod+d')).toBe(true);
    });

    it('should not match if extra modifiers pressed', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        shiftKey: true,
      });
      expect(matchesKeyNotation(event, 'ArrowUp')).toBe(false);
    });
  });
});
