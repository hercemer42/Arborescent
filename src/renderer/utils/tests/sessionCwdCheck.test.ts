import { describe, it, expect } from 'vitest';
import { assertCwdMatch } from '../sessionCwdCheck';

describe('assertCwdMatch — match', () => {
  it('returns "match" when registry cwd equals terminalCwd', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, '/Users/me/proj')).toBe('match');
  });

  it('treats trailing-slash difference as mismatch (full-path equality)', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, '/Users/me/proj/')).toBe('mismatch');
  });
});

describe('assertCwdMatch — mismatch (path differs)', () => {
  it('returns "mismatch" when registry cwd is a different path', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, '/Users/me/other')).toBe('mismatch');
  });

  it('returns "mismatch" when registry cwd is a parent of terminalCwd', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, '/Users/me/proj/sub')).toBe('mismatch');
  });

  it('returns "mismatch" when registry cwd is a child of terminalCwd', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj/sub' } };
    expect(assertCwdMatch('sess-1', registry, '/Users/me/proj')).toBe('mismatch');
  });
});

describe('assertCwdMatch — mismatch (terminalCwd empty/null)', () => {
  it('returns "mismatch" when terminalCwd is null', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, null)).toBe('mismatch');
  });

  it('returns "mismatch" when terminalCwd is undefined', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, undefined)).toBe('mismatch');
  });

  it('returns "mismatch" when terminalCwd is an empty string', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    expect(assertCwdMatch('sess-1', registry, '')).toBe('mismatch');
  });

  it('returns "mismatch" even when registry cwd is also empty — never match on empty', () => {
    const registry = { 'sess-1': { cwd: '' } };
    expect(assertCwdMatch('sess-1', registry, '')).toBe('mismatch');
  });
});

describe('assertCwdMatch — sessionId not in registry', () => {
  it.todo('returns "mismatch" when sessionId is set but absent from registry (defensive — block rather than silently proceed)');
});

describe('assertCwdMatch — purity', () => {
  it('does not mutate the registry argument', () => {
    const registry = { 'sess-1': { cwd: '/Users/me/proj' } };
    const snapshot = JSON.stringify(registry);
    assertCwdMatch('sess-1', registry, '/Users/me/other');
    expect(JSON.stringify(registry)).toBe(snapshot);
  });
});
