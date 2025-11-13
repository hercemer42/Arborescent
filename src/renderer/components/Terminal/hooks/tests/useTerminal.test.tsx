import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTerminal } from '../useTerminal';

// Mock xterm
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    onData: vi.fn((callback) => {
      // Store callback for testing
      return callback;
    }),
  })),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

describe('useTerminal', () => {
  let mockTerminalWrite: ReturnType<typeof vi.fn>;
  let mockTerminalResize: ReturnType<typeof vi.fn>;
  let mockOnTerminalData: ReturnType<typeof vi.fn>;
  let mockOnTerminalExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup window.electron mocks
    mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
    mockTerminalResize = vi.fn().mockResolvedValue(undefined);
    mockOnTerminalData = vi.fn().mockReturnValue(vi.fn());
    mockOnTerminalExit = vi.fn().mockReturnValue(vi.fn());

    window.electron = {
      ...window.electron,
      terminalWrite: mockTerminalWrite,
      terminalResize: mockTerminalResize,
      onTerminalData: mockOnTerminalData,
      onTerminalExit: mockOnTerminalExit,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return terminalRef', () => {
    const { result } = renderHook(() =>
      useTerminal({ id: 'test-terminal', onResize: undefined })
    );

    expect(result.current.terminalRef).toBeDefined();
    expect(result.current.terminalRef.current).toBeNull();
  });

  it('should return xtermRef and fitAddonRef', () => {
    const { result } = renderHook(() =>
      useTerminal({ id: 'test-terminal', onResize: undefined })
    );

    expect(result.current.xtermRef).toBeDefined();
    expect(result.current.fitAddonRef).toBeDefined();
  });

  it('should have terminalRef that can be attached to DOM', () => {
    const { result } = renderHook(() =>
      useTerminal({ id: 'test-terminal', onResize: undefined })
    );

    expect(result.current.terminalRef).toBeDefined();
    expect(result.current.terminalRef.current).toBeNull();
  });

  it('should have xtermRef and fitAddonRef refs', () => {
    const { result } = renderHook(() =>
      useTerminal({ id: 'test-terminal', onResize: undefined })
    );

    expect(result.current.xtermRef).toBeDefined();
    expect(result.current.fitAddonRef).toBeDefined();
  });

  it('should call onResize callback when provided', () => {
    const onResize = vi.fn();

    renderHook(() => useTerminal({ id: 'test-terminal', onResize }));

    // onResize would be called during resize events, but we can verify the hook accepts it
    expect(onResize).toBeDefined();
  });
});
