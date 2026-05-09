import { describe, it } from 'vitest';

describe('recurse three-tier dispatch — tier (a) parent session alive-attached', () => {
  it.todo('sends the recursed node\'s prompt to the parent\'s already-open tab and does not create a new one');
  it.todo('does not write a cd or claude --resume command before the prompt — reuses the live shell as-is');
  it.todo('does not spawn a fresh session — workflowSessionMap entry for the parent\'s session id is unchanged');
  it.todo('the recursed node\'s metadata.sessionId equals the parent\'s sessionId');
  it.todo('the recursed node\'s metadata.sessionTabId equals the parent\'s currently-attached tab id');
  it.todo('does not surface the broken-chain indicator on the recursed node');
});

describe('recurse three-tier dispatch — tier (b) parent session alive-detached', () => {
  it.todo('opens a new terminal in the recorded sessionWorkingDirectory of the parent');
  it.todo('writes claude --resume <parentSessionId> to the new tab before sending the prompt');
  it.todo('the recursed node inherits the parent\'s sessionId in its metadata');
  it.todo('the recursed node\'s sessionTabId points at the newly-opened tab');
  it.todo('liveness on the recursed node lands at alive-attached after the resume succeeds');
  it.todo('does not surface the broken-chain indicator on the recursed node');
});

describe('recurse three-tier dispatch — tier (c) parent session lost', () => {
  it.todo('spawns a fresh CLI session — the recursed node gets a brand-new sessionId on SessionStart');
  it.todo('the recursed node\'s sessionId is NOT equal to the parent\'s former sessionId');
  it.todo('the recursed node surfaces the broken-chain indicator');
  it.todo('a toast informs the user that the parent session was lost and a fresh one started');
  it.todo('the parent node\'s sessionLiveness stays "lost" — recurse does not retroactively heal it');
});

describe('recurse three-tier dispatch — boundary inputs', () => {
  it.todo('parent node with no sessionId at all (manual step that never spawned) falls through to tier (c) fresh spawn');
  it.todo('parent node with sessionId but no recorded sessionWorkingDirectory falls back to the originating terminal\'s cwd');
  it.todo('parent node with empty / whitespace sessionId is treated as lost (tier c)');
});

describe('recurse three-tier dispatch — concurrent / repeated', () => {
  it.todo('two recurse advances on different parent sessions resolve independently — neither sees the other\'s tab');
  it.todo('recurse re-evaluates liveness fresh on each advance — a tab closing between two recurses flips tier (a) → tier (b)');
  it.todo('the 50-iteration recurse safety limit still fires regardless of which tier each step took');
});

describe('recurse three-tier dispatch — error / failure states', () => {
  it.todo('tier (b) with createNewTerminal failing surfaces a toast and does NOT mark the parent as lost (the session may still resume later)');
  it.todo('tier (b) with terminalWrite of the resume command rejecting falls back to tier (c) — fresh spawn + broken-chain indicator on the recursed node');
  it.todo('tier (c) with the fresh spawn itself failing stops the recurse chain with an error toast');
});

describe('recurse three-tier dispatch — regression guard', () => {
  it.todo('session inheritance fires for any sibling-advance dispatch that has a parent.sessionId, regardless of the parent step\'s recurse flag');
  it.todo('recurse without decomposition still surfaces the existing "set without decomposition" warning toast — the new tier logic does not swallow it');
  it.todo('non-recurse advancement (autonomous → autonomous) still spawns its own terminal as before — three-tier only fires on recurse advances');
});

describe('recurse three-tier dispatch — accessibility', () => {
  it.todo('broken-chain indicator on the recursed node carries an accessible label distinct from the session-lost indicator');
  it.todo('the toast announcing a fresh session after a broken chain is keyboard-dismissible and has a persistent action');
});
