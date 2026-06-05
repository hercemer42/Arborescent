import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createSessionResumeManager } from '../workflowSessionResume';

// PR3 — quiet launch-time resume into an already-materialized terminal.
// Reuses PR2's on-disk probe + shell-prompt gate + binding, but never toasts or
// steals focus: a missing session, missing cwd, or unready prompt leaves the
// plain shell untouched. Drives readiness through window.electron.onTerminalData
// (the only renderer PTY-output channel), as PR2's gate does.

vi.mock('../../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

// resumeRestoredTerminal does not touch the terminal store, but the module imports it.
vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({ createNewTerminal: vi.fn(), setActiveTerminal: vi.fn(), terminals: [] }),
  },
}));

type ResumeState = {
  nodes: Record<string, TreeNode>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
};

let state: ResumeState;

function build(): ReturnType<typeof createSessionResumeManager> {
  return createSessionResumeManager({
    get: () => state,
    set: (partial) => { state = { ...state, ...partial }; },
  });
}

function readyOnSubscribe(): void {
  (window.electron.onTerminalData as ReturnType<typeof vi.fn>).mockImplementation(
    (_id: string, cb: (data: string) => void) => {
      cb('\r\n$ ');
      return vi.fn();
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.electron = {
    ...window.electron,
    terminalWrite: vi.fn().mockResolvedValue(undefined),
    claudeSessionExists: vi.fn().mockResolvedValue(true),
    onTerminalData: vi.fn().mockReturnValue(vi.fn()),
  } as unknown as typeof window.electron;
  state = {
    nodes: {},
    workflowSessionMap: {},
    sessionRegistry: { 'sess-1': { cwd: '/recorded/cwd' } },
  };
});

describe('resumeRestoredTerminal — quiet launch resume into an existing terminal', () => {
  it('validates the session against its recorded cwd, then writes claude --resume once the prompt is ready', async () => {
    readyOnSubscribe();

    await build().resumeRestoredTerminal('term-1', 'sess-1');

    expect(window.electron.claudeSessionExists).toHaveBeenCalledWith('/recorded/cwd', 'sess-1');
    expect(window.electron.terminalWrite).toHaveBeenCalledWith('term-1', 'claude --resume sess-1\r');
    expect(state.workflowSessionMap).toEqual({ 'sess-1': 'term-1' });
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('does not write or toast when the session no longer exists on disk', async () => {
    (window.electron.claudeSessionExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    readyOnSubscribe();

    await build().resumeRestoredTerminal('term-1', 'sess-1');

    expect(window.electron.terminalWrite).not.toHaveBeenCalled();
    expect(state.workflowSessionMap).toEqual({});
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('does not write or toast when the session has no recorded cwd (missing folder / pre-feature)', async () => {
    state.sessionRegistry = {};
    readyOnSubscribe();

    await build().resumeRestoredTerminal('term-1', 'sess-1');

    expect(window.electron.claudeSessionExists).not.toHaveBeenCalled();
    expect(window.electron.terminalWrite).not.toHaveBeenCalled();
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('leaves a plain shell — no write, no toast — when the prompt never becomes ready', async () => {
    vi.useFakeTimers();
    try {
      const resumed = build().resumeRestoredTerminal('term-1', 'sess-1');
      await vi.advanceTimersByTimeAsync(120_000);
      await resumed;

      expect(window.electron.terminalWrite).not.toHaveBeenCalled();
      expect(mockAddToast).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('binds idempotently — a repeated resume converges on a single session-to-terminal mapping', async () => {
    readyOnSubscribe();
    const manager = build();

    await manager.resumeRestoredTerminal('term-1', 'sess-1');
    await manager.resumeRestoredTerminal('term-1', 'sess-1');

    expect(state.workflowSessionMap).toEqual({ 'sess-1': 'term-1' });
    const resumeWrites = (window.electron.terminalWrite as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([, data]) => typeof data === 'string' && data.includes('claude --resume'),
    );
    expect(resumeWrites).toHaveLength(2);
  });

  it('still resumes when the on-disk probe is unavailable (older build / missing IPC)', async () => {
    (window.electron as unknown as { claudeSessionExists?: unknown }).claudeSessionExists = undefined;
    readyOnSubscribe();

    await build().resumeRestoredTerminal('term-1', 'sess-1');

    expect(window.electron.terminalWrite).toHaveBeenCalledWith('term-1', 'claude --resume sess-1\r');
  });

  it('is a no-op for an empty terminalId or sessionId', async () => {
    readyOnSubscribe();

    await build().resumeRestoredTerminal('', 'sess-1');
    await build().resumeRestoredTerminal('term-1', '');

    expect(window.electron.terminalWrite).not.toHaveBeenCalled();
  });
});
