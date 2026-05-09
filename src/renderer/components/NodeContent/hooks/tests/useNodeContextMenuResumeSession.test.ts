import { describe, it } from 'vitest';

// PR1 — Context-menu hook gating for "Resume session".
// The entry appears only when liveness probe says alive (alive-attached
// or alive-detached). When the session has ended (lost), the entry
// disappears and the node shows a "session lost" indicator.

describe('useNodeContextMenu — Resume session entry gating (PR1)', () => {
  it.todo('shows "Resume session" when the node has sessionId AND liveness is alive-attached');
  it.todo('shows "Resume session" when the node has sessionId AND liveness is alive-detached');
  it.todo('hides "Resume session" when the node has sessionId AND liveness is lost');
  it.todo('hides "Resume session" when the node has no sessionId at all');
  it.todo('hides "Resume session" on non-workflow nodes regardless of metadata');
  it.todo('gating uses session liveness, not workflow execution state — a stopped workflow with alive session still shows resume');
});

describe('useNodeContextMenu — Resume session click behavior (PR1)', () => {
  it.todo('clicking "Resume session" when liveness is alive-attached focuses the existing tab');
  it.todo('clicking "Resume session" when liveness is alive-detached opens a new terminal tab in the recorded working directory');
  it.todo('clicking "Resume session" emits the resume command with the correct sessionId and cwd');
  it.todo('clicking "Resume session" surfaces a toast when the focus/open call rejects');
  it.todo('clicking "Resume session" on a stale node whose session just died shows "session lost" toast and refreshes the menu');
});

describe('useNodeContextMenu — session-lost indicator (PR1)', () => {
  it.todo('a node with sessionId and liveness=lost is rendered with the "session lost" indicator');
  it.todo('the indicator clears once the node is restarted with a fresh session');
});

describe('useNodeContextMenu — independence between parallel sessions (PR1)', () => {
  it.todo('Resume session on node A does not surface or affect node B\'s tab when both have live sessions');
  it.todo('two nodes with different live sessions each get their own working "Resume session" entry');
});

describe('useNodeContextMenu — accessibility (PR1)', () => {
  it.todo('the "Resume session" entry is keyboard-reachable in the context menu');
  it.todo('the session-lost indicator carries an accessible label / aria attribute');
});
