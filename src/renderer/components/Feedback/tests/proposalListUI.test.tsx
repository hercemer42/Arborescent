import { describe, it } from 'vitest';

// PR7 — Feedback panel renders the list of pending proposals (read from
// proposalsStore.getProposalsForFile for the active file). Each proposal row
// shows the bound node id, the operation kind, a brief content preview, and
// Accept / Reject buttons. Accept routes the proposal through executeCommand
// (so HistoryManager picks it up) and then removes the proposal from the
// store. Reject removes the proposal without applying.

describe('FeedbackPanel — proposals list (PR7)', () => {
  it.todo('renders a single proposal row with the bound node id, operation kind, and content preview');
  it.todo('renders multiple pending proposals in createdAt order (oldest first) so the user reviews in arrival order');
  it.todo('renders nothing when there are no pending proposals for the active file');
  it.todo('isolates proposal rows per active file — switching files does not show another file\'s proposals');
});

describe('FeedbackPanel — accept proposal (PR7)', () => {
  it.todo('clicking Accept on an add-child proposal calls executeCommand with CreateNodeCommand');
  it.todo('clicking Accept on a delete proposal calls executeCommand with DeleteNodeCommand');
  it.todo('clicking Accept on a move proposal calls executeCommand with MoveNodeCommand');
  it.todo('clicking Accept on a submit-step-output proposal calls executeCommand with the existing accept-feedback pipeline');
  it.todo('after Accept, the proposal is removed from the proposalsStore');
  it.todo('after Accept, the change is undoable via Ctrl+Z because it went through executeCommand');
});

describe('FeedbackPanel — reject proposal (PR7)', () => {
  it.todo('clicking Reject removes the proposal from proposalsStore without modifying the tree');
  it.todo('Reject does not call executeCommand');
});

describe('FeedbackPanel — accessibility (PR7)', () => {
  it.todo('each proposal row has an accessible label describing the proposed operation');
  it.todo('Accept and Reject buttons are keyboard-focusable in tab order');
  it.todo('the panel announces newly arrived proposals to screen readers (aria-live)');
});

describe('FeedbackPanel — error handling (PR7)', () => {
  it.todo('an Accept whose target node was deleted in the meantime surfaces a toast and removes the orphan proposal');
  it.todo('an Accept whose store is no longer open (file closed) surfaces a toast and discards the proposal');
});
