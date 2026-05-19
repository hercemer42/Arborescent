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
