import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '@shared/types';

vi.mock('../../../../services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/terminalService', () => ({
  createTerminal: vi.fn(),
}));

vi.mock('../../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: vi.fn(),
    getTerminalSession: vi.fn().mockResolvedValue(null),
  })),
}));

import {
  findSessionBoundNodeForTerminal,
  findCapturableNodeForTerminal,
  findRunningNodeOnTerminal,
  CONSULTED_BINDING_FACTS,
  type BindingResolutionState,
} from '../terminalBindingResolution';
import { BINDING_AUTHORITY } from '@shared/utils/bindingAuthority';
import { useTerminalStore, type TerminalInfo } from '../../../terminal/terminalStore';

// The live session (workflowSessionMap + a live owner) is what binds a
// terminal — stale references (a deleted node's persisted sessionId, a
// terminal's leftover originNodeId with no live session) never count.

const SESSION = 'sess-1';
const TERMINAL = 'terminal-1';

function makeNode(id: string, metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content: id, children: [], metadata } as unknown as TreeNode;
}

function makeState(overrides: Partial<BindingResolutionState> = {}): BindingResolutionState {
  return {
    nodes: {},
    workflowExecutionStates: {},
    workflowSessionMap: {},
    terminalNodeAssignments: {},
    ...overrides,
  };
}

function makeTerminal(overrides: Partial<TerminalInfo> = {}): TerminalInfo {
  return {
    id: TERMINAL,
    title: 'Terminal',
    cwd: '/tmp',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
    ...overrides,
  };
}

beforeEach(() => {
  useTerminalStore.setState({ terminals: [], fileStates: {} });
});

describe('authority table consumption — resolver read set comes from BINDING_AUTHORITY', () => {
  it('every fact the renderer resolver consults is renderer-owned per the table', () => {
    for (const fact of CONSULTED_BINDING_FACTS) {
      expect(BINDING_AUTHORITY[fact].owner).toBe('renderer');
    }
  });

  it('the renderer resolver never consults the main-owned session-to-node fact', () => {
    expect(CONSULTED_BINDING_FACTS).not.toContain('session-to-node');
  });
});

describe('drift regression — deleted bound node, rebound terminal', () => {
  it('after node A is deleted and the terminal rebound to B, resolution follows the live owner B', () => {
    // A was deleted (absent from nodes) — only its on-disk metadata is stale.
    const state = makeState({
      nodes: { nodeB: makeNode('nodeB', { sessionId: SESSION }) },
      workflowSessionMap: { [SESSION]: TERMINAL },
    });

    expect(findSessionBoundNodeForTerminal(() => state, TERMINAL)).toBe('nodeB');
  });

  it('a session whose owning node was deleted yields no binding — the stale map entry does not resurrect one', () => {
    const state = makeState({
      workflowSessionMap: { [SESSION]: TERMINAL },
    });

    expect(findSessionBoundNodeForTerminal(() => state, TERMINAL)).toBeNull();
  });

  it('a node flagged brokenChain never counts as the live owner of its stale sessionId', () => {
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA', { sessionId: SESSION, brokenChain: true }) },
      workflowSessionMap: { [SESSION]: TERMINAL },
    });

    expect(findSessionBoundNodeForTerminal(() => state, TERMINAL)).toBeNull();
  });

  it('a session mapped to a different terminal never binds this one', () => {
    const state = makeState({
      nodes: { nodeB: makeNode('nodeB', { sessionId: SESSION }) },
      workflowSessionMap: { [SESSION]: 'other-terminal' },
    });

    expect(findSessionBoundNodeForTerminal(() => state, TERMINAL)).toBeNull();
  });

  it('an empty workflowSessionMap yields no binding', () => {
    const state = makeState({
      nodes: { nodeB: makeNode('nodeB', { sessionId: SESSION }) },
    });

    expect(findSessionBoundNodeForTerminal(() => state, TERMINAL)).toBeNull();
  });
});

describe('stale originNodeId — never a binding without a live session', () => {
  it('a terminal whose originNodeId points at a node with no live session is not session-bound', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'nodeA' })] });
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA') },
    });

    expect(findSessionBoundNodeForTerminal(() => state, TERMINAL)).toBeNull();
  });

  it('a terminal whose originNodeId references a deleted node is not capturable', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'ghost' })] });
    const state = makeState();

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBeNull();
  });

  it('a terminal with no originNodeId at all is not capturable', () => {
    useTerminalStore.setState({ terminals: [makeTerminal()] });
    const state = makeState();

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBeNull();
  });
});

describe('capture gate — bookmarked origin node vs incoming session', () => {
  it('blocks capture onto an origin node bookmarked to a different session', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'nodeA' })] });
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA', { sessionId: 'other-session' }) },
    });

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBeNull();
  });

  it('allows capture when the origin node is bookmarked to the incoming session', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'nodeA' })] });
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA', { sessionId: SESSION }) },
    });

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBe('nodeA');
  });

  it('allows capture onto a brokenChain origin node even when its bookmark differs', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'nodeA' })] });
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA', { sessionId: 'other-session', brokenChain: true }) },
    });

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBe('nodeA');
  });

  it('allows capture when the origin node carries no bookmark at all', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'nodeA' })] });
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA') },
    });

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBe('nodeA');
  });
});

describe('precedence — running assignment beats origin bookmark', () => {
  it('an explicit terminalNodeAssignments entry wins over the origin bookmark gate', () => {
    useTerminalStore.setState({ terminals: [makeTerminal({ originNodeId: 'nodeA' })] });
    // The assignment only counts while it is backed by a live execution state on
    // the same terminal — that pairing is what beats the origin-bookmark gate.
    const state = makeState({
      nodes: { nodeA: makeNode('nodeA', { sessionId: 'other-session' }) },
      terminalNodeAssignments: { [TERMINAL]: 'nodeR' },
      workflowExecutionStates: {
        nodeR: { state: 'running', terminalTabId: TERMINAL } as BindingResolutionState['workflowExecutionStates'][string],
      },
    });

    expect(findCapturableNodeForTerminal(() => state, TERMINAL, SESSION)).toBe('nodeR');
  });

  it('a running workflow execution on the terminal wins when no explicit assignment exists', () => {
    const state = makeState({
      workflowExecutionStates: {
        nodeR: { state: 'running', terminalTabId: TERMINAL } as BindingResolutionState['workflowExecutionStates'][string],
      },
    });

    expect(findRunningNodeOnTerminal(() => state, TERMINAL)).toBe('nodeR');
  });

  it('undefined terminalNodeAssignments falls through without error', () => {
    const state = makeState({ terminalNodeAssignments: undefined });

    expect(findRunningNodeOnTerminal(() => state, TERMINAL)).toBeNull();
  });

  it('resolution is stable across repeated calls with the same state', () => {
    const state = makeState({
      nodes: { nodeB: makeNode('nodeB', { sessionId: SESSION }) },
      workflowSessionMap: { [SESSION]: TERMINAL },
    });
    const get = () => state;

    expect(findSessionBoundNodeForTerminal(get, TERMINAL)).toBe('nodeB');
    expect(findSessionBoundNodeForTerminal(get, TERMINAL)).toBe('nodeB');
  });
});
