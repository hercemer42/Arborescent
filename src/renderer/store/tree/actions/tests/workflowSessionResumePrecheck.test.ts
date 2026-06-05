import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

import { createSessionResumeManager } from '../workflowSessionResume';

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

vi.mock('@/utils/sessionLiveness', () => ({
  getSessionLiveness: vi.fn().mockReturnValue('alive-detached'),
}));

function makeNode(id: string, sessionId = 'sess-1'): TreeNode {
  return { id, content: 'Some task', children: [], metadata: { sessionId } } as unknown as TreeNode;
}

describe('resumeSession — pre-check that the on-disk session file exists', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNewTerminal.mockResolvedValue({
      id: 'fresh-terminal',
      title: 'unused',
      cwd: '/cwd',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });
    window.electron = {
      ...window.electron,
      terminalWrite: vi.fn().mockResolvedValue(undefined),
      claudeSessionExists: vi.fn().mockResolvedValue(true),
      // Signal shell-prompt readiness so the resume gate proceeds to the write.
      onTerminalData: vi.fn((_id: string, cb: (data: string) => void) => {
        cb('\r\n$ ');
        return vi.fn();
      }),
    } as unknown as typeof window.electron;
    state = {
      nodes: { 'node-A': makeNode('node-A') },
      workflowSessionMap: {},
      sessionRegistry: { 'sess-1': { cwd: '/recorded/cwd' } },
    };
  });

  function build(): ReturnType<typeof createSessionResumeManager> {
    return createSessionResumeManager({
      get: () => state,
      set: (partial) => { state = { ...state, ...partial }; },
    });
  }

  it('aborts with an error toast and does not spawn the terminal when claudeSessionExists returns false', async () => {
    (window.electron.claudeSessionExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);

    await build().resumeSession('node-A');

    expect(window.electron.claudeSessionExists).toHaveBeenCalledWith('/recorded/cwd', 'sess-1');
    expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    expect(window.electron.terminalWrite).not.toHaveBeenCalled();
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.stringContaining('no longer exists on disk'),
      'error',
    );
  });

  it('proceeds with the resume when claudeSessionExists returns true', async () => {
    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal).toHaveBeenCalledTimes(1);
    expect(window.electron.terminalWrite).toHaveBeenCalledWith(
      'fresh-terminal',
      'claude --resume sess-1\r',
    );
  });

  it('proceeds with the resume when the probe is unavailable (older build / missing IPC)', async () => {
    (window.electron as unknown as { claudeSessionExists?: unknown }).claudeSessionExists = undefined;

    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal).toHaveBeenCalledTimes(1);
  });

  it('proceeds with the resume when the probe throws — the failure is logged and not user-visible', async () => {
    (window.electron.claudeSessionExists as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IPC down'));

    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal).toHaveBeenCalledTimes(1);
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
