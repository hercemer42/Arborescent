import { describe, it, expect, vi, beforeEach } from 'vitest';
import { powerSaveBlocker } from 'electron';
import { createKeepAwake } from '../keepAwake';

vi.mock('electron', () => ({
  powerSaveBlocker: {
    start: vi.fn(),
    stop: vi.fn(),
    isStarted: vi.fn(),
  },
}));

describe('keepAwake', () => {
  let keepAwake: ReturnType<typeof createKeepAwake>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(powerSaveBlocker.start).mockImplementation(() => 42);
    vi.mocked(powerSaveBlocker.isStarted).mockImplementation(() => true);
    keepAwake = createKeepAwake();
  });

  it('does not start a blocker before any start call', () => {
    expect(powerSaveBlocker.start).not.toHaveBeenCalled();
  });

  it('starts a blocker with prevent-app-suspension on first start', () => {
    keepAwake.start();
    expect(powerSaveBlocker.start).toHaveBeenCalledWith('prevent-app-suspension');
    expect(powerSaveBlocker.start).toHaveBeenCalledTimes(1);
  });

  it('does not start a second blocker when start is called while one is already active', () => {
    keepAwake.start();
    keepAwake.start();
    keepAwake.start();
    expect(powerSaveBlocker.start).toHaveBeenCalledTimes(1);
  });

  it('releases the blocker when the only outstanding start is stopped', () => {
    keepAwake.start();
    keepAwake.stop();
    expect(powerSaveBlocker.stop).toHaveBeenCalledWith(42);
    expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
  });

  it('keeps the blocker active when one stop matches but other starts remain', () => {
    keepAwake.start();
    keepAwake.start();
    keepAwake.stop();
    expect(powerSaveBlocker.stop).not.toHaveBeenCalled();
  });

  it('releases only when the outstanding count finally reaches zero', () => {
    keepAwake.start();
    keepAwake.start();
    keepAwake.stop();
    keepAwake.stop();
    expect(powerSaveBlocker.stop).toHaveBeenCalledWith(42);
    expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
  });

  it('extra stops beyond outstanding starts are no-ops — no double release, no crash', () => {
    keepAwake.start();
    keepAwake.stop();
    expect(() => keepAwake.stop()).not.toThrow();
    expect(() => keepAwake.stop()).not.toThrow();
    expect(powerSaveBlocker.stop).toHaveBeenCalledTimes(1);
  });

  it('stop called before any start is a no-op (count clamped at zero)', () => {
    expect(() => keepAwake.stop()).not.toThrow();
    expect(powerSaveBlocker.stop).not.toHaveBeenCalled();
  });

  it('starts a fresh blocker after full release and re-acquire', () => {
    let callIndex = 0;
    vi.mocked(powerSaveBlocker.start).mockImplementation(() => {
      callIndex += 1;
      return callIndex === 1 ? 42 : 99;
    });

    keepAwake.start();
    keepAwake.stop();
    keepAwake.start();
    expect(powerSaveBlocker.start).toHaveBeenCalledTimes(2);

    keepAwake.stop();
    expect(powerSaveBlocker.stop).toHaveBeenLastCalledWith(99);
  });
});
