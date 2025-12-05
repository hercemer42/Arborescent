import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHistoryActions } from '../historyActions';
import { HistoryManager } from '../../commands/HistoryManager';
import { Command } from '../../commands/Command';

class MockCommand implements Command {
  execute = vi.fn();
  undo = vi.fn();
}

describe('historyActions', () => {
  let historyManager: HistoryManager;

  beforeEach(() => {
    historyManager = new HistoryManager();
  });

  describe('executeCommand', () => {
    it('should delegate executeCommand to history manager', () => {
      const actions = createHistoryActions(historyManager);
      const command = new MockCommand();

      actions.executeCommand(command);

      expect(command.execute).toHaveBeenCalled();
      expect(actions.canUndo()).toBe(true);
    });
  });

  describe('undo', () => {
    it('should undo the last command', () => {
      const actions = createHistoryActions(historyManager);
      const command = new MockCommand();

      actions.executeCommand(command);
      const result = actions.undo();

      expect(result).toBe(true);
      expect(command.undo).toHaveBeenCalled();
    });

    it('should return false when nothing to undo', () => {
      const actions = createHistoryActions(historyManager);
      const result = actions.undo();
      expect(result).toBe(false);
    });
  });

  describe('redo', () => {
    it('should delegate redo to history manager', () => {
      const actions = createHistoryActions(historyManager);
      const command = new MockCommand();

      actions.executeCommand(command);
      actions.undo();

      const result = actions.redo();

      expect(result).toBe(true);
      expect(actions.canRedo()).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should delegate clearHistory to history manager', () => {
      const actions = createHistoryActions(historyManager);

      actions.executeCommand(new MockCommand());
      expect(actions.canUndo()).toBe(true);

      actions.clearHistory();

      expect(actions.canUndo()).toBe(false);
    });
  });
});
