import { describe, it } from 'vitest';

// PR1 — Terminal handler resume contract.
// The handler accepts two operations:
//   1. focus existing tab for session X
//   2. open a new tab and run the resume command in working directory X
// After binding, it emits a "session now hosted by tab Y" event so the
// originator node can rebind its terminal-tab pointer.

describe('terminal:resume-session — focus existing tab (PR1)', () => {
  it.todo('when sessionId is registered to a still-open tab, handler focuses that tab and does not spawn a new one');
  it.todo('focusing brings the panel forward and selects the tab as the active terminal');
  it.todo('focusing does not write any new content to the PTY (no duplicate prompt)');
});

describe('terminal:resume-session — open new tab path (PR1)', () => {
  it.todo('when sessionId is registered but no tab hosts it, handler opens a new terminal tab');
  it.todo('the new tab is created with cwd equal to the working directory recorded for the session');
  it.todo('the new tab runs the CLI resume command for that sessionId (not a fresh session)');
  it.todo('the new tab inherits the same hookEnv used by ordinary spawn');
});

describe('terminal:resume-session — "session now hosted by tab Y" event (PR1)', () => {
  it.todo('after focus path, the handler emits a hosted-by event with the existing tabId');
  it.todo('after open-new-tab path, the handler emits a hosted-by event with the newly created tabId');
  it.todo('the event payload carries (sessionId, tabId) and only the originator node listens for its own sessionId');
});

describe('terminal:resume-session — error / failure states (PR1)', () => {
  it.todo('when the CLI rejects the resume (session not found), the handler returns a "lost" result and emits no hosted-by event');
  it.todo('when the working directory has been deleted, the handler returns an error result and surfaces a toast on the renderer');
  it.todo('when both the registered tab AND the CLI session have died between probe and click, the handler returns "lost" — does not silently spawn fresh');
});

describe('terminal:resume-session — boundary inputs (PR1)', () => {
  it.todo('empty/whitespace sessionId returns an error without spawning anything');
  it.todo('sessionId for a node that no longer exists returns an error without affecting the registry');
});

describe('terminal:resume-session — independence (PR1)', () => {
  it.todo('resuming sessionA does not change tab bindings or events for sessionB');
  it.todo('two parallel resume calls on different sessions resolve independently');
});
