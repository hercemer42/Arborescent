import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { TerminalContainer } from '../TerminalContainer';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { RefObject } from 'react';

// Mock the terminal store
vi.mock('../../../store/terminal/terminalStore');

// Mock TerminalPanel
vi.mock('../TerminalPanel', () => ({
  TerminalPanel: () => <div data-testid="terminal-panel">TerminalPanel</div>,
}));

// Mock hooks
vi.mock('../hooks/useTerminalResize', () => ({
  useTerminalResize: () => ({
    terminalHeight: 300,
    terminalWidth: 400,
    isResizing: false,
    handleMouseDown: vi.fn(),
  }),
}));

vi.mock('../hooks/useTerminalKeyboardShortcut', () => ({
  useTerminalKeyboardShortcut: vi.fn(),
}));

describe('TerminalContainer', () => {
  let mockContentRef: RefObject<HTMLDivElement>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContentRef = {
      current: document.createElement('div'),
    };
  });

  it('should render terminal panel when visible', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: true,
        panelPosition: 'bottom',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { getByTestId } = render(<TerminalContainer contentRef={mockContentRef} />);

    expect(getByTestId('terminal-panel')).toBeInTheDocument();
  });

  it('should hide terminal when not visible', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: false,
        panelPosition: 'bottom',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { container } = render(<TerminalContainer contentRef={mockContentRef} />);
    const terminalContainer = container.querySelector('.terminal-container');

    expect(terminalContainer).toHaveStyle({ display: 'none' });
  });

  it('should render with bottom panel position', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: true,
        panelPosition: 'bottom',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { container } = render(<TerminalContainer contentRef={mockContentRef} />);
    const resizeHandle = container.querySelector('.resize-handle');

    expect(resizeHandle).toHaveClass('vertical');
  });

  it('should render with side panel position', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: true,
        panelPosition: 'side',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { container } = render(<TerminalContainer contentRef={mockContentRef} />);
    const resizeHandle = container.querySelector('.resize-handle');

    expect(resizeHandle).toHaveClass('horizontal');
  });

  it('should apply correct styles for bottom panel', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: true,
        panelPosition: 'bottom',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { container } = render(<TerminalContainer contentRef={mockContentRef} />);
    const terminalContainer = container.querySelector('.terminal-container');

    expect(terminalContainer).toHaveStyle({ height: '300px' });
  });

  it('should apply correct styles for side panel', () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: true,
        panelPosition: 'side',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { container } = render(<TerminalContainer contentRef={mockContentRef} />);
    const terminalContainer = container.querySelector('.terminal-container');

    expect(terminalContainer).toHaveStyle({ width: '400px' });
  });

  it('should call useTerminalKeyboardShortcut hook', async () => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) =>
      selector({
        isTerminalVisible: true,
        panelPosition: 'bottom',
        toggleTerminalVisibility: vi.fn(),
      })
    );

    const { useTerminalKeyboardShortcut } = await import('../hooks/useTerminalKeyboardShortcut');

    render(<TerminalContainer contentRef={mockContentRef} />);

    expect(useTerminalKeyboardShortcut).toHaveBeenCalled();
  });
});
