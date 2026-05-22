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

const { mockCreateNewTerminal, mockSetActiveTerminal } = vi.hoisted(() => ({
  mockCreateNewTerminal: vi.fn(),
  mockSetActiveTerminal: vi.fn(),
}));
vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      createNewTerminal: mockCreateNewTerminal,
      setActiveTerminal: mockSetActiveTerminal,
      terminals: [],
    }),
  },
}));

vi.mock('@/utils/sessionLiveness', () => ({
  getSessionLiveness: vi.fn().mockReturnValue('alive-detached'),
}));

function makeNode(id: string, content: string, sessionId = 'sess-1'): TreeNode {
  return {
    id,
    content,
    children: [],
    metadata: { sessionId },
  } as unknown as TreeNode;
}

describe('resumeSession — terminal tab title is meaningful, never literal "Resume"', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    workflowSessionMap: Record<string, string>;
    sessionRegistry: Record<string, { cwd: string }>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateNewTerminal.mockResolvedValue({
      id: 'fresh-terminal',
      title: 'unused-by-test',
      cwd: '/cwd',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });
    window.electron = {
      ...window.electron,
      terminalWrite: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof window.electron;
    state = {
      nodes: {},
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

  it('does NOT pass the literal string "Resume" as the new tab title', async () => {
    state.nodes = { 'node-A': makeNode('node-A', 'Investigate session regression') };

    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal).toHaveBeenCalledTimes(1);
    const titleArg = mockCreateNewTerminal.mock.calls[0][0];
    expect(titleArg).not.toBe('Resume');
  });

  it('derives the tab title from the originating node\'s first non-empty line of content with the short sessionId appended', async () => {
    state.nodes = { 'node-A': makeNode('node-A', 'Investigate session regression\nsecond line') };

    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal).toHaveBeenCalledWith(
      'Investigate session regression · sess-1',
      '/recorded/cwd',
      'node-A',
    );
  });

  it('falls back to a non-"Resume" default when the originating node has no usable content', async () => {
    state.nodes = { 'node-A': makeNode('node-A', '   \n  ') };

    await build().resumeSession('node-A');

    const titleArg = mockCreateNewTerminal.mock.calls[0][0];
    expect(titleArg).not.toBe('Resume');
    expect(typeof titleArg).toBe('string');
    expect(titleArg.length).toBeGreaterThan(0);
  });

  it('still writes `claude --resume <sessionId>` regardless of the chosen title', async () => {
    state.nodes = { 'node-A': makeNode('node-A', 'Some task') };

    await build().resumeSession('node-A');

    expect(window.electron.terminalWrite).toHaveBeenCalledWith(
      'fresh-terminal',
      'claude --resume sess-1\r',
    );
  });

  it('passes the originating nodeId through as originNodeId on the new tab', async () => {
    state.nodes = { 'node-A': makeNode('node-A', 'Some task') };

    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal.mock.calls[0][2]).toBe('node-A');
  });
});
