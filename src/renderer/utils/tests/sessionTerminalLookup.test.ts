import { describe, it, expect } from 'vitest';

import { findSessionIdForTerminal } from '../sessionTerminalLookup';

describe('findSessionIdForTerminal', () => {
  it('returns the sessionId bound to the terminal', () => {
    expect(findSessionIdForTerminal({ 'sess-1': 'term-1', 'sess-2': 'term-2' }, 'term-2')).toBe('sess-2');
  });

  it('returns undefined when no session is bound to the terminal', () => {
    expect(findSessionIdForTerminal({ 'sess-1': 'term-1' }, 'term-9')).toBeUndefined();
  });

  it('returns undefined for an empty map', () => {
    expect(findSessionIdForTerminal({}, 'term-1')).toBeUndefined();
  });
});
