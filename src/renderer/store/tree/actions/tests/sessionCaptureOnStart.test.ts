import { describe, it } from 'vitest';

// PR1 — Session capture/teardown at workflow-step start.
// When startWorkflow runs:
//   1. Before the spawn, the originator node is marked with a "starting"
//      pre-spawn marker so a crash mid-spawn can be reconciled on next load.
//   2. When the spawned CLI emits its session id (via SessionStart hook),
//      the originator node's metadata is updated with sessionId,
//      sessionWorkingDirectory, and sessionLiveness=alive-attached.
//   3. The .arbo file is autosaved so the new session id is persisted
//      before any AI invocation begins.
//   4. When the session ends (process exit / hook teardown), the node's
//      sessionLiveness flips to "lost" — but sessionId is preserved so
//      the user sees the lost indicator and toast on resume attempt.

describe('session capture on start — pre-spawn marker (PR1)', () => {
  it.todo('startWorkflow writes a "starting" marker on the originator node BEFORE the spawn call is issued');
  it.todo('the "starting" marker also records the working directory chosen for the spawn');
  it.todo('autosave fires after the marker is written so a crash mid-spawn leaves the marker on disk');
  it.todo('the "starting" marker does not include a sessionId yet (it is the pre-id placeholder)');
});

describe('session capture on start — sessionId capture from SessionStart (PR1)', () => {
  it.todo('on SessionStart hook for the originator terminal, the node\'s metadata gets the captured sessionId');
  it.todo('captured metadata includes sessionWorkingDirectory matching the cwd of the spawned terminal');
  it.todo('captured metadata sets sessionLiveness="alive-attached" on first capture');
  it.todo('the "starting" marker is cleared once a real sessionId is captured');
  it.todo('autosave fires after capture so the persisted sessionId survives app restart');
  it.todo('capture only writes to the originator node — sibling workflow nodes on other terminals are untouched');
});

describe('session capture on start — independence between parallel steps (PR1)', () => {
  it.todo('two startWorkflow calls on different terminals produce two independent (sessionId, node) bindings');
  it.todo('the SessionStart event for terminal A only updates node-A; node-B is unaffected');
  it.todo('writing a sessionId to node-A does not overwrite node-B\'s prior sessionId');
});

describe('session capture on start — teardown on session end (PR1)', () => {
  it.todo('on terminal exit / session-end hook, the originator node\'s sessionLiveness flips to "lost"');
  it.todo('sessionId is preserved on the node after teardown — needed for the lost indicator');
  it.todo('teardown does not remove sessionWorkingDirectory — needed for diagnostics');
  it.todo('teardown does not propagate to descendant recurse nodes (PR3 scope)');
});

describe('session capture on start — error / failure states (PR1)', () => {
  it.todo('if the spawn rejects synchronously, the "starting" marker is converted to "lost"');
  it.todo('if no SessionStart hook arrives within the existing step timeout, the marker is converted to "lost"');
  it.todo('a SessionStart hook for an unknown terminal does not write to any node');
  it.todo('a SessionStart hook arriving after the workflow was already stopped still captures the sessionId (workflow-stopped ≠ session-ended)');
});

describe('session capture on start — boundary inputs (PR1)', () => {
  it.todo('empty / whitespace sessionId from the hook is rejected and the marker is converted to "lost"');
  it.todo('a SessionStart with no working directory falls back to the terminal\'s recorded cwd');
  it.todo('starting on a node that already has a live sessionId reuses it instead of overwriting (idempotence)');
});

describe('session capture on start — regression guard (PR1)', () => {
  it.todo('existing decomposition + recurse tests still pass — capture is additive metadata only');
  it.todo('clearSession=true flow still issues /clear before send (capture does not change ordering)');
});
