import { describe, it } from 'vitest';

describe('integration — recurse chain survives a tab close/resume cycle', () => {
  it.todo('originator runs, recurse advances to two descendants, then user closes the originating tab — all three nodes flip to alive-detached pointing at no tab');
  it.todo('user clicks Resume session on any chain member — every chain member ends up pointing at the new tab');
  it.todo('recurse continues from the new tab without spawning a fresh session for the next descendant');
  it.todo('prompts written by subsequent advances all go to the new tab — the closed tab id is never used after the transition');
});

describe('integration — recurse chain survives app restart', () => {
  it.todo('after restart, every chain member with a recoverable parent session is offered Resume; broken chain members surface the broken-chain indicator');
  it.todo('resuming the originator post-restart rebinds every chain descendant in a single state update');
});

describe('integration — recurse three-tier exercises end-to-end', () => {
  it.todo('full traversal across tier (a) → tier (b) → tier (c) within a single workflow run produces consistent metadata on every node visited');
  it.todo('no cross-talk: a parallel workflow on a different session is unaffected by the transitioning chain');
});
