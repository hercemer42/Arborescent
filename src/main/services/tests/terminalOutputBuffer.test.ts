import { describe, it, expect, beforeEach } from 'vitest';
import { TerminalOutputBuffer } from '../terminalOutputBuffer';

describe('TerminalOutputBuffer — offset tracking', () => {
  let buffer: TerminalOutputBuffer;

  beforeEach(() => {
    buffer = new TerminalOutputBuffer();
  });

  it('append returns the cumulative end offset for the terminal', () => {
    expect(buffer.append('t', 'abc')).toBe(3);
    expect(buffer.append('t', 'de')).toBe(5);
  });

  it('tracks offsets independently per terminal id', () => {
    buffer.append('a', 'aaa');
    buffer.append('b', 'bb');
    expect(buffer.read('a')).toEqual({ data: 'aaa', endOffset: 3 });
    expect(buffer.read('b')).toEqual({ data: 'bb', endOffset: 2 });
  });

  it('keeps the end offset monotonic even after old output is trimmed', () => {
    const bounded = new TerminalOutputBuffer(10);
    bounded.append('t', 'aaaaaa');
    expect(bounded.append('t', 'bbbbbb')).toBe(12);
    expect(bounded.read('t').endOffset).toBe(12);
  });
});

describe('TerminalOutputBuffer — read', () => {
  it('returns the retained data plus the end offset', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('t', 'hello ');
    buffer.append('t', 'world');
    expect(buffer.read('t')).toEqual({ data: 'hello world', endOffset: 11 });
  });

  it('returns empty data and offset 0 for an unknown terminal', () => {
    expect(new TerminalOutputBuffer().read('missing')).toEqual({ data: '', endOffset: 0 });
  });
});

describe('TerminalOutputBuffer — byte-safe trimming', () => {
  it('drops whole oldest chunks past the bound rather than slicing a byte tail', () => {
    const buffer = new TerminalOutputBuffer(10);
    buffer.append('t', 'aaaaaa');
    buffer.append('t', 'bbbbbb');
    expect(buffer.read('t').data).toBe('bbbbbb');
  });

  it('never splits an escape sequence held in a single chunk when trimming', () => {
    const buffer = new TerminalOutputBuffer(8);
    buffer.append('t', 'filler__');
    buffer.append('t', '\x1b[31mX');
    expect(buffer.read('t').data).toBe('\x1b[31mX');
  });

  it('retains a single chunk larger than the bound in full', () => {
    const buffer = new TerminalOutputBuffer(10);
    buffer.append('t', 'aaaaaa');
    const big = 'x'.repeat(50);
    expect(buffer.append('t', big)).toBe(56);
    expect(buffer.read('t')).toEqual({ data: big, endOffset: 56 });
  });
});

describe('TerminalOutputBuffer — recentTail', () => {
  it('returns a bounded recent tail of the output', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('t', 'hello world');
    expect(buffer.recentTail('t', 5)).toBe('world');
  });

  it('returns the whole retained output when it is under the requested max', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('t', 'hi');
    expect(buffer.recentTail('t', 100)).toBe('hi');
  });

  it('returns empty string for an unknown terminal', () => {
    expect(new TerminalOutputBuffer().recentTail('missing')).toBe('');
  });
});

describe('TerminalOutputBuffer — clear', () => {
  it('forgets a terminal so a reused id starts fresh at offset 0', () => {
    const buffer = new TerminalOutputBuffer();
    buffer.append('t', 'abc');
    buffer.clear('t');
    expect(buffer.read('t')).toEqual({ data: '', endOffset: 0 });
    expect(buffer.append('t', 'x')).toBe(1);
  });
});
