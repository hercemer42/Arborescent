import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPanel } from '../TerminalPanel';
import { useTerminalStore } from '../../../store/terminal/terminalStore';

vi.mock('../../../store/terminal/terminalStore');

vi.mock('../../../store/panel/panelStore', () => ({
  usePanelStore: vi.fn((selector: (state: { panelPosition: string; togglePanelPosition: () => void }) => unknown) => {
    const state = {
      panelPosition: 'bottom',
      togglePanelPosition: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../Terminal', () => ({
  Terminal: ({ id }: { id: string }) => <div data-testid={`terminal-${id}`}>Terminal {id}</div>,
}));

vi.mock('../../Tab', () => ({
  Tab: ({
    displayName,
    onClick,
    onClose,
    isActive,
  }: {
    displayName: string;
    onClick: () => void;
    onClose: () => void;
    isActive: boolean;
  }) => (
    <div data-testid={`tab-${displayName}`} className={isActive ? 'active' : ''}>
      <button onClick={onClick}>Tab: {displayName}</button>
      <button onClick={onClose} data-testid={`close-${displayName}`}>
        Close
      </button>
    </div>
  ),
}));

vi.mock('../hooks/useTerminalPanel', () => ({
  useTerminalPanel: () => ({
    handleNewTerminal: vi.fn(),
    handleCloseTerminal: vi.fn(),
  }),
}));

function makeTerminals(...ids: string[]) {
  return ids.map((id, i) => ({
    id,
    title: `Terminal ${i + 1}`,
    cwd: '/home',
    shellCommand: 'bash',
    shellArgs: [] as string[],
    pinnedToBottom: true,
  }));
}

describe('TerminalPanel — tab switching visibility', () => {
  let mockSetActiveTerminal: ReturnType<typeof vi.fn>;
  let mockTogglePinnedToBottom: ReturnType<typeof vi.fn>;

  function setupStore(
    terminals: ReturnType<typeof makeTerminals>,
    activeId: string | null
  ) {
    mockSetActiveTerminal = vi.fn();
    mockTogglePinnedToBottom = vi.fn();
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals,
      activeTerminalId: activeId,
      setActiveTerminal: mockSetActiveTerminal,
      togglePinnedToBottom: mockTogglePinnedToBottom,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetActiveTerminal = vi.fn();
    mockTogglePinnedToBottom = vi.fn();
  });

  describe('display:block / display:none visibility control', () => {
    it('gives exactly one terminal wrapper display:block (the active one)', () => {
      const terminals = makeTerminals('t1', 't2', 't3');
      setupStore(terminals, 't1');
      const { container } = render(<TerminalPanel />);
      const visible = container.querySelectorAll('[style*="display: block"]');
      expect(visible).toHaveLength(1);
    });

    it('gives all inactive terminal wrappers display:none', () => {
      const terminals = makeTerminals('t1', 't2', 't3');
      setupStore(terminals, 't1');
      const { container } = render(<TerminalPanel />);
      const hidden = container.querySelectorAll('[style*="display: none"]');
      expect(hidden).toHaveLength(2);
    });

    it('keeps all Terminal components mounted regardless of which tab is active', () => {
      const terminals = makeTerminals('t1', 't2', 't3');
      setupStore(terminals, 't1');
      render(<TerminalPanel />);
      expect(screen.getByTestId('terminal-t1')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-t2')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-t3')).toBeInTheDocument();
    });

    it('renders no terminal wrappers when the terminal list is empty', () => {
      setupStore([], null);
      const { container } = render(<TerminalPanel />);
      expect(container.querySelectorAll('.terminal-wrapper')).toHaveLength(0);
    });

    it('displays the sole terminal when only one exists (no inactive wrappers)', () => {
      const terminals = makeTerminals('t1');
      setupStore(terminals, 't1');
      const { container } = render(<TerminalPanel />);
      expect(container.querySelector('[style*="display: block"]')).toBeInTheDocument();
      expect(container.querySelector('[style*="display: none"]')).not.toBeInTheDocument();
    });

    it('correctly identifies which wrapper corresponds to the active terminal id', () => {
      const terminals = makeTerminals('t1', 't2', 't3');
      setupStore(terminals, 't2');
      const { container } = render(<TerminalPanel />);
      const wrappers = container.querySelectorAll('.terminal-wrapper');
      // t2 is the second terminal, so index 1 should be block
      expect(wrappers[0]).toHaveStyle({ display: 'none' });
      expect(wrappers[1]).toHaveStyle({ display: 'block' });
      expect(wrappers[2]).toHaveStyle({ display: 'none' });
    });
  });

  describe('clicking a tab invokes setActiveTerminal with the correct id', () => {
    it('clicking an inactive tab calls setActiveTerminal with that tab id', () => {
      const terminals = makeTerminals('t1', 't2');
      setupStore(terminals, 't1');
      render(<TerminalPanel />);
      fireEvent.click(screen.getByText('Tab: Terminal 2'));
      expect(mockSetActiveTerminal).toHaveBeenCalledWith('t2');
    });

    it('clicking the currently active tab still calls setActiveTerminal', () => {
      const terminals = makeTerminals('t1', 't2');
      setupStore(terminals, 't1');
      render(<TerminalPanel />);
      fireEvent.click(screen.getByText('Tab: Terminal 1'));
      expect(mockSetActiveTerminal).toHaveBeenCalledWith('t1');
    });

    it('clicking through all tabs in sequence calls setActiveTerminal once per click in order', () => {
      const terminals = makeTerminals('t1', 't2', 't3', 't4');
      setupStore(terminals, 't1');
      render(<TerminalPanel />);
      fireEvent.click(screen.getByText('Tab: Terminal 2'));
      fireEvent.click(screen.getByText('Tab: Terminal 3'));
      fireEvent.click(screen.getByText('Tab: Terminal 4'));
      fireEvent.click(screen.getByText('Tab: Terminal 1'));
      expect(mockSetActiveTerminal).toHaveBeenCalledTimes(4);
      expect(mockSetActiveTerminal).toHaveBeenNthCalledWith(1, 't2');
      expect(mockSetActiveTerminal).toHaveBeenNthCalledWith(2, 't3');
      expect(mockSetActiveTerminal).toHaveBeenNthCalledWith(3, 't4');
      expect(mockSetActiveTerminal).toHaveBeenNthCalledWith(4, 't1');
    });

    it('rapid repeated clicks on the same tab call setActiveTerminal each time', () => {
      const terminals = makeTerminals('t1', 't2');
      setupStore(terminals, 't1');
      render(<TerminalPanel />);
      fireEvent.click(screen.getByText('Tab: Terminal 2'));
      fireEvent.click(screen.getByText('Tab: Terminal 2'));
      fireEvent.click(screen.getByText('Tab: Terminal 2'));
      expect(mockSetActiveTerminal).toHaveBeenCalledTimes(3);
      expect(mockSetActiveTerminal).toHaveBeenCalledWith('t2');
    });
  });

  describe('UI updates when the active terminal changes', () => {
    it('the newly active terminal wrapper shows display:block after a tab switch', () => {
      const terminals = makeTerminals('t1', 't2');

      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals,
        activeTerminalId: 't1',
        setActiveTerminal: mockSetActiveTerminal,
        togglePinnedToBottom: mockTogglePinnedToBottom,
      });
      const { container, rerender } = render(<TerminalPanel />);

      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals,
        activeTerminalId: 't2',
        setActiveTerminal: mockSetActiveTerminal,
        togglePinnedToBottom: mockTogglePinnedToBottom,
      });
      rerender(<TerminalPanel />);

      const wrappers = container.querySelectorAll('.terminal-wrapper');
      expect(wrappers[1]).toHaveStyle({ display: 'block' });
    });

    it('the previously active terminal wrapper shows display:none after a tab switch', () => {
      const terminals = makeTerminals('t1', 't2');

      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals,
        activeTerminalId: 't1',
        setActiveTerminal: mockSetActiveTerminal,
        togglePinnedToBottom: mockTogglePinnedToBottom,
      });
      const { container, rerender } = render(<TerminalPanel />);

      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals,
        activeTerminalId: 't2',
        setActiveTerminal: mockSetActiveTerminal,
        togglePinnedToBottom: mockTogglePinnedToBottom,
      });
      rerender(<TerminalPanel />);

      const wrappers = container.querySelectorAll('.terminal-wrapper');
      expect(wrappers[0]).toHaveStyle({ display: 'none' });
    });

    it('exactly one wrapper has display:block regardless of which terminal is active', () => {
      const terminals = makeTerminals('t1', 't2', 't3');
      for (const activeId of ['t1', 't2', 't3']) {
        (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
          terminals,
          activeTerminalId: activeId,
          setActiveTerminal: mockSetActiveTerminal,
          togglePinnedToBottom: mockTogglePinnedToBottom,
        });
        const { container, unmount } = render(<TerminalPanel />);
        const visible = container.querySelectorAll('[style*="display: block"]');
        expect(visible).toHaveLength(1);
        unmount();
      }
    });

    it('restores the correct terminal visibility when switching files and back', () => {
      // Simulates returning to a file where t2 was the last active terminal
      const terminals = makeTerminals('t1', 't2');
      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals,
        activeTerminalId: 't2',
        setActiveTerminal: mockSetActiveTerminal,
        togglePinnedToBottom: mockTogglePinnedToBottom,
      });
      const { container } = render(<TerminalPanel />);
      const wrappers = container.querySelectorAll('.terminal-wrapper');
      expect(wrappers[0]).toHaveStyle({ display: 'none' });
      expect(wrappers[1]).toHaveStyle({ display: 'block' });
    });

    it('rapid cycling through all tabs in sequence updates display correctly each time', () => {
      const terminals = makeTerminals('t1', 't2', 't3');

      // Cycle through all active states and verify each produces one visible terminal
      for (const activeId of ['t1', 't2', 't3', 't2', 't1', 't3']) {
        (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
          terminals,
          activeTerminalId: activeId,
          setActiveTerminal: mockSetActiveTerminal,
          togglePinnedToBottom: mockTogglePinnedToBottom,
        });
        const { container, unmount } = render(<TerminalPanel />);
        const visible = container.querySelectorAll('[style*="display: block"]');
        expect(visible).toHaveLength(1);
        unmount();
      }
    });
  });

});
