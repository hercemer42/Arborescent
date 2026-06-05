import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createSessionResumeManager } from '../workflowSessionResume';

// PR2 — Gate `claude --resume` on shell-prompt readiness.
//
// resumeSession (workflowSessionResume.ts) currently writes
// `claude --resume <id>` the instant the PTY is spawned, with no wait for the
// shell to be ready to accept input. At launch many terminals resume at once
// (PR3) and that immediate write is exactly where the command races the shell
// start-up and gets dropped or mangled. This PR adds a shell-prompt-readiness
// gate: the resume command is written only after the freshly spawned shell has
// signalled it is ready, with a timeout that leaves a plain shell rather than
// hanging or writing blindly.
//
// The gate drives readiness through window.electron.onTerminalData (the only
// renderer-side PTY-output channel); these tests fire that stream to control
// exactly when the shell prompt becomes ready. The readiness primitive itself
// (prompt detection, timeout, listener teardown) is unit-tested in
// utils/tests/shellPrompt.test.ts and services/tests/shellPromptReadiness.test.ts;
// pre-existing resume behaviour lives in workflowSessionResumePrecheck.test.ts
// and workflowSessionResumeNewTab.test.ts. None of that is duplicated here —
// this file covers only the gate's effect on resumeSession.

vi.mock('../../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { mockAddToast } = vi.hoisted(() => ({ mockAddToast: vi.fn() }));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: mockAddToast }) },
}));

const { mockCreateNewTerminal } = vi.hoisted(() => ({
  mockCreateNewTerminal: vi.fn(),
}));
vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      createNewTerminal: mockCreateNewTerminal,
      setActiveTerminal: vi.fn(),
      terminals: [],
    }),
  },
}));

// Every test here exercises the spawn (new-tab) path, where the gated write lives.
vi.mock('@/utils/sessionLiveness', () => ({
  getSessionLiveness: vi.fn().mockReturnValue('alive-detached'),
}));

const RESUME_TERMINAL_ID = 'fresh-terminal';
const SESSION_ID = 'sess-1';
const RESUME_COMMAND = `claude --resume ${SESSION_ID}\r`;

function makeNode(id: string, sessionId = SESSION_ID): TreeNode {
  return {
    id,
    content: 'Investigate session regression',
    children: [],
    metadata: { sessionId },
  } as unknown as TreeNode;
}

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

function resumeWrites(): unknown[][] {
  return (window.electron.terminalWrite as ReturnType<typeof vi.fn>).mock.calls.filter(
    ([, data]) => typeof data === 'string' && data.includes('claude --resume'),
  );
}

// Capture the readiness callback the gate registers for the freshly spawned PTY,
// so each test decides exactly when (and whether) the shell prompt becomes ready.
function captureReadinessSignal(): { fire: (data?: string) => void } {
  const ref: { cb?: (data: string) => void } = {};
  (window.electron.onTerminalData as ReturnType<typeof vi.fn>).mockImplementation(
    (id: string, cb: (data: string) => void) => {
      if (id === RESUME_TERMINAL_ID) ref.cb = cb;
      return vi.fn();
    },
  );
  return {
    fire: (data = '\x1b[?2004h\r\nuser@host project % ') => ref.cb?.(data),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateNewTerminal.mockResolvedValue({
    id: RESUME_TERMINAL_ID,
    title: 'unused',
    cwd: '/recorded/cwd',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
  });
  window.electron = {
    ...window.electron,
    terminalWrite: vi.fn().mockResolvedValue(undefined),
    claudeSessionExists: vi.fn().mockResolvedValue(true),
    onTerminalData: vi.fn().mockReturnValue(vi.fn()),
  } as unknown as typeof window.electron;
  state = {
    nodes: { 'node-A': makeNode('node-A') },
    workflowSessionMap: {},
    sessionRegistry: { [SESSION_ID]: { cwd: '/recorded/cwd' } },
  };
});

describe('resumeSession — shell-prompt-readiness gate on the resume write', () => {
  it('subscribes to the freshly spawned PTY and does not write claude --resume before the prompt is ready', async () => {
    const signal = captureReadinessSignal();

    const resumed = build().resumeSession('node-A');

    // The gate must subscribe to the new terminal's output stream...
    await vi.waitFor(() => {
      expect(window.electron.onTerminalData).toHaveBeenCalledWith(
        RESUME_TERMINAL_ID,
        expect.any(Function),
      );
    });
    // ...and must NOT have written the resume command yet — the shell is not ready.
    expect(resumeWrites()).toHaveLength(0);

    signal.fire();
    await resumed;

    expect(window.electron.terminalWrite).toHaveBeenCalledWith(RESUME_TERMINAL_ID, RESUME_COMMAND);
  });

  it('writes exactly one `claude --resume <id>` to the new tab once readiness fires and binds the session a single time', async () => {
    const signal = captureReadinessSignal();

    const resumed = build().resumeSession('node-A');
    await vi.waitFor(() => expect(window.electron.onTerminalData).toHaveBeenCalled());
    signal.fire('\r\n$ ');
    await resumed;

    const writes = resumeWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toEqual([RESUME_TERMINAL_ID, RESUME_COMMAND]);
    // Idempotent binding: the session maps to exactly the resumed terminal, no duplicates.
    expect(state.workflowSessionMap).toEqual({ [SESSION_ID]: RESUME_TERMINAL_ID });
  });

  it('times out to a plain shell — resolves without hanging and never writes claude --resume — when readiness never arrives', async () => {
    vi.useFakeTimers();
    try {
      // onTerminalData stays silent for the whole run — readiness never arrives.
      let settled = false;
      const resumed = build().resumeSession('node-A').then(() => { settled = true; });

      await vi.advanceTimersByTimeAsync(120_000);
      await resumed;

      expect(settled).toBe(true);
      expect(resumeWrites()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not error-toast a user-initiated resume that times out — the fallback is a quiet plain shell', async () => {
    vi.useFakeTimers();
    try {
      const resumed = build().resumeSession('node-A');
      await vi.advanceTimersByTimeAsync(120_000);
      await resumed;

      expect(mockAddToast).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

// Readiness-detection edge cases (standard/custom/partial prompts, slow start,
// listener teardown, per-terminal isolation) are covered by the primitive's own
// unit tests in utils/tests/shellPrompt.test.ts and
// services/tests/shellPromptReadiness.test.ts. Concurrent launch-time fan-out
// across many terminals is PR3.
