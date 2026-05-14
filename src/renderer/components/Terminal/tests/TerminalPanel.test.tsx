import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPanel } from '../TerminalPanel';
import { useTerminalStore } from '../../../store/terminal/terminalStore';

// Mock the terminal store
vi.mock('../../../store/terminal/terminalStore');

const { mockTreeState } = vi.hoisted(() => ({
  mockTreeState: { activeNodeId: null as string | null },
}));

vi.mock('../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn((selector) => {
    const state = { activeFilePath: '/current.arbo' };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: () => ({
      subscribe: () => () => {},
      getState: () => mockTreeState,
    }),
  },
}));

// Mock the panel store
const mockTogglePanelPosition = vi.fn();
vi.mock('../../../store/panel/panelStore', () => ({
  usePanelStore: vi.fn((selector) => {
    const state = {
      panelPosition: 'bottom',
      togglePanelPosition: mockTogglePanelPosition,
    };
    return selector ? selector(state) : state;
  }),
}));

import { usePanelStore } from '../../../store/panel/panelStore';

// Mock the Terminal component
vi.mock('../Terminal', () => ({
  Terminal: ({ id }: { id: string }) => <div data-testid={`terminal-${id}`}>Terminal {id}</div>,
}));

// Mock the Tab component
vi.mock('../../Tab', () => ({
  Tab: ({ displayName, onClick, onClose, isActive, isAssociated }: {
    displayName: string;
    onClick: () => void;
    onClose: () => void;
    isActive: boolean;
    isAssociated?: boolean;
  }) => (
    <div
      data-testid={`tab-${displayName}`}
      className={isActive ? 'active' : ''}
      data-associated={isAssociated ? 'true' : 'false'}
    >
      <button onClick={onClick}>Tab: {displayName}</button>
      <button onClick={onClose} data-testid={`close-${displayName}`}>Close</button>
    </div>
  ),
}));

// Mock useTerminalPanel hook
vi.mock('../hooks/useTerminalPanel', () => ({
  useTerminalPanel: () => ({
    handleNewTerminal: vi.fn(),
    handleCloseTerminal: vi.fn(),
  }),
}));

describe('TerminalPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTreeState.activeNodeId = null;
  });

  it('should render empty state when no terminals', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: [],
      activeTerminalId: null,
      setActiveTerminal: vi.fn(),
      fileStates: {},
    });

    render(<TerminalPanel />);

    // Should show the new terminal button
    expect(screen.getByTitle('New Terminal')).toBeInTheDocument();
  });

  it('should render terminals when they exist', () => {
    const mockTerminals = [
      { id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
      { id: 'term-2', title: 'Terminal 2', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
    ];

    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      setActiveTerminal: vi.fn(),
      fileStates: { '/current.arbo': { terminals: mockTerminals, activeTerminalId: 'term-1' } },
    });

    render(<TerminalPanel />);

    expect(screen.getByTestId('tab-Terminal 1')).toBeInTheDocument();
    expect(screen.getByTestId('tab-Terminal 2')).toBeInTheDocument();
  });

  it('should display active terminal', () => {
    const mockTerminals = [
      { id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
      { id: 'term-2', title: 'Terminal 2', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
    ];

    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      setActiveTerminal: vi.fn(),
      fileStates: { '/current.arbo': { terminals: mockTerminals, activeTerminalId: 'term-1' } },
    });

    const { container } = render(<TerminalPanel />);

    // Active terminal should be displayed
    const term1Wrapper = container.querySelector('[style*="display: block"]');
    expect(term1Wrapper).toBeInTheDocument();
  });

  it('should call setActiveTerminal when tab is clicked', () => {
    const mockSetActiveTerminal = vi.fn();
    const mockTerminals = [
      { id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
      { id: 'term-2', title: 'Terminal 2', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
    ];

    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      setActiveTerminal: mockSetActiveTerminal,
      fileStates: { '/current.arbo': { terminals: mockTerminals, activeTerminalId: 'term-1' } },
    });

    render(<TerminalPanel />);

    const tab2 = screen.getByText('Tab: Terminal 2');
    fireEvent.click(tab2);

    expect(mockSetActiveTerminal).toHaveBeenCalledWith('term-2');
  });

  it('should call togglePanelPosition when toggle button is clicked', () => {
    const mockTerminals = [
      { id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
    ];

    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      setActiveTerminal: vi.fn(),
      fileStates: { '/current.arbo': { terminals: mockTerminals, activeTerminalId: 'term-1' } },
    });

    render(<TerminalPanel />);

    const toggleButton = screen.getByTitle(/Switch to/);
    fireEvent.click(toggleButton);

    expect(mockTogglePanelPosition).toHaveBeenCalled();
  });

  it('should show correct toggle button icon for bottom panel', () => {
    const mockTerminals = [{ id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] }];
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      setActiveTerminal: vi.fn(),
      fileStates: { '/current.arbo': { terminals: mockTerminals, activeTerminalId: 'term-1' } },
    });

    // Default mock already has panelPosition: 'bottom'
    render(<TerminalPanel />);

    expect(screen.getByText('➡')).toBeInTheDocument();
    expect(screen.getByTitle('Switch to side panel')).toBeInTheDocument();
  });

  it('should show correct toggle button icon for side panel', () => {
    const mockTerminals = [{ id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] }];
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      setActiveTerminal: vi.fn(),
      fileStates: { '/current.arbo': { terminals: mockTerminals, activeTerminalId: 'term-1' } },
    });

    // Override panel position to side
    (usePanelStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector: (state: Record<string, unknown>) => unknown) => {
      const state = {
        panelPosition: 'side',
        togglePanelPosition: mockTogglePanelPosition,
      };
      return selector ? selector(state) : state;
    });

    render(<TerminalPanel />);

    expect(screen.getByText('⬇')).toBeInTheDocument();
    expect(screen.getByTitle('Switch to bottom panel')).toBeInTheDocument();
  });

  describe('associated tab wiring (focused node → matching terminal)', () => {
    function setupTerminals(terminals: { id: string; title: string; originNodeId?: string }[], activeTerminalId: string | null) {
      const full = terminals.map((t) => ({
        ...t,
        cwd: '/home',
        shellCommand: 'bash',
        shellArgs: [] as string[],
        pinnedToBottom: true,
      }));
      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals: full,
        activeTerminalId,
        setActiveTerminal: vi.fn(),
        togglePinnedToBottom: vi.fn(),
        fileStates: { '/current.arbo': { terminals: full, activeTerminalId } },
      });
    }

    it('marks the terminal whose originNodeId matches the focused node as associated', () => {
      mockTreeState.activeNodeId = 'node-A';
      setupTerminals(
        [
          { id: 'term-1', title: 'Terminal 1', originNodeId: 'node-A' },
          { id: 'term-2', title: 'Terminal 2', originNodeId: 'node-B' },
        ],
        'term-2',
      );

      render(<TerminalPanel />);

      expect(screen.getByTestId('tab-Terminal 1')).toHaveAttribute('data-associated', 'true');
      expect(screen.getByTestId('tab-Terminal 2')).toHaveAttribute('data-associated', 'false');
    });

    it('marks no tab as associated when no node is focused', () => {
      mockTreeState.activeNodeId = null;
      setupTerminals(
        [
          { id: 'term-1', title: 'Terminal 1', originNodeId: 'node-A' },
          { id: 'term-2', title: 'Terminal 2', originNodeId: 'node-B' },
        ],
        'term-1',
      );

      render(<TerminalPanel />);

      expect(screen.getByTestId('tab-Terminal 1')).toHaveAttribute('data-associated', 'false');
      expect(screen.getByTestId('tab-Terminal 2')).toHaveAttribute('data-associated', 'false');
    });

    it('marks no tab as associated when the focused node has no bound terminal', () => {
      mockTreeState.activeNodeId = 'node-orphan';
      setupTerminals(
        [
          { id: 'term-1', title: 'Terminal 1', originNodeId: 'node-A' },
          { id: 'term-2', title: 'Terminal 2', originNodeId: 'node-B' },
        ],
        'term-1',
      );

      render(<TerminalPanel />);

      expect(screen.getByTestId('tab-Terminal 1')).toHaveAttribute('data-associated', 'false');
      expect(screen.getByTestId('tab-Terminal 2')).toHaveAttribute('data-associated', 'false');
    });

    it('marks no tab as associated when terminals have no originNodeId at all', () => {
      mockTreeState.activeNodeId = 'node-A';
      setupTerminals(
        [
          { id: 'term-1', title: 'Terminal 1' },
          { id: 'term-2', title: 'Terminal 2' },
        ],
        'term-1',
      );

      render(<TerminalPanel />);

      expect(screen.getByTestId('tab-Terminal 1')).toHaveAttribute('data-associated', 'false');
      expect(screen.getByTestId('tab-Terminal 2')).toHaveAttribute('data-associated', 'false');
    });
  });
});
