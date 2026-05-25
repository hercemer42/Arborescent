import { describe, it, expect } from 'vitest';
import { Command } from '../Command';

describe('Command interface contract — touchedNodeIds', () => {
  it('the Command type permits a touchedNodeIds accessor', () => {
    const cmd: Command = {
      execute() {},
      undo() {},
      touchedNodeIds: new Set<string>(['n1', 'n2']),
    };
    expect(cmd.touchedNodeIds).toBeInstanceOf(Set);
    expect(cmd.touchedNodeIds?.has('n1')).toBe(true);
  });

  it('legacy commands without touchedNodeIds remain assignable to Command', () => {
    const legacy: Command = {
      execute() {},
      undo() {},
    };
    expect(legacy.touchedNodeIds).toBeUndefined();
  });

  it.todo(
    'every concrete Command class in store/tree/commands exposes a non-empty touchedNodeIds after execute()',
  );
});
