import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../HistoryManager';
import { Command } from '../Command';

class TrackingCommand implements Command {
  executed = false;
  undone = false;
  constructor(public readonly touchedNodeIds: Set<string>, public readonly label: string = '') {}
  execute(): void {
    this.executed = true;
  }
  undo(): void {
    this.undone = true;
  }
}

describe('HistoryManager.invalidateEntriesTouching', () => {
  let manager: HistoryManager;

  beforeEach(() => {
    manager = new HistoryManager();
  });

  it('removes commands whose touched UUIDs intersect with the input set', () => {
    const cmdA = new TrackingCommand(new Set(['n1']), 'A');
    const cmdB = new TrackingCommand(new Set(['n2']), 'B');
    const cmdC = new TrackingCommand(new Set(['n1', 'n3']), 'C');
    manager.executeCommand(cmdA);
    manager.executeCommand(cmdB);
    manager.executeCommand(cmdC);

    manager.invalidateEntriesTouching(new Set(['n1']));

    expect(manager.getHistoryInfo().size).toBe(1);
  });

  it('leaves commands that touch only disjoint UUIDs untouched', () => {
    const cmdA = new TrackingCommand(new Set(['n1']), 'A');
    const cmdB = new TrackingCommand(new Set(['n2']), 'B');
    manager.executeCommand(cmdA);
    manager.executeCommand(cmdB);

    manager.invalidateEntriesTouching(new Set(['n3']));

    expect(manager.getHistoryInfo().size).toBe(2);
  });

  it('preserves stack order of surviving entries', () => {
    const cmdA = new TrackingCommand(new Set(['n1']), 'A');
    const cmdB = new TrackingCommand(new Set(['n2']), 'B');
    const cmdC = new TrackingCommand(new Set(['n3']), 'C');
    manager.executeCommand(cmdA);
    manager.executeCommand(cmdB);
    manager.executeCommand(cmdC);

    manager.invalidateEntriesTouching(new Set(['n2']));

    expect(manager.getHistoryInfo().size).toBe(2);
    // Undoing should hit cmdC (the most-recent surviving), then cmdA
    manager.undo();
    expect(cmdC.undone).toBe(true);
    expect(cmdA.undone).toBe(false);
    manager.undo();
    expect(cmdA.undone).toBe(true);
  });

  it('does not throw on empty input set', () => {
    manager.executeCommand(new TrackingCommand(new Set(['n1'])));
    expect(() => manager.invalidateEntriesTouching(new Set())).not.toThrow();
    expect(manager.getHistoryInfo().size).toBe(1);
  });

  it('does not throw on empty undo stack', () => {
    expect(() => manager.invalidateEntriesTouching(new Set(['n1']))).not.toThrow();
    expect(manager.getHistoryInfo().size).toBe(0);
  });

  it('does not call undo() on invalidated commands', () => {
    const cmd = new TrackingCommand(new Set(['n1']));
    manager.executeCommand(cmd);
    manager.invalidateEntriesTouching(new Set(['n1']));
    expect(cmd.undone).toBe(false);
  });

  it('clears redo stack entries that are invalidated', () => {
    const cmdA = new TrackingCommand(new Set(['n1']), 'A');
    const cmdB = new TrackingCommand(new Set(['n2']), 'B');
    manager.executeCommand(cmdA);
    manager.executeCommand(cmdB);
    manager.undo(); // B now redoable
    manager.invalidateEntriesTouching(new Set(['n2']));
    // B was in redo position; after invalidation only A survives
    expect(manager.canRedo()).toBe(false);
    expect(manager.getHistoryInfo().size).toBe(1);
  });

  it('treats commands missing touchedNodeIds as non-touching (no removal)', () => {
    // Backward-compat case for any command that hasn't yet exposed touchedNodeIds.
    const legacy: Command = {
      execute() {},
      undo() {},
    };
    manager.executeCommand(legacy);
    expect(() => manager.invalidateEntriesTouching(new Set(['n1']))).not.toThrow();
    expect(manager.getHistoryInfo().size).toBe(1);
  });

  it('is silent — no return value indicating which commands were dropped', () => {
    const cmd = new TrackingCommand(new Set(['n1']));
    manager.executeCommand(cmd);
    const result = manager.invalidateEntriesTouching(new Set(['n1']));
    // Should return void or undefined — not a list. Calls remain silent by design.
    expect(result).toBeUndefined();
  });
});
