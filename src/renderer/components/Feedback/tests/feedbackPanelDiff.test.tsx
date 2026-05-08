import { describe, it } from 'vitest';

describe('FeedbackPanel — diff on open', () => {
  it.todo('runs the reconciliation diff once when the panel opens');
  it.todo('renders the three highlight states immediately, before the user interacts');
  it.todo('exposes the panel view model on a feedback-panel-local store, not on the underlying tree nodes');
});

describe('FeedbackPanel — highlight rendering', () => {
  it.todo('renders modified nodes with the modified-blue background token');
  it.todo('renders added nodes with the added-green background token');
  it.todo('renders removed nodes with the removed-red background and strikethrough at their original sibling position');
  it.todo('animates classification flips with a CSS background transition rather than snapping');
  it.todo('keeps the modified-blue background visually distinct from selection and focus styling');
});

describe('FeedbackPanel — in-panel edits', () => {
  it.todo('text edits commit on blur and re-classify only the edited node, not siblings');
  it.todo('a text edit that reverts content to the prior value flips the highlight back to unchanged');
  it.todo('a text edit that diverges from the prior value flips the highlight to modified');
  it.todo('a text edit retains the inherited UUID across the classification flip');
  it.todo('text edits do not trigger an LCS re-run over the children array');
  it.todo('inserting a sibling triggers an LCS re-run only at the affected parent\'s children level');
  it.todo('deleting a sibling triggers an LCS re-run only at the affected parent\'s children level');
  it.todo('reordering siblings triggers an LCS re-run only at the affected parent\'s children level');
  it.todo('classification flips and removed-list changes use a brief background transition so the user is not jolted');
});

describe('FeedbackPanel — persistence across save and reload', () => {
  it.todo('writes the panel view model into the saved feedback panel record on file save');
  it.todo('does not write classification or highlight state onto nodes in the .arbo tree');
  it.todo('restores the panel with the same proposed subtree, in-panel edits, and highlights after reload');
});

describe('FeedbackPanel — accept and reject', () => {
  it.todo('accepting commits the merged subtree atomically, preserving the parent UUID and inherited UUIDs for unchanged and modified children');
  it.todo('accepting mints fresh UUIDs only for nodes classified as added');
  it.todo('accepting clears the persisted feedback panel record and its highlight state');
  it.todo('rejecting discards both the merged subtree and the persisted panel record');
  it.todo('the parent node UUID is preserved on accept under both feedback mode and decomposition mode');
});

describe('FeedbackPanel — decomposition mode', () => {
  it.todo('renders every output node as added (green), shows no removed indicators, and reuses no UUIDs');
  it.todo('still preserves the parent node UUID on accept');
});

describe('FeedbackPanel — non-functional', () => {
  it.todo('diff on panel open shows no perceptible lag for a typical subtree of ≤200 nodes');
  it.todo('per-node compare on text-edit commit shows no perceptible lag');
  it.todo('sibling-level LCS re-run on structural edit shows no perceptible lag');
});
