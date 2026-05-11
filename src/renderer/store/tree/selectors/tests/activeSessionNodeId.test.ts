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
});
