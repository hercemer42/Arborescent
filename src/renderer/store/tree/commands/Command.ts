/**
 * Base command interface for undo/redo system
 * All state mutations should go through commands
 */
export interface Command {
  /**
   * Execute the command (do the action)
   */
  execute(): void;

  /**
   * Undo the command (reverse the action)
   */
  undo(): void;

  /**
   * Optional: Re-execute the command (for redo)
   * Defaults to calling execute() again
   */
  redo?(): void;

  /**
   * Optional: Check if this command can be merged with another
   * Used for grouping rapid typing or similar operations
   */
  canMergeWith?(other: Command): boolean;

  /**
   * Optional: Merge this command with another
   * Used for grouping rapid typing
   */
  mergeWith?(other: Command): void;

  /**
   * Optional: Description for debugging
   */
  description?: string;
}

/**
 * Base class for commands that provides default redo implementation
 */
export abstract class BaseCommand implements Command {
  abstract execute(): void;
  abstract undo(): void;

  redo(): void {
    this.execute();
  }

  description?: string;
}
