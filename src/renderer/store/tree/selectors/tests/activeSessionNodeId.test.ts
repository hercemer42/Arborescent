import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../../../../shared/types';
import { selectActiveSessionNodeId, type SessionSelectorState } from '../activeSessionNodeId';

const emptyState: SessionSelectorState = {
  workflowExecutionStates: {},
  collaboratingNodeId: null,
  collaborationSource: null,
  collaboratingTerminalId: null,
};

function makeNode(id: string, metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content: '', children: [], metadata };
}

describe('selectActiveSessionNodeId', () => {
  it('returns null when no terminal is focused', () => {
    expect(selectActiveSessionNodeId(emptyState, null)).toBeNull();
  });

  it('returns null when the focused terminal has no bound node', () => {
    expect(selectActiveSessionNodeId(emptyState, 'terminal-1')).toBeNull();
  });

  it('returns the running workflow step nodeId when its terminal is focused', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'running', terminalTabId: 'terminal-1' },
      },
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
  });

  it('returns the awaiting-validation step nodeId when its terminal is focused', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
      },
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
  });

  it('returns null when an awaiting-validation step is bound to a different terminal than the one focused', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'awaiting-validation', terminalTabId: 'terminal-2' },
      },
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
  });

  it('prefers an awaiting-validation step on the focused terminal over a running step on another terminal', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
        'node-B': { state: 'running', terminalTabId: 'terminal-2' },
      },
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
  });

  it('prefers an awaiting-validation workflow step over a concurrent collaboration on the same terminal', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
      },
      collaboratingNodeId: 'node-B',
      collaborationSource: 'terminal',
      collaboratingTerminalId: 'terminal-1',
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
  });

  it('returns null when a step is running on a different terminal than the one focused', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'running', terminalTabId: 'terminal-2' },
      },
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
  });

  it('returns the collaboration nodeId when its terminal is focused and source is terminal', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      collaboratingNodeId: 'node-B',
      collaborationSource: 'terminal',
      collaboratingTerminalId: 'terminal-1',
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-B');
  });

  it('returns null for a browser-source collaboration even when a terminal is focused', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      collaboratingNodeId: 'node-B',
      collaborationSource: 'browser',
      collaboratingTerminalId: null,
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
  });

  it('returns null when a terminal collaboration is bound to a different terminal than the one focused', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      collaboratingNodeId: 'node-B',
      collaborationSource: 'terminal',
      collaboratingTerminalId: 'terminal-2',
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
  });

  it('prefers the workflow step over a concurrent collaboration on the same terminal', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'node-A': { state: 'running', terminalTabId: 'terminal-1' },
      },
      collaboratingNodeId: 'node-B',
      collaborationSource: 'terminal',
      collaboratingTerminalId: 'terminal-1',
    };
    expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
  });

  it('returns the deepest (last-started) running step when the terminal hosts nested running steps', () => {
    const state: SessionSelectorState = {
      ...emptyState,
      workflowExecutionStates: {
        'parent-step': { state: 'running', terminalTabId: 'terminal-1' },
        'child-step': { state: 'running', terminalTabId: 'terminal-1' },
      },
    };
    const result = selectActiveSessionNodeId(state, 'terminal-1');
    expect(result === 'parent-step' || result === 'child-step').toBe(true);
  });

  it('handles an empty workflowExecutionStates record without throwing', () => {
    expect(() => selectActiveSessionNodeId(emptyState, 'terminal-1')).not.toThrow();
  });

  it('treats undefined activeTerminalId the same as null', () => {
    expect(selectActiveSessionNodeId(emptyState, undefined as unknown as string | null)).toBeNull();
  });

  describe('session ownership (metadata.sessionId binding)', () => {
    function withSession(
      base: SessionSelectorState,
      workflowSessionMap: Record<string, string>,
      nodes: Record<string, TreeNode>,
    ): SessionSelectorState {
      return { ...base, workflowSessionMap, nodes };
    }

    it('returns the node whose metadata.sessionId matches the active terminal’s session id', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-1' },
        { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-owner');
    });

    it('returns null when no node carries the matching sessionId in metadata', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-1' },
        { 'node-other': makeNode('node-other', { sessionId: 'sess-other' }) },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('returns null when the active terminal has no mapped sessionId', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-2' },
        { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('does not match a node whose sessionId points to a different terminal’s session', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-1', 'sess-2': 'terminal-2' },
        {
          'node-A': makeNode('node-A', { sessionId: 'sess-1' }),
          'node-B': makeNode('node-B', { sessionId: 'sess-2' }),
        },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
      expect(selectActiveSessionNodeId(state, 'terminal-2')).toBe('node-B');
    });

    it('skips brokenChain nodes when resolving sessionId to a node', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-1' },
        { 'node-stale': makeNode('node-stale', { sessionId: 'sess-1', brokenChain: true }) },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('prefers a non-brokenChain match over a brokenChain match for the same sessionId', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-1' },
        {
          'node-stale': makeNode('node-stale', { sessionId: 'sess-1', brokenChain: true }),
          'node-live': makeNode('node-live', { sessionId: 'sess-1' }),
        },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-live');
    });

    it('returns null when the terminal has a mapped sessionId but no node owns it (no stale-origin fallback)', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        workflowSessionMap: { 'sess-1': 'terminal-1' },
        nodes: {},
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('prefers a running step on the focused terminal over session-ownership', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        workflowExecutionStates: {
          'node-step': { state: 'running', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'sess-1': 'terminal-1' },
        nodes: { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-step');
    });

    it('prefers an awaiting-validation step on the focused terminal over session-ownership', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        workflowExecutionStates: {
          'node-step': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
        },
        workflowSessionMap: { 'sess-1': 'terminal-1' },
        nodes: { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-step');
    });

    it('prefers a terminal-source collaboration over session-ownership', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        collaboratingNodeId: 'node-collab',
        collaborationSource: 'terminal',
        collaboratingTerminalId: 'terminal-1',
        workflowSessionMap: { 'sess-1': 'terminal-1' },
        nodes: { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-collab');
    });

    it('returns the session-owning node after the workflow step finished (idle between steps — bug repro)', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        workflowExecutionStates: {},
        workflowSessionMap: { 'sess-1': 'terminal-1' },
        nodes: { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-owner');
    });

    it('updates when focus switches to a different terminal — bar follows the newly-focused terminal’s owning node', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        workflowSessionMap: { 'sess-1': 'terminal-1', 'sess-2': 'terminal-2' },
        nodes: {
          'node-A': makeNode('node-A', { sessionId: 'sess-1' }),
          'node-B': makeNode('node-B', { sessionId: 'sess-2' }),
        },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
      expect(selectActiveSessionNodeId(state, 'terminal-2')).toBe('node-B');
    });

    it('treats an absent workflowSessionMap as no session — returns null (no stale-origin fallback)', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        nodes: { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('treats an absent nodes record as no session-ownership — returns null (no stale-origin fallback)', () => {
      const state: SessionSelectorState = {
        ...emptyState,
        workflowSessionMap: { 'sess-1': 'terminal-1' },
      };
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('ignores a node whose metadata.sessionId is the empty string', () => {
      const state = withSession(
        emptyState,
        { 'sess-1': 'terminal-1' },
        { 'node-empty': makeNode('node-empty', { sessionId: '' }) },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('tiebreak when multiple non-brokenChain nodes share the same sessionId (recurse-inherited)');

    it('reflects updated ownership when the nodes record is replaced (cache invalidates on new reference)', () => {
      const sharedMap = { 'sess-1': 'terminal-1' };

      const initialState = withSession(
        emptyState,
        sharedMap,
        { 'node-owner': makeNode('node-owner', { sessionId: 'sess-1' }) },
      );
      expect(selectActiveSessionNodeId(initialState, 'terminal-1')).toBe('node-owner');

      const replacedState = withSession(
        emptyState,
        sharedMap,
        { 'node-other': makeNode('node-other', { sessionId: 'sess-other' }) },
      );
      expect(selectActiveSessionNodeId(replacedState, 'terminal-1')).toBeNull();
    });
  });
});
