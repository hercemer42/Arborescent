import { describe, it } from 'vitest';

describe('useNodeContextMenu — Start workflow modal-warn entry', () => {
  it.todo('clicking Start on a node that resolves to "remap-warn" surfaces a confirm modal naming the existing sessionId');
  it.todo('on confirm, replaces sessionId, runs spawn-fresh + auto-launch, /clear is skipped');
  it.todo('on cancel, no mutation — sessionId stays, no prompt sent, no terminal write');
  it.todo('modal-warn does NOT fire when route resolves to "reattach" — silent reattach is preserved');
  it.todo('modal-warn does NOT fire when route resolves to "block" — toast fires instead');
});

describe('useNodeContextMenu — Start workflow cwd block / cross-user-story block', () => {
  it.todo('Start on a node that resolves to block(reason=cwd-mismatch) surfaces the informational cwd-block toast — no remap modal');
  it.todo('Start on a node that resolves to block(reason=cross-user-story) surfaces a toast suggesting Resume session or opening a new terminal — no remap modal');
  it.todo('cwd block fires before cross-user-story block when both apply');
});

describe('useNodeContextMenu — Send "Are you sure?" entry', () => {
  it.todo('Send on a sessionId-X source into a terminal with no session surfaces the "Are you sure?" modal naming session X');
  it.todo('Send on a sessionId-X source into a terminal with an unmapped session surfaces the same modal');
  it.todo('Send on a sessionId-X source into a terminal hosting matching session X bypasses the modal — direct send');
});

describe('useNodeContextMenu — accessibility', () => {
  it.todo('the modal-warn dialog is keyboard-reachable and ESC cancels');
  it.todo('the "Are you sure?" Send dialog uses the same confirm-dialog pattern as showRunningWorkflowDialog');
});
