import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Terminal } from '../Terminal';

// Mock the useTerminal hook
vi.mock('../hooks/useTerminal', () => ({
  useTerminal: vi.fn(() => ({
    terminalRef: { current: null },
    xtermRef: { current: null },
    fitAddonRef: { current: null },
  })),
}));

describe('Terminal', () => {
  it('should render terminal container', () => {
    const { container } = render(<Terminal id="test-terminal" />);
    const terminalDiv = container.querySelector('.terminal-container');
    expect(terminalDiv).toBeInTheDocument();
  });

  it('should call useTerminal hook with correct id', async () => {
    const { useTerminal } = await import('../hooks/useTerminal');

    render(<Terminal id="test-terminal-123" />);

    expect(useTerminal).toHaveBeenCalledWith({
      id: 'test-terminal-123',
      pinnedToBottom: true,
      onResize: undefined,
    });
  });

  it('should pass onResize callback to useTerminal', async () => {
    const { useTerminal } = await import('../hooks/useTerminal');
    const mockOnResize = vi.fn();

    render(<Terminal id="test-terminal" onResize={mockOnResize} />);

    expect(useTerminal).toHaveBeenCalledWith({
      id: 'test-terminal',
      pinnedToBottom: true,
      onResize: mockOnResize,
    });
  });
});
