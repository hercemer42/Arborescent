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

const { mockCreateNewTerminal, mockSetActiveTerminal, mockTerminals } = vi.hoisted(() => ({
  mockCreateNewTerminal: vi.fn(),
  mockSetActiveTerminal: vi.fn(),
  mockTerminals: [] as Array<{ id: string }>,
}));
vi.mock('../../../terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      createNewTerminal: mockCreateNewTerminal,
      setActiveTerminal: mockSetActiveTerminal,
      terminals: mockTerminals,
    }),
  },
}));

const { mockGetSessionLiveness } = vi.hoisted(() => ({
  mockGetSessionLiveness: vi.fn(),
}));
vi.mock('@/utils/sessionLiveness', () => ({
  getSessionLiveness: mockGetSessionLiveness,
}));

const { mockFocusTerminal } = vi.hoisted(() => ({
  mockFocusTerminal: vi.fn(),
}));
vi.mock('@/services/terminalFocusRegistry', () => ({
  focusTerminal: mockFocusTerminal,
  registerTerminalFocus: vi.fn(),
  unregisterTerminalFocus: vi.fn(),
}));

function makeNode(id: string, sessionId?: string): TreeNode {
  return {
    id,
    content: id,
    children: [],
    metadata: sessionId ? { sessionId } : {},
  } as unknown as TreeNode;
}

interface ResumeState {
  nodes: Record<string, TreeNode>;
  workflowSessionMap: Record<string, string>;
  sessionRegistry: Record<string, { cwd: string }>;
}

describe('resumeSession — focuses the bound terminal', () => {
  let state: ResumeState;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTerminals.length = 0;
    mockCreateNewTerminal.mockResolvedValue({
      id: 'fresh-terminal',
      title: 'Terminal 1',
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
      sessionRegistry: {},
    };
  });

  function build(): ReturnType<typeof createSessionResumeManager> {
    return createSessionResumeManager({
      get: () => state,
      set: (partial) => { state = { ...state, ...partial }; },
    });
  }

  it('focuses the mapped terminal on the alive-attached path', async () => {
    mockGetSessionLiveness.mockReturnValue('alive-attached');
    mockTerminals.push({ id: 'terminal-mapped' });
    state.nodes = { 'node-A': makeNode('node-A', 'sess-1') };
    state.workflowSessionMap = { 'sess-1': 'terminal-mapped' };

    await build().resumeSession('node-A');

    expect(mockSetActiveTerminal).toHaveBeenCalledWith('terminal-mapped');
    expect(mockFocusTerminal).toHaveBeenCalledWith('terminal-mapped');
  });

  it('focuses the newly-created terminal on the alive-detached new-tab path', async () => {
    mockGetSessionLiveness.mockReturnValue('alive-detached');
    state.nodes = { 'node-A': makeNode('node-A', 'sess-1') };
    state.sessionRegistry = { 'sess-1': { cwd: '/work' } };
    mockCreateNewTerminal.mockResolvedValueOnce({
      id: 'terminal-new',
      title: 'Terminal 1',
      cwd: '/work',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });

    await build().resumeSession('node-A');

    expect(mockFocusTerminal).toHaveBeenCalledWith('terminal-new');
  });

  it('focuses the bound terminal after setActiveTerminal so the active-tab switch is rendered first', async () => {
    mockGetSessionLiveness.mockReturnValue('alive-attached');
    mockTerminals.push({ id: 'terminal-mapped' });
    state.nodes = { 'node-A': makeNode('node-A', 'sess-1') };
    state.workflowSessionMap = { 'sess-1': 'terminal-mapped' };
    const callOrder: string[] = [];
    mockSetActiveTerminal.mockImplementation(() => { callOrder.push('setActiveTerminal'); });
    mockFocusTerminal.mockImplementation(() => { callOrder.push('focusTerminal'); });

    await build().resumeSession('node-A');

    expect(callOrder).toEqual(['setActiveTerminal', 'focusTerminal']);
  });

  it('does not call focusTerminal when the node has no sessionId', async () => {
    state.nodes = { 'node-A': makeNode('node-A') };

    await build().resumeSession('node-A');

    expect(mockFocusTerminal).not.toHaveBeenCalled();
  });

  it('does not call focusTerminal when alive-detached resume fails because cwd is missing', async () => {
    mockGetSessionLiveness.mockReturnValue('alive-detached');
    state.nodes = { 'node-A': makeNode('node-A', 'sess-1') };
    // sessionRegistry intentionally empty — resume should toast-and-bail.

    await build().resumeSession('node-A');

    expect(mockCreateNewTerminal).not.toHaveBeenCalled();
    expect(mockFocusTerminal).not.toHaveBeenCalled();
  });

  it('does not call focusTerminal when createNewTerminal rejects on the alive-detached path', async () => {
    mockGetSessionLiveness.mockReturnValue('alive-detached');
    state.nodes = { 'node-A': makeNode('node-A', 'sess-1') };
    state.sessionRegistry = { 'sess-1': { cwd: '/work' } };
    mockCreateNewTerminal.mockRejectedValueOnce(new Error('create failed'));

    await build().resumeSession('node-A');

    expect(mockFocusTerminal).not.toHaveBeenCalled();
  });

  it('does not call focusTerminal when terminalWrite of claude --resume rejects', async () => {
    mockGetSessionLiveness.mockReturnValue('alive-detached');
    state.nodes = { 'node-A': makeNode('node-A', 'sess-1') };
    state.sessionRegistry = { 'sess-1': { cwd: '/work' } };
    mockCreateNewTerminal.mockResolvedValueOnce({
      id: 'terminal-new',
      title: 'Terminal 1',
      cwd: '/work',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });
    (window.electron.terminalWrite as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('write failed'),
    );

    await build().resumeSession('node-A');

    expect(mockFocusTerminal).not.toHaveBeenCalled();
  });
});

describe('workflow-advance (recurse) — does NOT focus the terminal', () => {
  it.todo('dispatchRecurseStart on the focus-existing-tab route does not call focusTerminal');
  it.todo('dispatchRecurseStart on the resume-in-new-tab route does not call focusTerminal');
});

describe('resume gated by an open modal — does NOT steal focus', () => {
  it.todo('skips focusTerminal when the rebind confirmation dialog is open on the bound terminal');
});
