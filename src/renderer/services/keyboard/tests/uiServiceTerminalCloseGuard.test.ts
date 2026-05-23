import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { usePendingTerminalCloseStore } from '../../../store/pendingTerminalCloseStore';
import { requestGuardedTerminalClose } from '../../terminalCloseService';

// The Cmd-W close shortcut in uiService.ts now routes through
// requestGuardedTerminalClose — the same chokepoint as the Tab × button. The
// keyboard event plumbing is covered by the uiService hotkey tests; here we
// exercise the chokepoint with realistic terminal store state to confirm the
// guarded path is what the shortcut ends up invoking.

vi.mock('../../../store/storeManager', () => ({
  storeManager: { getAllStores: () => [{ getState: () => ({ actions: { handleTerminalClosed: vi.fn() } }) }] },
}));

describe('uiService closeTab shortcut — terminal close guard', () => {
  beforeEach(() => {
    usePendingTerminalCloseStore.getState().clear();
    useTerminalStore.setState({
      terminals: [
        { id: 'term-1', title: 'Terminal 1', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true },
      ],
      activeTerminalId: 'term-1',
      currentFilePath: '/test/file.arbo',
      fileStates: {
        '/test/file.arbo': {
          terminals: [
            { id: 'term-1', title: 'Terminal 1', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true },
          ],
          activeTerminalId: 'term-1',
        },
      },
      terminalProcessing: {},
    });
    Object.assign(window.electron, { terminalDestroy: vi.fn().mockResolvedValue(undefined) });
  });

  it('when the active terminal is processing, the close path opens the confirmation dialog and does NOT close the terminal', async () => {
    useTerminalStore.getState().markTerminalProcessing('term-1', true);

    await requestGuardedTerminalClose('term-1');

    expect(usePendingTerminalCloseStore.getState().current?.terminalId).toBe('term-1');
    expect(useTerminalStore.getState().terminals.find((t) => t.id === 'term-1')).toBeTruthy();
  });

  it('when the active terminal is NOT processing, the close path closes immediately with no dialog', async () => {
    await requestGuardedTerminalClose('term-1');

    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
    expect(useTerminalStore.getState().terminals.find((t) => t.id === 'term-1')).toBeFalsy();
  });

  it('a second close request while one is already pending is dropped silently — the first remains authoritative', async () => {
    useTerminalStore.getState().markTerminalProcessing('term-1', true);
    await requestGuardedTerminalClose('term-1');
    const first = usePendingTerminalCloseStore.getState().current;

    await requestGuardedTerminalClose('term-1');

    expect(usePendingTerminalCloseStore.getState().current).toBe(first);
  });

  it.todo('confirming the dialog from the keyboard path runs the same close + handleTerminalClosed broadcast as the click path');
  it.todo('cancelling the dialog from the keyboard path leaves the active terminal open with no state change');
});
