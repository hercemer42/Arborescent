import { describe, it, expect, beforeEach } from 'vitest';
import {
  getHotkeyConfig,
  getKeyForAction,
  matchesHotkey,
  setHotkeyConfig,
  resetHotkeyConfig,
  type HotkeyConfig,
} from '../hotkeyConfig';

describe('hotkeyConfig', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    resetHotkeyConfig();
  });

  describe('getHotkeyConfig', () => {
    it('should return default configuration', () => {
      const config = getHotkeyConfig();
      expect(config).toBeDefined();
      expect(config.navigation).toBeDefined();
      expect(config.editing).toBeDefined();
      expect(config.actions).toBeDefined();
      expect(config.file).toBeDefined();
      expect(config.view).toBeDefined();
    });

    it('should have expected default keys', () => {
      const config = getHotkeyConfig();
      expect(config.navigation.moveUp).toBe('ArrowUp');
      expect(config.navigation.moveDown).toBe('ArrowDown');
      expect(config.editing.indent).toBe('Tab');
      expect(config.editing.outdent).toBe('Shift+Tab');
      expect(config.actions.deleteNode).toBe('CmdOrCtrl+D');
      expect(config.file.closeTab).toBe('CmdOrCtrl+W');
      expect(config.view.toggleTerminal).toBe('CmdOrCtrl+`');
      expect(config.view.toggleBrowser).toBe('CmdOrCtrl+B');
    });
  });

  describe('getKeyForAction', () => {
    it('should get navigation action', () => {
      expect(getKeyForAction('navigation', 'moveUp')).toBe('ArrowUp');
    });

    it('should get editing action', () => {
      expect(getKeyForAction('editing', 'indent')).toBe('Tab');
    });

    it('should get actions action', () => {
      expect(getKeyForAction('actions', 'deleteNode')).toBe('CmdOrCtrl+D');
    });

    it('should get file action', () => {
      expect(getKeyForAction('file', 'save')).toBe('CmdOrCtrl+S');
    });

    it('should get view action', () => {
      expect(getKeyForAction('view', 'toggleTerminal')).toBe('CmdOrCtrl+`');
      expect(getKeyForAction('view', 'toggleBrowser')).toBe('CmdOrCtrl+B');
    });

    it('should return undefined for non-existent action', () => {
      expect(getKeyForAction('navigation', 'nonExistent')).toBeUndefined();
    });
  });

  describe('matchesHotkey', () => {
    it('should match moveUp hotkey', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      expect(matchesHotkey(event, 'navigation', 'moveUp')).toBe(true);
    });

    it('should not match moveUp when other key pressed', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
      expect(matchesHotkey(event, 'navigation', 'moveUp')).toBe(false);
    });

    it('should match deleteNode with Ctrl', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        ctrlKey: true,
      });
      expect(matchesHotkey(event, 'actions', 'deleteNode')).toBe(true);
    });

    it('should match deleteNode with Meta', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'd',
        metaKey: true,
      });
      expect(matchesHotkey(event, 'actions', 'deleteNode')).toBe(true);
    });

    it('should match indent', () => {
      const event = new KeyboardEvent('keydown', { key: 'Tab' });
      expect(matchesHotkey(event, 'editing', 'indent')).toBe(true);
    });

    it('should match outdent', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
      });
      expect(matchesHotkey(event, 'editing', 'outdent')).toBe(true);
    });

    it('should return false for non-existent action', () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      expect(matchesHotkey(event, 'navigation', 'nonExistent')).toBe(false);
    });
  });

  describe('setHotkeyConfig', () => {
    it('should allow custom configuration', () => {
      const customConfig: HotkeyConfig = {
        navigation: {
          moveUp: 'k',
          moveDown: 'j',
          moveLeft: 'h',
          moveRight: 'l',
          expandCollapse: 'Space',
          toggleNode: 'CmdOrCtrl+T',
          moveNodeUp: 'CmdOrCtrl+K',
          moveNodeDown: 'CmdOrCtrl+J',
        },
        editing: {
          startEdit: 'i',
          cancelEdit: 'Escape',
          saveEdit: 'Escape',
          deleteLine: 'd',
          newSiblingAfter: 'o',
          newChildNode: 'Shift+O',
          indent: '>',
          outdent: '<',
        },
        actions: {
          toggleTaskStatus: 'x',
          deleteNode: 'd',
          undo: 'u',
          redo: 'CmdOrCtrl+R',
          cut: 'CmdOrCtrl+X',
          copy: 'CmdOrCtrl+C',
          paste: 'CmdOrCtrl+V',
        },
        file: {
          new: 'CmdOrCtrl+N',
          save: 'CmdOrCtrl+S',
          saveAs: 'CmdOrCtrl+Shift+S',
          open: 'CmdOrCtrl+O',
          closeTab: 'CmdOrCtrl+W',
          reload: 'CmdOrCtrl+R',
          quit: 'CmdOrCtrl+Q',
        },
        view: {
          toggleTerminal: 'CmdOrCtrl+T',
          toggleBrowser: 'CmdOrCtrl+B',
        },
      };

      setHotkeyConfig(customConfig);
      expect(getKeyForAction('navigation', 'moveUp')).toBe('k');
      expect(getKeyForAction('navigation', 'moveDown')).toBe('j');
    });
  });

  describe('resetHotkeyConfig', () => {
    it('should reset to defaults after custom config', () => {
      const customConfig: HotkeyConfig = {
        navigation: {
          moveUp: 'k',
          moveDown: 'j',
          moveLeft: 'h',
          moveRight: 'l',
          expandCollapse: 'Space',
          toggleNode: 'CmdOrCtrl+T',
          moveNodeUp: 'CmdOrCtrl+K',
          moveNodeDown: 'CmdOrCtrl+J',
        },
        editing: {
          startEdit: 'i',
          cancelEdit: 'Escape',
          saveEdit: 'Escape',
          deleteLine: 'd',
          newSiblingAfter: 'o',
          newChildNode: 'Shift+O',
          indent: '>',
          outdent: '<',
        },
        actions: {
          toggleTaskStatus: 'x',
          deleteNode: 'd',
          undo: 'u',
          redo: 'CmdOrCtrl+R',
          cut: 'CmdOrCtrl+X',
          copy: 'CmdOrCtrl+C',
          paste: 'CmdOrCtrl+V',
        },
        file: {
          new: 'CmdOrCtrl+N',
          save: 'CmdOrCtrl+S',
          saveAs: 'CmdOrCtrl+Shift+S',
          open: 'CmdOrCtrl+O',
          closeTab: 'CmdOrCtrl+W',
          reload: 'CmdOrCtrl+R',
          quit: 'CmdOrCtrl+Q',
        },
        view: {
          toggleTerminal: 'CmdOrCtrl+T',
          toggleBrowser: 'CmdOrCtrl+B',
        },
      };

      setHotkeyConfig(customConfig);
      expect(getKeyForAction('navigation', 'moveUp')).toBe('k');

      resetHotkeyConfig();
      expect(getKeyForAction('navigation', 'moveUp')).toBe('ArrowUp');
    });
  });
});
