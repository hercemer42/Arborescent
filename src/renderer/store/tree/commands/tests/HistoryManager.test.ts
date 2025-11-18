import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../HistoryManager';
import { Command } from '../Command';

// Mock command for testing
class MockCommand implements Command {
  executed = false;
  undone = false;
  redone = false;

  execute(): void {
    this.executed = true;
  }

  undo(): void {
    this.undone = true;
  }

  redo(): void {
    this.redone = true;
  }
}

// Mock mergeable command
class MergeableCommand implements Command {
  constructor(public value: string) {}

  execute(): void {}
  undo(): void {}

  canMergeWith(other: unknown): boolean {
    return other instanceof MergeableCommand;
  }

  mergeWith(other: unknown): void {
    if (other instanceof MergeableCommand) {
      this.value += other.value;
    }
  }
}

describe('HistoryManager', () => {
  let manager: HistoryManager;

  beforeEach(() => {
    manager = new HistoryManager();
  });

  describe('executeCommand', () => {
    it('should execute and add command to history', () => {
      const cmd = new MockCommand();
      manager.executeCommand(cmd);

      expect(cmd.executed).toBe(true);
      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);
    });

    it('should clear redo stack when executing new command', () => {
      const cmd1 = new MockCommand();
      const cmd2 = new MockCommand();
      const cmd3 = new MockCommand();

      manager.executeCommand(cmd1);
      manager.executeCommand(cmd2);
      manager.undo(); // cmd2 is now in redo stack

      expect(manager.canRedo()).toBe(true);

      manager.executeCommand(cmd3); // Should clear redo stack

      expect(manager.canRedo()).toBe(false);
    });

    it('should merge commands within timeout', () => {
      const cmd1 = new MergeableCommand('a');
      const cmd2 = new MergeableCommand('b');

      manager.executeCommand(cmd1);
      manager.executeCommand(cmd2); // Within 1 second

      const info = manager.getHistoryInfo();
      expect(info.size).toBe(1); // Merged into single command
      expect(cmd1.value).toBe('ab'); // Merged value
    });

    it('should not merge commands after timeout', async () => {
      const cmd1 = new MergeableCommand('a');
      const cmd2 = new MergeableCommand('b');

      manager.executeCommand(cmd1);

      // Wait for merge timeout (1 second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      manager.executeCommand(cmd2);

      const info = manager.getHistoryInfo();
      expect(info.size).toBe(2); // Not merged
    });

    it('should limit history to 100 commands', () => {
      // Execute 101 commands
      for (let i = 0; i < 101; i++) {
        manager.executeCommand(new MockCommand());
      }

      const info = manager.getHistoryInfo();
      expect(info.size).toBe(100); // Oldest removed
    });
  });

  describe('undo', () => {
    it('should undo last command', () => {
      const cmd = new MockCommand();
      manager.executeCommand(cmd);

      const result = manager.undo();

      expect(result).toBe(true);
      expect(cmd.undone).toBe(true);
      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(true);
    });

    it('should return false when nothing to undo', () => {
      const result = manager.undo();
      expect(result).toBe(false);
    });

    it('should undo multiple commands in reverse order', () => {
      const cmd1 = new MockCommand();
      const cmd2 = new MockCommand();
      const cmd3 = new MockCommand();

      manager.executeCommand(cmd1);
      manager.executeCommand(cmd2);
      manager.executeCommand(cmd3);

      manager.undo();
      expect(cmd3.undone).toBe(true);
      expect(cmd2.undone).toBe(false);

      manager.undo();
      expect(cmd2.undone).toBe(true);
      expect(cmd1.undone).toBe(false);

      manager.undo();
      expect(cmd1.undone).toBe(true);
    });
  });

  describe('redo', () => {
    it('should redo undone command', () => {
      const cmd = new MockCommand();
      manager.executeCommand(cmd);
      manager.undo();

      const result = manager.redo();

      expect(result).toBe(true);
      expect(cmd.redone).toBe(true);
      expect(manager.canUndo()).toBe(true);
      expect(manager.canRedo()).toBe(false);
    });

    it('should return false when nothing to redo', () => {
      const result = manager.redo();
      expect(result).toBe(false);
    });

    it('should redo multiple commands in order', () => {
      const cmd1 = new MockCommand();
      const cmd2 = new MockCommand();

      manager.executeCommand(cmd1);
      manager.executeCommand(cmd2);
      manager.undo();
      manager.undo();

      manager.redo();
      expect(cmd1.redone).toBe(true);
      expect(cmd2.redone).toBe(false);

      manager.redo();
      expect(cmd2.redone).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      manager.executeCommand(new MockCommand());
      manager.executeCommand(new MockCommand());

      manager.clear();

      expect(manager.canUndo()).toBe(false);
      expect(manager.canRedo()).toBe(false);
      expect(manager.getHistoryInfo().size).toBe(0);
    });
  });

  describe('getHistoryInfo', () => {
    it('should return correct history info', () => {
      expect(manager.getHistoryInfo()).toEqual({
        size: 0,
        currentIndex: -1,
        canUndo: false,
        canRedo: false,
      });

      manager.executeCommand(new MockCommand());
      manager.executeCommand(new MockCommand());

      expect(manager.getHistoryInfo()).toEqual({
        size: 2,
        currentIndex: 1,
        canUndo: true,
        canRedo: false,
      });

      manager.undo();

      expect(manager.getHistoryInfo()).toEqual({
        size: 2,
        currentIndex: 0,
        canUndo: true,
        canRedo: true,
      });
    });
  });
});
