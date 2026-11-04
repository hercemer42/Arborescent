import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('node-pty', () => ({ spawn: mockSpawn }));
vi.mock('../logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { TerminalManager } from '../terminalManager';

describe('TerminalManager.shellInFront', () => {
  const ptyIn = (front: string) => ({
    pid: 12345,
    process: front,
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  });

  beforeEach(() => {
    TerminalManager.destroyAll();
  });

  it('is true when the terminal is back at its own shell, login dash or not', () => {
    mockSpawn.mockReturnValueOnce(ptyIn('zsh')).mockReturnValueOnce(ptyIn('-zsh'));
    TerminalManager.create('term-1', 'Test', '/bin/zsh', ['-l']);
    TerminalManager.create('term-2', 'Test', '/bin/zsh', ['-l']);

    expect(TerminalManager.shellInFront('term-1')).toBe(true);
    expect(TerminalManager.shellInFront('term-2')).toBe(true);
  });

  it('is false when something runs in front of the shell, or the terminal is unknown', () => {
    mockSpawn.mockReturnValueOnce(ptyIn('claude'));
    TerminalManager.create('term-1', 'Test', '/bin/zsh', ['-l']);

    expect(TerminalManager.shellInFront('term-1')).toBe(false);
    expect(TerminalManager.shellInFront('unknown')).toBe(false);
  });
});
