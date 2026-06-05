import { describe, it, expect } from 'vitest';

import { TerminalSessionSchema } from '../schemas';

// Read sessionId through a widened view until the persisted type carries it.
type EntryWithSession = { title: string; cwd: string; originNodeId?: string; sessionId?: string };

// PR3 persists the Claude sessionId per terminal so a restored terminal can be
// re-linked to its session at launch. The persisted schema is the contract that
// carries it across a quit/relaunch, so it must keep sessionId rather than strip
// it as an unknown key.
describe('TerminalSessionSchema — per-terminal sessionId', () => {
  it('preserves a terminal entry sessionId across parse', () => {
    const parsed = TerminalSessionSchema.parse({
      fileStates: {
        '/a.arbo': {
          terminals: [{ title: 'Terminal', cwd: '/home/user', sessionId: 'sess-1' }],
          activeTerminalIndex: 0,
        },
      },
    });

    const entry = parsed.fileStates['/a.arbo'].terminals[0] as EntryWithSession;
    expect(entry.sessionId).toBe('sess-1');
  });

  it('still accepts a terminal entry with no sessionId (pre-feature sessions)', () => {
    const parsed = TerminalSessionSchema.parse({
      fileStates: {
        '/a.arbo': {
          terminals: [{ title: 'Terminal', cwd: '/home/user' }],
          activeTerminalIndex: 0,
        },
      },
    });

    const entry = parsed.fileStates['/a.arbo'].terminals[0] as EntryWithSession;
    expect(entry.sessionId).toBeUndefined();
  });
});
