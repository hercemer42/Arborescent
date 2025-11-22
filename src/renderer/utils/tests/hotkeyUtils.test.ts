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
    // Tests run on Linux, so we expect text-based output (Ctrl, Shift, Alt)
    // Mac would show Unicode symbols (⌘, ⇧, ⌥)
    describe('on Linux/Windows', () => {
      it('should format CmdOrCtrl as Ctrl', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+S')).toBe('Ctrl+S');
      });

      it('should format CmdOrCtrl+Shift', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+Shift+Z')).toBe('Ctrl+Shift+Z');
      });

      it('should format arrow keys', () => {
        expect(formatHotkeyForDisplay('Up')).toBe('Up');
        expect(formatHotkeyForDisplay('Down')).toBe('Down');
        expect(formatHotkeyForDisplay('Left')).toBe('Left');
        expect(formatHotkeyForDisplay('Right')).toBe('Right');
      });

      it('should format CmdOrCtrl+Arrow', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+Up')).toBe('Ctrl+Up');
      });

      it('should format single letters uppercase', () => {
        expect(formatHotkeyForDisplay('CmdOrCtrl+D')).toBe('Ctrl+D');
      });

      it('should handle empty notation', () => {
        expect(formatHotkeyForDisplay('')).toBe('');
      });

      it('should format Ctrl', () => {
        expect(formatHotkeyForDisplay('Ctrl+C')).toBe('Ctrl+C');
      });

      it('should format Alt', () => {
        expect(formatHotkeyForDisplay('Alt+F4')).toBe('Alt+F4');
      });

      it('should format Shift', () => {
        expect(formatHotkeyForDisplay('Shift+Tab')).toBe('Shift+Tab');
      });
    });
  });
});
