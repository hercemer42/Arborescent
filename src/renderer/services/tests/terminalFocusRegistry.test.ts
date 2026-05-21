import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerTerminalFocus,
  unregisterTerminalFocus,
  focusTerminal,
} from '../terminalFocusRegistry';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

describe('terminalFocusRegistry', () => {
  beforeEach(() => {
    // Each test starts with an empty registry; the module should expose no
    // registered handlers across tests.
    unregisterTerminalFocus('t-1');
    unregisterTerminalFocus('t-2');
    unregisterTerminalFocus('t-3');
  });

  it('invokes the registered focus function for a known terminal id', async () => {
    const focusFn = vi.fn();
    registerTerminalFocus('t-1', focusFn);

    focusTerminal('t-1');
    await nextFrame();

    expect(focusFn).toHaveBeenCalledTimes(1);
  });

  it('defers the focus call past the current paint so xterm sees a visible container', () => {
    const focusFn = vi.fn();
    registerTerminalFocus('t-1', focusFn);

    focusTerminal('t-1');

    // The contract is that focus does not run synchronously — the active-tab
    // switch needs a render cycle to flip the container's display from
    // none to block before xterm.focus() is meaningful.
    expect(focusFn).not.toHaveBeenCalled();
  });

  it('does nothing and does not throw when no handler is registered for the id', () => {
    expect(() => focusTerminal('unregistered-id')).not.toThrow();
  });

  it('does nothing after the handler is unregistered', async () => {
    const focusFn = vi.fn();
    registerTerminalFocus('t-1', focusFn);
    unregisterTerminalFocus('t-1');

    focusTerminal('t-1');
    await nextFrame();

    expect(focusFn).not.toHaveBeenCalled();
  });

  it('replaces the prior handler when the same id is registered twice', async () => {
    const first = vi.fn();
    const second = vi.fn();
    registerTerminalFocus('t-1', first);
    registerTerminalFocus('t-1', second);

    focusTerminal('t-1');
    await nextFrame();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('tracks each id independently', async () => {
    const focusOne = vi.fn();
    const focusTwo = vi.fn();
    registerTerminalFocus('t-1', focusOne);
    registerTerminalFocus('t-2', focusTwo);

    focusTerminal('t-2');
    await nextFrame();

    expect(focusOne).not.toHaveBeenCalled();
    expect(focusTwo).toHaveBeenCalledTimes(1);
  });

  it('swallows errors thrown by the registered handler so callers are insulated', async () => {
    const throwing = vi.fn(() => {
      throw new Error('xterm gone');
    });
    registerTerminalFocus('t-1', throwing);

    expect(() => focusTerminal('t-1')).not.toThrow();
    await nextFrame();
    expect(throwing).toHaveBeenCalledTimes(1);
  });
});
