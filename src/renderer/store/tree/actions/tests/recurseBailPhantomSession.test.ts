import { describe, it } from 'vitest';

// Fix #2 — "start on a terminal is all-or-nothing". dispatchRecurseStart now
// stamps the inherited session onto the next sibling ONLY after a confirmed
// start (finalizeRecurseSessionStamp) and releases the orchestrator on a bail.
//
// Both core behaviours now have real tests in recurseHandoff.test.ts:
//   - confirmed start still stamps the sibling ("Case A — confirmed hand-off …")
//   - a bailed start (another node claims the live tab during the recurse delay)
//     leaves the sibling unstamped ("… leaves the next sibling unstamped …")
//
// The remaining title-only cases below are lower-probability edge variants that
// recurseZombieState.test.ts also touches from the broken-chain / zombie-state
// angle; they stay deferred until that area is fleshed out.

describe('dispatchRecurseStart — session stamp edge variants when the start bails', () => {
  it.todo('on a bail, the next sibling carries no inherited sessionTabId / group binding');
  it.todo('a stamp that was already valid on the sibling before the bail is left untouched, not cleared');
});

describe('dispatchRecurseStart — bail releases the orchestrator terminal assignment', () => {
  it.todo('on a bail, terminalNodeAssignments no longer points the terminal at the orchestrator');
  it.todo('after the bail, manually Starting the next sibling on that terminal succeeds with no "already assigned" toast');
});

describe('end-to-end — the dual-binding symptom does not survive a bailed hand-off', () => {
  // The user-reported chain: a bailed recurse hand-off leaves the sibling
  // session-stamped, so a later manual Start routes via the persisted sessionId.
  it.todo('a later manual Start on the sibling does NOT resume the original (now-closed) sibling session');
  it.todo('a later manual Start on the sibling does NOT raise the "bound to another node — rebind?" preflight from a phantom stamp');
  it.todo('with no phantom stamp, a later manual Start spawns fresh (or focuses the live tab) per decideWorkflowStartRoute');
});

describe('regression — the legitimate recurse hand-off is unaffected', () => {
  it.todo('a recurse hand-off onto a terminal whose stale assignment was re-validated away proceeds without bailing');
  it.todo('the intentionally un-gated mode \'recurse\' parent→child hand-off still moves the terminal as before');
});
