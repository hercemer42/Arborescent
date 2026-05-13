import { describe, it } from 'vitest';

describe('integration — decomposed children auto-advance to the next workflow step', () => {
  it.todo('an Nth-step decomposition lands each new child at step N+1, not at step N');
  it.todo('the decomposing step does not re-execute on any child it just produced within the same recurse pass');
  it.todo('when the decomposing step is the final step, children are created but no further step is scheduled — no loop, no re-fire, no error');
  it.todo('non-decomposition steps continue to advance the same node, unchanged by this rule');
  it.todo('workflow resume after app restart places previously decomposed children at the correct downstream step, not back at the decomposition step');
  it.todo('no regression in autonomous-collaborate / AI-call count for workflows that already terminated correctly before the fix');
});

describe('integration — decomposition session group affinity', () => {
  it.todo('after a decomposition step finishes, the first child auto-plays in the same terminal session that ran the parent');
  it.todo('subsequent siblings play in the same session in deterministic order after each previous siblings downstream step completes');
  it.todo('manually triggering play on any decomposed child in the originating session succeeds and does not raise "session already assigned"');
  it.todo('a session cannot be bound to children from a decomposition group it did not produce — foreign nodes still raise the existing assignment error');
  it.todo('after app restart, the session active-child pointer is restored from saved state, not silently reset to the parent');
});

describe('integration — focus follows the active decomposed child', () => {
  it.todo('only the currently active child of the group shows the blue focus bar and tints its bound terminal tab');
  it.todo('when a step completes on the active child and the runner advances to the next sibling, the previous child loses the blue bar and tab tint');
  it.todo('focus state and runtime active-child pointer share a single source of truth — the rendered focus never disagrees with the runner');
});

describe('integration — final-step decomposition edge case', () => {
  it.todo('children created by a final-step decomposition stay terminal with no execution state entry');
  it.todo('the runner does not loop on the producing step after producing final-step children');
  it.todo('no toast or error is raised when final-step decomposition completes');
});

describe('integration — pre-fix saved state migration', () => {
  it.todo('saved workflows from before the fix resume without phantom or duplicate steps on decomposed children');
  it.todo('children carrying the producing-step index in saved state are coerced forward to N+1 on resume, deterministically');
  it.todo('saved session bindings that pointed at the decomposition parent do not strand the group after resume');
});
