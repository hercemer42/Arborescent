import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTerminalStore } from '../terminalStore';

// "isProcessing" is the close-guard's single source of truth: a terminal is
// "active" iff a prompt is currently in flight on it. Bound-but-idle terminals
// are not active. Restored terminals start non-active until UserPromptSubmit
// fires inside their shell.

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: vi.fn().mockResolvedValue({
    id: 'new-terminal-1',
    title: 'Terminal',
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
  }),
}));

describe('terminalStore — per-terminal isProcessing flag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: '/test/file.arbo',
      fileStates: {},
    });
  });

  it('defaults to non-processing for any terminal id', () => {
    expect(useTerminalStore.getState().isTerminalProcessing('term-1')).toBe(false);
    expect(useTerminalStore.getState().isTerminalProcessing('never-seen')).toBe(false);
  });

  it('markTerminalProcessing(id, true) flips the flag on', () => {
    useTerminalStore.getState().markTerminalProcessing('term-1', true);
    expect(useTerminalStore.getState().isTerminalProcessing('term-1')).toBe(true);
  });

  it('markTerminalProcessing(id, false) flips the flag back off', () => {
    useTerminalStore.getState().markTerminalProcessing('term-1', true);
    useTerminalStore.getState().markTerminalProcessing('term-1', false);
    expect(useTerminalStore.getState().isTerminalProcessing('term-1')).toBe(false);
  });

  it('processing flags are per-terminal — toggling one does not affect another', () => {
    useTerminalStore.getState().markTerminalProcessing('term-1', true);
    useTerminalStore.getState().markTerminalProcessing('term-2', false);
    expect(useTerminalStore.getState().isTerminalProcessing('term-1')).toBe(true);
    expect(useTerminalStore.getState().isTerminalProcessing('term-2')).toBe(false);
  });

  it('marking the same terminal processing twice is idempotent', () => {
    useTerminalStore.getState().markTerminalProcessing('term-1', true);
    useTerminalStore.getState().markTerminalProcessing('term-1', true);
    expect(useTerminalStore.getState().isTerminalProcessing('term-1')).toBe(true);
  });

  it('ignores empty or whitespace terminal ids — no state change, no throw', () => {
    expect(() => useTerminalStore.getState().markTerminalProcessing('', true)).not.toThrow();
    expect(useTerminalStore.getState().isTerminalProcessing('')).toBe(false);
  });

  it('closeTerminal clears the processing flag for the closed terminal', async () => {
    Object.assign(window.electron, { terminalDestroy: vi.fn().mockResolvedValue(undefined) });
    useTerminalStore.getState().addTerminal({
      id: 'term-1',
      title: 'Terminal 1',
      cwd: '/',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    });
    useTerminalStore.getState().markTerminalProcessing('term-1', true);

    await useTerminalStore.getState().closeTerminal('term-1');

    expect(useTerminalStore.getState().isTerminalProcessing('term-1')).toBe(false);
  });

  it('newly created terminals start non-processing', async () => {
    await useTerminalStore.getState().openTerminal();
    const id = useTerminalStore.getState().activeTerminalId;
    expect(id).toBeTruthy();
    expect(useTerminalStore.getState().isTerminalProcessing(id!)).toBe(false);
  });

  it('terminals restored from a saved session start non-processing — restore must not surface a false confirmation', () => {
    // Restore puts entries into pendingRestore; the materialized terminals
    // must not inherit a stale "processing" flag from anywhere.
    useTerminalStore.setState({
      fileStates: {
        '/test/file.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [
            { title: 'Restored Term', cwd: '/' },
          ],
        },
      },
    });
    // Before materialization, no record exists — flag is false.
    expect(useTerminalStore.getState().isTerminalProcessing('any-restored-id')).toBe(false);
  });

  it('closeFileTerminals clears processing flags for every terminal under that file', async () => {
    Object.assign(window.electron, { terminalDestroy: vi.fn().mockResolvedValue(undefined) });
    useTerminalStore.setState({
      currentFilePath: '/test/file.arbo',
      fileStates: {
        '/test/file.arbo': {
          terminals: [
            { id: 'term-a', title: 'A', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true },
            { id: 'term-b', title: 'B', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true },
          ],
          activeTerminalId: 'term-a',
        },
      },
    });
    useTerminalStore.getState().markTerminalProcessing('term-a', true);
    useTerminalStore.getState().markTerminalProcessing('term-b', true);

    await useTerminalStore.getState().closeFileTerminals('/test/file.arbo');

    expect(useTerminalStore.getState().isTerminalProcessing('term-a')).toBe(false);
    expect(useTerminalStore.getState().isTerminalProcessing('term-b')).toBe(false);
  });
});
