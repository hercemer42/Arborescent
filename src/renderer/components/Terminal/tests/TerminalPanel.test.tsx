import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TerminalPanel } from '../TerminalPanel';
import { useTerminalStore } from '../../../store/terminal/terminalStore';

// Mock the terminal store
vi.mock('../../../store/terminal/terminalStore');

// Mock the Terminal component
vi.mock('../Terminal', () => ({
  Terminal: ({ id }: { id: string }) => <div data-testid={`terminal-${id}`}>Terminal {id}</div>,
}));

// Mock the Tab component
vi.mock('../../Tab', () => ({
  Tab: ({ displayName, onClick, onClose, isActive }: {
    displayName: string;
    onClick: () => void;
    onClose: () => void;
    isActive: boolean;
  }) => (
    <div data-testid={`tab-${displayName}`} className={isActive ? 'active' : ''}>
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
  });

  it('should render empty state when no terminals', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: [],
      activeTerminalId: null,
      panelPosition: 'bottom',
      setActiveTerminal: vi.fn(),
      togglePanelPosition: vi.fn(),
    });

    render(<TerminalPanel />);

    expect(screen.getByText('+ New Terminal')).toBeInTheDocument();
  });

  it('should render terminals when they exist', () => {
    const mockTerminals = [
      { id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
      { id: 'term-2', title: 'Terminal 2', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
    ];

    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      panelPosition: 'bottom',
      setActiveTerminal: vi.fn(),
      togglePanelPosition: vi.fn(),
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
      panelPosition: 'bottom',
      setActiveTerminal: vi.fn(),
      togglePanelPosition: vi.fn(),
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
      panelPosition: 'bottom',
      setActiveTerminal: mockSetActiveTerminal,
      togglePanelPosition: vi.fn(),
    });

    render(<TerminalPanel />);

    const tab2 = screen.getByText('Tab: Terminal 2');
    fireEvent.click(tab2);

    expect(mockSetActiveTerminal).toHaveBeenCalledWith('term-2');
  });

  it('should call togglePanelPosition when toggle button is clicked', () => {
    const mockTogglePanelPosition = vi.fn();
    const mockTerminals = [
      { id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] },
    ];

    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      panelPosition: 'bottom',
      setActiveTerminal: vi.fn(),
      togglePanelPosition: mockTogglePanelPosition,
    });

    render(<TerminalPanel />);

    const toggleButton = screen.getByTitle(/Switch to/);
    fireEvent.click(toggleButton);

    expect(mockTogglePanelPosition).toHaveBeenCalled();
  });

  it('should show correct toggle button icon for bottom panel', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: [{ id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] }],
      activeTerminalId: 'term-1',
      panelPosition: 'bottom',
      setActiveTerminal: vi.fn(),
      togglePanelPosition: vi.fn(),
    });

    render(<TerminalPanel />);

    expect(screen.getByText('➡')).toBeInTheDocument();
    expect(screen.getByTitle('Switch to side panel')).toBeInTheDocument();
  });

  it('should show correct toggle button icon for side panel', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: [{ id: 'term-1', title: 'Terminal 1', cwd: '/home', shellCommand: 'bash', shellArgs: [] }],
      activeTerminalId: 'term-1',
      panelPosition: 'side',
      setActiveTerminal: vi.fn(),
      togglePanelPosition: vi.fn(),
    });

    render(<TerminalPanel />);

    expect(screen.getByText('⬇')).toBeInTheDocument();
    expect(screen.getByTitle('Switch to bottom panel')).toBeInTheDocument();
  });
});
