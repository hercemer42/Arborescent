export interface Command {
  execute(): void;
  undo(): void;
  redo?(): void;
  canMergeWith?(other: Command): boolean;
  mergeWith?(other: Command): void;
  description?: string;
}

export abstract class BaseCommand implements Command {
  abstract execute(): void;
  abstract undo(): void;

  redo(): void {
    this.execute();
  }

  description?: string;
}
