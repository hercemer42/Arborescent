import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestGuardedTerminalClose } from '../terminalCloseService';
import { useTerminalStore } from '../../store/terminal/terminalStore';
import { usePendingTerminalCloseStore } from '../../store/pendingTerminalCloseStore';
import { storeManager } from '../../store/storeManager';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

interface MockTerminalState {
  isTerminalProcessing: (id: string) => boolean;
  closeTerminal: (id: string) => Promise<void>;
  terminals: Array<{ id: string; title: string; originNodeId?: string }>;
  fileStates: Record<string, { terminals: Array<{ id: string; title: string; originNodeId?: string }> }>;
}

function installTerminalStoreState(state: Partial<MockTerminalState>): {
  closeTerminal: ReturnType<typeof vi.fn>;
  isTerminalProcessing: ReturnType<typeof vi.fn>;
} {
  const closeTerminal = vi.fn().mockResolvedValue(undefined);
  const isTerminalProcessing = vi.fn().mockImplementation((id: string) =>
    state.isTerminalProcessing ? state.isTerminalProcessing(id) : false,
  );
  const merged: MockTerminalState = {
    isTerminalProcessing,
    closeTerminal,
    terminals: state.terminals ?? [],
    fileStates: state.fileStates ?? {},
  };
  vi.spyOn(useTerminalStore, 'getState').mockReturnValue(
    merged as unknown as ReturnType<typeof useTerminalStore.getState>,
  );
  return { closeTerminal, isTerminalProcessing };
}

function installEmptyTreeStores(): void {
  const handleTerminalClosed = vi.fn();
  const fakeStore = {
    getState: () => ({ actions: { handleTerminalClosed } }),
  };
  vi.spyOn(storeManager, 'getAllStores').mockReturnValue(
    [fakeStore] as unknown as ReturnType<typeof storeManager.getAllStores>,
  );
}

describe('terminalCloseService.requestGuardedTerminalClose', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    usePendingTerminalCloseStore.setState({ current: null });
  });

  it('returns immediately for an empty id without disposing or showing the dialog', async () => {
    const { closeTerminal, isTerminalProcessing } = installTerminalStoreState({});
    installEmptyTreeStores();

    await requestGuardedTerminalClose('');

    expect(isTerminalProcessing).not.toHaveBeenCalled();
    expect(closeTerminal).not.toHaveBeenCalled();
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('disposes the terminal directly when no prompt is processing', async () => {
    const { closeTerminal } = installTerminalStoreState({
      isTerminalProcessing: () => false,
      terminals: [{ id: 'term-1', title: 'Terminal 1' }],
    });
    installEmptyTreeStores();

    await requestGuardedTerminalClose('term-1');

    expect(closeTerminal).toHaveBeenCalledWith('term-1');
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('shows the confirmation dialog when a prompt is actively processing', async () => {
    const { closeTerminal } = installTerminalStoreState({
      isTerminalProcessing: (id) => id === 'term-1',
      terminals: [{ id: 'term-1', title: 'Build Terminal' }],
    });
    installEmptyTreeStores();

    await requestGuardedTerminalClose('term-1');

    expect(closeTerminal).not.toHaveBeenCalled();
    const pending = usePendingTerminalCloseStore.getState().current;
    expect(pending?.terminalId).toBe('term-1');
    expect(pending?.terminalTitle).toBe('Build Terminal');
  });

  it('drops a second close request when a confirmation is already pending for another terminal', async () => {
    installTerminalStoreState({
      isTerminalProcessing: () => true,
      terminals: [
        { id: 'term-1', title: 'Term 1' },
        { id: 'term-2', title: 'Term 2' },
      ],
    });
    installEmptyTreeStores();

    await requestGuardedTerminalClose('term-1');
    await requestGuardedTerminalClose('term-2');

    expect(usePendingTerminalCloseStore.getState().current?.terminalId).toBe('term-1');
  });

  it('finds the terminal title from fileStates when the terminal is not in the top-level terminals list', async () => {
    installTerminalStoreState({
      isTerminalProcessing: () => true,
      terminals: [],
      fileStates: {
        '/tmp/a.arbo': { terminals: [{ id: 'term-1', title: 'Inside File' }] },
      },
    });
    installEmptyTreeStores();

    await requestGuardedTerminalClose('term-1');

    expect(usePendingTerminalCloseStore.getState().current?.terminalTitle).toBe('Inside File');
  });

  it('falls back to the literal title "Terminal" when no matching terminal record exists', async () => {
    installTerminalStoreState({
      isTerminalProcessing: () => true,
      terminals: [],
      fileStates: {},
    });
    installEmptyTreeStores();

    await requestGuardedTerminalClose('term-1');

    expect(usePendingTerminalCloseStore.getState().current?.terminalTitle).toBe('Terminal');
  });
});
