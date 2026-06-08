import { describe, it, expect, beforeEach, vi } from 'vitest';

import { waitForShellPrompt } from '../shellPromptReadiness';

type DataCallback = (data: string) => void;

const listeners = new Map<string, DataCallback>();
const unsubscribeSpies = new Map<string, ReturnType<typeof vi.fn>>();

function emit(id: string, data: string): void {
  listeners.get(id)?.(data);
}

beforeEach(() => {
  listeners.clear();
  unsubscribeSpies.clear();
  window.electron = {
    ...window.electron,
    onTerminalData: vi.fn((id: string, cb: DataCallback) => {
      listeners.set(id, cb);
      const unsub = vi.fn(() => listeners.delete(id));
      unsubscribeSpies.set(id, unsub);
      return unsub;
    }),
    getTerminalRecentOutput: vi.fn().mockResolvedValue(''),
  } as unknown as typeof window.electron;
});

function setRecentOutput(value: string): void {
  (window.electron.getTerminalRecentOutput as ReturnType<typeof vi.fn>).mockResolvedValue(value);
}

describe('waitForShellPrompt', () => {
  it('subscribes to the given terminal and resolves true once its shell prompt is ready', async () => {
    const pending = waitForShellPrompt('term-1');

    expect(window.electron.onTerminalData).toHaveBeenCalledWith('term-1', expect.any(Function));

    emit('term-1', '\r\n$ ');
    await expect(pending).resolves.toBe(true);
  });

  it('accumulates output across chunks so a prompt split across reads still resolves', async () => {
    const pending = waitForShellPrompt('term-1');

    emit('term-1', '\r\nuser@host:~/project');
    emit('term-1', '$ ');

    await expect(pending).resolves.toBe(true);
  });

  it('resolves false when no prompt-ready signal arrives within the timeout', async () => {
    vi.useFakeTimers();
    try {
      const pending = waitForShellPrompt('term-1', 5000);
      await vi.advanceTimersByTimeAsync(5000);
      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves true for a slow-starting shell whose prompt arrives just before the timeout', async () => {
    vi.useFakeTimers();
    try {
      const pending = waitForShellPrompt('term-1', 5000);
      await vi.advanceTimersByTimeAsync(4999);
      emit('term-1', '\r\n$ ');
      await expect(pending).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tears down the PTY data subscription once readiness resolves', async () => {
    const pending = waitForShellPrompt('term-1');
    emit('term-1', '\x1b[?2004h');
    await pending;

    expect(unsubscribeSpies.get('term-1')).toHaveBeenCalledTimes(1);
  });

  it('tears down the real subscription even when readiness fires synchronously during subscription', async () => {
    const unsub = vi.fn();
    (window.electron.onTerminalData as ReturnType<typeof vi.fn>).mockImplementation(
      (_id: string, cb: DataCallback) => {
        cb('\r\n$ '); // ready before onTerminalData has returned the disposer
        return unsub;
      },
    );

    await expect(waitForShellPrompt('term-sync')).resolves.toBe(true);
    expect(unsub).toHaveBeenCalledTimes(1);
  });

  it('tears down the PTY data subscription when the readiness timeout fires', async () => {
    vi.useFakeTimers();
    try {
      const pending = waitForShellPrompt('term-1', 3000);
      await vi.advanceTimersByTimeAsync(3000);
      await pending;

      expect(unsubscribeSpies.get('term-1')).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('detects a prompt drawn before subscription via the replayed output buffer (launch timing)', async () => {
    // The PTY printed its prompt during the spawn→subscribe gap, so onTerminalData
    // never delivers it live — readiness must come from the replay buffer alone.
    setRecentOutput('user@host:~/project$ ');

    await expect(waitForShellPrompt('term-late')).resolves.toBe(true);
    expect(listeners.has('term-late')).toBe(false); // subscription torn down
  });

  it('detects a bracketed-paste-ready prompt from the replay buffer with no live output', async () => {
    setRecentOutput('\x1b[?2004h');

    await expect(waitForShellPrompt('term-late')).resolves.toBe(true);
  });

  it('does not falsely signal readiness when the replay buffer holds no prompt', async () => {
    vi.useFakeTimers();
    try {
      setRecentOutput('Resolving dependencies...\r\nbuilding');
      const pending = waitForShellPrompt('term-busy', 5000);
      await vi.advanceTimersByTimeAsync(5000);
      await expect(pending).resolves.toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still resolves from live output when the replay buffer was empty', async () => {
    setRecentOutput('');
    const pending = waitForShellPrompt('term-1');

    emit('term-1', '\r\n$ ');
    await expect(pending).resolves.toBe(true);
  });

  it('gates each terminal independently — emitting on one does not resolve another', async () => {
    const first = waitForShellPrompt('term-A');
    const second = waitForShellPrompt('term-B');

    emit('term-B', '\r\n$ ');
    await expect(second).resolves.toBe(true);

    emit('term-A', '\r\n% ');
    await expect(first).resolves.toBe(true);
  });
});
