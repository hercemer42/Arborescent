import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { OneShotTargetStore } from '../oneShotTargetStore';
import { resolveBinding } from '../bindingResolution';

const SESSION = 'session-1';
const OTHER_SESSION = 'session-2';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const TARGET = 'cccccccc-cccc-cccc-cccc-cccccccccc03';

describe('resolveBinding', () => {
  let bindingRegistry: SessionBindingRegistry;
  let oneShotTargetStore: OneShotTargetStore;

  beforeEach(() => {
    bindingRegistry = new SessionBindingRegistry();
    oneShotTargetStore = new OneShotTargetStore();
  });

  describe('workflow resolution (oneShot: false)', () => {
    it('resolves the registry binding with source workflow', () => {
      bindingRegistry.register(SESSION, BOUND);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: false });

      expect(resolved).toEqual({ nodeId: BOUND, source: 'workflow' });
    });

    it('ignores a pending one-shot target — read/write callers never gain pendingTarget semantics', () => {
      bindingRegistry.register(SESSION, BOUND);
      oneShotTargetStore.setPendingTarget(SESSION, TARGET);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: false });

      expect(resolved).toEqual({ nodeId: BOUND, source: 'workflow' });
    });

    it('never consults the one-shot store when oneShot is false', () => {
      bindingRegistry.register(SESSION, BOUND);
      const pendingTarget = vi.fn(() => TARGET);

      resolveBinding({ bindingRegistry, oneShotTargetStore: { pendingTarget } }, SESSION, { oneShot: false });

      expect(pendingTarget).not.toHaveBeenCalled();
    });

    it('returns null when unbound even if a one-shot target is pending', () => {
      oneShotTargetStore.setPendingTarget(SESSION, TARGET);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: false });

      expect(resolved).toBeNull();
    });
  });

  describe('one-shot resolution (oneShot: true)', () => {
    it('prefers the pending one-shot target over the registry binding', () => {
      bindingRegistry.register(SESSION, BOUND);
      oneShotTargetStore.setPendingTarget(SESSION, TARGET);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(resolved).toEqual({ nodeId: TARGET, source: 'one-shot' });
    });

    it('falls back to the registry binding with source workflow when no one-shot target is pending', () => {
      bindingRegistry.register(SESSION, BOUND);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(resolved).toEqual({ nodeId: BOUND, source: 'workflow' });
    });

    it('resolves a one-shot target even without a registry binding', () => {
      oneShotTargetStore.setPendingTarget(SESSION, TARGET);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(resolved).toEqual({ nodeId: TARGET, source: 'one-shot' });
    });

    it('returns null when neither a one-shot target nor a registry binding exists', () => {
      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(resolved).toBeNull();
    });
  });

  describe('peek semantics', () => {
    it('does not consume the pending one-shot target — repeated calls resolve identically', () => {
      bindingRegistry.register(SESSION, BOUND);
      oneShotTargetStore.setPendingTarget(SESSION, TARGET);

      const first = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });
      const second = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(first).toEqual({ nodeId: TARGET, source: 'one-shot' });
      expect(second).toEqual(first);
      expect(oneShotTargetStore.pendingTarget(SESSION)).toBe(TARGET);
    });

    it('leaves the registry binding untouched after resolution', () => {
      bindingRegistry.register(SESSION, BOUND);

      resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(bindingRegistry.lookup(SESSION)).toBe(BOUND);
    });
  });

  describe('session isolation and degenerate inputs', () => {
    it('does not leak another session’s one-shot target', () => {
      bindingRegistry.register(SESSION, BOUND);
      oneShotTargetStore.setPendingTarget(OTHER_SESSION, TARGET);

      const resolved = resolveBinding({ bindingRegistry, oneShotTargetStore }, SESSION, { oneShot: true });

      expect(resolved).toEqual({ nodeId: BOUND, source: 'workflow' });
    });

    it('returns null for an empty session id regardless of the oneShot flag', () => {
      bindingRegistry.register(SESSION, BOUND);
      oneShotTargetStore.setPendingTarget(SESSION, TARGET);

      expect(resolveBinding({ bindingRegistry, oneShotTargetStore }, '', { oneShot: false })).toBeNull();
      expect(resolveBinding({ bindingRegistry, oneShotTargetStore }, '', { oneShot: true })).toBeNull();
    });

    it('returns null for an unknown session id', () => {
      bindingRegistry.register(SESSION, BOUND);

      expect(resolveBinding({ bindingRegistry, oneShotTargetStore }, OTHER_SESSION, { oneShot: true })).toBeNull();
    });
  });

  describe('story 1 error-code integration', () => {
    // Story 1 (feat/mcp-error-codes) has not landed; the coded-error envelope
    // callers wrap around a null resolution is not yet defined.
    it.todo('callers map a null resolution to the story 1 unbound error code');
  });
});
