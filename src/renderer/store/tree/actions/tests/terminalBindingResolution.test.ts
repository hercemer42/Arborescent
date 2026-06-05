import { describe, it, expect } from 'vitest';

import { findRunningNodeOnTerminal } from '../terminalBindingResolution';
import type { BindingResolutionState } from '../terminalBindingResolution';

// findRunningNodeOnTerminal reads only from get() (no useTerminalStore), so it
// can be exercised directly with a plain state object — no mocks required.
function makeGet(partial: Partial<BindingResolutionState>): () => BindingResolutionState {
  const state: BindingResolutionState = {
    nodes: {},
    workflowExecutionStates: {},
    workflowSessionMap: {},
    terminalNodeAssignments: {},
    ...partial,
  };
  return () => state;
}

describe('findRunningNodeOnTerminal — explicit assignment re-validated against running state', () => {
  it('returns the assigned node when it is genuinely running on that terminal', () => {
    const get = makeGet({
      terminalNodeAssignments: { 'term-1': 'node-a' },
      workflowExecutionStates: { 'node-a': { state: 'running', terminalTabId: 'term-1' } },
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBe('node-a');
  });

  it('returns the assigned node when it is awaiting validation on that terminal', () => {
    const get = makeGet({
      terminalNodeAssignments: { 'term-1': 'node-a' },
      workflowExecutionStates: { 'node-a': { state: 'awaiting-validation', terminalTabId: 'term-1' } },
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBe('node-a');
  });

  it('does NOT report a stale assignment whose node has no running execution state', () => {
    // node-a finished and its workflowExecutionStates entry was deleted, but the
    // terminalNodeAssignments entry was never released. This is the classic
    // source of the false "Terminal tab is already assigned to a running
    // workflow node" toast — the assignment must not mask the terminal as busy.
    const get = makeGet({
      terminalNodeAssignments: { 'term-1': 'node-a' },
      workflowExecutionStates: {},
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBeNull();
  });

  it('falls through a stale assignment to a node genuinely running on the same terminal', () => {
    // term-1 still carries a stale assignment to the finished node-a, but node-b
    // is actually running on term-1 — the live node must win, not the ghost.
    const get = makeGet({
      terminalNodeAssignments: { 'term-1': 'node-a' },
      workflowExecutionStates: { 'node-b': { state: 'running', terminalTabId: 'term-1' } },
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBe('node-b');
  });

  it('does not report an assignment whose node is running on a different terminal than queried', () => {
    // The assignment on term-1 disagrees with the node's live terminal (term-2);
    // the assignment is stale and must not mask term-1 as busy.
    const get = makeGet({
      terminalNodeAssignments: { 'term-1': 'node-a' },
      workflowExecutionStates: { 'node-a': { state: 'running', terminalTabId: 'term-2' } },
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBeNull();
  });
});

describe('findRunningNodeOnTerminal — no explicit assignment (execution-state scan)', () => {
  it('returns a running node bound to the terminal via execution state', () => {
    const get = makeGet({
      workflowExecutionStates: { 'node-a': { state: 'running', terminalTabId: 'term-1' } },
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBe('node-a');
  });

  it('returns null when the only running node is on a different terminal', () => {
    const get = makeGet({
      workflowExecutionStates: { 'node-a': { state: 'running', terminalTabId: 'term-2' } },
    });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBeNull();
  });

  it('tolerates an undefined terminalNodeAssignments map', () => {
    const get = makeGet({ terminalNodeAssignments: undefined, workflowExecutionStates: {} });
    expect(findRunningNodeOnTerminal(get, 'term-1')).toBeNull();
  });

  it('returns null for an empty terminal id with no matching state', () => {
    const get = makeGet({});
    expect(findRunningNodeOnTerminal(get, '')).toBeNull();
  });
});

describe('findRunningNodeOnTerminal — stale-entry cleanup is a source-side concern', () => {
  // The resolver only reads state, so it cannot prune in place. Stale entries
  // are released where the start bails (dispatchRecurseStart) rather than here.
  it.todo('prunes the stale terminalNodeAssignments entry so the next lookup is clean');
});
