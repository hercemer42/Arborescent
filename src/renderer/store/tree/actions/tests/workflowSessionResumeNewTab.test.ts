import { describe, it } from 'vitest';

describe('Resume session — alive-attached (terminal hosts the session)', () => {
  it.todo('focuses the existing terminal that hosts the sessionId');
  it.todo('does NOT open a new tab when one already hosts the session');
  it.todo('does NOT write any claude command — tab is already running the session');
  it.todo('does NOT mutate workflowExecutionStates — Resume is conversation-only');
});

describe('Resume session — alive-detached (no terminal hosts the session, new-tab fallback)', () => {
  it.todo('opens a new terminal tab in sessionRegistry[sessionId].cwd');
  it.todo('writes `claude --resume <sessionId>\\r` to the new tab');
  it.todo('focuses the newly-opened tab');
  it.todo('does NOT mutate workflowExecutionStates — workflow stays stopped/awaiting');
  it.todo('auto-routes silently regardless of which terminal the user has focused at the time');
});

describe('Resume session — registry without cwd entry', () => {
  it.todo('falls back to a sensible default cwd (or the originating terminal\'s cwd) when sessionRegistry has no entry for the sessionId');
  it.todo('still writes `claude --resume <sessionId>\\r` even when registry cwd is missing');
});

describe('Resume session — failure surfaces transient toast', () => {
  it.todo('createNewTerminal rejecting surfaces a transient toast and leaves no persistent indicator');
  it.todo('terminalWrite of `claude --resume` rejecting surfaces a transient toast and leaves no persistent indicator');
  it.todo('focusing an existing tab failing surfaces a transient toast');
  it.todo('a stale sessionId (gone from Claude\'s session store) — Resume still attempts, the failure toast fires from upstream');
  it.todo('re-attempting Resume after a failure retries fresh — no leftover state from prior attempt');
});

describe('Resume session — auto-resume on Start transient-toast', () => {
  it.todo('a Start that auto-resumes a node whose session can\'t be resumed surfaces a transient toast at the moment of failure');
  it.todo('does NOT write any persistent "session-lost" indicator on the node — failures are transient only');
});

describe('Resume session — multi-node-share', () => {
  it.todo('Resume on any of N nodes pointing to the same sessionId resolves to the same target terminal');
  it.todo('Resume on a sibling that captured the session via Send works the same as Resume on the original workflow node');
});

describe('Resume session — concurrent / repeated', () => {
  it.todo('two rapid Resume clicks on the same node do not open two new tabs');
  it.todo('Resume after the host terminal closes flips alive-attached → alive-detached and triggers the new-tab fallback');
});

describe('Resume session — accessibility', () => {
  it.todo('the failure toast carries an accessible label and is keyboard-dismissible');
});
