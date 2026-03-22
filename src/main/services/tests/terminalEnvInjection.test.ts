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

// Import after mocks are set up
import { TerminalManager } from '../terminalManager';

describe('Terminal environment variable injection', () => {
  const mockPtyProcess = {
    onData: vi.fn(() => ({ dispose: vi.fn() })),
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };

  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpawn.mockReturnValue(mockPtyProcess);
    TerminalManager.destroyAll();

    // Isolate from host environment
    for (const key of ['ARBORESCENT_HOOK_PORT', 'ARBORESCENT_AUTH_TOKEN', 'ARBORESCENT_TERMINAL_ID']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('should merge extraEnv vars into spawned process environment', () => {
    TerminalManager.create('term-1', 'Test Terminal', undefined, undefined, undefined, {
      ARBORESCENT_HOOK_PORT: '17832',
      ARBORESCENT_AUTH_TOKEN: 'token-abc',
      ARBORESCENT_TERMINAL_ID: 'term-1',
    });

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const spawnArgs = mockSpawn.mock.calls[0];
    const envArg = spawnArgs[2].env;

    expect(envArg.ARBORESCENT_HOOK_PORT).toBe('17832');
    expect(envArg.ARBORESCENT_AUTH_TOKEN).toBe('token-abc');
    expect(envArg.ARBORESCENT_TERMINAL_ID).toBe('term-1');
  });

  it('should preserve existing process.env keys alongside extraEnv', () => {
    // process.env.PATH should still be present
    TerminalManager.create('term-2', 'Test Terminal', undefined, undefined, undefined, {
      ARBORESCENT_HOOK_PORT: '17832',
    });

    const spawnArgs = mockSpawn.mock.calls[0];
    const envArg = spawnArgs[2].env;

    expect(envArg.ARBORESCENT_HOOK_PORT).toBe('17832');
    // PATH (or Path on Windows) should be inherited from process.env
    const hasPath = 'PATH' in envArg || 'Path' in envArg;
    expect(hasPath).toBe(true);
  });

  it('should work without extraEnv (backwards compatible)', () => {
    TerminalManager.create('term-3', 'Test Terminal');

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const spawnArgs = mockSpawn.mock.calls[0];
    const envArg = spawnArgs[2].env;

    // Should just have process.env (no ARBORESCENT_ keys)
    expect(envArg.ARBORESCENT_HOOK_PORT).toBeUndefined();
    expect(envArg.ARBORESCENT_AUTH_TOKEN).toBeUndefined();
    expect(envArg.ARBORESCENT_TERMINAL_ID).toBeUndefined();
  });

  it('should include all three ARBORESCENT_* vars when passed', () => {
    const extraEnv = {
      ARBORESCENT_HOOK_PORT: '8080',
      ARBORESCENT_AUTH_TOKEN: 'my-secret-token',
      ARBORESCENT_TERMINAL_ID: 'terminal-99',
    };

    TerminalManager.create('term-4', 'Test Terminal', undefined, undefined, undefined, extraEnv);

    const spawnArgs = mockSpawn.mock.calls[0];
    const envArg = spawnArgs[2].env;

    expect(envArg.ARBORESCENT_HOOK_PORT).toBe('8080');
    expect(envArg.ARBORESCENT_AUTH_TOKEN).toBe('my-secret-token');
    expect(envArg.ARBORESCENT_TERMINAL_ID).toBe('terminal-99');
  });

  it('should allow extraEnv to be an empty object', () => {
    TerminalManager.create('term-5', 'Test Terminal', undefined, undefined, undefined, {});

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const spawnArgs = mockSpawn.mock.calls[0];
    const envArg = spawnArgs[2].env;

    // Should behave like no extraEnv
    expect(envArg.ARBORESCENT_HOOK_PORT).toBeUndefined();
  });
});
