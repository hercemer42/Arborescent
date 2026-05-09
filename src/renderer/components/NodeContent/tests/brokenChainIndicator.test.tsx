import { describe, it } from 'vitest';

describe('broken-chain indicator — render gating', () => {
  it.todo('renders on a recursed node whose parent session was lost and a fresh session was spawned in its place');
  it.todo('does NOT render on a recursed node whose parent session was alive (tier a or b)');
  it.todo('does NOT render on the originator node — only on descendants whose chain was broken');
  it.todo('does NOT render on a node with no sessionId');
  it.todo('does NOT render on a node whose sessionLiveness is "lost" via direct teardown — that uses the existing session-lost indicator, not broken-chain');
});

describe('broken-chain indicator — clearing', () => {
  it.todo('the indicator clears when the recursed node is started again with an explicit fresh-spawn (not via recurse)');
  it.todo('the indicator clears automatically when a previously-broken node later inherits a session via a successful tier (a) or tier (b) recurse advance');
  it.todo('the indicator persists across save/load — the broken-chain marker round-trips through .arbo');
  it.todo('the indicator clears when the user dismisses it through a dedicated context-menu action');
});

describe('broken-chain indicator — coexistence with other indicators', () => {
  it.todo('a node can carry both broken-chain (originated from a lost parent) AND alive-attached on its own session — both visible without overlap');
  it.todo('broken-chain indicator visually distinguishes itself from the session-lost indicator (different colour or shape)');
});

describe('broken-chain indicator — accessibility', () => {
  it.todo('carries a distinct aria-label like "Broken session chain — parent session was lost, this step started a fresh one"');
  it.todo('uses role="img" so screen readers announce the labelled marker');
  it.todo('the indicator is keyboard-reachable when interactive (if a dismiss action is exposed) and otherwise non-focusable');
});
