import { Command } from './Command';

const MAX_HISTORY_SIZE = 100;
const MERGE_TIMEOUT_MS = 1000;

export class HistoryManager {
  private history: Command[] = [];
  private currentIndex = -1;
  private lastExecuteTime = 0;

  executeCommand(command: Command): void {
    // Try to merge with the last command if possible
    const now = Date.now();
    const timeSinceLastExecute = now - this.lastExecuteTime;

    if (
      this.currentIndex >= 0 &&
      timeSinceLastExecute < MERGE_TIMEOUT_MS &&
      this.history[this.currentIndex]?.canMergeWith?.(command)
    ) {
      // Merge with last command instead of adding new one
      this.history[this.currentIndex].mergeWith?.(command);
      command.execute();
      this.lastExecuteTime = now;
      return;
    }

    // Clear any redo history when executing a new command
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Execute the command
    command.execute();

    // Add to history
    this.history.push(command);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > MAX_HISTORY_SIZE) {
      this.history.shift();
      this.currentIndex--;
    }

    this.lastExecuteTime = now;
  }

  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.history[this.currentIndex];
    command.undo();
    this.currentIndex--;

    return true;
  }

  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];

    if (command.redo) {
      command.redo();
    } else {
      command.execute();
    }

    return true;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.lastExecuteTime = 0;
  }

  getHistoryInfo(): { size: number; currentIndex: number; canUndo: boolean; canRedo: boolean } {
    return {
      size: this.history.length,
      currentIndex: this.currentIndex,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }
}
