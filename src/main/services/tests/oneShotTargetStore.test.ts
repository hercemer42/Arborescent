import { describe, it, expect, beforeEach } from 'vitest';
import { OneShotTargetStore } from '../oneShotTargetStore';

describe('OneShotTargetStore — pending target lifecycle', () => {
  let store: OneShotTargetStore;

  beforeEach(() => {
    store = new OneShotTargetStore();
  });

  it('returns null pendingTarget when nothing has been set', () => {
    expect(store.pendingTarget('sess-1')).toBe(null);
  });

  it('setPendingTarget makes pendingTarget readable for that session', () => {
    store.setPendingTarget('sess-1', 'node-a');
    expect(store.pendingTarget('sess-1')).toBe('node-a');
  });

  it('clearPendingTarget removes the pendingTarget for the session', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.clearPendingTarget('sess-1');
    expect(store.pendingTarget('sess-1')).toBe(null);
  });

  it('setPendingTarget overwrites a previous pending target for the same session', () => {
    // Two consecutive freeform sends to different nodes — the second prompt
    // wins. Acceptance criterion: "Two consecutive freeform sends to the same
    // node each route their respective response to that node" — encoded here
    // as "the latest setPendingTarget wins."
    store.setPendingTarget('sess-1', 'node-a');
    store.setPendingTarget('sess-1', 'node-b');
    expect(store.pendingTarget('sess-1')).toBe('node-b');
  });

  it('pendingTarget is per-session — clearing one session does not affect another', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setPendingTarget('sess-2', 'node-b');
    store.clearPendingTarget('sess-1');
    expect(store.pendingTarget('sess-2')).toBe('node-b');
  });

  it('clearPendingTarget on an unknown session is a silent no-op', () => {
    expect(() => store.clearPendingTarget('sess-unknown')).not.toThrow();
    expect(store.pendingTarget('sess-unknown')).toBe(null);
  });

  it('empty sessionId is treated defensively — set is a no-op, lookup returns null', () => {
    store.setPendingTarget('', 'node-a');
    expect(store.pendingTarget('')).toBe(null);
  });
});

describe('OneShotTargetStore — markManualCollabResolved API', () => {
  // pendingTarget persists for the lifetime of an open manual feedback panel.
  // markManualCollabResolved is the sanctioned clearing entry point — the
  // renderer fires it on accept / reject / cancel.
  let store: OneShotTargetStore;

  beforeEach(() => {
    store = new OneShotTargetStore();
  });

  it('markManualCollabResolved clears pendingTarget for the session', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.markManualCollabResolved('sess-1');
    expect(store.pendingTarget('sess-1')).toBe(null);
  });

  it('markManualCollabResolved is per-session — resolving sess-1 does not affect sess-2', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setPendingTarget('sess-2', 'node-b');
    store.markManualCollabResolved('sess-1');
    expect(store.pendingTarget('sess-1')).toBe(null);
    expect(store.pendingTarget('sess-2')).toBe('node-b');
  });

  it('markManualCollabResolved on a session with no pendingTarget is a silent no-op', () => {
    expect(() => store.markManualCollabResolved('sess-unknown')).not.toThrow();
    expect(store.pendingTarget('sess-unknown')).toBe(null);
  });

  it('markManualCollabResolved with an empty sessionId is a defensive no-op', () => {
    store.setPendingTarget('sess-1', 'node-a');
    expect(() => store.markManualCollabResolved('')).not.toThrow();
    expect(store.pendingTarget('sess-1')).toBe('node-a');
  });

  it('markManualCollabResolved does not touch markerSeenThisTurn or the done-declaration — only the routing pin', () => {
    // Resolution is about the route, not about per-turn gating signals.
    // The Stop-hook gates remain independent so a turn ending after a
    // resolved collab still surfaces its true done-declaration.
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.recordDoneDeclaration('sess-1', 'node-a');

    store.markManualCollabResolved('sess-1');

    expect(store.pendingTarget('sess-1')).toBe(null);
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(true);
    expect(store.doneDeclarationNode('sess-1')).toBe('node-a');
  });

  it('a subsequent setPendingTarget after markManualCollabResolved re-arms the route normally', () => {
    // After resolution, a fresh manual send (which fires register-target →
    // setPendingTarget) must succeed and establish a brand-new route.
    store.setPendingTarget('sess-1', 'node-a');
    store.markManualCollabResolved('sess-1');
    store.setPendingTarget('sess-1', 'node-b');
    expect(store.pendingTarget('sess-1')).toBe('node-b');
  });
});

describe('OneShotTargetStore — markerSeenThisTurn lifecycle', () => {
  let store: OneShotTargetStore;

  beforeEach(() => {
    store = new OneShotTargetStore();
  });

  it('defaults to false when no marker has been seen for the session', () => {
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(false);
  });

  it('setMarkerSeenThisTurn(true) flips the flag observable to the Stop-hook gate', () => {
    store.setMarkerSeenThisTurn('sess-1', true);
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(true);
  });

  it('setMarkerSeenThisTurn(false) explicitly clears the flag without touching pendingTarget', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.setMarkerSeenThisTurn('sess-1', false);
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(false);
    expect(store.pendingTarget('sess-1')).toBe('node-a');
  });

  it('markerSeenThisTurn is per-session — flagging one session does not affect another', () => {
    store.setMarkerSeenThisTurn('sess-1', true);
    expect(store.wasMarkerSeenThisTurn('sess-2')).toBe(false);
  });

  it('resetSession clears both pendingTarget and markerSeenThisTurn for that session', () => {
    // The Stop hook (or any other turn-boundary owner) needs one entry point
    // to drop a session's transient routing state without poking each field.
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.resetSession('sess-1');
    expect(store.pendingTarget('sess-1')).toBe(null);
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(false);
  });

  it('resetSession does not affect other sessions', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.setPendingTarget('sess-2', 'node-b');
    store.setMarkerSeenThisTurn('sess-2', true);

    store.resetSession('sess-1');

    expect(store.pendingTarget('sess-2')).toBe('node-b');
    expect(store.wasMarkerSeenThisTurn('sess-2')).toBe(true);
  });

  it('clear() drops state for all sessions', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.setPendingTarget('sess-2', 'node-b');
    store.setMarkerSeenThisTurn('sess-2', true);

    store.clear();

    expect(store.pendingTarget('sess-1')).toBe(null);
    expect(store.pendingTarget('sess-2')).toBe(null);
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(false);
    expect(store.wasMarkerSeenThisTurn('sess-2')).toBe(false);
  });
});

describe('OneShotTargetStore — doneDeclaration lifecycle', () => {
  // The done-declaration is the node-scoped positive completion signal for the
  // Stop-hook gate. It is recorded by submit_step_output(origin=explicit) and
  // announce_step_done with the node that declared done, and read by the
  // dispatcher to thread declared_node_id onto the Stop event. Without a
  // declaration for the bound node this turn, Stop must not advance the step.
  let store: OneShotTargetStore;

  beforeEach(() => {
    store = new OneShotTargetStore();
  });

  it('defaults to null when no node has declared done for the session', () => {
    expect(store.doneDeclarationNode('sess-1')).toBeNull();
  });

  it('recordDoneDeclaration names the node observable to the Stop-hook gate', () => {
    store.recordDoneDeclaration('sess-1', 'node-a');
    expect(store.doneDeclarationNode('sess-1')).toBe('node-a');
  });

  it('a second declaration in the same turn overwrites the first — the latest declared node wins', () => {
    store.recordDoneDeclaration('sess-1', 'node-a');
    store.recordDoneDeclaration('sess-1', 'node-b');
    expect(store.doneDeclarationNode('sess-1')).toBe('node-b');
  });

  it('clearDoneDeclaration drops the declaration without touching pendingTarget or markerSeen', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.recordDoneDeclaration('sess-1', 'node-a');
    store.clearDoneDeclaration('sess-1');
    expect(store.doneDeclarationNode('sess-1')).toBeNull();
    expect(store.pendingTarget('sess-1')).toBe('node-a');
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(true);
  });

  it('doneDeclaration is per-session — declaring one session does not affect another', () => {
    store.recordDoneDeclaration('sess-1', 'node-a');
    expect(store.doneDeclarationNode('sess-2')).toBeNull();
  });

  it('doneDeclaration is independent of markerSeen — setting one does not implicitly set the other', () => {
    // markerSeen tracks "the prompt this turn carried an Arborescent marker"
    // (set by hookEventDispatcher at UserPromptSubmit). doneDeclaration tracks
    // "the AI declared a node done this turn" (set by mcpSubmitOutputTool /
    // announce_step_done). They serve different gates and must not bleed.
    store.setMarkerSeenThisTurn('sess-1', true);
    expect(store.doneDeclarationNode('sess-1')).toBeNull();

    store.recordDoneDeclaration('sess-2', 'node-a');
    expect(store.wasMarkerSeenThisTurn('sess-2')).toBe(false);
  });

  it('resetSession clears the done-declaration alongside pendingTarget and markerSeen', () => {
    store.setPendingTarget('sess-1', 'node-a');
    store.setMarkerSeenThisTurn('sess-1', true);
    store.recordDoneDeclaration('sess-1', 'node-a');
    store.resetSession('sess-1');
    expect(store.pendingTarget('sess-1')).toBe(null);
    expect(store.wasMarkerSeenThisTurn('sess-1')).toBe(false);
    expect(store.doneDeclarationNode('sess-1')).toBeNull();
  });

  it('resetSession does not affect the done-declaration on other sessions', () => {
    store.recordDoneDeclaration('sess-1', 'node-a');
    store.recordDoneDeclaration('sess-2', 'node-b');
    store.resetSession('sess-1');
    expect(store.doneDeclarationNode('sess-2')).toBe('node-b');
  });

  it('clear() drops done-declaration state for all sessions', () => {
    store.recordDoneDeclaration('sess-1', 'node-a');
    store.recordDoneDeclaration('sess-2', 'node-b');
    store.clear();
    expect(store.doneDeclarationNode('sess-1')).toBeNull();
    expect(store.doneDeclarationNode('sess-2')).toBeNull();
  });

  it('empty sessionId or nodeId is treated defensively — record is a no-op, lookup returns null', () => {
    store.recordDoneDeclaration('', 'node-a');
    expect(store.doneDeclarationNode('')).toBeNull();
    store.recordDoneDeclaration('sess-1', '');
    expect(store.doneDeclarationNode('sess-1')).toBeNull();
  });
});
