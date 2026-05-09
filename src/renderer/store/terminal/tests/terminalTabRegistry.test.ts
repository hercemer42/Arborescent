import { describe, it } from 'vitest';

// PR1 — Terminal-tab registry indexes open terminal tabs by session id.
// Reconciliation triggers: tab close, app boot, resume failure.
// The module under test does not yet exist; titles below describe the contract
// and will be filled in once the API shape is settled.

describe('terminalTabRegistry — index by session id (PR1)', () => {
  it.todo('register(sessionId, tabId) makes lookupTabIdForSession(sessionId) return that tabId');
  it.todo('lookupTabIdForSession returns null for an unknown session');
  it.todo('register overwrites a stale mapping when the same session re-binds to a new tab');
  it.todo('register on an empty sessionId is a no-op (does not pollute the registry)');
  it.todo('register on a null/undefined tabId throws or is rejected (tab pointer is required)');
  it.todo('a session can only point to one tab at a time — last-write-wins, prior tabId is detached');
});

describe('terminalTabRegistry — reconciliation (PR1)', () => {
  it.todo('on tab close, the registry entry for that tab is removed');
  it.todo('on tab close, any session that was bound to that tab is marked alive-detached, not lost');
  it.todo('on app boot, the registry is empty — sessions persisted in .arbo are not assumed to be tab-bound');
  it.todo('on resume failure (CLI reports session not found), the binding is dropped and the session marked lost');
  it.todo('reconciliation never touches mappings for unrelated sessions/tabs (isolation)');
  it.todo('two sessions on different tabs survive a reconciliation that only affects one');
});

describe('terminalTabRegistry — concurrent / repeated interactions (PR1)', () => {
  it.todo('register is idempotent when called twice with the same (sessionId, tabId)');
  it.todo('rapid register/unregister of the same session does not leak entries (no zombie bindings)');
  it.todo('two parallel registers for the same sessionId resolve to a single deterministic mapping');
});

describe('terminalTabRegistry — empty / null / undefined inputs (PR1)', () => {
  it.todo('lookup with empty string sessionId returns null');
  it.todo('unregister on a session not in the registry is a no-op (no throw)');
});
