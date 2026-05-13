import { describe, it, expect } from 'vitest';
import { selectActiveSessionNodeId, type SessionSelectorState } from '../activeSessionNodeId';

const emptyState: SessionSelectorState = {
  workflowExecutionStates: {},
  collaboratingNodeId: null,
  collaborationSource: null,
  collaboratingTerminalId: null,
};

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

  describe('durable origin association (terminalOrigins)', () => {
    function withOrigins(
      base: SessionSelectorState,
      origins: Record<string, string>,
    ): SessionSelectorState {
      return { ...base, terminalOrigins: origins };
    }

    it('returns the focused terminal’s origin nodeId when no workflow step and no collaboration apply', () => {
      const state = withOrigins(emptyState, { 'terminal-1': 'node-origin' });
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-origin');
    });

    it('returns the origin nodeId after a workflow step has finished (idle scenario the bug reproduces — entry gone from map)', () => {
      const state = withOrigins(
        { ...emptyState, workflowExecutionStates: {} },
        { 'terminal-1': 'node-origin' },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-origin');
    });

    it('prefers a running workflow step on the focused terminal over the terminal’s origin', () => {
      const state = withOrigins(
        {
          ...emptyState,
          workflowExecutionStates: {
            'node-current': { state: 'running', terminalTabId: 'terminal-1' },
          },
        },
        { 'terminal-1': 'node-origin' },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-current');
    });

    it('prefers an awaiting-validation workflow step on the focused terminal over the terminal’s origin', () => {
      const state = withOrigins(
        {
          ...emptyState,
          workflowExecutionStates: {
            'node-current': { state: 'awaiting-validation', terminalTabId: 'terminal-1' },
          },
        },
        { 'terminal-1': 'node-origin' },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-current');
    });

    it('prefers an active terminal collaboration on the focused terminal over the terminal’s origin', () => {
      const state = withOrigins(
        {
          ...emptyState,
          collaboratingNodeId: 'node-collab',
          collaborationSource: 'terminal',
          collaboratingTerminalId: 'terminal-1',
        },
        { 'terminal-1': 'node-origin' },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-collab');
    });

    it('does not leak another terminal’s origin onto the focused terminal', () => {
      const state = withOrigins(emptyState, {
        'terminal-1': 'node-A',
        'terminal-2': 'node-B',
      });
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-A');
      expect(selectActiveSessionNodeId(state, 'terminal-2')).toBe('node-B');
    });

    it('returns null when the focused terminal has no origin entry', () => {
      const state = withOrigins(emptyState, { 'other-terminal': 'node-X' });
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });

    it('returns null when activeTerminalId is null even if origins are populated', () => {
      const state = withOrigins(emptyState, { 'terminal-1': 'node-origin' });
      expect(selectActiveSessionNodeId(state, null)).toBeNull();
    });

    it('still returns the focused terminal’s origin when the origin node has a running step on a different terminal', () => {
      const state = withOrigins(
        {
          ...emptyState,
          workflowExecutionStates: {
            'node-origin': { state: 'running', terminalTabId: 'terminal-2' },
          },
        },
        { 'terminal-1': 'node-origin' },
      );
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBe('node-origin');
    });

    it('is idempotent — repeated calls return the same value with no observable side-effects', () => {
      const state = withOrigins(emptyState, { 'terminal-1': 'node-origin' });
      const first = selectActiveSessionNodeId(state, 'terminal-1');
      const second = selectActiveSessionNodeId(state, 'terminal-1');
      const third = selectActiveSessionNodeId(state, 'terminal-1');
      expect(first).toBe('node-origin');
      expect(second).toBe('node-origin');
      expect(third).toBe('node-origin');
    });

    it('treats a missing terminalOrigins record as no origin (back-compat with existing callers)', () => {
      expect(selectActiveSessionNodeId(emptyState, 'terminal-1')).toBeNull();
    });

    it('returns null for an empty terminalOrigins object', () => {
      const state = withOrigins(emptyState, {});
      expect(selectActiveSessionNodeId(state, 'terminal-1')).toBeNull();
    });
  });
});
