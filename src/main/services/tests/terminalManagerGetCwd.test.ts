import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockSpawn = vi.hoisted(() => vi.fn());

vi.mock('node-pty', () => ({
  spawn: mockSpawn,
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { TerminalManager } from '../terminalManager';
import type { ProcessCwdReader } from '../processCwd';

describe('TerminalManager.getCwd', () => {
  const mockPtyProcess = {
    pid: 12345,
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };

  let readerMock: ProcessCwdReader;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(mockPtyProcess);
    TerminalManager.destroyAll();
    readerMock = { read: vi.fn() };
    TerminalManager.setCwdReader(readerMock);
  });

  it('should return null for unknown terminal id', async () => {
    const cwd = await TerminalManager.getCwd('unknown');
    expect(cwd).toBeNull();
  });

  it('should return the live cwd from the reader when available', async () => {
    TerminalManager.create('term-1', 'Test', undefined, undefined, '/initial');
    (readerMock.read as ReturnType<typeof vi.fn>).mockResolvedValue('/new/live/cwd');

    const cwd = await TerminalManager.getCwd('term-1');

    expect(cwd).toBe('/new/live/cwd');
    expect(readerMock.read).toHaveBeenCalledWith(12345);
  });

  it('should update the stored cwd when a fresh live cwd is returned', async () => {
    TerminalManager.create('term-1', 'Test', undefined, undefined, '/initial');
    (readerMock.read as ReturnType<typeof vi.fn>).mockResolvedValue('/updated');

    await TerminalManager.getCwd('term-1');
    const terminal = TerminalManager.get('term-1');

    expect(terminal?.cwd).toBe('/updated');
  });

  it('should fall back to the stored cwd when the reader returns null', async () => {
    TerminalManager.create('term-1', 'Test', undefined, undefined, '/initial');
    (readerMock.read as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const cwd = await TerminalManager.getCwd('term-1');

    expect(cwd).toBe('/initial');
  });

  it('should fall back to the stored cwd when the pty has no pid', async () => {
    mockSpawn.mockImplementation(() => ({
      ...mockPtyProcess,
      pid: undefined,
    }));
    TerminalManager.create('term-noPid', 'Test', undefined, undefined, '/initial');

    const cwd = await TerminalManager.getCwd('term-noPid');

    expect(cwd).toBe('/initial');
    expect(readerMock.read).not.toHaveBeenCalled();
  });
});
