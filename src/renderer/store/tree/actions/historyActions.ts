import { HistoryManager } from '../commands/HistoryManager';
import { Command } from '../commands/Command';

export interface HistoryActions {
  executeCommand: (command: Command) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export function createHistoryActions(historyManager: HistoryManager): HistoryActions {
  return {
    executeCommand: (command: Command) => {
      historyManager.executeCommand(command);
    },

    undo: () => {
      return historyManager.undo();
    },

    redo: () => {
      return historyManager.redo();
    },

    canUndo: () => {
      return historyManager.canUndo();
    },

    canRedo: () => {
      return historyManager.canRedo();
    },

    clearHistory: () => {
      historyManager.clear();
    },
  };
}
