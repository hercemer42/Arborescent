export interface Command {
  execute(): void;
  undo(): void;
  redo?(): void;
  canMergeWith?(other: Command): boolean;
  mergeWith?(other: Command): void;
  description?: string;
  touchedNodeIds?: Set<string>;
}

export abstract class BaseCommand implements Command {
  abstract execute(): void;
  abstract undo(): void;

  redo(): void {
    this.execute();
  }

  description?: string;
  touchedNodeIds?: Set<string>;
}
