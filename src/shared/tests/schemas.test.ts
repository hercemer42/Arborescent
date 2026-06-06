import { describe, it, expect } from 'vitest';

import { TerminalSessionSchema, PanelSessionSchema } from '../schemas';

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

// PR3 retired the feedback panel and dropped 'feedback' as a panel content type. A session
// persisted by an earlier build can still carry 'feedback'; the schema must tolerate it and
// normalize to null so the rest of the panel layout and per-file state survive the upgrade
// rather than the whole session being discarded as a parse failure.
describe('PanelSessionSchema — retired feedback content normalizes to null', () => {
  it('normalizes a top-level feedback activeContent to null and keeps the layout', () => {
    const parsed = PanelSessionSchema.parse({
      panelPosition: 'bottom',
      panelHeight: 420,
      panelWidth: 700,
      activeContent: 'feedback',
    });

    expect(parsed.activeContent).toBeNull();
    expect(parsed.panelPosition).toBe('bottom');
    expect(parsed.panelHeight).toBe(420);
    expect(parsed.panelWidth).toBe(700);
  });

  it('normalizes feedback in per-file states while preserving other files', () => {
    const parsed = PanelSessionSchema.parse({
      panelPosition: 'side',
      panelHeight: 300,
      panelWidth: 600,
      activeContent: null,
      fileStates: {
        '/a.arbo': { activeContent: 'feedback', previousContent: 'browser' },
        '/b.arbo': { activeContent: 'terminal', previousContent: null },
      },
    });

    expect(parsed.fileStates?.['/a.arbo'].activeContent).toBeNull();
    expect(parsed.fileStates?.['/a.arbo'].previousContent).toBe('browser');
    expect(parsed.fileStates?.['/b.arbo'].activeContent).toBe('terminal');
  });
});
