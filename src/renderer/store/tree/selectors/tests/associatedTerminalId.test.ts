import { describe, it, expect } from 'vitest';
import {
  selectAssociatedTerminalId,
  type AssociatedTerminalSelectorState,
} from '../associatedTerminalId';

function withOrigins(origins: Record<string, string>): AssociatedTerminalSelectorState {
  return { terminalOrigins: origins };
}

describe('selectAssociatedTerminalId (inverse of selectActiveSessionNodeId)', () => {
  it('returns null when focusedNodeId is null', () => {
    const state = withOrigins({ 'terminal-1': 'node-A' });
    expect(selectAssociatedTerminalId(state, null)).toBeNull();
  });

  it('returns null when focusedNodeId is undefined', () => {
    const state = withOrigins({ 'terminal-1': 'node-A' });
    expect(selectAssociatedTerminalId(state, undefined)).toBeNull();
  });

  it('returns null when focusedNodeId is the empty string', () => {
    const state = withOrigins({ 'terminal-1': 'node-A' });
    expect(selectAssociatedTerminalId(state, '')).toBeNull();
  });

  it('returns null when terminalOrigins is missing on the state (back-compat)', () => {
    expect(selectAssociatedTerminalId({}, 'node-A')).toBeNull();
  });

  it('returns null when terminalOrigins is an empty record', () => {
    expect(selectAssociatedTerminalId(withOrigins({}), 'node-A')).toBeNull();
  });

  it('returns the terminalId whose originNodeId matches the focused node', () => {
    const state = withOrigins({ 'terminal-1': 'node-A' });
    expect(selectAssociatedTerminalId(state, 'node-A')).toBe('terminal-1');
  });

  it('returns null when no terminal has the focused node as its origin', () => {
    const state = withOrigins({ 'terminal-1': 'node-A', 'terminal-2': 'node-B' });
    expect(selectAssociatedTerminalId(state, 'node-Z')).toBeNull();
  });

  it('picks the right terminal among many — different nodes resolve to their own terminals', () => {
    const state = withOrigins({
      'terminal-1': 'node-A',
      'terminal-2': 'node-B',
      'terminal-3': 'node-C',
    });
    expect(selectAssociatedTerminalId(state, 'node-A')).toBe('terminal-1');
    expect(selectAssociatedTerminalId(state, 'node-B')).toBe('terminal-2');
    expect(selectAssociatedTerminalId(state, 'node-C')).toBe('terminal-3');
  });

  it('returns a deterministic terminalId when multiple terminals share an origin', () => {
    const state = withOrigins({
      'terminal-1': 'node-shared',
      'terminal-2': 'node-shared',
    });
    const a = selectAssociatedTerminalId(state, 'node-shared');
    const b = selectAssociatedTerminalId(state, 'node-shared');
    const c = selectAssociatedTerminalId(state, 'node-shared');
    expect(a).not.toBeNull();
    expect(a === 'terminal-1' || a === 'terminal-2').toBe(true);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('is a pure function — repeated calls return the same value with no observable side-effects', () => {
    const state = withOrigins({ 'terminal-1': 'node-A' });
    expect(selectAssociatedTerminalId(state, 'node-A')).toBe('terminal-1');
    expect(selectAssociatedTerminalId(state, 'node-A')).toBe('terminal-1');
    expect(selectAssociatedTerminalId(state, 'node-A')).toBe('terminal-1');
  });

  it('treats an empty-string origin as "no origin" (defensive — symmetric with origin-on-create)', () => {
    const state = withOrigins({ 'terminal-1': '' });
    expect(selectAssociatedTerminalId(state, '')).toBeNull();
  });

  it('does not match a focused node against an unrelated terminal whose origin happens to be undefined', () => {
    const state = withOrigins({ 'terminal-orphan': 'some-other-node' });
    expect(selectAssociatedTerminalId(state, undefined)).toBeNull();
  });
});
