import { describe, it, expect } from 'vitest';
import { parseKeyNotation, matchesKeyNotation, formatHotkeyForDisplay } from '../hotkeyUtils';

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

    it('should parse CmdOrCtrl+key as both ctrl and meta', () => {
      const binding = parseKeyNotation('CmdOrCtrl+D');
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

    it('should parse CmdOrCtrl+Shift+key', () => {
      const binding = parseKeyNotation('CmdOrCtrl+Shift+Z');
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
      const binding = parseKeyNotation('CmdOrCtrl+w');
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

    it('should match CmdOrCtrl with Ctrl on Windows/Linux', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
      });
      expect(matchesKeyNotation(event, 'CmdOrCtrl+D')).toBe(true);
    });

    it('should match CmdOrCtrl with Meta on Mac', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        metaKey: true,
      });
      expect(matchesKeyNotation(event, 'CmdOrCtrl+D')).toBe(true);
    });

    it('should not match CmdOrCtrl if neither ctrl nor meta pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'd' });
      expect(matchesKeyNotation(event, 'CmdOrCtrl+D')).toBe(false);
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

    it('should match CmdOrCtrl+Shift+key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
      });
      expect(matchesKeyNotation(event, 'CmdOrCtrl+Shift+Z')).toBe(true);
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
      expect(matchesKeyNotation(event, 'CmdOrCtrl+d')).toBe(true);
    });

    it('should not match if extra modifiers pressed', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        shiftKey: true,
      });
      expect(matchesKeyNotation(event, 'ArrowUp')).toBe(false);
    });
  });

  describe('formatHotkeyForDisplay', () => {
    // Note: electron-accelerator-formatter uses Unicode symbols on all platforms
    // The library uses process.platform internally, so tests reflect actual system platform (Linux)
    describe('on Linux (current test platform)', () => {
      it('should format CmdOrCtrl with Ctrl symbol', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+S')).toBe('⌃S');
      });

      it('should format CmdOrCtrl+Shift with symbols', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+Shift+Z')).toBe('⌃⇧Z');
      });

      it('should format arrow keys', () => {
        expect(formatHotkeyForDisplay('Up')).toBe('Up');
        expect(formatHotkeyForDisplay('Down')).toBe('Down');
        expect(formatHotkeyForDisplay('Left')).toBe('Left');
        expect(formatHotkeyForDisplay('Right')).toBe('Right');
      });

      it('should format CmdOrCtrl+Arrow', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+Up')).toBe('⌃Up');
      });

      it('should format single letters', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+D')).toBe('⌃D');
      });

      it('should handle empty notation', () => {
        expect(formatHotkeyForDisplay('')).toBe('');
      });

      it('should format Ctrl as symbol', () => {
        expect(formatHotkeyForDisplay('Ctrl+C')).toBe('⌃C');
      });

      it('should format Alt as symbol', () => {
        expect(formatHotkeyForDisplay('Alt+F4')).toBe('⌥F4');
      });

      it('should format Shift as symbol', () => {
        expect(formatHotkeyForDisplay('Shift+Tab')).toBe('⇧Tab');
      });
    });

    // Note: Cannot test Mac-specific output because electron-accelerator-formatter
    // uses process.platform internally which cannot be mocked in test environment.
    // The library would show ⌘ for CmdOrCtrl on Mac.
  });
});
