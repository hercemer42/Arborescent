import { describe, it } from 'vitest';

// Bodies are deferred — workflow-execution wiring (invalidate calls, startWorkflow snapshot,
// decomposition seeding, mutate-then-move attribution) is a separate follow-up; these titles
// describe the routing the workflow execution layer must enforce when it lands.
describe('workflowExecutionActions — step history capture and invalidation', () => {
  describe('startWorkflow', () => {
    it.todo(
      'writes the input node’s state as the first history entry on the starting step',
    );
    it.todo(
      'does not write any history entry on downstream steps that the node has not yet reached',
    );
  });

  describe('advanceNode (autonomous mutation)', () => {
    it.todo(
      'captures a pre-mutation snapshot of the working node before applying autonomous changes',
    );
    it.todo(
      'attributes the change to the source step when a mutation is followed by a move (mutate-then-move)',
    );
    it.todo(
      'never records the automated move itself as a history entry on the destination step',
    );
    it.todo(
      'calls HistoryManager.invalidateEntriesTouching with the UUIDs it just mutated',
    );
  });

  describe('decomposition path', () => {
    it.todo(
      'records the pre-decomposition state of the parent node on the decomposition step’s history',
    );
    it.todo(
      'seeds an initial-state history entry on the decomposition step for each generated sibling',
    );
    it.todo(
      'invalidates user undo entries that touched the parent or any of the generated siblings',
    );
  });

  describe('checkpoint accept routing', () => {
    it.todo(
      'when the working node is currently owned by a checkpoint step, accept writes a pre-accept snapshot AND registers the command on the user undo stack',
    );
    it.todo(
      'a subsequent autonomous mutation that touches the same UUID silently removes the checkpoint accept from the user undo stack',
    );
    it.todo(
      'after the subsequent autonomous mutation, the checkpoint step still holds the pre-accept snapshot (history is unaffected by stack invalidation)',
    );
  });

  describe('manual-send accept routing', () => {
    it.todo(
      'when the working node is not owned by any workflow step, accept registers on the user undo stack only and writes no step history anywhere',
    );
  });

  describe('Cmd+Z behavior after workflow run', () => {
    it.todo(
      'reverts the user’s last manual edit when that edit did not touch a node subsequently mutated by the workflow',
    );
    it.todo(
      'silently skips a manual edit whose touched node was later mutated by the workflow (the edit has been removed from the stack)',
    );
  });
});
